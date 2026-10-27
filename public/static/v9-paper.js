/* Rangeform paper practice, browser-local only. Never places or simulates
   authenticated brokerage orders. Candles are historical reference prices;
   stop orders are NOT automatically filled. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const KEY='rf_v9_paper_journal_v1',KILL='rf_v9_paper_pause_v1';
 const cap=200,costPerSide=.0005;
 const money=n=>Number.isFinite(n)?(n<0?'−':'')+'$'+Math.abs(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
 const create=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=String(txt);return e};
 const valid=t=>t&&typeof t.symbol==='string'&&/^[A-Z][A-Z0-9.-]{0,9}$/.test(t.symbol)&&Number.isFinite(t.entry)&&Number.isFinite(t.stop)&&Number.isFinite(t.qty)&&t.qty>0&&t.entry>0&&t.stop>0&&t.stop<t.entry&&['open','closed'].includes(t.status);
 const load=()=>{try{const arr=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(arr)?arr.filter(valid).slice(0,cap):[]}catch{return []}};
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state.trades.slice(0,cap)))}catch{$('paperStatus').textContent='Unable to save practice journal in this browser. Check private-browsing storage settings.'}};
 const state={trades:load(),paused:false,last:null};
 try{state.paused=localStorage.getItem(KILL)==='true'}catch{}
 const dt=s=>{const d=new Date(s);return Number.isFinite(+d)?d:null};
 const nyday=s=>{const d=dt(s);return d?new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'unknown'};
 const stamp=s=>{const d=dt(s);return d?d.toLocaleString('en-CA',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'unknown'};
 const pnl=t=>(t.exit-t.entry)*t.qty-t.qty*(t.entry+t.exit)*costPerSide;
 const rMultiple=t=>{const risk=t.qty*(t.entry-t.stop);return risk>0?pnl(t)/risk:null};
 function guard(){
  const closed=state.trades.filter(t=>t.status==='closed'&&dt(t.closedAt)).sort((a,b)=>Date.parse(b.closedAt)-Date.parse(a.closedAt));
  const today=nyday(new Date()),realizedToday=closed.filter(t=>nyday(t.closedAt)===today).reduce((s,t)=>s+pnl(t),0);
  const equity=Number($('riskAccount').value),risk=Number($('riskPercent').value);
  let streak=0;for(const t of closed){if(pnl(t)<0)streak++;else break}
  const opens=state.trades.filter(t=>t.status==='open').length;
  const limits=[];
  if(state.paused)limits.push('Local kill switch is on');
  if(opens>=3)limits.push('Maximum of three open paper positions reached');
  if(streak>=3)limits.push('Three consecutive paper losses');
  if(Number.isFinite(equity)&&equity>0&&realizedToday<=-equity*.02)limits.push('Daily paper loss reached 2% of account');
  if(!(equity>0&&equity<=1e9&&risk>.0&&risk<=1))limits.push('Set a positive account value and risk between 0.1% and 1%');
  return {limits,equity,risk,opens,streak,realizedToday};
 }
 function eligibility(){
  const x=state.last,g=guard();
  if(g.limits.length)return {ok:false,note:g.limits.join(' · ')};
  if(x?.agent_room?.verdict!=='BUY_WATCH'||x?.opportunity?.status!=='BUY_WATCH'||x.opportunity?.plan?.direction!=='long')return {ok:false,note:'No fresh long watch confirmed by the supervisor.'};
  const t=x.analysis,plan=x.opportunity.plan;
  const entry=Number(plan.reference_entry),stop=Number(plan.invalidation);
  if(!Number.isFinite(entry)||!Number.isFinite(stop)||stop<=0||entry<=stop)return {ok:false,note:'No valid simulated entry and stop from confirmed market data.'};
  if(!dt(t.last_bar_utc))return {ok:false,note:'Missing completed-bar timestamp.'};
  if(state.trades.some(t=>t.symbol===x.analysis.symbol&&t.status==='open'))return {ok:false,note:'An open paper position already exists for this symbol.'};
  const qty=Math.floor(Math.min(g.equity*g.risk/100/(entry-stop),g.equity/entry));
  if(qty<1)return {ok:false,note:'Cash or risk budget is too small to simulate one whole share.'};
  return {ok:true,qty,entry,stop,symbol:t.symbol,barTime:t.last_bar_utc};
 }
 function report(){
  const root=$('paperJournal');root.replaceChildren();let trades=state.trades.slice(0,15);
  if(!trades.length){const tr=create('tr'),td=create('td','empty-inline','No practice trades recorded yet.');td.colSpan=5;tr.append(td);root.append(tr)}
  for(const t of trades){
   const row=create('tr');for(const value of [
    t.symbol,t.status==='open'?'Open (hypothetical)':'Closed',String(t.qty),money(t.entry)+' / '+(t.status==='closed'?money(t.exit):'—'),
    t.status==='closed'?money(pnl(t)):'Not marked'
   ])row.append(create('td','',value));
   root.append(row);
  }
  const closed=state.trades.filter(t=>t.status==='closed'),won=closed.filter(t=>pnl(t)>0),net=closed.reduce((s,t)=>s+pnl(t),0);
  const avgR=closed.length?closed.reduce((s,t)=>s+(rMultiple(t)||0),0)/closed.length:NaN;
  $('paperStats').textContent=closed.length?closed.length+' closed · '+won.length+' positive · realized '+money(net)+' · average '+(Number.isFinite(avgR)?avgR.toFixed(2)+'R':'—')+' (historical practice only)':'No closed practice positions. No return or win-rate claim.';
  $('paperKill').checked=state.paused;
  const eligible=eligibility(),current=state.last?.analysis?.symbol;
  $('paperOpen').disabled=!eligible.ok;
  $('paperClose').disabled=!state.trades.some(t=>t.symbol===current&&t.status==='open'&&dt(state.last?.analysis?.last_bar_utc)&&Date.parse(state.last.analysis.last_bar_utc)>Date.parse(t.barTime));
  $('paperStatus').textContent=eligible.ok?'Possible paper long: '+eligible.qty+' whole shares at '+money(eligible.entry)+' (past completed bar); planned risk '+money(eligible.qty*(eligible.entry-eligible.stop))+'. No actual fill.':eligible.note;
 }
 function open(){
  const ready=eligibility();
  if(!ready.ok){report();return}
  const now=Date.now(),t={id:String(now)+'-'+state.trades.length,symbol:ready.symbol,side:'LONG',status:'open',entry:ready.entry,stop:ready.stop,qty:ready.qty,
   barTime:ready.barTime,recordedAt:new Date().toISOString(),fee_per_side:costPerSide};
  state.trades.unshift(t);save();report();
 }
 function close(){
  const x=state.last;const symbol=x?.analysis?.symbol,bar=x?.analysis?.last_bar_utc;
  const t=state.trades.find(t=>t.symbol===symbol&&t.status==='open');
  if(!t||!dt(bar)||Date.parse(bar)<=Date.parse(t.barTime)){report();return}
  const exit=Number(x.analysis.last);
  if(!Number.isFinite(exit)||exit<=0){report();return}
  t.exit=exit;t.exitBarTime=bar;t.closedAt=new Date().toISOString();t.status='closed';save();report();
 }
 function exportCSV(){
  const headers=['symbol','side','status','qty','entry','stop','reference_open_bar','reference_exit_bar','reference_exit','closed_at','realized_pnl_after_assumed_costs','result_in_R'];
  const q=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  const rows=state.trades.map(t=>[t.symbol,t.side,t.status,t.qty,t.entry,t.stop,t.barTime,t.exitBarTime||'',t.exit||'',t.closedAt||'',
    t.status==='closed'?pnl(t).toFixed(2):'',t.status==='closed'?rMultiple(t)?.toFixed(3):''].map(q).join(','));
  const blob=new Blob([[headers.join(','),...rows].join('\r\n')],{type:'text/csv;charset=utf-8'});
  const uri=URL.createObjectURL(blob),a=document.createElement('a');a.href=uri;a.download='rangeform-paper-practice.csv';
  document.body.append(a);a.click();a.remove();URL.revokeObjectURL(uri);
 }
 function bind(){
  $('paperOpen').addEventListener('click',open);
  $('paperClose').addEventListener('click',close);
  $('paperExport').addEventListener('click',exportCSV);
  $('paperKill').addEventListener('change',e=>{
   state.paused=e.target.checked;try{localStorage.setItem(KILL,String(state.paused))}catch{}
   report();
  });
  for(const id of ['riskAccount','riskPercent'])$(id)?.addEventListener('input',report);
  window.addEventListener('rangeform:agent-report',e=>{state.last=e.detail;report()});
  report();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
