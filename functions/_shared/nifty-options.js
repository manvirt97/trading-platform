/* NIFTY 9/21 EMA options research. Deterministic and NO brokerage orders.
 * Requires actual 1-minute spot AND matching per-contract 1-minute option candles.
 * Times are exchange-local IST. Missing quotes/gaps fail closed: no invented fills.
 */
const tz = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const round=(n,p=2)=>Number.isFinite(n)?Number(n.toFixed(p)):null;
const modeIds=['itm5_buy','atm_buy','atm_sell'];
const names={itm5_buy:'Deep ITM buy (ITM 5)',atm_buy:'ATM buy',atm_sell:'ATM sell'};
const mOf=t=>{const p=t.split(':').map(Number);return p[0]*60+p[1]};
function clock(t){const parts=Object.fromEntries(tz.formatToParts(new Date(t)).map(x=>[x.type,x.value]));return {day:parts.year+'-'+parts.month+'-'+parts.day,minute:Number(parts.hour)*60+Number(parts.minute)}}
function validateBars(rows,label,limit=50000,strictOrder=true){
 if(!Array.isArray(rows)||rows.length<1||rows.length>limit)throw Error(label+' must contain 1–'+limit+' real OHLCV records.');
 let previous=-Infinity;
 return rows.map((row,i)=>{
  const timestamp=String(row.timestamp||'');const t=Date.parse(timestamp);
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(timestamp)||!Number.isFinite(t)||t>=Date.now()+60000||(strictOrder&&t<=previous))throw Error(label+' must be sorted, timezone-aware, unique and not in future (row '+(i+1)+').');
  previous=t;
  const values=['open','high','low','close','volume'].map(k=>Number(row[k]));
  if(values.some(x=>!Number.isFinite(x))||values.slice(0,4).some(x=>x<=0)||values[4]<0||values[1]<Math.max(values[0],values[3])||values[2]>Math.min(values[0],values[3]))throw Error(label+' contains invalid OHLCV at row '+(i+1)+'.');
  return {...row,t,...Object.fromEntries(['open','high','low','close','volume'].map((k,j)=>[k,values[j]]))};
 });
}
function resample(rows,minutes){
 const byDay=new Map();let rejected=0;
 for(const bar of rows){const c=clock(bar.t),minute=c.minute;
  if(minute<555||minute>=930)continue;
  if(!byDay.has(c.day))byDay.set(c.day,[]);
  byDay.get(c.day).push({bar,minute});
 }
 const all=[];
 for(const [day,list] of byDay){
  const map=new Map(list.map(x=>[x.minute,x.bar]));
  for(let start=555;start+minutes<=930;start+=minutes){
   const candles=Array.from({length:minutes},(_,k)=>map.get(start+k));
   if(candles.some(x=>!x)){rejected++;continue}
   const [first,last]=[candles[0],candles.at(-1)];
   all.push({day,start,end:start+minutes,time:first.timestamp,close_time:new Date(last.t+60000).toISOString(),
    open:first.open,high:Math.max(...candles.map(x=>x.high)),low:Math.min(...candles.map(x=>x.low)),
    close:last.close,volume:candles.reduce((s,x)=>s+x.volume,0)});
  }
 }
 return {bars:all,missing_buckets:rejected};
}
function emaSeries(bars,period){const result=Array(bars.length).fill(null);if(bars.length<period)return result;
 let avg=bars.slice(0,period).reduce((sum,x)=>sum+x.close,0)/period;result[period-1]=avg;
 for(let i=period;i<bars.length;i++){avg=bars[i].close*2/(period+1)+avg*(1-2/(period+1));result[i]=avg}return result;}
