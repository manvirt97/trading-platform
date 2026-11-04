/* OpenAI Council v34: authenticated, owner-only, explicit paid API opt-in.
 * LLM text rendered only through textContent, no HTML injection.
 * Separate from deterministic agent-room and paper/live execution.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const state={user:null,ready:false,working:false};
function el(tag,cls,content){
 const result=document.createElement(tag);if(cls)result.className=cls;
 if(content!==undefined)result.textContent=String(content);
 return result;
}
function message(s,kind=''){
 $('councilMessage').textContent=String(s);
 $('councilMessage').className='message'+(kind?' '+kind:'');
}
function buttonState(){
 $('runOpenAICouncil').disabled=!state.user||!state.ready||state.working;
 $('checkCSO').disabled=!state.user||state.working;
}
async function api(path,post=null){
 if(!state.user)throw Error('Sign in to your Rangeform owner account first.');
 const token=await state.user.getIdToken();
 const response=await fetch(path,{method:post?'POST':'GET',cache:'no-store',
  headers:{Authorization:'Bearer '+token,...(post?{'Content-Type':'application/json'}:{})},
  body:post?JSON.stringify(post):undefined});
 const data=await response.json().catch(()=>({error:'Invalid server response.'}));
 if(!response.ok){const error=Error(data.error||'Server request failed.');error.code=data.code||'';throw error;}
 return data;
}
function renderPosture(security){
 const list=$('csoChecks');list.replaceChildren();
 if(!security||!Array.isArray(security.checks)){
  list.append(el('p','agent-placeholder','Unable to verify security posture.'));$('csoBadge').textContent='Unverified';return;
 }
 $('csoBadge').textContent=security.research_ready?'Research checks ready':'Needs configuration';
 for(const check of security.checks){
  const line=el('div','agent-cso-line');
  const text=el('div','agent-cso-copy');
  text.append(el('strong','',check.name),el('p','',check.detail));
  line.append(text,el('span','agent-role-status state-'+String(check.state||'limited'),check.state||'limited'));
  list.append(line);
 }
 list.append(el('p','agent-cso-caption',security.remediation||'All security changes require human review.'));
}
function makeReport(r){
 const card=el('article','agent-ai-report');
 const top=el('div','agent-ai-report-head');
 top.append(el('strong','',r.name||'Specialist'),el('span','agent-role-status state-'+String(r.state||'unavailable'),r.state||'unavailable'));
 card.append(top,el('p','',r.assessment||'No assessment returned.'));
 if(r.uncertainty)card.append(el('p','agent-ai-uncertainty','Limits: '+r.uncertainty));
 if(r.model)card.append(el('small','agent-ai-model',r.model));
 return card;
}
function renderCouncil(result){
 const root=$('councilResults');root.replaceChildren();
 const decision=el('div','agent-ai-decision');
 decision.append(el('strong','',result.decision?.research_verdict||'WAIT'));
 decision.append(el('span','',result.decision?.reason||'No supported research decision.'));
 root.append(decision);
 const supervisor=result.supervisor||{};
 const heading=el('h3','agent-ai-heading','AI Supervisor');
 root.append(heading,makeReport(supervisor));
 root.append(el('h3','agent-ai-heading','Specialist research'));
 const specialists=el('div','agent-ai-grid');
 for(const r of result.specialists||[])specialists.append(makeReport(r));
 root.append(specialists);
 root.append(el('h3','agent-ai-heading','CSO AI review'));
 root.append(makeReport(result.cso||{name:'CSO Security Agent',state:'unavailable'}));
 root.append(el('p','agent-cso-caption','Execution: '+String(result.decision?.execution||'NO_ORDER')+
  ' · AI input tokens: '+Number(result.usage?.input||0)+' · output tokens: '+Number(result.usage?.output||0)+
  ' · Independent agent responses are not market forecasts.'));
 if(result.security)renderPosture(result.security);
 $('csoBadge').textContent=result.security?.research_ready?'Research checks ready':'Needs review';
 message(result.partial?'Some model calls failed. Hard risk and security controls remain active.':'OpenAI council completed. No paper or live order was placed.');
}
async function check(){
 if(!state.user||state.working)return;
 state.working=true;buttonState();
 try{
  const [security,config]=await Promise.all([api('/api/cso-status'),api('/api/openai-council')]);
  renderPosture(security.security);
  state.ready=Boolean(config.configured);
  $('openaiAvailability').textContent=state.ready?'API connected':'API setup required';
  message(state.ready?'Owner verified; OpenAI Council is configured. Model calls use separate API credits.':
   'CSO checks available; OpenAI Council needs a private API key, explicit enable flag and audit migration before it can run.');
 }catch(e){
  state.ready=false;
  $('openaiAvailability').textContent='Unavailable';
  $('csoBadge').textContent='Unverified';
  $('csoChecks').replaceChildren(el('p','agent-placeholder','Security status unavailable. '+e.message));
  message('Owner authentication or Cloudflare configuration needs attention: '+e.message,'error');
 }finally{state.working=false;buttonState()}
}
async function run(){
 if(!state.user||!state.ready||state.working)return;
 const mode=$('councilMode').value;
 if(!['focused','full'].includes(mode))return;
 const symbol=$('teamSymbol').value.trim().toUpperCase();
 const interval=$('teamInterval').value;
 if(!/^[A-Z][A-Z0-9.\\-]{0,9}$/.test(symbol)||!['1min','5min','15min'].includes(interval)){message('Enter a valid symbol and chart interval first.','error');return;}
 if(!confirm('Run '+(mode==='full'?'11':'4')+' paid OpenAI specialist calls plus CSO and Supervisor? API charges may apply. No orders can be placed.'))return;
 state.working=true;buttonState();
 message('Reading verified market data and coordinating the AI specialists. No trading orders will be placed.');
 const control=new AbortController();const timeout=setTimeout(()=>control.abort(),115000);
 try{
  // Explicit on-click action. Never auto-bill on page load.
  const response=await fetch('/api/openai-council',{method:'POST',cache:'no-store',
   headers:{Authorization:'Bearer '+await state.user.getIdToken(),'content-type':'application/json'},
   body:JSON.stringify({symbol,interval,mode}),signal:control.signal});
  const data=await response.json().catch(()=>({error:'Invalid model response'}));
  if(!response.ok)throw Error(data.error||'Investigation could not be completed.');
  renderCouncil(data);
 }catch(e){
  message('OpenAI Council did not complete: '+String(e.message).slice(0,220)+'. Do not treat missing reports as market signals.','error');
 }finally{clearTimeout(timeout);state.working=false;buttonState()}
}
async function setupAuth(){
 try{
  const config=await fetch('/api/profile-config',{cache:'no-store'}).then(r=>r.json());
  if(!config.enabled||!config.firebase?.projectId){
   $('openaiAvailability').textContent='Sign-in unavailable';
   message('Firebase sign-in is not configured. Open Account to review authentication settings.','error');return;
  }
  const [app,auth]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')
  ]);
  const instance=app.getApps().length?app.getApp():app.initializeApp(config.firebase);
  auth.onAuthStateChanged(auth.getAuth(instance),user=>{
   state.user=user;state.ready=false;buttonState();
   if(user)check();
   else{
    $('openaiAvailability').textContent='Sign in required';
    $('csoBadge').textContent='Not checked';
    message('Sign in to Account with the configured owner profile, then return to the Agent Team.');
   }
  });
 }catch{message('Unable to check the Firebase login. No paid API call was made.','error')}
}
function init(){
 $('checkCSO').addEventListener('click',check);
 $('runOpenAICouncil').addEventListener('click',run);
 buttonState();setupAuth();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();