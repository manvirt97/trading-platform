/* Integrated Rangeform research assistant. Rule-based evidence first; optional
   signed-in Cloudflare Workers AI when the provider actually exists. */
const $=id=>document.getElementById(id);
const state={discovery:null,user:null,aiReady:false,authReady:false,auth:null,signIn:null,signOut:null};
const answer=(txt)=>{$('assistantAnswer').textContent=txt;};
const service=(txt)=>{$('assistantService').textContent=txt;};
const authStatus=(txt)=>{$('assistantAuthState').textContent=txt;};
const fmt=x=>Number.isFinite(Number(x))?'$'+Number(x).toFixed(2):'—';
const time=t=>{const d=new Date(t);return Number.isFinite(+d)?d.toLocaleString('en-CA',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'time unavailable'};
function groundedReply(type='best'){
 const d=state.discovery;
 if(!d?.items?.length){
  return 'No verified market scan is available. Connect an authorized price feed, then open Overview and let the six-stock sample scanner run. I cannot determine current trades without those bars.';
 }
 const leader=d.items[0],name=leader.symbol;
 const heads=(leader.news_headlines||[]).slice(0,2);
 const headlines=heads.length?heads.map(x=>x.title+' ('+x.source+', '+time(x.date)+')').join(' · '):'No independently verified recent company news in this response.';
 const patterns=(leader.supporting_patterns||[]).map(x=>x.name).join(', ')||'No named candlestick pattern confirmed';
 const common='This is a six-stock sample, NOT whole-market coverage. Candles are completed historical bars. Check a broker quote, spread and upcoming catalysts before acting.';
 if(type==='risks')return 'Risk review for '+name+': '+leader.reason+' Last bar: '+time(leader.bar_time)+'. Relative volume: '+(leader.relative_volume??'unavailable')+'×. No verified execution spread, slippage, or portfolio constraints. Breakouts can fail, and stop prices may not fill as expected. '+common;
 if(type==='patterns')return 'Candle-pattern research for '+name+': '+patterns+'. '+(leader.opening_range?'Opening range high '+fmt(leader.opening_range.high)+' and low '+fmt(leader.opening_range.low)+'.':'Opening range not validated for the current session.')+' Technical alignment '+(leader.quality_score??'unknown')+'/100 is NOT a likelihood of profit. '+common;
 return 'Highest-ranked research candidate in this limited scan: '+name+'. Status: '+leader.status.replaceAll('_',' ')+'. '+leader.reason+' Indicators: '+(leader.quality_score??'unknown')+'/100 alignment. Patterns: '+patterns+'. News: '+headlines+'. '+common;
}
async function getJSON(path,opts={}){
 const response=await fetch(path,{cache:'no-store',...opts});
 let payload;try{payload=await response.json()}catch{throw Error('Invalid response from the server.')}
 if(!response.ok||payload.error){const err=new Error(payload.error||'Service unavailable');err.status=response.status;err.code=payload.code;throw err}
 return payload;
}
async function initAuth(){
 try{
  const cfg=await getJSON('/api/profile-config');
  if(!cfg.ai_enabled){
   service('AI model unavailable');
   authStatus(!cfg.enabled?'Google account/D1 configuration unavailable. Evidence explanations remain usable.':'Cloudflare AI binding or AI_ENABLED is missing. Evidence explanations remain usable.');
   return;
  }
  service('AI model available · sign in');
  authStatus('Loading secure Google sign-in…');
  const [{initializeApp,getApps,getApp},{getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut,setPersistence,browserSessionPersistence}]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')
  ]);
  const app=getApps().length?getApp():initializeApp(cfg.firebase);
  state.auth=getAuth(app);await setPersistence(state.auth,browserSessionPersistence);
  state.signIn=async()=>{
   const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
   await signInWithPopup(state.auth,provider);
  };
  state.signOut=async()=>signOut(state.auth);
  state.aiReady=true;state.authReady=true;
  $('assistantSignIn').hidden=false;
  onAuthStateChanged(state.auth,user=>{
   state.user=user;
   $('assistantSignIn').hidden=!!user;
   $('assistantSignOut').hidden=!user;
   service(user?'AI model connected':'AI model ready · sign in');
   authStatus(user?'Signed in as '+(user.email||'Google user')+' · authenticated requests only':'Sign in with Google to use Cloudflare AI. Evidence explanations require no sign-in.');
  });
 }catch(e){
  service('AI sign-in unavailable');
  authStatus('Unable to initialize Google login: '+e.message+'. Check Cloudflare and authorized Firebase domains.');
 }
}
function explain(){
 const query=$('assistantQuestion').value.trim().toLowerCase();
 const type=/risk|loss|wrong|danger|caution|slippage|stop/.test(query)?'risks':/candle|pattern|chart|engulf|hammer|wick/.test(query)?'patterns':'best';
 answer('RULE-BASED MARKET EVIDENCE\n\n'+groundedReply(type));
}
async function useModel(){
 if(!state.aiReady){answer('AI MODEL UNAVAILABLE\n\n'+$('assistantAuthState').textContent+'\n\nRule-based analysis:\n'+groundedReply());return}
 if(!state.user){answer('SIGN-IN REQUIRED\n\nChoose “Sign in with Google” below. This prevents public anonymous AI usage and protects research history.\n\nEvidence summary:\n'+groundedReply());return}
 const question=$('assistantQuestion').value.trim()||'Review available historical market evidence, technical trend, volume and risks. Do not invent prices, returns, or recommended orders.';
 const symbol=state.discovery?.items?.[0]?.symbol||'';
 const button=$('assistantUseAI');button.disabled=true;button.textContent='Asking model…';answer('Requesting evidence-based AI explanation…');
 try{
  const token=await state.user.getIdToken();
  const response=await getJSON('/api/research-ai',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({question:question.slice(0,450),symbol,model:'balanced',
    chart:symbol?{symbol,interval:'5min'}:null})});
  answer('CLOUDFLARE AI · '+(response.model||'Research model')+'\n\n'+response.answer+'\n\n'+(response.limitations||'Confirm data and execution independently.'));
 }catch(e){
  const message=e.status===401?'Your Google sign-in is no longer valid. Sign out and sign in again.':e.message;
  answer('AI REQUEST COULD NOT COMPLETE\n\n'+message+'\n\nThe app can still explain the most recent validated scan without AI:\n'+groundedReply());
 }finally{button.disabled=false;button.textContent='Ask AI model'}
}
function bind(){
 window.addEventListener('rangeform:discovery',event=>{state.discovery=event.detail;const data=state.discovery;
  if(data?.items?.length)answer('SCAN UPDATED · '+time(data.checked_at)+'\n\n'+groundedReply());
  else answer('MARKET DATA NOT READY\n\n'+(data?.reason||'No verified scan available.'));
 });
 document.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>{
  const queries={best:'Explain the strongest setup',risks:'What could go wrong?',patterns:'Analyze candle patterns'};
  $('assistantQuestion').value=queries[btn.dataset.preset]||'Explain market evidence';
  answer('RULE-BASED MARKET EVIDENCE\n\n'+groundedReply(btn.dataset.preset));
 }));
 $('assistantExplain').addEventListener('click',explain);
 $('assistantQuestion').addEventListener('keydown',e=>{if(e.key==='Enter')explain()});
 $('assistantUseAI').addEventListener('click',useModel);
 $('assistantSignIn').addEventListener('click',async()=>{try{await state.signIn?.()}catch(e){authStatus('Google sign-in failed: '+e.message+'. Check pop-up restrictions and authorized domain.')}});
 $('assistantSignOut').addEventListener('click',async()=>{try{await state.signOut?.()}catch(e){authStatus('Sign-out failed: '+e.message)}});
 initAuth();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
