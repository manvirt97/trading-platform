import {bookMetrics,contractPair,assumedFill,paperGuard,PAIRS} from './algo-math.mjs';
const $=id=>document.getElementById(id);
const fmt=(n,d=2)=>Number.isFinite(n)?Number(n).toLocaleString('en-CA',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const money=n=>Number.isFinite(n)?(n<0?'−':'')+'$'+fmt(Math.abs(n),2):'—';
const PERSIST='rf_algo_paper_v1';
const empty=capital=>({capital,cash:capital,position:null,realized:0,paused:false,history:[]});
function load(){
 try{const d=JSON.parse(localStorage.getItem(PERSIST)||'null');
  if(!d||!Number.isFinite(d.capital)||d.capital<100||!Number.isFinite(d.cash)||d.cash<0||!Array.isArray(d.history)||d.history.length>500)return empty(10000);
  if(d.position&&(!Object.hasOwn(PAIRS,d.position.pair)||!(d.position.qty>0&&d.position.cost>0)))return empty(10000);
  return {...d,paused:Boolean(d.paused),realized:Number.isFinite(d.realized)?d.realized:0,history:d.history.slice(0,150)};
 }catch{return empty(10000)}
}
let ledger=load(),snapshot=null,lastSnapshotAt=0,busy=false,error=null;
const set=(id,value)=>{$(id).textContent=value};
const setMsg=(id,message,kind='')=>{const e=$(id);e.textContent=message;e.className='message'+(kind?' '+kind:'')};
const save=()=>{try{localStorage.setItem(PERSIST,JSON.stringify(ledger))}catch{setMsg('paperMessage','Local storage unavailable. Journal changes will not survive reopening the page.','error')}};
const currentPair=()=> $('pair').value;
const f=()=>Number($('fee').value),s=()=>Number($('slippage').value),notional=()=>Number($('notional').value);
const freshness=()=>snapshot&&snapshot.pair===currentPair()&&Date.now()-lastSnapshotAt<20000;
const stamp=()=>new Date().toISOString();
const utcDay=t=>String(t||stamp()).slice(0,10);
function dailyLoss(){return ledger.history.filter(h=>h.action==='SELL'&&utcDay(h.at)===utcDay()).reduce((a,h)=>a+Math.min(0,Number(h.pnl)||0),0)}
function quoteMetrics(){if(!freshness())return null;try{return bookMetrics(snapshot,f(),s(),notional())}catch{return null}}
function renderLevels(id,rows,side){const root=$(id);root.replaceChildren();if(!rows?.length){root.textContent='No verified depth';return}
 const peak=Math.max(...rows.slice(0,6).map(r=>Number(r[1])));for(const [price,qty] of rows.slice(0,6)){
  const line=document.createElement('div');line.className='level'+(side==='ask'?' ask':'');
  const bar=document.createElement('span');bar.className='bar';bar.style.width=(peak>0?Math.min(100,qty/peak*100):0)+'%';
  const p=document.createElement('b');p.textContent=money(price);const q=document.createElement('span');q.textContent=fmt(qty,5);line.append(bar,p,q);root.append(line);
 }
}
function showBook(){
 const m=quoteMetrics();
 if(!m){for(const id of ['bid','ask','spread','imbalance','roundtrip','depthStatus','buyCost','sellProceeds'])set(id,'—');$('bids').textContent='No fresh verified depth';$('asks').textContent='No fresh verified depth';}
 else{
  set('bid',money(m.bid));set('ask',money(m.ask));set('spread',fmt(m.spreadBps,2)+' bps');
  set('imbalance',m.imbalance===null?'Depth balance unavailable':'Bid-side share of top depth: '+fmt(m.imbalance*100,1)+'%');
  set('roundtrip',money(m.estimatedRoundTrip));set('depthStatus',m.depthSufficient?'Yes at shown top quote':'No — insufficient top depth');
  set('buyCost',money(m.estimatedBuy));set('sellProceeds',money(m.estimatedSale));
  renderLevels('bids',snapshot.bids,'bid');renderLevels('asks',snapshot.asks,'ask');
 }
 const age=lastSnapshotAt?Math.round((Date.now()-lastSnapshotAt)/1000):null;
 set('age',age===null?'—':age+'s'+(freshness()?'':' · stale'));
 if(freshness())setMsg('feedMessage','Verified '+PAIRS[snapshot.pair]+' exchange snapshot received '+new Date(snapshot.observed_at).toLocaleTimeString('en-CA')+'. Market can move between snapshots.','success');
 else if(error)setMsg('feedMessage',error,'error');
 else setMsg('feedMessage','No fresh market snapshot. Paper actions are disabled until the exchange responds.');
 $('feedPill').textContent=freshness()?'Kraken book · fresh':error?'Exchange unavailable':'Quote not verified';
 $('feedPill').className='chip'+(freshness()?' ok':error?' bad':'');
}
function paperStatus(){
 const m=quoteMetrics();
 let reason=paperGuard({paused:ledger.paused,capital:ledger.capital,cash:ledger.cash,notional:notional(),lossToday:dailyLoss(),openCount:ledger.position?1:0});
 if(!m)reason=error?'Exchange unavailable; paper orders blocked.':'Fresh market depth required.';
 else if(!m.depthSufficient)reason='Insufficient visible top-of-book quantity for this order size.';
 if(ledger.position)reason='One open paper position exists. Close it before opening another.';
 const capitalLocked=Boolean(ledger.history.length||ledger.position);
 $('capital').disabled=capitalLocked;$('capital').value=String(ledger.capital);
 $('pause').checked=ledger.paused;
 set('cash',money(ledger.cash));set('position',ledger.position?PAIRS[ledger.position.pair]+' · '+fmt(ledger.position.qty,7)+' units':'None');
 set('realized',money(ledger.realized));set('drawdown',money(Math.abs(dailyLoss()))+' / '+money(ledger.capital*.02));
 const open=ledger.position;let equity=ledger.cash,unrealized=0;
 if(open&&freshness()&&snapshot.pair===open.pair){
  try{const close=assumedFill('sell',snapshot.best_bid,open.qty,f(),s());equity+=close.total;unrealized=close.total-open.cost;}catch{equity=NaN}
 }else if(open)equity=NaN;
 set('equity',money(equity));
 if(open&&Number.isFinite(unrealized))set('position',PAIRS[open.pair]+' · '+fmt(open.qty,7)+' · unrealized '+money(unrealized));
 $('buy').disabled=Boolean(reason)||!m;
 let sellReason='';
 if(!open)sellReason='There is no open paper position.';
 else if(ledger.paused)sellReason='Emergency pause is active.';
 else if(!freshness()||open.pair!==snapshot?.pair)sellReason='Select the open position market and fetch a fresh book.';
 else if(!(Number(snapshot.bids[0]?.[1])>=open.qty))sellReason='Top bid quantity cannot cover the paper exit.';
 $('sell').disabled=Boolean(sellReason);
 setMsg('paperMessage',open?(sellReason||'Paper position can be closed at an assumed marketable bid (including entered costs).'):(reason||'Eligible for a hypothetical paper buy. No actual orders will be placed.'),sellReason||reason?'':'success');
 renderJournal();
}
function renderJournal(){
 const root=$('journal');root.replaceChildren();
 if(!ledger.history.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No paper activity recorded.';tr.append(td);root.append(tr);return}
 for(const h of ledger.history.slice(0,30)){const tr=document.createElement('tr');for(const value of [h.at,h.action,h.pair,fmt(h.qty,7),money(h.price),(h.action==='BUY'?'−':'+')+money(h.cashImpact)]){const td=document.createElement('td');td.textContent=String(value);tr.append(td)}root.append(tr)}
}
function render(){showBook();paperStatus()}
async function refresh(){
 if(busy||document.visibilityState==='hidden')return;
 busy=true;$('refresh').disabled=true;$('refresh').textContent='Checking exchange…';error=null;
 const pair=currentPair(),control=new AbortController(),timeout=setTimeout(()=>control.abort(),8500);
 try{
  const response=await fetch('/api/algo-book?pair='+encodeURIComponent(pair),{cache:'no-store',signal:control.signal});
  const result=await response.json().catch(()=>({error:'Invalid exchange response'}));
  if(!response.ok)throw Error(result.error||'Live feed failed');
  if(result.mode!=='PUBLIC_MARKET_SNAPSHOT'||result.pair!==pair||!Array.isArray(result.bids)||!Array.isArray(result.asks))throw Error('Incomplete exchange snapshot; ignored.');
  if(result.best_bid<=0||result.best_ask<=result.best_bid)throw Error('Invalid exchange bid/ask; ignored.');
  if(currentPair()!==pair)return;
  snapshot=result;lastSnapshotAt=Date.now();
 }catch(e){snapshot=null;lastSnapshotAt=0;error='Kraken snapshot unavailable: '+(e?.name==='AbortError'?'request timed out':String(e.message||e));}
 finally{clearTimeout(timeout);busy=false;$('refresh').disabled=false;$('refresh').textContent='Refresh snapshot ↻';render()}
}
function buyPaper(){
 const m=quoteMetrics();if(!m)return;
 const reason=paperGuard({paused:ledger.paused,capital:ledger.capital,cash:ledger.cash,notional:notional(),lossToday:dailyLoss(),openCount:ledger.position?1:0});
 if(reason)return setMsg('paperMessage',reason,'error');
 try{
  const unit=assumedFill('buy',m.ask,1,f(),s()).total,qty=notional()/unit;
  if(!(snapshot.asks[0][1]>=qty))throw Error('Insufficient top ask quantity.');
  const fill=assumedFill('buy',m.ask,qty,f(),s());
  if(fill.total>ledger.cash+1e-6||fill.total>ledger.capital*.05+1e-6)throw Error('Cash or position-cap limit.');
  ledger.cash=Math.max(0,ledger.cash-fill.total);
  ledger.position={pair:currentPair(),qty,cost:fill.total,entry:fill.execution,at:stamp()};
  ledger.history.unshift({at:stamp(),action:'BUY',pair:currentPair(),qty,price:fill.execution,cashImpact:fill.total,fee:fill.fee,assumed_slip_bps:s()});
  save();render();
 }catch(e){setMsg('paperMessage','Paper buy blocked: '+e.message,'error')}
}
function sellPaper(){
 const open=ledger.position;
 if(!open||ledger.paused||!freshness()||snapshot.pair!==open.pair)return;
 if(!(snapshot.bids[0][1]>=open.qty))return setMsg('paperMessage','Visible bid depth is too small to model this paper exit.','error');
 try{
  const fill=assumedFill('sell',snapshot.best_bid,open.qty,f(),s()),pnl=fill.total-open.cost;
  ledger.cash+=fill.total;ledger.realized+=pnl;
  ledger.history.unshift({at:stamp(),action:'SELL',pair:open.pair,qty:open.qty,price:fill.execution,cashImpact:fill.total,pnl,fee:fill.fee,assumed_slip_bps:s()});
  ledger.position=null;save();render();
 }catch(e){setMsg('paperMessage','Paper sell blocked: '+e.message,'error')}
}
function calculatePair(){
 try{
  if(!$('yes').value||!$('no').value)throw Error('Enter actual YES and NO ask quotes to begin.');
  const result=contractPair({yes:Number($('yes').value)/100,no:Number($('no').value)/100,yesFee:Number($('yesFee').value),noFee:Number($('noFee').value),quantity:Number($('qty').value)});
  set('pairCost',money(result.cost));set('pairPayout',money(result.payout));set('pairEdge',money(result.edge));
  setMsg('pairMessage',(result.positive?'Potential positive matched edge':'No positive matched edge')+' of '+money(result.edgePerPair)+' per pair after entered fees. Verify that both sides of the exact same event are buyable simultaneously, and verify all contract rules.','');
 }catch(e){set('pairCost','—');set('pairPayout','—');set('pairEdge','—');setMsg('pairMessage',e.message)}
}
function exportCSV(){
 const cols=['timestamp_utc','action','pair','quantity','execution_price_usd','cash_impact_usd','assumed_fee_usd','assumed_slippage_bps','paper_net_pnl_usd'];
 const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const csv=[cols.join(','),...ledger.history.map(h=>[h.at,h.action,h.pair,h.qty,h.price,h.cashImpact,h.fee,h.assumed_slip_bps,h.pnl??''].map(q).join(','))].join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rangeform-algo-paper.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function setTab(active){
 const crypto=active==='crypto';$('cryptoPanel').hidden=!crypto;$('contractsPanel').hidden=crypto;
 $('cryptoTab').classList.toggle('selected',crypto);$('contractsTab').classList.toggle('selected',!crypto);
 $('cryptoTab').setAttribute('aria-selected',String(crypto));$('contractsTab').setAttribute('aria-selected',String(!crypto));
}
function init(){
 // Align the separate desk to the currently selected main-app theme.
 let theme;try{theme=localStorage.getItem('rf_v9_theme')||localStorage.getItem('rangeform_theme')||'light'}catch{theme='light'}
 if(!['light','dark','warm'].includes(theme))theme='light';
 window.RangeformTheme?.apply(theme);document.body.dataset.theme=theme;
 $('theme').addEventListener('click',()=>{let next=document.body.dataset.theme==='light'?'dark':'light';window.RangeformTheme?.apply(next);document.body.dataset.theme=next;try{localStorage.setItem('rf_v9_theme',next)}catch{}});
 $('pair').addEventListener('change',()=>{snapshot=null;lastSnapshotAt=0;error=null;render();refresh()});
 $('refresh').addEventListener('click',refresh);
 for(const id of ['fee','slippage','notional'])$(id).addEventListener('input',render);
 $('capital').value=String(ledger.capital);
 $('capital').addEventListener('change',()=>{if(ledger.history.length||ledger.position)return;const value=Number($('capital').value);if(value>=100&&value<=1e9){ledger=empty(value);save()}render()});
 $('pause').addEventListener('change',e=>{ledger.paused=e.target.checked;save();render()});
 $('buy').addEventListener('click',buyPaper);$('sell').addEventListener('click',sellPaper);
 $('reset').addEventListener('click',()=>{if(confirm('Erase this browser\'s algorithmic paper ledger and open hypothetical position?')){ledger=empty(Number($('capital').value)||10000);save();render()}});
 $('export').addEventListener('click',exportCSV);
 $('cryptoTab').addEventListener('click',()=>setTab('crypto'));$('contractsTab').addEventListener('click',()=>setTab('contracts'));
 for(const id of ['yes','no','yesFee','noFee','qty'])$(id).addEventListener('input',calculatePair);
 calculatePair();render();refresh();
 setInterval(()=>{if(!busy&&document.visibilityState==='visible'&&Date.now()-lastSnapshotAt>=12000)refresh();else render()},3000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!freshness())refresh()});
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);
