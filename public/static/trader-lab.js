// Rangeform V29 · single-click scenario replay, deliberately no broker actions.
// All output uses textContent. No background polling, local storage or AI-generated quotes.
(()=>{'use strict';
 const el=id=>document.getElementById(id);
 const field=id=>el(id)?.value?.trim()||'';
 const node=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=String(txt);return x};
 const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('en-CA',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
 const clear=message=>{const out=el('trader-lab-output');if(out)out.replaceChildren(node('p','trader-lab-intro',message))};
 const warn=text=>{const x=node('p','trader-lab-warning',text);return x};
 let inFlight=false,version=0;
 function useLevels(){
  const gate=el('day-use-levels');
  if(!gate||gate.disabled){clear('No qualified current-session reference is available. Enter your own hypothetical long-only entry, stop and target.');return}
  const value=id=>Number((el(id)?.textContent||'').replace(/[$,]/g,''));
  const entry=value('day-entry'),stop=value('day-stop'),target=value('day-target');
  if(![entry,stop,target].every(Number.isFinite)||!(stop<entry&&entry<target)){clear('The completed-bar reference has invalid levels.');return}
  el('trader-lab-entry').value=String(entry);el('trader-lab-stop').value=String(stop);el('trader-lab-target').value=String(target);
  clear('Qualified historical reference copied. These are NOT executable broker orders. Press Run simulation to check illustrative paths.');
 }
 function show(data){
  const out=el('trader-lab-output');out.replaceChildren();
  out.append(node('strong','trader-lab-verdict','10,000 RESAMPLED PATHS · RESEARCH ONLY'));
  const grid=node('div','trader-lab-stats');
  for(const [key,label] of [['target_first','Target first'],['stop_first','Stop first'],['neither','Neither at horizon']]){
   const tile=node('div','trader-lab-stat');
   tile.append(node('span','',label),node('strong','',fmt(data.frequency_pct?.[key])+'%'),
    node('small','',fmt(data.outcomes?.[key]||0,0)+' of '+fmt(data.paths,0)+' scenarios'));
   grid.append(tile);
  }
  out.append(grid);
  const quality=data.evidence?.sample_quality==='LIMITED_SESSIONS'?' · LIMITED SAMPLE':'';
  out.append(node('p','trader-lab-footnote','Evidence: '+data.evidence?.sample_returns+' completed-bar returns across '+
   data.evidence?.sessions+' US sessions'+quality+'. Last historical bar '+data.evidence?.last_bar_utc+
   '. Source: '+data.source+'. Horizon: '+data.horizon_bars+' × '+data.interval+'. Seed: '+data.seed+'.'));
  for(const message of data.warnings||[])out.append(warn(message));
 }
 async function run(){
  if(inFlight)return;
  const q={symbol:field('day-symbol').toUpperCase(),interval:field('day-interval'),
   entry:field('trader-lab-entry'),stop:field('trader-lab-stop'),target:field('trader-lab-target'),
   horizonBars:field('trader-lab-horizon')};
  if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(q.symbol)||
   ![q.entry,q.stop,q.target].every(x=>x!==''&&Number.isFinite(Number(x))&&Number(x)>0)||
   !(Number(q.stop)<Number(q.entry)&&Number(q.entry)<Number(q.target))||
   !Number.isInteger(Number(q.horizonBars))||Number(q.horizonBars)<3||Number(q.horizonBars)>48){
   clear('Enter a valid ticker, a 3–48 bar horizon, and long-only levels with stop < entry < target.');return
  }
  const id=++version,btn=el('trader-lab-run');inFlight=true;btn.disabled=true;btn.textContent='Resampling historical bars…';
  clear('Fetching licensed historical bars once. No trade will be placed.');
  try{
   const r=await fetch('/api/trader-lab?'+new URLSearchParams(q),{cache:'no-store',headers:{Accept:'application/json'}});
   const data=await r.json();
   if(id!==version)return;
   if(!r.ok||data.error)throw Error(data.error||'Simulation unavailable');
   if(data.state!=='SIMULATION_ONLY'||data.security?.broker_orders!==false||data.paths!==10000||data.symbol!==q.symbol)
    throw Error('Unexpected response. Simulation was not accepted.');
   show(data);
  }catch(e){if(id===version)clear('No replay produced: '+String(e.message||'Unable to fetch validated historical bars.').slice(0,240))}
  finally{inFlight=false;btn.disabled=false;btn.textContent='Run 10,000 scenarios'}
 }
 function risk(){
  const entry=Number(field('trader-lab-entry')),stop=Number(field('trader-lab-stop'));
  if(!Number.isFinite(entry)||!Number.isFinite(stop)||!(stop>0&&stop<entry)){
   clear('Enter a positive long entry and a stop below entry before calculating hypothetical size.');return
  }
  el('day-risk-entry').value=String(entry);el('day-risk-stop').value=String(stop);
  el('day-risk-calc').click();
  el('day-risk-result').scrollIntoView({behavior:'smooth',block:'center'});
 }
 function init(){
  if(!el('trader-lab-run'))return;
  el('trader-lab-run').addEventListener('click',run);
  el('trader-lab-levels').addEventListener('click',useLevels);
  el('trader-lab-risk').addEventListener('click',risk);
  for(const id of ['day-symbol','day-interval']){
   const e=el(id);e?.addEventListener(id==='day-symbol'?'input':'change',()=>{
    version++;clear('Symbol or interval changed. Review your scenario inputs and run again.');
   });
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
