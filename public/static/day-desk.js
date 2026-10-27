import {positionPlan} from './daydesk-math.mjs';
// Rangeform V15: on-demand intraday research, not a broker or live streaming feed.
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
let requestSeq=0,last=null,lastRetry=0;
const symbolOK=s=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(s);
const fmt=(x,d=2)=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('en-CA',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const price=x=>typeof x==='number'&&Number.isFinite(x)?'$'+fmt(x,2):'—';
const et=s=>{const d=new Date(s);return Number.isFinite(+d)?d.toLocaleString('en-CA',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Unavailable'};
const text=(id,value)=>{if($(id))$(id).textContent=value};
const elt=(name,cls,value)=>{const e=document.createElement(name);if(cls)e.className=cls;if(value!=null)e.textContent=String(value);return e};
const svg=(name,attrs={})=>{const e=document.createElementNS(NS,name);for(const [key,val]of Object.entries(attrs))e.setAttribute(key,String(val));return e};
function status(state,message,checked='Not checked'){
 const el=$('day-status');el.dataset.dayStatus=state;
 text('day-verdict',state==='candidate'?'CONDITIONAL WATCH · VERIFY QUOTE':state==='ready'?'WAIT · NO QUALIFIED SETUP':
   state==='stale'?'WAIT · NOT CURRENT':state==='limited'?'PROVIDER QUOTA PAUSED':'NO SIGNAL · DATA REQUIRED');
 text('day-verdict-detail',message);text('day-checked',checked);
}
function emptyChart(message){
 const root=$('day-chart');root.replaceChildren();root.append(elt('div','daydesk-empty',message));
 root.setAttribute('aria-label',message);
}
function reset(message){
 last=null;$('day-use-levels').disabled=true;
 for(const id of ['day-close','day-vwap','day-range-high','day-range-low','day-relative-volume','day-age','day-entry','day-stop','day-target','day-pattern'])text(id,'—');
 text('day-bar-time','No completed candle');
 text('day-plan-message','No entry or invalidation levels without verified, eligible completed bars.');
 text('day-chart-label','No chart loaded');
 text('day-source','Completed historical OHLCV only');
 const checks=$('day-checks');checks.replaceChildren();checks.append(elt('p','daydesk-muted',message));
 emptyChart('Chart unavailable. '+message);
}
function clockTick(){
 const now=new Date(),p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const parts=Object.fromEntries(p.map(x=>[x.type,x.value]));
 const h=Number(parts.hour),m=Number(parts.minute),weekday=parts.weekday;
 const market=!['Sat','Sun'].includes(weekday)&&h*60+m>=570&&h*60+m<960;
 text('day-session',(market?'Regular US hours':'Outside regular US hours')+' · '+now.toLocaleString('en-CA',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET');
}
async function passiveFeed(){
 try{
  const response=await fetch('/api/feed-state',{cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw Error();
  const d=await response.json();
  text('day-feed',d.state==='rate-limited'?'Quota reached · retry '+Math.ceil((d.retry_after_seconds||60)/60)+' min':
   d.state==='responding'?'Completed bar feed checked · NOT streaming':d.state==='configured-unverified'?'API configured · response not yet verified':
   d.state==='not-configured'?'Connect historical market data in Settings':'Provider status: '+d.state);
 }catch{text('day-feed','Feed status unavailable · verify Settings')}
}
function renderChart(data){
 const root=$('day-chart');root.replaceChildren();
 const raw=Array.isArray(data.candles)?data.candles:[];
 const valid=raw.filter(b=>Number.isFinite(Date.parse(b.time))&&[b.open,b.high,b.low,b.close].every(Number.isFinite));
 if(valid.length<10){emptyChart('Insufficient complete candles for the chart.');return}
 const bars=valid.slice(-65),W=900,H=360,left=48,right=68,top=20,bottom=45;
 const viewWidth=W-left-right,viewHeight=H-top-bottom;
 const levels=[data.range?.high,data.range?.low,data.vwap?.value].filter(v=>typeof v==='number'&&Number.isFinite(v));
 const min=Math.min(...bars.map(x=>x.low),...levels),max=Math.max(...bars.map(x=>x.high),...levels);
 const padding=Math.max(.01,(max-min)*.08),low=min-padding,high=max+padding;
 const y=v=>top+(high-v)/(high-low)*viewHeight;
 const step=viewWidth/bars.length,bodyWidth=Math.max(2,Math.min(9,step*.64));
 const chart=svg('svg',{viewBox:'0 0 '+W+' '+H,'aria-hidden':'true',preserveAspectRatio:'xMidYMid meet'});
 const grid=svg('g',{'class':'daydesk-svg-grid'});chart.append(grid);
 for(let i=0;i<5;i++){
  const level=high-(high-low)*i/4,yy=y(level);
  grid.append(svg('line',{x1:left,y1:yy,x2:W-right,y2:yy}));
  const label=svg('text',{x:W-right+9,y:yy+4});label.textContent=fmt(level,2);grid.append(label);
 }
 const barsGroup=svg('g',{'class':'daydesk-svg-bars'});chart.append(barsGroup);
 for(let i=0;i<bars.length;i++){
  const b=bars[i],xx=left+(i+.5)*step,up=b.close>=b.open;
  const wick=svg('line',{x1:xx,x2:xx,y1:y(b.high),y2:y(b.low),'class':up?'up':'down'});
  const rect=svg('rect',{x:xx-bodyWidth/2,y:Math.min(y(b.open),y(b.close)),width:bodyWidth,
    height:Math.max(1.3,Math.abs(y(b.open)-y(b.close))),'class':up?'up':'down',rx:1});
  barsGroup.append(wick,rect);
 }
 const overlay=svg('g',{'class':'daydesk-svg-levels'});chart.append(overlay);
 const series=[{value:data.vwap?.state==='ready'?data.vwap.value:null,label:'VWAP',type:'vwap'},
 {value:data.range?.state==='ready'?data.range.high:null,label:'OR H',type:'range'},
 {value:data.range?.state==='ready'?data.range.low:null,label:'OR L',type:'range'}];
 for(const l of series)if(typeof l.value==='number'){
  const yy=y(l.value);
  overlay.append(svg('line',{x1:left,y1:yy,x2:W-right,y2:yy,'class':l.type}));
  const txt=svg('text',{x:left+5,y:yy-4,'class':l.type});txt.textContent=l.label;overlay.append(txt);
 }
 const marks=svg('g',{'class':'daydesk-svg-labels'});chart.append(marks);
 for(const i of [0,Math.floor((bars.length-1)/2),bars.length-1]){
  const d=new Date(bars[i].time);
  const label=svg('text',{x:left+(i+.5)*step,y:H-14,'text-anchor':i===0?'start':i===bars.length-1?'end':'middle'});
  label.textContent=d.toLocaleString('en-CA',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  marks.append(label);
 }
 root.append(chart);
 root.setAttribute('aria-label','Historical completed candlesticks for '+data.symbol+' on '+data.interval+', last completed bar '+et(data.last_completed_bar_utc)+'. Session VWAP proxy and opening-range levels shown when available.');
 text('day-chart-label',bars.length+' completed historical candles · '+data.interval);
}
function render(data){
 last=data;
 status(data.status==='CONDITIONAL_WATCH'?'candidate':data.status==='WAIT'?'ready':data.status==='WAIT_STALE'?'stale':'missing',
  data.explanation,'Checked '+et(data.checked_at));
 text('day-source','Source: '+(data.source==='finnhub-backup'?'Authorized backup bars':'Twelve Data')+' · NO live broker quote');
 text('day-close',price(data.historical_close));
 text('day-bar-time',et(data.last_completed_bar_utc)+' · completed');
 text('day-vwap',data.vwap?.state==='ready'?price(data.vwap.value):'Unavailable');
 text('day-range-high',data.range?.state==='ready'?price(data.range.high):'Unavailable');
 text('day-range-low',data.range?.state==='ready'?price(data.range.low):'Unavailable');
 text('day-relative-volume',typeof data.relative_volume==='number'?fmt(data.relative_volume,2)+'×':'Unavailable');
 text('day-age',data.age_minutes==null?'Unknown':fmt(data.age_minutes,1)+' min');
 text('day-pattern',data.setup==='NONE'?'No qualified pattern':data.setup.replaceAll('_',' ').toLowerCase());
 const eligible=data.status==='CONDITIONAL_WATCH'&&data.reference;
 text('day-entry',eligible?price(data.reference.entry):'—');
 text('day-stop',eligible?price(data.reference.invalidation):'—');
 text('day-target',eligible?price(data.reference.hypothetical2R):'—');
 text('day-plan-message',eligible?'This is a completed-candle research reference, NOT a verified live entry. Confirm broker spread, catalysts and risk independently.':
  'No qualified current watch. Historical levels are not presented as an entry instruction.');
 $('day-use-levels').disabled=!eligible;
 const checks=$('day-checks');checks.replaceChildren();
 for(const check of data.checks||[]){
  const row=elt('div','daydesk-check '+(check.pass?'pass':'not-ready'));
  row.append(elt('span','daydesk-check-dot',check.pass?'✓':'—'));
  const info=elt('div');info.append(elt('strong','',check.name),elt('small','',check.state));row.append(info);checks.append(row);
 }
 renderChart(data);
}
async function load(){
 const symbol=$('day-symbol').value.trim().toUpperCase(),interval=$('day-interval').value;
 if(!symbolOK(symbol)){status('missing','Enter a valid symbol like NVDA or TSLA.');return}
 if(lastRetry>Date.now()){
  status('limited','Provider cooldown active. Recheck after '+Math.ceil((lastRetry-Date.now())/60000)+' min. No quote is available.');
  return;
 }
 const id=++requestSeq,btn=$('day-load');btn.disabled=true;btn.textContent='Checking bars…';
 status('missing','Requesting authorized completed intraday candles. This is not a live quote.');
 try{
  const url='/api/day-desk?'+new URLSearchParams({symbol,interval});
  const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});
  const data=await response.json();
  if(id!==requestSeq||$('day-symbol').value.trim().toUpperCase()!==symbol||$('day-interval').value!==interval)return;
  if(!response.ok||data.error){
   if(response.status===429||data.code==='PROVIDER_RATE_LIMIT'){
    lastRetry=Date.now()+(Number(data.retry_after_seconds)||65)*1000;status('limited',data.error||'Market-data quota reached.');
   }else status('missing',data.error||'Authorized historical bars unavailable.');
   reset(data.error||'Provider unavailable');await passiveFeed();return;
  }
  if(data.symbol!==symbol||data.interval!==interval||data.security?.broker_orders!==false)throw Error('Invalid provider response. No signal was accepted.');
  render(data);await passiveFeed();
 }catch(e){if(id===requestSeq){reset('No verified chart data.');status('missing',String(e.message||'Provider unavailable.'))}}
 finally{if(id===requestSeq){btn.disabled=false;btn.textContent='Check intraday setup ↗'}}
}
function calculateRisk(){
 const attrs={account:'account',riskPct:'pct',entry:'entry',stop:'stop',capitalPct:'alloc',dailyLoss:'daily',usedDailyLoss:'used',slippageBps:'slip',fees:'fees'};
 const input=Object.fromEntries(Object.entries(attrs).map(([key,id])=>[key,$('day-risk-'+id).value]));
 const result=$('day-risk-result');result.replaceChildren();
 try{
  const x=positionPlan(input);
  const heading=elt('strong','',x.shares===0?'No position fits your limits':x.shares+' shares · hypothetical '+x.side+' exposure');
  const grid=elt('div','daydesk-size-grid');
  for(const [label,value] of [['Position notional',price(x.notional)],['Budget for this trade',price(x.effectiveBudget)],
   ['Estimated risk incl. inputs',price(x.estimatedRiskWithCosts)],['Daily loss capacity left',price(x.dailyRemaining)],
   ['Stop distance',price(x.stopDistance)],['Illustrative 2R',price(x.hypothetical2R)]]){
   const cell=elt('div');cell.append(elt('span','',label),elt('strong','',value));grid.append(cell);
  }
  result.append(heading,grid,elt('p','daydesk-disclaimer',x.note));
 }catch(e){result.append(elt('p','daydesk-risk-error',e.message))}
}
function init(){
 if(!$('day-load'))return;
 reset('No market data checked yet.');clockTick();setInterval(clockTick,60000);passiveFeed();
 $('day-load').addEventListener('click',load);
 $('day-symbol').addEventListener('keydown',e=>{if(e.key==='Enter')load()});
 $('day-interval').addEventListener('change',()=>{requestSeq++;reset('Interval changed; check the new interval.');status('missing','Recheck to avoid using levels from a different interval.')});
 for(const button of document.querySelectorAll('[data-day-ticker]'))button.addEventListener('click',()=>{
  $('day-symbol').value=button.dataset.dayTicker;requestSeq++;reset('New ticker selected. Choose Check intraday setup to load it.');
  status('missing','No price request yet for '+button.dataset.dayTicker+'.');
 });
 $('day-use-levels').addEventListener('click',()=>{
  if(!last||last.status!=='CONDITIONAL_WATCH'||!last.reference)return;
  $('day-risk-entry').value=String(last.reference.entry);
  $('day-risk-stop').value=String(last.reference.invalidation);
  calculateRisk();$('day-risk-entry').scrollIntoView({behavior:'smooth',block:'center'});
 });
 $('day-risk-calc').addEventListener('click',calculateRisk);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
