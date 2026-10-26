/* Rangeform Experience 5.0. Source-aware search, public news discovery, secure AI. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dec=(date)=>{let d=Date.parse(date),age=Date.now()-d;if(!Number.isFinite(age)||age<0)return 'Time unverified';if(age<3600000)return Math.max(1,Math.floor(age/60000))+'m ago';if(age<86400000)return Math.floor(age/3600000)+'h ago';return Math.floor(age/86400000)+'d ago'};
let newsCache=null,newsLast=0,currentUser=null,auth=null,authReady=false,aiReady=false,fetchSeq=0,commandItems=[],commandIndex=0;
const getJson=async(path,options={})=>{const resp=await fetch(path,{cache:'no-store',...options}),data=await resp.json().catch(()=>({}));if(!resp.ok)throw Error(data.error||'This service is temporarily unavailable');return data};
const sleepDebounce=(func,delay=160)=>{let id;return(...args)=>{clearTimeout(id);id=setTimeout(()=>func(...args),delay)}};
async function matches(term){try{return (await getJson('/api/symbol-search?q='+encodeURIComponent(term))).items||[]}catch{return []}}
const likelyTicker=t=>/^[A-Za-z][A-Za-z0-9.-]{0,9}$/.test(t.trim())?t.trim().toUpperCase():null;
async function resolveInput(term){let cleaned=term.trim();if(!cleaned)return null;let response=await getJson('/api/symbol-search?q='+encodeURIComponent(cleaned));if(response.exact)return response.exact;if(response.items.length===1)return response.items[0];if(response.items.some(i=>i.symbol===cleaned.toUpperCase()))return response.items.find(i=>i.symbol===cleaned.toUpperCase());if(likelyTicker(cleaned))return {symbol:likelyTicker(cleaned),exchange:'NASDAQ',name:cleaned};return null}
function marketCode(item){return (item.exchange||'NASDAQ')+':'+item.symbol}
function updateChart(item){const widget=$('rfTradingChart');if(!widget)return;const market=marketCode(item);widget.setAttribute('symbol',market);widget.symbol=market;widget.setAttribute('theme',document.body.dataset.theme==='light'?'light':'dark');$('liveChartSearch').value=item.name||item.symbol;const card=widget.closest('.chart-browser');card?.querySelector('.kicker')?.setAttribute('title','Now showing '+market)}
async function chartGo(){const input=$('liveChartSearch');const item=await resolveInput(input.value);if(!item){window.toast?.('Please select a company from suggestions or enter a ticker.','error');return}updateChart(item)}
function commandShow(show){$('commandOverlay').hidden=!show;document.body.style.overflow=show?'hidden':'';if(show){$('commandInput').value='';drawCommand('');$('commandInput').focus()}else $('commandTrigger')?.focus()}
function makeButton(title,subtitle,icon,fn){const btn=document.createElement('button');btn.type='button';btn.className='command-result';btn.innerHTML='<span class="command-symbol">'+escape(icon)+'</span><span><strong>'+escape(title)+'</strong><small>'+escape(subtitle)+'</small></span><span class="command-arrow">↗</span>';btn.onclick=()=>{commandShow(false);fn()};return btn}
async function drawCommand(q){
 const seq=++fetchSeq,root=$('commandResults');
 const items=q?await matches(q):[];
 if(seq!==fetchSeq)return;
 root.replaceChildren();commandItems=[];commandIndex=0;
 const add=el=>{root.append(el);commandItems.push(el)};
 for(const item of items.slice(0,6))add(makeButton(item.name+' · '+item.symbol,item.exchange+' · Explore news and technical evidence',item.symbol,()=>{updateChart(item);$('newsSymbol').value=item.name;go('news')}));
 if(q.trim())add(makeButton('Find news about “'+q.slice(0,70)+'”','Search public articles for this company or market topic','≡',()=>{$('newsSymbol').value=q;go('news')}));
 for(const [label,page,icon] of [['Overview','overview','◫'],['Signals','signals','⌁'],['News & catalysts','news','≡'],['Research AI','copilot','✳'],['Market radar','radar','◎']]){if(!q||label.toLowerCase().includes(q.toLowerCase()))add(makeButton(label,'Open Rangeform workspace',icon,()=>go(page)))}
 if(!commandItems.length){let note=document.createElement('p');note.className='loading-news';note.textContent='No matching company in the curated directory. Search the news topic instead.';root.append(note)}
 commandItems[0]?.classList.add('active');
}
function newsMarkup(d){
 const dest=$('newsRows');dest.replaceChildren();
 if(!d.items.length){dest.innerHTML='<div class="empty-state"><strong>No verified articles returned for this search.</strong><p>Try a company name or a broader topic. A missing result is not proof there is no news.</p></div>';return}
 d.items.slice(0,24).forEach((item,i)=>{let link;try{link=new URL(item.url);if(link.protocol!=='https:')return}catch{return}
  const a=document.createElement('a');a.className='news-item news-story';a.href=link.href;a.target='_blank';a.rel='noopener noreferrer';
  const num=document.createElement('span');num.className='story-number';num.textContent=String(i+1).padStart(2,'0');
  const main=document.createElement('div'),meta=document.createElement('div'),h=document.createElement('strong'),source=document.createElement('span');
  meta.className='story-top';meta.textContent=(item.topic||'MARKETS')+' · '+dec(item.date);
  h.textContent=item.title;source.className='story-source';source.textContent=(item.source||'Public publisher')+' · '+new Date(item.date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  main.append(meta,h,source);let arrow=document.createElement('span');arrow.className='news-arrow';arrow.textContent='↗';a.append(num,main,arrow);dest.append(a)
 })
}
async function loadNews(){
 const term=$('newsSymbol').value.trim(),req=++newsLast;
 $('fetchNews').disabled=true;$('newsCount').textContent='UPDATING';
 $('newsRows').innerHTML='<div class="loading-news"><span class="loading-orbit"></span>Searching recent headlines…</div>';
 try{
  const data=await getJson('/api/news?'+new URLSearchParams({q:term,region:'CA'}));
  if(req!==newsLast)return;
  $('newsProvider').textContent=data.provider||'Public news';$('newsCount').textContent=data.items.length+' ARTICLES'+(data.availability==='partial'?' · PARTIAL':'');
  $('newsFoot').textContent=data.note||'Original publication and freshness should be verified.';
  newsMarkup(data);
  newsCache=data;
 }catch(e){
  if(req!==newsLast)return;
  $('newsProvider').textContent='SOURCE UNAVAILABLE';$('newsCount').textContent='RETRY';
  const root=$('newsRows');root.replaceChildren();let box=document.createElement('div');box.className='empty-state';let title=document.createElement('strong');title.textContent='Public headlines are temporarily unavailable';let note=document.createElement('p');note.textContent=e.message+' — this does not mean the market is quiet.';let link=document.createElement('a');link.href='https://news.google.com/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Browse Google News directly ↗';box.append(title,note,link);root.append(box);$('newsFoot').textContent='No invented stories or fake “live” alert.'
 }finally{if(req===newsLast)$('fetchNews').disabled=false}
}
async function loadPulse(){
 const root=$('overviewNewsPulse');if(!root)return;
 try{let d=await getJson('/api/news?region=CA');root.replaceChildren();
   for(const item of d.items.slice(0,5)){let a=document.createElement('a');a.className='pulse-article';a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';let dot=document.createElement('span');dot.className='pulse-dot';let content=document.createElement('span');let title=document.createElement('strong');title.textContent=item.title;let sub=document.createElement('small');sub.textContent=(item.source||'Public news')+' · '+dec(item.date);content.append(title,sub);a.append(dot,content);root.append(a)}
   if(!d.items.length)root.textContent='No recent public headlines returned. Open the news desk for a broader search.';
 }catch{root.innerHTML='<div class="loading-news">Market headlines are unavailable right now. <a href="https://news.google.com/" target="_blank" rel="noopener noreferrer">Browse the source ↗</a></div>'}
}
function chat(role,message){const root=$('copilotThread'),row=document.createElement('div'),span=document.createElement('span');row.className='chat-row '+role;span.className='chat-bubble';span.textContent=message;row.append(span);root.append(row);root.scrollTop=root.scrollHeight;return span}
function aiState(label,isEnabled){$('copilotState').textContent=label;$('copilotBadge').textContent=isEnabled?'AI READY':'SIGN-IN / SETUP';$('copilotSend').disabled=!isEnabled;if($('copilotSignIn'))$('copilotSignIn').hidden=!(authReady&&!currentUser)}
async function setupAI(){
 aiState('Checking your secure research account…',false);
 try{
  const config=await getJson('/api/profile-config');aiReady=Boolean(config.ai_enabled);
  if(!config.enabled){aiState('Account setup incomplete; use My workspace',false);return}
  const [{initializeApp},{getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')]);
  auth=getAuth(initializeApp(config.firebase,'rangeform-intelligence'));authReady=true;
  window.rangeformGoogleSignIn=()=>signInWithPopup(auth,new GoogleAuthProvider());
  onAuthStateChanged(auth,user=>{currentUser=user;if(!user)aiState('Sign in with Google to ask the AI',false);else if(!aiReady)aiState('Signed in · AI binding not yet enabled',false);else aiState('Signed in · ready to analyze research questions',true)});
 }catch(e){aiState('Unable to initialize AI sign-in: '+e.message,false)}
}
async function sendAI(question){
 const text=String(question||'').trim();if(text.length<4){$('copilotQuestion').focus();return}
 if(!currentUser){chat('assistant','Google sign-in is required to protect your private questions and daily AI allowance. Open My workspace to sign in, then return here.');return}
 if(!aiReady){chat('assistant','The AI model is not activated in Cloudflare yet. You can still explore public news, interactive charts and signals.');return}
 chat('user',text);$('copilotQuestion').value='';$('copilotSend').disabled=true;
 const bubble=chat('assistant','Reviewing your question…');
 try{
  const token=await currentUser.getIdToken();
  const res=await getJson('/api/research-ai',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({question:text,symbol:''})});
  bubble.textContent=res.answer||'No answer was returned';bubble.textContent+='\n\n'+(res.limitations||'Confirm any current facts independently.');
 }catch(e){bubble.textContent='Could not complete that AI request: '+e.message}
 finally{$('copilotSend').disabled=!aiReady||!currentUser}
}
function updateSession(){if(!$('sessionLocal'))return;let now=new Date(),zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',local=new Intl.DateTimeFormat('en-CA',{timeZone:zone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(now),name=zone==='America/Edmonton'?'Calgary':zone.split('/').at(-1).replaceAll('_',' ');$('sessionLocal').textContent=name+' · '+local;let parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now).map(z=>[z.type,z.value]));let minutes=Number(parts.hour)*60+Number(parts.minute),weekday=!['Sat','Sun'].includes(parts.weekday),inside=weekday&&minutes>=570&&minutes<960;$('sessionMarket').textContent=inside?'Within regular session hours · verify holidays':'Outside regular session hours';$('sessionMarket').title='Standard regular session is 9:30 a.m.–4:00 p.m. ET on trading weekdays. Exchange holidays and exceptional closures are not checked.'}
function bind(){
 if(!$('commandTrigger'))return;
 $('commandTrigger').onclick=()=>commandShow(true);$('commandClose').onclick=()=>commandShow(false);
 $('commandOverlay').addEventListener('click',e=>{if(e.target===$('commandOverlay'))commandShow(false)});
 $('commandInput').oninput=sleepDebounce(e=>drawCommand(e.target.value));
 $('commandInput').onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();commandItems[commandIndex]?.classList.remove('active');commandIndex=(commandIndex+(e.key==='ArrowDown'?1:-1)+commandItems.length)%Math.max(commandItems.length,1);commandItems[commandIndex]?.classList.add('active');commandItems[commandIndex]?.scrollIntoView({block:'nearest'})}if(e.key==='Enter'){e.preventDefault();commandItems[commandIndex]?.click()}};
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();commandShow($('commandOverlay').hidden)}if(e.key==='Escape'&&!$('commandOverlay').hidden)commandShow(false)});
 $('mobileMore').onclick=()=>$('sidebar').classList.add('open');
 document.querySelectorAll('[data-dock]').forEach(b=>b.onclick=()=>go(b.dataset.dock));
 window.addEventListener('rangeform:navigate',e=>{document.querySelectorAll('[data-dock]').forEach(b=>b.classList.toggle('on',b.dataset.dock===e.detail.page))});
 $('fetchNews').onclick=loadNews;
 $('newsSymbol').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();loadNews()}};
 document.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-topic]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');$('newsSymbol').value=b.dataset.topic;loadNews()}));
 $('liveChartGo').onclick=chartGo;
 $('liveChartSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();chartGo()}};
 const sharedDatalist=document.createElement('datalist');sharedDatalist.id='rangeformSymbols';document.body.append(sharedDatalist);
 const updateSuggestions=sleepDebounce(async(term)=>{let rows=await matches(term);sharedDatalist.replaceChildren();rows.forEach(r=>{let o=document.createElement('option');o.value=r.name;o.label=r.symbol+' / '+r.exchange;sharedDatalist.append(o)})},160);
 for(const id of ['symbolInput','liveChartSearch','newsSymbol']){const input=$(id);if(!input)continue;input.setAttribute('list','rangeformSymbols');input.addEventListener('input',()=>updateSuggestions(input.value))}
 const analyze=$('analyzeBtn');analyze.onclick=async()=>{let input=$('symbolInput'),original=input.value,known=await resolveInput(original);if(!known){window.toast?.('Select a suggested company or enter a valid ticker.','error');return}input.value=known.symbol;state.symbol=known.symbol;loadSignal()};
 $('symbolInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();analyze.click()}};
 $('copilotSignIn').onclick=async()=>{if(!authReady)return;try{await window.rangeformGoogleSignIn()}catch(e){aiState('Google sign-in could not complete: '+(e.code||e.message||'Unknown error'),false)}};
 $('copilotForm').onsubmit=e=>{e.preventDefault();sendAI($('copilotQuestion').value)};
 document.querySelectorAll('[data-ask]').forEach(b=>b.onclick=()=>{$('copilotQuestion').value=b.dataset.ask;$('copilotQuestion').focus()});
 $('copilotQuestion').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('copilotForm').requestSubmit()}});
 const themeObserver=new MutationObserver(()=>{$('rfTradingChart')?.setAttribute('theme',document.body.dataset.theme==='light'?'light':'dark')});themeObserver.observe(document.body,{attributes:true,attributeFilter:['data-theme']});
 updateSession();setInterval(updateSession,60000);loadPulse();setupAI();
}
window.rangeformExperience={loadNews,loadPulse};
document.addEventListener('DOMContentLoaded',bind);
})();