/* Rangeform agent team: read-only client for server-computed roles. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const fixed=x=>Number.isFinite(x)?x.toFixed(1)+'%':'—';
const LABELS=['Market Regime','Opportunity Scanner','Trend','Momentum','Patterns','Volume','Support & Resistance','Macro','News & Catalysts','Risk Manager','Execution & Monitoring'];
function node(tag,cls,text){
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);
  return el;
}
function renderRoles(roles){
  const grid=$('agentGrid');grid.replaceChildren();
  if(!Array.isArray(roles)||roles.length!==11){grid.append(node('p','agent-placeholder','The server returned an incomplete agent roster. No trade conclusion is available.'));return;}
  roles.forEach((role,i)=>{
    const card=node('article','agent-role');
    const head=node('div','agent-role-head');
    head.append(node('span','agent-role-number',String(i+1).padStart(2,'0')));
    const title=node('div','agent-role-title');title.append(node('h3','',role.name||LABELS[i]));
    title.append(node('span','agent-role-status state-'+String(role.status||'unavailable').replace(/[^a-z-]/g,''),String(role.status||'unavailable').replaceAll('-',' ')));
    head.append(title);card.append(head);
    card.append(node('p','agent-role-summary',role.summary||'No evidence available.'));
    const evidence=Array.isArray(role.evidence)?role.evidence:[];
    if(evidence.length){
      const details=node('details','agent-evidence'),summary=node('summary','',evidence.length+' evidence checks');details.append(summary);
      const list=node('ul','');
      evidence.forEach(item=>{list.append(node('li','',String(item.check||'Check')+': '+String(item.note||item.status||'No detail')))});
      details.append(list);card.append(details);
    }
    grid.append(card);
  });
  $('rolesStatus').textContent='11 reviewed';
}
function render(result){
  const team=result?.agent_team;
  if(!team||!team.supervisor||team.mode!=='RESEARCH_ONLY'||!team.execution_gate){
    throw Error('The server did not return a verified research team response.');
  }
  $('supervisorStatus').textContent=team.supervisor.status||'WAIT';
  $('supervisorVerdict').textContent=team.supervisor.action||'WAIT';
  $('supervisorAgreement').textContent=fixed(team.supervisor.agreement_pct);
  $('supervisorReason').textContent=team.supervisor.reasoning||'No supported conclusion.';
  $('supervisorTimestamp').textContent=team.timestamp?new Date(team.timestamp).toLocaleString():'—';
  const gate=team.execution_gate;
  $('teamVeto').textContent=gate.decision==='NO_ORDER'?'NO ORDERS: '+gate.reason:'Unknown order gate: execution remains blocked.';
  renderRoles(team.specialists);
  const blocks=team.checks?.hard_vetoes||[];
  if(blocks.length){
    $('teamMessage').textContent=blocks.length+' safety veto(s) for '+team.symbol+'. '+blocks[0].reason;
    $('teamMessage').className='message error';
  }else{
    $('teamMessage').textContent=team.symbol+' · '+team.interval+' · '+(team.supervisor.status==='RESEARCH_WATCH'?'Research watch identified; no execution permission.':'No validated trade setup. Waiting for stronger evidence.');
    $('teamMessage').className='message';
  }
}
async function analyze(event){
  event.preventDefault();
  const symbol=$('teamSymbol').value.trim().toUpperCase(),interval=$('teamInterval').value;
  if(!/^[A-Z][A-Z0-9.\\-]{0,9}$/.test(symbol)||!['1min','5min','15min'].includes(interval)){
    $('teamMessage').textContent='Enter a valid symbol and chart interval.';$('teamMessage').className='message error';return;
  }
  const button=$('teamAnalyze');button.disabled=true;button.textContent='Reviewing…';
  $('teamMessage').textContent='Checking server-side market data. No simulated or real orders will be placed.';$('teamMessage').className='message';
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),25000);
  try{
    const query=new URLSearchParams({symbol,interval,news:'0'});
    const res=await fetch('/api/opportunity?'+query,{cache:'no-store',signal:ctrl.signal});
    const body=await res.json().catch(()=>({error:'Unexpected response'}));
    if(!res.ok)throw Error(body.error||'Market provider unavailable');
    render(body);
  }catch(error){
    $('teamMessage').textContent='Cannot complete this review: '+String(error?.message||error).slice(0,220)+'. No decision or order was made.';
    $('teamMessage').className='message error';
    $('supervisorStatus').textContent='UNAVAILABLE';
    $('supervisorVerdict').textContent='WAIT';
    $('supervisorAgreement').textContent='—';
    $('supervisorReason').textContent='No verified review could be completed.';
    $('supervisorTimestamp').textContent='—';
    $('rolesStatus').textContent='0 reviewed';
    $('agentGrid').replaceChildren(node('p','agent-placeholder','Provider data unavailable. Existing results were cleared; retry only after the feed is working.'));
  }finally{clearTimeout(timer);button.disabled=false;button.textContent='Run agent review'}
}
function init(){
  $('teamForm').addEventListener('submit',analyze);
  $('themeToggleAgent').addEventListener('click',()=>{
    const next=document.body.dataset.theme==='dark'?'light':'dark';
    if(window.RangeformTheme?.apply)window.RangeformTheme.apply(next);
    document.body.dataset.theme=next;
    try{localStorage.setItem('rf_v9_theme',next)}catch{}
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();