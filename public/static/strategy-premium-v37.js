/* Rangeform Premium NIFTY Audit v37: all metrics require verified market data.
 * No broker orders; original 11-role research and paper-bot modules remain untouched.
 */
import {drawEmaChart} from './strategy-live.js';
const $=id=>document.getElementById(id);
const modes=['itm5_buy','atm_buy','atm_sell'];
const currency=value=>Number.isFinite(value)?(value<0?'-₹':'+₹')+Math.abs(value).toLocaleString('en-IN',{maximumFractionDigits:0}):'—';
const rupee=value=>Number.isFinite(value)?'₹'+value.toLocaleString('en-IN',{maximumFractionDigits:2}):'—';
const display=value=>Number.isFinite(value)?Number(value).toLocaleString('en-IN',{maximumFractionDigits:2}):'—';
const percent=value=>Number.isFinite(value)?value.toFixed(2)+'%':'—';
const istTime=value=>new Date(value).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false});
const istDate=value=>new Date(value).toLocaleDateString('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',weekday:'short'});
let mode='itm5_buy',timeframe=15,result=null,selection=0,visibleTrades=[];
const pane=$('sbBacktestPane'),advanced=$('rfAdvanced');
const legacy=pane.querySelector(':scope > .sb-grid'),previous=$('sbResults');
if(legacy)advanced.append(legacy);
if(previous)advanced.append(previous);
const text=(id,value)=>{$(id).textContent=String(value??'—')};
function pnl(id,value){text(id,currency(value));$(id).classList.toggle('rf-profit',value>=0);$(id).classList.toggle('rf-loss',value<0)}
function spark(id,series){
 const svg=$(id);svg.replaceChildren();
 if(!Array.isArray(series)||series.length<2)return;
 const nums=series.map(v=>v.equity),lo=Math.min(...nums),hi=Math.max(...nums),range=Math.max(1,hi-lo);
 const points=nums.map((n,i)=>(3+i*254/(nums.length-1)).toFixed(2)+','+(43-38*(n-lo)/range).toFixed(2)).join(' ');
 const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
 line.setAttribute('points',points);line.setAttribute('fill','none');
 line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','2.4');svg.append(line);
 svg.setAttribute('aria-label','Historical net profit and loss chart');
}
function counts(trades){
 const wins=trades.filter(t=>t.net_pnl>0),losses=trades.filter(t=>t.net_pnl<0);
 const gross=trades.reduce((s,t)=>s+t.gross_pnl,0),net=trades.reduce((s,t)=>s+t.net_pnl,0),costs=trades.reduce((s,t)=>s+t.friction,0);
 const gain=wins.reduce((s,t)=>s+t.net_pnl,0),loss=-losses.reduce((s,t)=>s+t.net_pnl,0);
 return {gross,net,costs,wins:wins.length,losses:losses.length,n:trades.length,
  win_rate:trades.length?wins.length*100/trades.length:null,
  pf:loss>0?gain/loss:null,expectancy:trades.length?net/trades.length:null};
}
function row(title,value,total=false){
 const line=document.createElement('div');line.className='rf-cost-line'+(total?' total':'');
 const label=document.createElement('span'),amount=document.createElement('strong');
 label.textContent=title;amount.textContent=rupee(value);line.append(label,amount);$('rfCostRows').append(line);
}
function resetSelected(){
 for(const id of ['rfSelected','rfSymbol','rfDirection','rfSpot','rfOption','rfTime','rfExpiry','rfReason','rfTradeNet','rfFlag'])text(id,'—');
 $('rfSpotChart').replaceChildren();$('rfChartEmpty').hidden=false;
 $('rfCostRows').replaceChildren();
 const tip=document.createElement('p');tip.className='rf-empty';tip.textContent='Choose a completed trade to inspect verified prices and transaction costs.';$('rfCostRows').append(tip);
}
function choose(index){
 if(!visibleTrades.length){resetSelected();return}
 selection=Math.min(Math.max(0,index),visibleTrades.length-1);const t=visibleTrades[selection];
 document.querySelectorAll('.rf-trade-row').forEach((item,i)=>item.classList.toggle('active',i===selection));
 const rowNode=document.querySelectorAll('.rf-trade-row')[selection];
 if(rowNode)rowNode.scrollIntoView({block:'nearest'});
 pnl('rfSelected',t.net_pnl);text('rfSelectedSub',istDate(t.entry_time)+' · '+istTime(t.entry_time));
 text('rfSymbol',t.symbol);text('rfDirection',t.direction+' · '+t.type+' '+t.side);
 text('rfSpot',display(t.spot_entry)+' → '+display(t.spot_exit));
 text('rfOption',rupee(t.entry_raw)+' → '+rupee(t.exit_raw));
 text('rfTime',istTime(t.entry_time)+' → '+istTime(t.exit_time));
 text('rfExpiry',t.expiry+' · '+t.dte+' days');
 text('rfReason',t.exit_reason.replaceAll('_',' '));pnl('rfTradeNet',t.net_pnl);
 text('rfFlag',t.whipsaw?'Whipsaw':'No whipsaw');
 text('rfChartTitle','NIFTY spot · '+timeframe+'m · '+istDate(t.entry_time));
 if(t.spot_chart?.length>1){$('rfChartEmpty').hidden=true;drawEmaChart($('rfSpotChart'),t.spot_chart)}
 else{$('rfChartEmpty').hidden=false;$('rfSpotChart').replaceChildren()}
 $('rfCostRows').replaceChildren();
 row('Gross premium P&L',t.gross_pnl);row('Slippage / tick rounding',t.slippage_cost);
 for(const [key,label] of [['brokerage','Brokerage'],['stt','STT'],['exchange','Exchange charges'],['sebi','SEBI fee'],['stamp','Stamp duty'],['ipft','IPFT charge'],['gst','GST']])row(label,t.costs[key]);
 row('Net P&L',t.net_pnl,true);
}
function drawList(){
 const root=$('rfTradeList');root.replaceChildren();let lastDay='';
 if(!visibleTrades.length){const empty=document.createElement('p');empty.className='rf-empty';empty.textContent='No completed option trades match this selection. Missing quotes are never invented.';root.append(empty);resetSelected();return}
 visibleTrades.forEach((t,i)=>{
  const day=istDate(t.entry_time);
  if(day!==lastDay){lastDay=day;const label=document.createElement('div');label.className='rf-day';label.textContent=day.toUpperCase();root.append(label)}
  const item=document.createElement('button');item.type='button';item.className='rf-trade-row';
  const line=document.createElement('span');line.className='rf-trade-line';
  const time=document.createElement('span');time.textContent=istTime(t.entry_time);
  const symbol=document.createElement('span');symbol.textContent=t.symbol;
  const side=document.createElement('span');side.className='rf-side';side.textContent=t.side;
  const value=document.createElement('b');value.textContent=currency(t.net_pnl);value.className=t.net_pnl<0?'rf-loss':'rf-profit';
  line.append(time,symbol,side,value);
  const secondary=document.createElement('small');secondary.textContent='→ '+istTime(t.exit_time)+' · '+t.exit_reason.replaceAll('_',' ')+' · cross #'+t.cross_number;
  item.append(line,secondary);item.addEventListener('click',()=>choose(i));root.append(item);
 });
 choose(selection);
}
function update(){
 document.querySelectorAll('[data-rf-mode]').forEach(button=>button.classList.toggle('selected',button.dataset.rfMode===mode));
 $('rfMode').value=mode;
 if(!result)return;
 const candidates=result.comparisons[mode].trades_detail;
 const outcome=$('rfOutcome').value,cross=$('rfCross').value,whip=$('rfWhipsaw').value,from=$('rfFrom').value,to=$('rfTo').value;
 visibleTrades=candidates.filter(t=>{
  const date=t.entry_time.slice(0,10);
  return (outcome==='all'||(outcome==='win'?t.net_pnl>0:t.net_pnl<0)) &&
   (cross==='all'||(cross==='3'?t.cross_number>=3:t.cross_number===Number(cross))) &&
   (whip==='all'||t.whipsaw===(whip==='yes'))&&(!from||date>=from)&&(!to||date<=to);
 });
 const s=counts(visibleTrades),full=result.comparisons[mode];
 text('rfTotal',s.n);text('rfTotalSub',s.wins+' wins · '+s.losses+' losses');
 text('rfWin',percent(s.win_rate));text('rfWinSub','Expectancy '+rupee(s.expectancy)+' / trade');
 pnl('rfNet',s.net);text('rfNetSub','Closed-trade DD '+rupee(full.max_drawdown_closed_pnl));
 pnl('rfGross',s.gross);text('rfGrossSub','Modeled friction '+rupee(s.costs));
 text('rfPf',display(s.pf));text('rfPfSub','Filtered trade result');
 text('rfTradeCount','Trades ('+visibleTrades.length+')');
 selection=0;drawList();
}
function updateCards(){
 if(!result)return;
 for(const m of modes){
  const x=result.comparisons[m];
  pnl('rfPnl-'+m,x.net_pnl);
  text('rfSub-'+m,x.trades+' trades · Win '+percent(x.win_rate_pct)+' · PF '+display(x.profit_factor)+' · Max DD '+rupee(x.max_drawdown_closed_pnl));
  spark('rfSpark-'+m,x.equity_curve);
 }
}
function invalidate(){
 if(!result)return;
 result=null;visibleTrades=[];selection=0;
 for(const id of ['rfTotal','rfWin','rfNet','rfGross','rfPf'])text(id,'—');
 for(const m of modes){text('rfPnl-'+m,'—');text('rfSub-'+m,'Recompute for new session settings');$('rfSpark-'+m).replaceChildren()}
 text('rfTradeCount','Trades (—)');
 $('rfTradeList').replaceChildren();$('rfTradeList').textContent='Settings changed. Recompute with your actual one-minute history.';
 resetSelected();text('rfDataStatus','Settings changed. Existing results hidden until recomputed.');
 $('rfAdvanced').open=true;
}
function parseCells(line){
 const a=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){
  const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}
  else if(char===','&&!quoted){a.push(value.trim());value=''}else value+=char;
 }
 if(quoted)throw Error('CSV quote not closed');
 a.push(value.trim());return a;
}
async function parseCsv(file,contract=false){
 if(!file)throw Error('Choose both historical spot and option CSV files first.');
 if(file.size>2800000)throw Error('CSV exceeds 2.8 MB; split into smaller date ranges.');
 const lines=(await file.text()).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
 if(lines.length<2)throw Error('CSV is empty.');
 const headers=parseCells(lines.shift()).map(s=>s.toLowerCase());
 const fields=['timestamp','open','high','low','close','volume'];
 if(contract)fields.push('symbol','expiry','strike','option_type');
 for(const field of fields)if(!headers.includes(field))throw Error('Missing CSV column: '+field);
 const indexes=fields.map(f=>headers.indexOf(f));
 const data=lines.map((line,i)=>{
  const values=parseCells(line),entry={};
  fields.forEach((field,j)=>{
   const raw=values[indexes[j]];
   if(!raw)throw Error('Missing '+field+' on CSV row '+(i+2));
   entry[field]=['open','high','low','close','volume','strike'].includes(field)?Number(raw):raw;
  });
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(entry.timestamp)||!Number.isFinite(Date.parse(entry.timestamp)))
    throw Error('CSV timestamps require an explicit ISO timezone offset, e.g. 2026-10-12T09:15:00+05:30.');
  entry.timestamp=new Date(entry.timestamp).toISOString();
  return entry;
 });
 data.sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
 return data;
}
async function recompute(){
 const button=$('rfRun');button.disabled=true;text('rfUploadStatus','Validating actual spot and contract premiums…');
 try{
  const [spot_bars,option_bars]=await Promise.all([parseCsv($('rfSpotFile').files[0]),parseCsv($('rfOptionFile').files[0],true)]);
  const input={spot_bars,option_bars,timeframe,entry_from:$('rfEntryFrom').value,cutoff:$('rfCutoff').value,
   lot_size:Number($('rfLot').value),lots:Number($('rfLots').value),strike_step:Number($('rfStep').value),
   costs:{slippage_points:Number($('rfSlip').value)}};
  const raw=JSON.stringify(input);
  if(raw.length>4_000_000)throw Error('Historical upload is too large. Try fewer trading sessions.');
  const response=await fetch('/api/nifty-options-backtest',{method:'POST',headers:{'content-type':'application/json'},body:raw});
  const out=await response.json();if(!response.ok)throw Error(out.error||'Historical test rejected.');
  if(out.broker_orders!==false||out.mode!=='NIFTY_OPTIONS_RESEARCH_ONLY')throw Error('Unverified research service response.');
  result=out;selection=0;updateCards();update();$('rfAdvanced').open=false;
  const skipped=Object.values(out.missing_quote_or_exit_counts).reduce((sum,n)=>sum+n,0);
  text('rfDataStatus','History '+out.range.first.slice(0,10)+' → '+out.range.last.slice(0,10)+
    ' · '+out.events_count+' confirmed crosses'+(skipped?' · '+skipped+' missing-premium events skipped':'')+' · no broker orders');
  text('rfUploadStatus','Backtest complete using uploaded actual candles. Not brokerage fills.');
  text('rfDataCoverage',out.range.first.slice(0,10)+' → '+out.range.last.slice(0,10)+' · real imported history');
 }catch(e){text('rfUploadStatus',String(e.message||e));text('rfDataStatus','Options research not updated: '+String(e.message||e));}
 finally{button.disabled=false}
}
for(const button of document.querySelectorAll('[data-rf-tf]'))button.addEventListener('click',()=>{
 timeframe=Number(button.dataset.rfTf);document.querySelectorAll('[data-rf-tf]').forEach(b=>b.classList.toggle('active',b===button));
 text('rfChartTitle','NIFTY spot · '+timeframe+'-minute EMA audit');invalidate();
});
$('rfMode').addEventListener('change',()=>{mode=$('rfMode').value;update()});
document.querySelectorAll('[data-rf-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.rfMode;update()}));
for(const id of ['rfOutcome','rfCross','rfWhipsaw','rfFrom','rfTo'])$(id).addEventListener('change',update);
for(const id of ['rfEntryFrom','rfCutoff'])$(id).addEventListener('change',invalidate);
$('rfUp').addEventListener('click',()=>choose(selection-1));
$('rfDown').addEventListener('click',()=>choose(selection+1));
$('rfReset').addEventListener('click',()=>{
 for(const id of ['rfOutcome','rfCross','rfWhipsaw'])$(id).value='all';
 for(const id of ['rfFrom','rfTo'])$(id).value='';
 mode='itm5_buy';update();
});
$('rfConfigure').addEventListener('click',()=>{$('rfAdvanced').open=true;$('rfAdvanced').scrollIntoView({block:'start',behavior:'smooth'})});
$('rfRun').addEventListener('click',recompute);
$('rfTopRecompute').addEventListener('click',()=>{
 if($('rfSpotFile').files.length&&$('rfOptionFile').files.length){recompute();return}
 $('rfAdvanced').open=true;$('rfAdvanced').scrollIntoView({block:'start',behavior:'smooth'});
 text('rfUploadStatus','Choose verified NIFTY spot and option contract CSV files, then recompute.');
});
