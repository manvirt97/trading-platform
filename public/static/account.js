// Profiles are local until Firebase + D1 are BOTH configured. Never store ID tokens here.
const $=id=>document.getElementById(id);
const store=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
let auth=null,activeUser=null,api={},signed=false,configured=false,aiReady=false;
const blank=()=>({nickname:'',region:'CA',risk_profile:'learning',watchlist:[]});
let profile=read('trader_guest_profile',blank()),history=read('trader_guest_history',[]);
function status(message){$('accountStatus').querySelector('div').textContent=message}
function fields(){let f=profile||blank();$('nickname').value=f.nickname||'';$('region').value=f.region||'CA';$('riskMode').value=f.risk_profile||'learning';$('watchlist').value=(f.watchlist||[]).join(', ')}
function histories(){let list=$('historyList');list.replaceChildren();if(!history.length){let li=document.createElement('li');li.textContent='No saved research yet.';list.append(li);return}
 for(const r of history.slice(0,100)){let li=document.createElement('li'),bold=document.createElement('b'),note=document.createElement('span'),small=document.createElement('small');bold.textContent=r.symbol;note.textContent=r.note||'Research note';small.textContent=r.created_at||'';li.append(bold,note,small);
 let remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>removeItem(r.id);li.append(remove);list.append(li)}}
async function token(){if(!activeUser)throw Error('Sign in required');return await activeUser.getIdToken()}
async function request(path,method='GET',data=null){const headers={Authorization:'Bearer '+await token()};if(data)headers['Content-Type']='application/json';const res=await fetch(path,{method,headers,body:data?JSON.stringify(data):undefined,cache:'no-store'});const body=await res.json().catch(()=>({}));if(!res.ok)throw Error(body.error||'Request failed');return body}
async function refresh(){if(!signed)return;try{let data=await request('/api/profile');profile=data.profile||blank();history=data.history||[];fields();histories();status('Your workspace is private and saved for this signed-in account.');}catch(e){status('Private history is not ready: '+e.message)}}
async function removeItem(id){if(signed){try{await request('/api/profile','POST',{action:'removeHistory',id});await refresh()}catch(e){status(e.message)}}else{history=history.filter(h=>h.id!==id);store('trader_guest_history',history);histories();status('Removed from this browser')}}
$('profileForm').addEventListener('submit',async e=>{e.preventDefault();
 let watchlist=[...new Set($('watchlist').value.toUpperCase().split(',').map(x=>x.trim()).filter(x=>/^[A-Z0-9._-]{1,12}$/.test(x)))].slice(0,25);
 let p={action:'saveProfile',nickname:$('nickname').value.trim().slice(0,40),region:$('region').value,risk_profile:$('riskMode').value,timezone,watchlist};
 if(signed){try{await request('/api/profile','POST',p);status('Profile saved to your private account.');await refresh()}catch(e){status('Could not save: '+e.message)}}else{profile=p;store('trader_guest_profile',profile);status('Saved on this device only. Sign in when account sync becomes available.')}});
$('historyForm').addEventListener('submit',async e=>{e.preventDefault();let symbol=$('historyTicker').value.toUpperCase().trim(),note=$('historyNote').value.trim();if(!/^[A-Z0-9._-]{1,12}$/.test(symbol)){status('Enter a valid symbol');return}
 if(signed){try{await request('/api/profile','POST',{action:'saveHistory',symbol,kind:'research',note});$('historyNote').value='';await refresh()}catch(e){status('Could not save: '+e.message)}}else{history.unshift({id:crypto.randomUUID(),symbol,kind:'research',note,created_at:new Date().toISOString()});history=history.slice(0,100);store('trader_guest_history',history);$('historyNote').value='';histories();status('Note saved in this browser only.')}});
$('deleteData').addEventListener('click',async()=>{if(!confirm('Permanently delete your saved research notes and profile from this workspace?'))return;if(signed){try{await request('/api/profile','DELETE');profile=blank();history=[];fields();histories();status('Your saved account data was deleted.')}catch(e){status(e.message)}}else{localStorage.removeItem('trader_guest_profile');localStorage.removeItem('trader_guest_history');profile=blank();history=[];fields();histories();status('Local guest notes and preferences cleared.')}});
$('aiForm').addEventListener('submit',async e=>{e.preventDefault();if(!signed||!aiReady){status('AI requires a configured account and explicit Cloudflare AI activation.');return}
 const btn=$('askAI');btn.disabled=true;btn.textContent='Thinking…';try{const result=await request('/api/research-ai','POST',{symbol:$('aiTicker').value,question:$('aiQuestion').value});$('aiResponse').textContent=result.answer+'\n\n'+result.limitations;}catch(e){$('aiResponse').textContent=e.message}finally{btn.disabled=false;btn.textContent='Ask AI'}});
async function init(){fields();histories();if(/America\/(Edmonton|Vancouver|Toronto|Winnipeg|Halifax|Regina|St_Johns|Moncton|Whitehorse|Yellowknife|Iqaluit)/.test(timezone)&&!localStorage.getItem('trader_guest_profile')){$('region').value='CA'}
 try{let res=await fetch('/api/profile-config',{cache:'no-store'}),c=await res.json();configured=Boolean(c.enabled);aiReady=Boolean(c.ai_enabled);
 if(!configured){status('Guest mode: notes and preferences save ONLY on this device. Cross-device accounts require one-time owner setup in Firebase and Cloudflare D1.');$('authText').textContent='Your profile is stored only in this browser until sign-in is enabled.';return}
 let [{initializeApp},{getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')]);auth=getAuth(initializeApp(c.firebase));let provider=new GoogleAuthProvider();
 $('signIn').onclick=async()=>{try{await signInWithPopup(auth,provider)}catch(e){status('Google sign-in did not complete. Add this Pages domain in Firebase Authentication authorized domains. '+e.code)}};
 $('signOut').onclick=async()=>await signOut(auth);
 onAuthStateChanged(auth,async u=>{activeUser=u;signed=Boolean(u);$('signIn').hidden=signed;$('signOut').hidden=!signed;$('askAI').disabled=!signed||!aiReady;
 if(signed){$('authHeading').textContent='Signed in';$('authText').textContent=u.email||'Account connected';await refresh()}else{$('authHeading').textContent='Sign in for private sync';$('authText').textContent='Sign in with Google to save research across your devices.';profile=read('trader_guest_profile',blank());history=read('trader_guest_history',[]);fields();histories();status('Browsing as a guest. Notes stay on this device until you sign in.')}})
 }catch(e){status('Account service unavailable. Guest notes remain on this device.');$('authText').textContent='Accounts could not be initialized: '+e.message}}
}
init();