function optionIndex(rows){
 const map=new Map(),eligibleExpiries=new Set();
 let priorBySymbol=new Map();
 for(let i=0;i<rows.length;i++){
  const r=rows[i],symbol=String(r.symbol||''),expiry=String(r.expiry||''),strike=Number(r.strike),type=String(r.option_type||r.type||'').toUpperCase();
  if(!/^[A-Za-z0-9-]{8,80}$/.test(symbol)||!/^\d{4}-\d\d-\d\d$/.test(expiry)||!Number.isFinite(strike)||strike<=0||!['CE','PE'].includes(type))throw Error('Option candle '+(i+1)+' needs symbol, expiry YYYY-MM-DD, strike, option_type CE/PE.');
  if(expiry<clock(r.t).day)throw Error('Expired option candle at row '+(i+1));
  const key=expiry+'|'+strike+'|'+type+'|'+r.timestamp;
  if(map.has(key))throw Error('Duplicate option candle for '+key);
  map.set(key,{...r,symbol,expiry,strike,type});eligibleExpiries.add(expiry);
  const last=priorBySymbol.get(symbol);
  if(last!==undefined&&r.t<=last)throw Error('Option bars must be increasing within each symbol.');
  priorBySymbol.set(symbol,r.t);
 }
 return {map,expiries:[...eligibleExpiries].sort()};
}
const floorTick=x=>Math.max(.05,Math.floor((x+1e-9)/.05)*.05);
const ceilTick=x=>Math.max(.05,Math.ceil((x-1e-9)/.05)*.05);
function numeric(name,n,min,max){const v=Number(n);if(!Number.isFinite(v)||v<min||v>max)throw Error(name+' must be '+min+'–'+max);return v}
function charges(entryPx,exitPx,side,qty,when,rates){
 // One order buys and one order sells, regardless of the directional position.
 const buy=side==='BUY'?entryPx:exitPx,sell=side==='SELL'?entryPx:exitPx;
 const bought=buy*qty,sold=sell*qty,turnover=bought+sold;
 const brokerage=2*rates.brokerage_per_order;
 const stt=sold*(when<'2026-04-01'?rates.stt_before_2026_pct:rates.stt_after_2026_pct)/100;
 const exchange=turnover*rates.exchange_pct/100;
 const sebi=turnover*rates.sebi_pct/100;
 const stamp=bought*rates.stamp_pct/100;
 const ipft=turnover*rates.ipft_pct/100;
 const gst=(brokerage+exchange+sebi+ipft)*rates.gst_pct/100;
 const total=brokerage+stt+exchange+sebi+stamp+ipft+gst;
 return {brokerage:round(brokerage),stt:round(stt),exchange:round(exchange),sebi:round(sebi),
  stamp:round(stamp),ipft:round(ipft),gst:round(gst),total:round(total)};
}
export const DEFAULT_OPTION_COSTS=Object.freeze({
 brokerage_per_order:20,stt_before_2026_pct:.10,stt_after_2026_pct:.15,
 exchange_pct:.03503,sebi_pct:.0001,stamp_pct:.003,ipft_pct:.0005,gst_pct:18,
 slippage_pct:.5,slippage_points:0
});
function costRates(config={}){
 const result={};
 for(const [k,v] of Object.entries(DEFAULT_OPTION_COSTS))result[k]=numeric(k,config[k]??v,0,k==='brokerage_per_order'?500: k==='slippage_points'?100:25);
 return result;
}
function selectContract(mode,direction,spot,step,when,index){
 const atm=Math.floor(spot/step+.5-1e-9)*step; // exact midpoint chooses lower strike
 const type=mode==='atm_sell'?(direction==='BULLISH'?'PE':'CE'):(direction==='BULLISH'?'CE':'PE');
 const strike=mode==='itm5_buy'?(type==='CE'?atm-5*step:atm+5*step):atm;
 const expiry=index.expiries.find(e=>e>=when.day);
 return expiry?index.map.get(expiry+'|'+strike+'|'+type+'|'+when.timestamp)||null:null;
}
function summarize(trades){
 const wins=trades.filter(t=>t.net_pnl>0),losses=trades.filter(t=>t.net_pnl<0);
 const gain=wins.reduce((s,x)=>s+x.net_pnl,0),loss=-losses.reduce((s,x)=>s+x.net_pnl,0);
 let high=0,equity=0,worst=0;const curve=[];
 for(const tr of trades){equity+=tr.net_pnl;high=Math.max(high,equity);worst=Math.min(worst,equity-high);curve.push({time:tr.exit_time,equity:round(equity)})}
 return {trades:trades.length,wins:wins.length,losses:losses.length,win_rate_pct:trades.length?round(wins.length/trades.length*100):null,
 gross_pnl:round(trades.reduce((s,x)=>s+x.gross_pnl,0)),net_pnl:round(equity),
 profit_factor:loss>0?round(gain/loss,3):null,
 payoff_ratio:losses.length&&wins.length?round(gain/wins.length/(loss/losses.length),3):null,
 expectancy:trades.length?round(equity/trades.length):null,
 max_drawdown_closed_pnl:round(worst),equity_curve:curve};
}
export function runNiftyOptionBacktest(input){
 if(!input||typeof input!=='object')throw Error('Backtest request body required');
 const tf=numeric('timeframe',input.timeframe??15,5,30);
 if(![5,15,30].includes(tf))throw Error('Timeframe must be 5, 15 or 30 minutes.');
 const start=String(input.entry_from||'09:30'),cut=String(input.cutoff||'14:30');
 if(!['09:30','10:00','10:30'].includes(start))throw Error('Entry start must be 09:30, 10:00 or 10:30 IST.');
 if(!['11:30','12:00','12:30','13:00','13:30','14:00','14:30'].includes(cut)||mOf(start)>=mOf(cut))throw Error('Invalid entry cutoff.');
 const lot=numeric('Lot size',input.lot_size??65,1,2000);
 const lots=numeric('Lots',input.lots??1,1,100);
 if(!Number.isInteger(lot)||!Number.isInteger(lots))throw Error('Lot quantities must be whole numbers.');
 const strikeStep=numeric('Strike step',input.strike_step??50,10,1000);
 const rates=costRates(input.costs);
 const spot=validateBars(input.spot_bars,'NIFTY spot 1-minute candles',50000);
 const optionRows=validateBars(input.option_bars,'NIFTY option 1-minute candles',100000,false);
 if(spot.length<50)throw Error('At least 50 NIFTY spot one-minute bars are required.');
 const options=optionIndex(optionRows),spotByTime=new Map(spot.map(x=>[x.timestamp,x]));
 const sampled=resample(spot,tf),bars=sampled.bars;
 if(bars.length<23)throw Error('Need at least 23 fully observed resampled bars for 9/21 EMA crossovers. Load multiple sessions for 30-minute tests.');
 const fast=emaSeries(bars,9),slow=emaSeries(bars,21);
 let events=[],crossByDay=new Map();
 for(let i=22;i<bars.length;i++){
  if(![fast[i-1],fast[i],slow[i-1],slow[i]].every(Number.isFinite))continue;
  const up=fast[i-1]<=slow[i-1]&&fast[i]>slow[i],down=fast[i-1]>=slow[i-1]&&fast[i]<slow[i];
  if(!up&&!down)continue;
  const b=bars[i],minute=b.end;
  if(minute>900)continue; // No signals after the mandatory 15:00 IST square-off.
  const count=(crossByDay.get(b.day)||0)+1;crossByDay.set(b.day,count);
  events.push({at:b.close_time,day:b.day,minute,number:count,direction:up?'BULLISH':'BEARISH',spot_close:b.close});
 }
 const preparedCharts=new Map();
 const tradeChart=(trade)=>{
  if(!preparedCharts.has(trade.entry_time.slice(0,10))){
   const day=clock(Date.parse(trade.entry_time)).day;
   const dayBars=bars.map((b,i)=>({b,i})).filter(x=>x.b.day===day);
   preparedCharts.set(trade.entry_time.slice(0,10),dayBars.map(({b,i})=>({
    time:b.time,close_time:b.close_time,open:round(b.open),high:round(b.high),
    low:round(b.low),close:round(b.close),fast:round(fast[i]),slow:round(slow[i])
   })));
  }
  const series=preparedCharts.get(trade.entry_time.slice(0,10));
  return series.map(b=>({...b,
   entry_marker:b.close_time===trade.entry_time,
   exit_marker:b.close_time===trade.exit_time
  }));
 };
 const byMode={};const missingByMode={};
 for(const mode of modeIds){let active=null,completed=[],missing=0;
  const finish=(signalTime,reason,newSpot)=>{
   if(!active)return;
   const key=active.expiry+'|'+active.strike+'|'+active.type+'|'+signalTime;
   const exitOption=options.map.get(key),spotOpen=spotByTime.get(signalTime);
   if(!exitOption||!spotOpen){missing++;active=null;return}
   const exitRaw=exitOption.open,entryRaw=active.raw;
   const side=active.side;
   const entry=side==='BUY'?ceilTick(entryRaw*(1+rates.slippage_pct/100)+rates.slippage_points):floorTick(entryRaw*(1-rates.slippage_pct/100)-rates.slippage_points);
   const exit=side==='BUY'?floorTick(exitRaw*(1-rates.slippage_pct/100)-rates.slippage_points):ceilTick(exitRaw*(1+rates.slippage_pct/100)+rates.slippage_points);
   const qty=lot*lots,gross=(side==='BUY'?exitRaw-entryRaw:entryRaw-exitRaw)*qty;
   const afterSlippage=(side==='BUY'?exit-entry:entry-exit)*qty;
   const fees=charges(entry,exit,side,qty,active.day,rates);
   const net=afterSlippage-fees.total;
   completed.push({mode,mode_label:names[mode],symbol:active.symbol,expiry:active.expiry,
    dte:Math.max(0,Math.ceil((Date.parse(active.expiry+'T00:00:00Z')-Date.parse(active.day+'T00:00:00Z'))/86400000)),
    strike:active.strike,type:active.type,side,direction:active.direction,cross_number:active.cross_number,
    entry_time:active.time,exit_time:signalTime,entry_raw:round(entryRaw),exit_raw:round(exitRaw),
    entry_effective:round(entry),exit_effective:round(exit),spot_entry:round(active.spot_entry),
    spot_exit:round(spotOpen.open),qty,
    gross_pnl:round(gross),slippage_cost:round(gross-afterSlippage),
    costs:fees,friction:round(gross-net),net_pnl:round(net),exit_reason:reason,
    whipsaw:reason==='opposite_cross'&&Date.parse(signalTime)-Date.parse(active.time)<=30*60000});
   active=null;
  };
  const days=[...new Set(bars.map(x=>x.day))].sort();
  for(const day of days){
   const todays=events.filter(x=>x.day===day).sort((a,b)=>a.at.localeCompare(b.at));
   for(const event of todays){
    // Stop-entry gate: after cutoff, opposite signal still exits an open position.
    if(active&&event.direction!==active.direction)finish(event.at,'opposite_cross',event.spot_close);
    if(!active&&event.minute>=mOf(start)&&event.minute<=mOf(cut)&&event.minute<900){
     const option=selectContract(mode,event.direction,event.spot_close,strikeStep,
      {timestamp:event.at,day:event.day},options);
     const spotQuote=spotByTime.get(event.at);
     if(!option||!spotQuote){missing++;continue}
     active={time:event.at,day,direction:event.direction,mode,symbol:option.symbol,
      expiry:option.expiry,strike:option.strike,type:option.type,raw:option.open,
      side:mode==='atm_sell'?'SELL':'BUY',spot_entry:spotQuote.open,cross_number:event.number};
    }
   }
   if(active&&active.day===day){
    const endMinute=900;const bar=spot.find(x=>clock(x.t).day===day&&clock(x.t).minute===endMinute);
    if(bar)finish(bar.timestamp,'15:00_square_off',bar.open);
    else {missing++;active=null}
   }
  }
  // Explicit stop: no non-intraday overnight or unpriced positions.
  byMode[mode]={...summarize(completed),trades_detail:completed.slice(-500).map(t=>({...t,spot_chart:tradeChart(t)})),mode_label:names[mode]};
  missingByMode[mode]=missing;
 }
 return {
  source:'USER-SUPPLIED VERIFIED OHLCV',mode:'NIFTY_OPTIONS_RESEARCH_ONLY',broker_orders:false,
  range:{first:spot[0].timestamp,last:spot.at(-1).timestamp,minute_bars:spot.length,
   resampled_bars:bars.length,missing_resampled_buckets:sampled.missing_buckets,
   option_minute_bars:optionRows.length},
  settings:{timeframe:tf,entry_from:start,cutoff:cut,mandatory_square_off:'15:00',
   lot_size:lot,lots,strike_step:strikeStep,costs:rates,
   fee_basis:'2026 Groww published schedule; historical charges may differ'},
  events_count:events.length,events:events.slice(-200),comparisons:byMode,
  missing_quote_or_exit_counts:missingByMode,
  cautions:[
   'Gross returns use actual option minute OPEN quotes, never index-price proxies. Entry/exit fill prices are modeled, not broker-confirmed.',
   'Next one-minute OPEN is used at the moment the fully observed 5/15/30-minute spot signal candle closes.',
   'Missing option entry or exit candles suppress a trade; check skipped counts. No interpolation or guessed premiums.',
   'ATM SELL models an uncovered short PE for bullish or short CE for bearish signals. Real trading is DISABLED; margin/risk are NOT calculated.',
   'Daily option lot sizes and exchange tariff history must be verified before interpreting historical results. Supplied 65-unit lot is not automatically correct for earlier dates.',
   'Closed-trade drawdown is not intratrade mark-to-market drawdown.',
   '2026 Groww charge assumptions are applied to past dates as a what-if comparison; historical actual brokerage schedules may differ.',
   'Only sessions with at least the selected number of consecutive one-minute candles yield signals; no artificial market data.'
  ]
 };
}
