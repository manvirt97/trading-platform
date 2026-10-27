/* Agent Room: 22 auditable, deterministic research specialists.
   Inspired by user-supplied TradeClimb: *not* 22 autonomous LLMs.
   Missing broker, calendar or exchange data means explicit abstention.
   Agents CANNOT override the existing ORB/freshness gates or place orders. */
const numeric=x=>typeof x==='number'&&Number.isFinite(x);
const round=(n,d=2)=>numeric(n)?Number(n.toFixed(d)):null;
const avg=x=>x.length?x.reduce((s,v)=>s+v,0)/x.length:NaN;
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const dt=t=>{const v=new Date(t);return numeric(+v)?v:null};
const ny=t=>{
 const d=dt(t);if(!d)return null;
 const bits=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}).formatToParts(d);
 const x=Object.fromEntries(bits.map(p=>[p.type,p.value]));
 return {day:x.year+'-'+x.month+'-'+x.day,minute:Number(x.hour)*60+Number(x.minute),weekday:x.weekday};
};
const ema=(v,p)=>{if(v.length<p)return null;let x=avg(v.slice(0,p));for(let i=p;i<v.length;i++)x=x*(1-2/(p+1))+v[i]*2/(p+1);return x};
function rsi(v,p=14){if(v.length<p+1)return null;let gain=0,loss=0;for(let i=v.length-p;i<v.length;i++){let d=v[i]-v[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}return loss===0?100:100-100/(1+gain/loss)}
const agent=(id,name,group,weight)=>({id,name,group,weight,vote:null,state:'unavailable',note:'Evidence unavailable',veto:null});
const vote=(a,v,n)=>{a.vote=clamp(Math.round(v),-100,100);a.state=a.vote>15?'bullish':a.vote< -15?'bearish':'neutral';a.note=n;return a};
const unavailable=(a,n)=>{a.state='unavailable';a.note=n;return a};
const gate=(a,ok,n,hard=false)=>{a.state=ok?'pass':'blocked';a.note=n;if(!ok&&hard)a.veto=n;return a};
function vwap(candles,day){const items=candles.filter(c=>ny(c.time)?.day===day&&ny(c.time)?.minute>=570&&ny(c.time)?.minute<960);const total=items.reduce((sum,c)=>sum+c.volume,0);if(!total)return null;return items.reduce((sum,c)=>sum+(c.high+c.low+c.close)/3*c.volume,0)/total}
export function runAgentRoom(analysis,opportunity,now=new Date()){
 const bars=(Array.isArray(analysis?.bar_history)?analysis.bar_history:[]).map(b=>({
  time:b.time||b.timestamp,open:Number(b.open),high:Number(b.high),low:Number(b.low),close:Number(b.close),volume:Number(b.volume)
 })).filter(b=>dt(b.time)&&[b.open,b.high,b.low,b.close,b.volume].every(numeric)&&b.low>0&&b.volume>=0&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close)).slice(-220);
 const interval=analysis?.interval||'',duration={'1min':60,'5min':300,'15min':900,'1day':86400}[interval]||null;
 const last=bars.at(-1),previous=bars.at(-2),close=last?.close;
 const p=bars.map(b=>b.close),vol=bars.map(b=>b.volume),atr=Number(analysis?.indicators?.atr14),score=Number(analysis?.score),up=opportunity?.status==='BUY_WATCH',down=opportunity?.status==='SELL_WATCH';
 const clock=ny(now),barclock=last&&ny(last.time);
 const history=bars.length>=55;
 const agents=[];
 // 10 risk/context specialists.
 let a=agent('integrity','Data Integrity','Safety',0);agents.push(gate(a,['twelvedata','finnhub-backup'].includes(analysis?.source)&&analysis?.data_quality==='complete-ohlcv'&&bars.length>=36&&numeric(close),'Only real, validated OHLCV bars may enter the supervisor.',true));
 a=agent('freshness','Completed Bar Freshness','Safety',0);
 const age=last?Math.round((+now-Date.parse(last.time))/1000):Infinity,validAge=numeric(duration)&&age>=duration&&age<=duration*3+180;
 agents.push(gate(a,validAge&&opportunity?.status!=='WAIT_STALE'&&opportunity?.status!=='NO_DATA','Latest completed bar age '+(Number.isFinite(age)?Math.round(age/60)+' minutes':'unknown')+'; current entry blocked if stale.',true));
 a=agent('session','Market Session','Safety',0);
 const regular=clock&&!['Sat','Sun'].includes(clock.weekday)&&clock.minute>=600&&clock.minute<950;
 agents.push(gate(a,Boolean(regular&&clock.day===barclock?.day&&interval!=='1day'),'Intraday setups only after 10:00 and before 15:50 ET, same regular session. Exchange holidays still require verification.',true));
 a=agent('liquidity','Liquidity Proxy','Safety',0);
 const sample=vol.slice(-21,-1).filter(n=>n>0),positiveVol=sample.length>=12&&last?.volume>0;
 agents.push(gate(a,positiveVol,'Candle volume '+(last?.volume??'unknown')+'; actual bid-ask depth and liquidity not measured.',true));
 a=agent('volatility','ATR & Volatility','Safety',0);
 const ratio=atr/close,goodATR=numeric(ratio)&&ratio>.0001&&ratio<.15;
 agents.push(gate(a,goodATR,'ATR is '+(numeric(ratio)?round(ratio*100,2)+'% of price':'unavailable')+'. Outlier or missing volatility blocks a new watch.',true));
 agents.push(unavailable(agent('crossquote','Second Provider Check','Verification',0),'No independent synchronized quote included. Check broker/exchange before trading.'));
 agents.push(unavailable(agent('spread','Spread & Fill Costs','Verification',0),'No authenticated bid/ask or slippage data; cannot validate executable prices.'));
 agents.push(unavailable(agent('earnings','Earnings Calendar','Verification',0),'No verified earnings event calendar for this analysis; check upcoming earnings.'));
 a=agent('payoff','Reward / Risk','Safety',0);
 const plan=opportunity?.plan,rr=plan?Math.abs(plan.illustrative_target_2r-plan.reference_entry)/Math.abs(plan.reference_entry-plan.invalidation):NaN;
 agents.push(plan&&numeric(rr)?gate(a,rr>=1.5,'Illustrative '+round(rr,2)+'R before trading fees, slippage and gaps.',true):unavailable(a,'No confirmed trade plan; no reward/risk can be validated.'));
 agents.push(unavailable(agent('edge','Out-of-Sample Validation','Verification',0),'Strategy win rate and expectancy are NOT validated out of sample. Backtest must be separate.'));
 // 12 analytical specialists. Unavailable specialists don't get votes.
 a=agent('trend','EMA 9 / 21 / 50','Trend',1.5);
 const e9=ema(p,9),e21=ema(p,21),e50=ema(p,50);
 agents.push(!history||![e9,e21,e50].every(numeric)?unavailable(a,'At least 55 validated bars are required.'):vote(a,close>e9&&e9>e21&&e21>e50?75:close<e9&&e9<e21&&e21<e50?-75:close>e21?25:-25,'EMA trend: 9 '+round(e9)+' / 21 '+round(e21)+' / 50 '+round(e50)));
 a=agent('vwap','Intraday VWAP','Trend',1);
 const vw=clock&&interval!=='1day'?vwap(bars,barclock?.day):null;
 agents.push(!numeric(vw)?unavailable(a,'Same-session volume-weighted average unavailable.'):vote(a,close>vw?45:-45,'Price '+(close>vw?'above':'below')+' session VWAP '+round(vw)));
 a=agent('structure','Swing Structure','Structure',1.0);
 const early=bars.slice(-24,-12),recent=bars.slice(-12);
 const high0=early.length?Math.max(...early.map(b=>b.high)):NaN,high1=recent.length?Math.max(...recent.map(b=>b.high)):NaN,low0=early.length?Math.min(...early.map(b=>b.low)):NaN,low1=recent.length?Math.min(...recent.map(b=>b.low)):NaN;
 agents.push(!numeric(high0)?unavailable(a,'Insufficient local swing candles.'):vote(a,high1>high0&&low1>low0?50:high1<high0&&low1<low0?-50:0,'Recent swing highs/lows versus the previous twelve bars.'));
 a=agent('rsi','RSI Momentum','Momentum',.7);const currentRSI=rsi(p);
 agents.push(!numeric(currentRSI)?unavailable(a,'Need 15 recent closes for RSI.'):vote(a,currentRSI>55&&currentRSI<75?40:currentRSI<45&&currentRSI>25?-40:0,'RSI '+round(currentRSI,1)+' (extremes treated as caution).'));
 a=agent('macd','MACD Momentum','Momentum',1);
 const macd=ema(p,12)-ema(p,26),priorMACD=ema(p.slice(0,-1),12)-ema(p.slice(0,-1),26);
 agents.push(!history||!numeric(macd)||!numeric(priorMACD)?unavailable(a,'Insufficient data for MACD trend proxy.'):vote(a,macd>0&&macd>priorMACD?50:macd<0&&macd<priorMACD?-50:0,'MACD line trend approximation; not an execution trigger.'));
 a=agent('momentum','Five-Bar Momentum','Momentum',.8);
 const move=p.length>6?100*(close/p.at(-6)-1):NaN;
 agents.push(!numeric(move)?unavailable(a,'Need six closes for five-bar momentum.'):vote(a,Math.abs(move)<.08?0:Math.sign(move)*Math.min(65,Math.abs(move)*35),'Five-bar change '+round(move,2)+'%'));
 a=agent('volume','Relative Volume','Participation',.7);
 const rel=Number(analysis?.indicators?.rel_volume);
 agents.push(!numeric(rel)||!positiveVol?unavailable(a,'Relative candle volume unavailable.'):vote(a,rel>=1.2?(close>previous?.close?50:-50):0,'Relative volume '+round(rel,2)+'×. Volume alone has no direction.'));
 a=agent('opening','Opening Range','Structure',1.4);
 const range=opportunity?.opening_range;
 agents.push(range?.state!=='ready'?unavailable(a,range?.note||'Valid current-session opening range unavailable.'):vote(a,close>range.high?80:close<range.low?-80:0,'9:30–10:00 ET high '+round(range.high)+' and low '+round(range.low)+'.'));
 a=agent('levels','Support / Resistance','Structure',.9);
 const hi=Number(analysis?.indicators?.resistance20),lo=Number(analysis?.indicators?.support20);
 agents.push(!numeric(hi)||!numeric(lo)?unavailable(a,'Historical support/resistance missing.'):vote(a,close>hi?55:close<lo?-55:0,'Previous 20-bar resistance '+round(hi)+'; support '+round(lo)+'.'));
 a=agent('candles','Candlestick Patterns','Patterns',.6);
 const patterns=analysis?.patterns||[],bull=patterns.filter(x=>x.type==='bullish').length,bear=patterns.filter(x=>x.type==='bearish').length;
 agents.push(!patterns.length?unavailable(a,'No supported candlestick pattern recognized.'):vote(a,bull&&!bear?35:bear&&!bull?-35:0,patterns.slice(0,3).map(x=>x.name).join(', ')+'. Patterns need confirmation.'));
 a=agent('extension','Price Extension','Risk & Pattern',.6);
 const distance=numeric(atr)&&numeric(e21)?(close-e21)/atr:NaN;
 agents.push(!numeric(distance)?unavailable(a,'Need ATR and EMA21 to measure extension.'):vote(a,Math.abs(distance)>2.5?-Math.sign(distance)*35:0,'Distance from EMA21: '+round(distance,2)+' ATR. Chasing large extensions is risky.'));
 a=agent('news','News & Catalysts','Context',.0);
 const count=opportunity?.news?.stories?.length||0;
 agents.push(unavailable(a,count+' dated publisher headlines; sentiment, earnings impact and market reaction not reliably verified.'));
 // Supervisor: same-direction votes require >=60% among actually evidenced specialists.
 const voters=agents.filter(x=>x.weight>0&&numeric(x.vote)&&Math.abs(x.vote)>=15);
 const weighted=agents.reduce((t,a)=>{if(a.weight&&numeric(a.vote)){t.total+=a.vote*a.weight;t.weight+=a.weight}return t},{total:0,weight:0});
 const consensus=weighted.weight?Math.round(weighted.total/weighted.weight):0;
 const direction=consensus>0?'bullish':consensus<0?'bearish':'mixed';
 const same=voters.filter(x=>consensus>0?x.vote>0:x.vote<0).length;
 const agreement=voters.length?round(100*same/voters.length,1):0;
 const vetoes=agents.filter(x=>x.veto).map(x=>({agent:x.name,reason:x.veto}));
 const eligible=voters.length>=5&&Math.abs(consensus)>=30&&agreement>=60&&!vetoes.length;
 const signal=eligible&&up&&consensus>0?'BUY_WATCH':eligible&&down&&consensus<0?'SELL_WATCH':'WAIT';
 return {
  specialist_count:22,available_votes:agents.filter(x=>numeric(x.vote)&&x.weight>0).length,
  abstentions:agents.filter(x=>x.state==='unavailable').length,
  score:consensus,agreement_pct:agreement,voting_specialists:voters.length,direction,
  verdict:signal,underlying_pattern:opportunity?.status||'NO_DATA',
  vetoes,agents,
  next_step:signal!=='WAIT'?'A research watch only. Independently verify broker quote, bid-ask, events and position risk before acting.':vetoes.length?'Safety veto: '+vetoes[0].reason:'Insufficient agreement or no fresh confirmed opening-range setup.',
  caveat:'22 deterministic specialist checks; not 22 independent AI models or a probability of profit.'
 };
}
