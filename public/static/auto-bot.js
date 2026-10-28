const $=id=>document.getElementById(id);
const money=x=>Number.isFinite(Number(x))?'$'+Number(x).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const dec=(x,d=6)=>Number.isFinite(Number(x))?Number(x).toLocaleString('en-CA',{maximumFractionDigits:d}):'—';
const state={user:null,auth:null,bot:null,busy:false};
function display(msg,kind=''){$('botMessage').textContent=String(msg);$('botMessage').className='message'+(kind?' '+kind:'')}
function buttons(ready){
 const bot=state.bot;
 $('startBot').disabled=!ready||state.busy||Boolean(bot?.enabled||bot?.halted);
 $('pauseBot').disabled=!ready||state.busy||!bot?.enabled;
 $('resetBot').disabled=!ready||state.busy||Boolean(bot?.enabled||bot?.position);
 $('runTick').disabled=!ready||state.busy||!bot?.enabled;
 $('flattenBot').disabled=!ready||state.busy||!bot?.position;
 $('exportBot').disabled=!bot?.events?.length;
}
async function api(method='GET',body=null){
 if(!state.user)throw Error('Sign in with the Google account chosen for your Rangeform workspace.');
 const headers={Authorization:'Bearer '+await state.user.getIdToken()};
 if(body)headers['Content-Type']='application/json';
 const r=await fetch('/api/auto-bot',{method,cache:'no-store',headers,body:body?JSON.stringify(body):undefined});
 const x=await r.json().catch(()=>({error:'Invalid response from the application server'}));
 if(!r.ok){const e=Error(x.error||'Server did not respond');e.code=x.code||'';throw e}
 return x;
}
function render(x){
 if(!x?.state)return;
 state.bot=x.state;const b=state.bot;
 $('botBadge').textContent=b.halted?'Risk halted':b.enabled?(x.background_scheduler==='RECENT_CRON_TICK'?'Paper automation recently active':'Paper enabled · cron unverified'):'Paper bot paused';
 $('botBadge').className='chip'+(b.halted?' bad':b.enabled?' ok':'');
 $('engineState').textContent=b.halted?'RISK HALT':b.enabled?'ENABLED':'PAUSED';
 $('lastCheck').textContent=b.lastTickAt?new Date(b.lastTickAt).toLocaleString('en-CA',{timeZone:'UTC',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Never';
 const cronVerified=x.background_scheduler==='RECENT_CRON_TICK';
 const cronTime=x.background_last_seen||b.lastCronTickAt;
 $('cronState').textContent=cronVerified?'RECENT WORKER TICK':'NOT VERIFIED';
 $('cronState').dataset.heartbeat=cronVerified?'verified':'unknown';
 $('cronLastSeen').textContent=cronTime?'Last scheduled: '+new Date(cronTime).toLocaleString('en-CA',{timeZone:'UTC',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})+(cronVerified?' · fresh':' · not recent'):'No scheduled Worker run recorded';
 $('signal').textContent=String(b.lastSignal||'—').replaceAll('_',' ');
 $('error').textContent=b.lastError||b.haltReason||'No outstanding feed error';
 $('startCapital').textContent=money(b.capital);$('paperCash').textContent=money(b.cash);
 $('pnl').textContent=money(b.realizedPnl);$('dayPnl').textContent=money(b.dayPnl);$('entries').textContent=String(b.entriesToday||0);
 $('holding').textContent=b.position?'BTC '+dec(b.position.qty)+' · cost '+money(b.position.cost):'Flat';
 $('resetCapital').value=String(b.capital);
 const tbody=$('events');tbody.replaceChildren();
 const events=(b.events||[]).slice(0,40);
 if(!events.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No server-side paper trades recorded.';tr.append(td);tbody.append(tr)}
 for(const e of events){const tr=document.createElement('tr');for(const value of [e.at,e.action,dec(e.qty),money(e.price),e.pnl===undefined?'—':money(e.pnl),e.reason||'—']){const td=document.createElement('td');td.textContent=String(value);tr.append(td)}tbody.append(tr)}
 buttons(true);
 if(b.halted)display('Safety stop triggered: '+(b.haltReason||'Risk guard')+'. No new paper orders will be generated.','error');
 else if(b.lastError)display('Feed check failed: '+b.lastError+'. No substituted prices or paper orders.','error');
 else if(b.enabled&&cronVerified)display('Paper strategy enabled and a recent scheduled Worker tick was recorded. This confirms recent paper automation only; no real orders are possible.','success');
 else if(b.enabled)display('Paper strategy enabled but autonomous scheduled operation is NOT verified. Deploy the separate Cloudflare Worker, then confirm a recent scheduled timestamp.','error');
 else display('Paper bot is paused. No automatic paper trades are being generated.');
}
async function refresh(){
 if(state.busy||!state.user)return;
 state.busy=true;buttons(false);
 try{const x=await api();render(x);$('connection').textContent='Signed-in owner, shared Cloudflare D1 paper ledger. Background scheduler requires separate Worker.'}
 catch(e){state.bot=null;$('botBadge').className='chip bad';$('botBadge').textContent='Not configured';display(e.message,'error');
  $('cronState').textContent='NOT CONFIGURED';$('cronState').dataset.heartbeat='unknown';$('cronLastSeen').textContent='Configure Pages owner settings and separate Worker';
  $('connection').textContent=e.code==='NOT_CONFIGURED'?'Cloudflare owner-only bot service is not yet enabled. See setup instructions below.':e.message;
  buttons(false)}
 finally{state.busy=false;buttons(Boolean(state.bot))}
}
async function action(kind,more={}){
 if(state.busy||!state.user)return;
 if(kind==='start'&&!confirm('Enable autonomous hypothetical trading? No real broker orders will be placed.'))return;
 if(kind==='flatten'&&!confirm('Model closing your open PAPER position at the current verified bid and pause the bot? No real exchange order will be placed.'))return;
 if(kind==='reset'&&!confirm('Erase server-side paper trades and reset the stopped, flat ledger?'))return;
 state.busy=true;buttons(false);
 try{
  const x=await api('POST',{action:kind,...more});
  if(x.state)render(x);
  if(kind==='run_once')display('Scheduled-equivalent paper tick: '+(x.status||'unknown')+' · '+(x.reason||'No trade')+'. No live order submitted.',x.status==='FEED_UNAVAILABLE'?'error':'success');
 }catch(e){display(e.message,'error')}
 finally{state.busy=false;await refresh()}
}
function exportCSV(){
 if(!state.bot?.events?.length)return;
 const headers=['timestamp_utc','action','pair','quantity','execution_price_usd','fees_assumed_usd','paper_pnl_usd','decision_reason'];
 const csv=[headers.join(','),...state.bot.events.map(e=>[e.at,e.action,e.pair,e.qty,e.price,e.fee,e.pnl,e.reason].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='rangeform-autonomous-paper-log.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function setupAuth(){
 try{
  const cfg=await fetch('/api/profile-config',{cache:'no-store'}).then(r=>r.json());
  if(!cfg.enabled||!cfg.firebase?.projectId){$('authState').textContent='Not configured';display('Google sign-in needs to be enabled first.','error');return}
  const [app,auth]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')]);
  const firebase=app.getApps().length?app.getApp():app.initializeApp(cfg.firebase);
  state.auth=auth.getAuth(firebase);
  auth.onAuthStateChanged(state.auth,user=>{
   state.user=user;
   $('authState').textContent=user?'Signed in':'Sign in required';
   $('uid').textContent=user?.uid||'—';
   if(user)refresh();else{state.bot=null;buttons(false);display('Open Account, sign in with Google, then return to this desk.','')}
  });
 }catch(e){$('authState').textContent='Unavailable';display('Unable to verify account sign-in: '+String(e.message).slice(0,130),'error')}
}
function init(){
 let theme;try{theme=localStorage.getItem('rf_v9_theme')||localStorage.getItem('rangeform_theme')||'light'}catch{theme='light'}
 if(!['light','dark','warm'].includes(theme))theme='light';
 window.RangeformTheme?.apply(theme);document.body.dataset.theme=theme;
 $('theme').addEventListener('click',()=>{const next=document.body.dataset.theme==='light'?'dark':'light';window.RangeformTheme?.apply(next);document.body.dataset.theme=next;try{localStorage.setItem('rf_v9_theme',next)}catch{}});
 $('refreshBot').addEventListener('click',refresh);
 $('startBot').addEventListener('click',()=>action('start'));
 $('pauseBot').addEventListener('click',()=>action('pause'));
 $('runTick').addEventListener('click',()=>action('run_once'));
 $('flattenBot').addEventListener('click',()=>action('flatten'));
 $('resetBot').addEventListener('click',()=>action('reset',{capital:Number($('resetCapital').value)}));
 $('exportBot').addEventListener('click',exportCSV);
 buttons(false);setupAuth();
 setInterval(()=>{if(document.visibilityState==='visible'&&!state.busy&&state.user)refresh()},30000);
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);
