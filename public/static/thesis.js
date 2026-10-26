/* Rangeform historical thesis lab. Observed rule frequencies are NOT predictive win probabilities. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const pct=x=>Number.isFinite(x)?(x>=0?'+':'')+(x*100).toFixed(2)+'%':'—';
const money=x=>Number.isFinite(x)?'$'+x.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null,caseMode='bull',recentNews=[],busyNews=false;
function sampleOutcomes(bars){
 // Use ONLY prior close/bars to classify each completed event. Evaluate later close as historical holding-period outcome.
 // Non-overlapping 5-bar windows; no claim about trading fills, position sizing, costs, or out-of-sample accuracy.
 const horizon=5,run={bull:[],bear:[]};
 for(let i=52;i<bars.length-horizon;i++){
  const curr=bars[i],history=bars.slice(0,i),previous=history.slice(-20),price=Number(curr.close);
  const ma20=history.slice(-20).reduce((a,b)=>a+Number(b.close),0)/20;
  const max=Math.max(...previous.map(b=>Number(b.high??b.close)));
  const min=Math.min(...previous.map(b=>Number(b.low??b.close)));
  const type=price>max&&price>ma20?'bull':price<min&&price<ma20?'bear':null;
  if(!type)continue;
  const end=Number(bars[i+horizon].close),ret=end/price-1;
  if(!Number.isFinite(ret))continue;
  run[type].push(ret);i+=horizon;
 }
 return Object.fromEntries(Object.entries(run).map(([k,arr])=>[k,{count:arr.length,avg:arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null,positive:arr.filter(x=>x>0).length,negative:arr.filter(x=>x<0).length}]))
}
function kind(x){
 const s=Number(x.score)||50,volume=Number(x.indicators?.rel_volume),r=Number(x.indicators?.rsi14),m=Number(x.indicators?.momentum5_pct);
 const patternBull=(x.patterns||[]).filter(p=>p.type==='bullish'),patternBear=(x.patterns||[]).filter(p=>p.type==='bearish');
 return {score:s,bull:s>=65&&m>0,bear:s<=35&&m<0,volume:volume||0,rsi:r,momentum:m,patternBull,patternBear}
}
function formatEvidence(x,mode){
 const t=kind(x),p=x.indicators||{},score=t.score,bar=x.bar_history||[],refPrice=Number(x.last),atr=Number(p.atr14)||refPrice*.02;
 const points=[];
 const add=(check,label,explain)=>points.push({check,label,explain});
 if(mode==='bull'){
  add(refPrice>Number(p.sma20),'20-bar trend','Price '+(refPrice>Number(p.sma20)?'above':'below')+' the 20-period average.');
  add(t.momentum>0,'Recent momentum','Five-bar price movement '+(t.momentum>=0?'+':'')+t.momentum+'%.');
  add(t.volume>=1.3,'Volume confirmation','Relative volume '+(Number.isFinite(t.volume)?t.volume.toFixed(2):'—')+'×; stronger participation generally matters.');
  add(refPrice>Number(p.resistance20),'Range confirmation','Prior 20-bar high '+money(Number(p.resistance20))+'.');
  add(t.patternBull.length>0,'Pattern recognition',t.patternBull.length?t.patternBull.map(y=>y.name).join(', '):'No bullish chart pattern detected in last bar.');
 }else if(mode==='bear'){
  add(refPrice<Number(p.sma20),'20-bar trend','Price '+(refPrice<Number(p.sma20)?'below':'above')+' the 20-period average.');
  add(t.momentum<0,'Recent momentum','Five-bar price movement '+(t.momentum>=0?'+':'')+t.momentum+'%.');
  add(t.volume>=1.3,'Volume confirmation','Relative volume '+(Number.isFinite(t.volume)?t.volume.toFixed(2):'—')+'×.');
  add(refPrice<Number(p.support20),'Support breakdown','Prior 20-bar support '+money(Number(p.support20))+'.');
  add(t.patternBear.length>0,'Pattern recognition',t.patternBear.length?t.patternBear.map(y=>y.name).join(', '):'No bearish chart pattern detected in last bar.');
 }else{
  add(score>35&&score<65,'Conflicting factors','Alignment score '+score+'/100; neither side dominates enough for a strong technical thesis.');
  add(x.source==='archived-demo','Synthetic data','This analysis uses generated historical example bars, not a real equity price series.');
  add(x.source==='twelvedata'&&!fresh(x),'Stale data','The last completed bar is too old for intraday execution.');
  add(t.volume<1.3,'Weak participation','Relative volume '+(Number.isFinite(t.volume)?t.volume.toFixed(2):'—')+'×; a move may lack confirmation.');
  add(bar.length<100,'Small history','Too few bars for reliable historical comparison.');
  add(true,'Event and behavioral risk','Earnings, headline interpretation, crowded positioning, spreads, gaps, and overconfidence can overwhelm chart patterns.');
 }
 return {points,atr,t,refPrice}
}
function fresh(x){
 if(x.source!=='twelvedata'||x.interval==='1day')return false;
 const elapsed=Date.now()-Date.parse(x.last_bar_utc),min={'1min':60000,'5min':300000,'15min':900000}[x.interval];
 const local=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
 const z=Object.fromEntries(local.map(y=>[y.type,y.value]));let minutes=Number(z.hour)*60+Number(z.minute);
 return !['Sat','Sun'].includes(z.weekday)&&minutes>=570&&minutes<960&&Number.isFinite(min)&&elapsed>=0&&elapsed<=min*3+60000
}
function render(){
 const x=current;if(!x)return;
 const t=kind(x),hist=sampleOutcomes(x.bar_history||[]),series=hist[caseMode==='bear'?'bear':'bull'];
 const source=x.source==='archived-demo'?'HYPOTHETICAL DATA':x.source==='twelvedata'?'TWELVE DATA · '+(fresh(x)?'RECENT BAR':'STALE / CLOSED'):'IMPORTED BARS';
 $('thesisDataStatus').textContent=source;
 const signal=t.score>=65?'BULLISH BIAS':t.score<=35?'BEARISH BIAS':'MIXED / WAIT';
 const regime=x.source==='archived-demo'?'DEMO '+signal:!fresh(x)&&x.interval!=='1day'?'WAIT · '+signal:signal;
 const safeHist=series.count>=5;
 const risk=(Number(x.indicators?.atr14)||0),riskTxt=risk>0?money(risk)+' ATR':'ATR N/A';
 $('thesisMetrics').innerHTML=[
  ['TECHNICAL DIRECTION',regime],['MATCHED HISTORICAL EVENTS',caseMode==='wait'?'—':String(series.count)],['AVERAGE NEXT 5 BARS',caseMode==='wait'||!safeHist?'INSUFFICIENT SAMPLE':pct(series.avg)],['ATR / VOLATILITY REFERENCE',riskTxt]
 ].map(([name,val])=>'<div class="thesis-metric"><small>'+esc(name)+'</small><strong>'+esc(val)+'</strong></div>').join('');
 const {points,atr,refPrice}=formatEvidence(x,caseMode);
 const confirmed=points.filter(p=>p.check).length;
 const header=caseMode==='bull'?'What would support a bullish thesis?':caseMode==='bear'?'What would support a bearish thesis?':'Why might waiting be smarter?';
 $('thesisExplanation').innerHTML='<div class="thesis-verdict"><span class="thesis-mini">'+(caseMode==='wait'?'RISK FLAGS':confirmed+' OF '+points.length+' CONDITIONS')+'</span><h3>'+esc(header)+'</h3><p>'+esc(caseMode==='bull'?'A positive chart bias needs trend, momentum, range and participation to line up.':caseMode==='bear'?'A bearish case calls for genuine price weakness and clear invalidation—not an automatic short sale.':'Acting without reliable data or confirmation is itself a risk decision.')+'</p></div><div class="evidence-list">'+points.map(z=>'<div class="evidence-item"><span class="evidence-check '+(z.check?'yes':'no')+'">'+(z.check?'✓':'–')+'</span><div><strong>'+esc(z.label)+'</strong><p>'+esc(z.explain)+'</p></div></div>').join('')+'</div>';
 let histogram=$('thesisMetrics').querySelectorAll('.thesis-metric strong');
 if(histogram[2]&&caseMode!=='wait'&&safeHist){
  histogram[2].title='Exploratory, in-sample, non-overlapping '+series.count+' observations. Does not include commissions, spreads, slippage or regime changes.';
 }
 $('thesisDisclaimer').textContent=(x.source==='archived-demo'?'DEMO SERIES · ':'')+'The 5-bar outcomes use only '+series.count+' historical, non-overlapping breakout/breakdown examples from the available data. They are NOT calibrated win probabilities, prices you can trade, or investment recommendations. Last bar '+(x.last_bar_utc||'unknown')+'. Confirm new bar timing, liquidity, earnings and broker prices before making decisions.';
}
function newsRender(){
 const root=$('thesisNewsItems');if(!root)return;root.replaceChildren();
 if(!recentNews.length){let p=document.createElement('p');p.textContent='No recent articles verified for this ticker. That is not evidence of no catalyst. Review filings and the linked news sources.';root.append(p);return}
 for(const article of recentNews.slice(0,3)){let a=document.createElement('a');a.href=article.url;a.rel='noopener noreferrer';a.target='_blank';let b=document.createElement('strong');b.textContent=article.title;let date=document.createElement('small');date.textContent=(article.source||'Source')+' · '+new Date(article.date).toLocaleString(undefined,{month:'short',day:'numeric'});a.append(b,date);root.append(a)}
}
async function refreshNews(){
 if(!current||busyNews)return;
 busyNews=true;$('thesisNewsItems').textContent='Cross-checking public catalysts…';
 try{let r=await fetch('/api/news?q='+encodeURIComponent(current.symbol)+'&region=CA',{cache:'no-store'});let d=await r.json();if(!r.ok)throw Error('Feed unavailable');recentNews=d.items||[];newsRender()}
 catch{$('thesisNewsItems').replaceChildren();let link=document.createElement('a');link.href='https://www.tradingview.com/news/';link.rel='noopener noreferrer';link.target='_blank';link.textContent='Market headlines unavailable here. Review TradingView stories ↗';$('thesisNewsItems').append(link)}
 finally{busyNews=false}
}
function init(){
 $('thesisSwitch')?.querySelectorAll('[data-thesis]').forEach(btn=>btn.onclick=()=>{caseMode=btn.dataset.thesis;$('thesisSwitch').querySelectorAll('button').forEach(b=>b.classList.toggle('chosen',b===btn));render()});
 $('thesisNewsRefresh')?.addEventListener('click',refreshNews);
 $('thesisAskAI')?.addEventListener('click',()=>{if(current)window.rangeformExperience?.askChart?.(current)});

}
window.renderQuantThesis=x=>{current=x;render();refreshNews()};
document.addEventListener('DOMContentLoaded',init);
})();