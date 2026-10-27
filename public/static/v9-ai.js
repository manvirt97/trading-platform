/* Integrated Rangeform research assistant. Rule-based evidence first; optional
   signed-in Cloudflare Workers AI when the provider actually exists. */
const $=id=>document.getElementById(id);
const state={discovery:null,user:null,aiReady:false,authReady:false,auth:null,signIn:null,signOut:null,selectedSymbol:null,claudeEnabled:false};
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
  state.claudeEnabled=Boolean(cfg.claude_enabled);
  $('claudeDeskStatus').textContent=state.claudeEnabled?'Claude configured · login required':'Claude key not configured';
  if(!cfg.ai_enabled&&!cfg.claude_enabled){
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
  state.aiReady=Boolean(cfg.ai_enabled);state.authReady=true;
  $('assistantSignIn').hidden=false;
  onAuthStateChanged(state.auth,user=>{
   state.user=user;
   $('assistantSignIn').hidden=!!user;
   $('assistantSignOut').hidden=!user;
   service(user?'AI sign-in connected':'Sign in for Cloudflare AI or Claude');
   $('claudeDeskStatus').textContent=state.claudeEnabled?(user?'Claude ready · 11 agents':'Claude configured · sign in'):'Claude API not enabled';
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
async function runClaudeCouncil(){
 const badge=$('claudeDeskStatus'),btn=$('runClaudeCouncil');
 const symbol=state.selectedSymbol||document.getElementById('symbolInput')?.value?.trim().toUpperCase();
 const interval=document.getElementById('barInterval')?.value||'5min';
 if(!state.claudeEnabled){badge.textContent='Claude not configured';$('claudeDeskIntro').textContent='Cloudflare needs ANTHROPIC_API_KEY, CLAUDE_AGENTS_ENABLED=on, Firebase and D1.';return}
 if(!state.user){badge.textContent='Google sign-in required';$('claudeDeskIntro').textContent='Open Overview → Evidence Assistant → Sign in with Google, then return to Trade signals.';return}
 if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol||'')){badge.textContent='Analyze a valid ticker first';return}
 btn.disabled=true;btn.textContent='Running 10 specialists + supervisor…';
 badge.textContent='Investigating '+symbol;
 const container=$('claudeAgentResults');container.replaceChildren();
 $('claudeSupervisor').replaceChildren();$('claudeSupervisor').append(document.createTextNode('Collecting market evidence and independent Claude specialist reports…'));
 try{
  const token=await state.user.getIdToken();
  const data=await getJSON('/api/claude-desk',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({symbol,interval})});
  badge.textContent='Claude completed · '+data.agents_count+' specialist/supervisor reports';
  $('claudeDeskIntro').textContent='Source: '+data.source+'. Last completed bar: '+time(data.bar_time)+'. Risk vetoes remain authoritative.';
  const top=$('claudeSupervisor');top.replaceChildren();
  const h=document.createElement('strong');h.textContent='FINAL DECISION: '+data.decision+' · '+data.claude_supervisor.state;
  const p=document.createElement('p');p.textContent=data.claude_supervisor.assessment;
  top.append(h,p);
  if(data.hard_vetoes?.length){const v=document.createElement('p');v.className='claude-veto';v.textContent='Hard veto: '+data.hard_vetoes.map(x=>x.agent+': '+x.reason).join(' | ');top.append(v)}
  for(const agent of data.claude_agents||[]){
   const block=document.createElement('article');block.className='claude-agent-entry';
   const name=document.createElement('strong');name.textContent=agent.name+' · '+agent.state;
   const summary=document.createElement('p');summary.textContent=agent.assessment;
   block.append(name,summary);container.append(block);
  }
 }catch(e){badge.textContent='Claude request unavailable';$('claudeSupervisor').textContent=e.message+'. No AI trading conclusion was generated.'}
 finally{btn.disabled=false;btn.textContent='Investigate with 11 Claude agents'}
}
async function inspectConnection(kind){
 const target=$('integrationResults'),button=$(kind==='tv'?'tvRefresh':'cronRefresh');
 if(!state.user){target.textContent='Google sign-in is required to view private alert and scheduled-scan records. Sign in from Overview → Evidence Assistant.';return}
 button.disabled=true;target.textContent='Checking authenticated '+(kind==='tv'?'TradingView alerts':'scheduled scanner')+'…';
 try{
  const token=await state.user.getIdToken();
  const result=await getJSON(kind==='tv'?'/api/tv-alerts':'/api/scheduled-opportunities',{headers:{Authorization:'Bearer '+token}});
  target.replaceChildren();
  const items=kind==='tv'?(result.items||[]):(result.items||[]);
  if(!items.length){target.textContent='No recorded '+(kind==='tv'?'TradingView webhook events':'scheduled scan candidates')+'. This is not evidence of a market opportunity.';return}
  for(const item of items.slice(0,10)){
   const row=document.createElement('div');row.className='integration-event';
   const headline=document.createElement('strong'),detail=document.createElement('span');
   headline.textContent=kind==='tv'?item.symbol+' · '+item.action:item.symbol+' · '+item.status;
   detail.textContent=kind==='tv'?time(item.received_at)+' · Unverified chart alert':time(item.bar_time)+' · Completed bar / '+(item.quality_score??'unknown')+'/100 alignment';
   row.append(headline,detail);target.append(row);
  }
 }catch(e){target.textContent='Connection unavailable: '+e.message}
 finally{button.disabled=false}
}
function bind(){
 window.addEventListener('rangeform:agent-report',event=>{state.selectedSymbol=event.detail?.analysis?.symbol||null});
 $('runClaudeCouncil')?.addEventListener('click',runClaudeCouncil);
 $('tvRefresh')?.addEventListener('click',()=>inspectConnection('tv'));
 $('cronRefresh')?.addEventListener('click',()=>inspectConnection('cron'));
 fetch('/api/status',{cache:'no-store'}).then(r=>r.json()).then(x=>{const el=$('tvState');if(el)el.textContent=x.tradingview_bridge_configured?'Receiver configured · verify webhook test delivery':'Not configured. Set dedicated token and TV_EVENTS KV.'}).catch(()=>{$('tvState').textContent='Status unavailable'});
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
