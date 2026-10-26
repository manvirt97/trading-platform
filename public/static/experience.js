/* Rangeform Experience 5.0. Source-aware search, public news discovery, secure AI. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dec=(date)=>{let d=Date.parse(date),age=Date.now()-d;if(!Number.isFinite(age)||age<0)return 'Time unverified';if(age<3600000)return Math.max(1,Math.floor(age/60000))+'m ago';if(age<86400000)return Math.floor(age/3600000)+'h ago';return Math.floor(age/86400000)+'d ago'};
let newsCache=new Map(),newsLast=0,newsCategory='all',currentUser=null,auth=null,authReady=false,aiReady=false,fetchSeq=0,commandItems=[],commandIndex=0;
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
const CATEGORY_CONTENT={
 all:{name:'All markets',subtitle:'Market-moving corporate, policy, and economic coverage.',title:'Read the story. Then read the reaction.',body:'A big headline is not a trade signal. Confirm the timing, affected securities, and whether the chart already reflects the news.',checks:['Is this new information or already priced in?','Do price and trading volume confirm the move?','What can invalidate the thesis?']},
 earnings:{name:'Earnings',subtitle:'Company earnings, revenue, guidance, and quarterly results.',title:'Earnings move expectations.',body:'A stock can fall after strong results if expectations were even higher. Compare guidance, margins, revisions and earnings-call context.',checks:['Results versus analyst expectations','Guidance and margin outlook','After-hours gaps, spread and liquidity']},
 rates:{name:'Fed & rates',subtitle:'Central banks, inflation releases, yields and rate policy.',title:'Rate decisions reprice the market.',body:'The surprise versus expectations matters more than the headline rate. Watch Treasury yields, growth stocks, currencies and bond-sensitive sectors.',checks:['Decision versus consensus','Treasury yields and market reaction','Press-conference and guidance surprises']},
 energy:{name:'Energy',subtitle:'Oil, natural gas, OPEC, pipelines and energy equities.',title:'Energy trades on more than oil.',body:'Crude prices, differentials, refinery margins, supply outages, FX, and corporate cash returns can drive different energy stocks in opposite directions.',checks:['WTI / WCS and gas price moves','Company-specific production and margin exposure','Inventory data, OPEC and geopolitical risk']},
 canada:{name:'Canada',subtitle:'TSX, Bank of Canada, Canadian equities and economic news.',title:'Connect Canadian news to the TSX.',body:'Canadian sectors respond differently to energy prices, the Canadian dollar, interest rates and cross-border demand.',checks:['TSX sector and CAD reaction','Bank of Canada and employment data','Company earnings and commodity exposure']},
 technology:{name:'Technology',subtitle:'Semiconductors, AI, software and large-cap technology.',title:'Separate hype from earnings power.',body:'AI demand and product announcements matter, but valuation, growth assumptions, chip supply and positioning determine the market reaction.',checks:['Revenue growth and forward guidance','Chip demand, supply and capital spending','Valuation, positioning and price confirmation']}
};
function updateNewsScope(){
 const def=CATEGORY_CONTENT[newsCategory]||CATEGORY_CONTENT.all;
 const term=$('newsSymbol').value.trim();
 $('newsScopeTitle').textContent=def.name+(term?' · '+term:'');
 $('newsScopeSubtitle').textContent=def.subtitle;
 $('newsListHeading').textContent=term?'Stories matching '+term:'Latest '+def.name.toLowerCase()+' stories';
 $('newsInsightTitle').textContent=def.title;
 $('newsInsightText').textContent=def.body;
 const checklist=$('newsInsightChecks');checklist.replaceChildren();
 def.checks.forEach(item=>{const row=document.createElement('div');row.className='news-check';const glyph=document.createElement('span');glyph.textContent='✓';const content=document.createElement('span');content.textContent=item;row.append(glyph,content);checklist.append(row)});
 document.querySelectorAll('[data-category]').forEach(button=>{const active=button.dataset.category===newsCategory;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active))});
}
function newsMarkup(data){
 const dest=$('newsRows');dest.replaceChildren();
 if(!data.items.length){
  const box=document.createElement('div');box.className='empty-state news-empty';
  const heading=document.createElement('strong');heading.textContent='No matching stories in '+(data.category_label||'this category');
  const note=document.createElement('p');note.textContent=data.note||'No matching recent headlines were verified. This does not mean there is no market news.';
  const alt=document.createElement('a');alt.href='https://news.google.com/';alt.target='_blank';alt.rel='noopener noreferrer';alt.textContent='Browse the public news source ↗';
  box.append(heading,note,alt);dest.append(box);return;
 }
 data.items.slice(0,24).forEach((item,i)=>{
  let url;try{url=new URL(item.url);if(url.protocol!=='https:')return}catch{return}
  const a=document.createElement('a');a.className='news-item news-story'+(i===0?' featured-news':'');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';
  const num=document.createElement('span');num.className='story-number';num.textContent=i===0?'TOP':String(i+1).padStart(2,'0');
  const main=document.createElement('div'),meta=document.createElement('div'),title=document.createElement('strong'),source=document.createElement('span');
  meta.className='story-top';meta.textContent=(item.topic||data.category_label||'MARKETS')+' · '+dec(item.date);
  title.textContent=item.title;source.className='story-source';source.textContent=(item.source||'Public publisher')+' · '+new Date(item.date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  main.append(meta,title,source);const arrow=document.createElement('span');arrow.className='news-arrow';arrow.textContent='↗';
  a.append(num,main,arrow);dest.append(a)
 })
}
async function loadNews({refresh=false}={}){
 const term=$('newsSymbol').value.trim(),category=newsCategory,req=++newsLast;
 const key=category+'|'+term.toLowerCase()+'|CA';
 updateNewsScope();
 const cached=newsCache.get(key);
 if(!refresh&&cached&&Date.now()-cached.savedAt<90000){renderNews(cached.data);return}
 $('fetchNews').disabled=true;$('newsCount').textContent='SEARCHING';
 $('newsProvider').textContent=CATEGORY_CONTENT[category].name.toUpperCase()+' · TOPIC FILTER';$('newsRows').innerHTML='<div class="loading-news"><span class="loading-orbit"></span>Finding '+CATEGORY_CONTENT[category].name.toLowerCase()+' headlines from public publishers…</div>';
 try{
  const data=await getJson('/api/news?'+new URLSearchParams({q:term,category,region:'CA'}));
  if(req!==newsLast)return;
  newsCache.set(key,{data,savedAt:Date.now()});
  renderNews(data);
 }catch(e){
  if(req!==newsLast)return;
  $('newsProvider').textContent='NEWS SOURCES UNAVAILABLE';$('newsCount').textContent='SOURCE ERROR';
  $('newsFreshness').textContent='Feed unavailable';
  const root=$('newsRows');root.replaceChildren();const box=document.createElement('div');box.className='empty-state';
  const title=document.createElement('strong');title.textContent='Could not retrieve verified '+CATEGORY_CONTENT[category].name.toLowerCase()+' headlines';
  const note=document.createElement('p');note.textContent=e.message+' — no stories were invented or replaced by unrelated categories.';
  const link=document.createElement('a');link.href='https://news.google.com/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Browse Google News directly ↗';
  box.append(title,note,link);root.append(box);$('newsFoot').textContent='Public feeds can become temporarily unavailable.'
 }finally{if(req===newsLast)$('fetchNews').disabled=false}
}
function renderNews(data){
 $('newsProvider').textContent=(data.category_label||'Market')+' / PUBLIC HEADLINES';
 $('newsCount').textContent=data.items.length+' '+(data.items.length===1?'STORY':'STORIES')+(data.availability==='partial'?' · PARTIAL':'');
 $('newsFreshness').textContent='Checked '+new Date(data.as_of).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
 $('newsFoot').textContent=data.note||'Check original publication timestamps and market impact.';
 newsMarkup(data)
}
async function loadPulse(){
 const root=$('overviewNewsPulse');if(!root)return;
 try{let d=await getJson('/api/news?region=CA');root.replaceChildren();
   for(const item of d.items.slice(0,5)){let a=document.createElement('a');a.className='pulse-article';a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';let dot=document.createElement('span');dot.className='pulse-dot';let content=document.createElement('span');let title=document.createElement('strong');title.textContent=item.title;let sub=document.createElement('small');sub.textContent=(item.source||'Public news')+' · '+dec(item.date);content.append(title,sub);a.append(dot,content);root.append(a)}
   if(!d.items.length)root.textContent='No recent public headlines returned. Open the news desk for a broader search.';
 }catch{root.innerHTML='<div class="loading-news">Market headlines are unavailable right now. <a href="https://news.google.com/" target="_blank" rel="noopener noreferrer">Browse the source ↗</a></div>'}
}
function chat(role,message){const root=$('copilotThread'),row=document.createElement('div'),span=document.createElement('span');row.className='chat-row '+role;span.className='chat-bubble';span.textContent=message;row.append(span);root.append(row);root.scrollTop=root.scrollHeight;return span}
function aiState(label,isEnabled){$('copilotState').textContent=label;$('copilotBadge').textContent=isEnabled?'AI READY':'SIGN-IN / SETUP';$('copilotSend').disabled=!isEnabled;if($('copilotSignIn'))$('copilotSignIn').hidden=!authReady;$('copilotSignIn').textContent=currentUser?'Switch account':'Sign in with Google'}
async function setupAI(){
 aiState('Checking your secure research account…',false);
 try{
  const config=await getJson('/api/profile-config');aiReady=Boolean(config.ai_enabled);
  if(!config.enabled){aiState('Account setup incomplete; use My workspace',false);return}
  const [{initializeApp},{getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,setPersistence,browserSessionPersistence}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')]);
  auth=getAuth(initializeApp(config.firebase));await setPersistence(auth,browserSessionPersistence);authReady=true;
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  window.rangeformGoogleSignIn=()=>signInWithPopup(auth,provider);
  onAuthStateChanged(auth,user=>{const old=currentUser?.uid||null;currentUser=user;if(old!==(user?.uid||null)){$('copilotThread').replaceChildren();chat('assistant','Private research session. I can use your saved watchlist and research notes from this Google account, but I will not invent live prices or remember this chat automatically.');const key=user?'rangeform_model_'+user.uid:null;$('copilotModel').value=key&&sessionStorage.getItem(key)||'balanced';}if(!user)aiState('Sign in with your own Google account to ask AI',false);else if(!aiReady)aiState('Signed in · AI binding not yet enabled',false);else aiState('Signed in as '+(user.email||'Google user')+' · ready',true)});
 }catch(e){aiState('Unable to initialize AI sign-in: '+e.message,false)}
}
async function sendAI(question){
 const text=String(question||'').trim();if(text.length<4){$('copilotQuestion').focus();return}
 if(!currentUser){chat('assistant','Google sign-in is required to protect your private questions and daily AI allowance. Open My workspace to sign in, then return here.');return}
 if(!aiReady){chat('assistant','The AI model is not activated in Cloudflare yet. You can still explore public news, interactive charts and signals.');return}
 const owner=currentUser.uid,model=$('copilotModel').value;chat('user',text);$('copilotQuestion').value='';$('copilotSend').disabled=true;
 const bubble=chat('assistant','Reviewing your question…');
 try{
  const token=await currentUser.getIdToken();
  const res=await getJson('/api/research-ai',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({question:text,symbol:'',model})});
  if(currentUser?.uid!==owner)return;bubble.textContent=(res.model||'Research model')+'\n\n'+(res.answer||'No answer was returned');bubble.textContent+='\n\n'+(res.limitations||'Confirm any current facts independently.');
 }catch(e){if(currentUser?.uid===owner)bubble.textContent='Could not complete that AI request: '+e.message}
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
 $('mobileMore').onclick=()=>window.rangeformSidebar?.open();
 document.querySelectorAll('[data-dock]').forEach(b=>b.onclick=()=>go(b.dataset.dock));
 window.addEventListener('rangeform:navigate',e=>{document.querySelectorAll('[data-dock]').forEach(b=>b.classList.toggle('on',b.dataset.dock===e.detail.page))});
 $('fetchNews').onclick=()=>loadNews({refresh:true});
 $('newsSymbol').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();loadNews()}};
 document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{if(newsCategory===b.dataset.category)return;newsCategory=b.dataset.category;updateNewsScope();loadNews()}));
 $('liveChartGo').onclick=chartGo;
 $('liveChartSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();chartGo()}};
 const sharedDatalist=document.createElement('datalist');sharedDatalist.id='rangeformSymbols';document.body.append(sharedDatalist);
 const updateSuggestions=sleepDebounce(async(term)=>{let rows=await matches(term);sharedDatalist.replaceChildren();rows.forEach(r=>{let o=document.createElement('option');o.value=r.name;o.label=r.symbol+' / '+r.exchange;sharedDatalist.append(o)})},160);
 for(const id of ['symbolInput','liveChartSearch','newsSymbol']){const input=$(id);if(!input)continue;input.setAttribute('list','rangeformSymbols');input.addEventListener('input',()=>updateSuggestions(input.value))}
 const analyze=$('analyzeBtn');analyze.onclick=async()=>{let input=$('symbolInput'),original=input.value,known=await resolveInput(original);if(!known){window.toast?.('Select a suggested company or enter a valid ticker.','error');return}input.value=known.symbol;state.symbol=known.symbol;loadSignal()};
 $('symbolInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();analyze.click()}};
 $('copilotSignIn').onclick=async()=>{if(!authReady)return;try{await window.rangeformGoogleSignIn()}catch(e){aiState('Google account selection did not complete: '+(e.code||e.message||'Unknown error'),Boolean(currentUser&&aiReady))}};
 $('copilotModel').onchange=()=>{if(currentUser)sessionStorage.setItem('rangeform_model_'+currentUser.uid,$('copilotModel').value)};
 $('copilotForm').onsubmit=e=>{e.preventDefault();sendAI($('copilotQuestion').value)};
 document.querySelectorAll('[data-ask]').forEach(b=>b.onclick=()=>{$('copilotQuestion').value=b.dataset.ask;$('copilotQuestion').focus()});
 $('copilotQuestion').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('copilotForm').requestSubmit()}});
 const themeObserver=new MutationObserver(()=>{$('rfTradingChart')?.setAttribute('theme',document.body.dataset.theme==='light'?'light':'dark')});themeObserver.observe(document.body,{attributes:true,attributeFilter:['data-theme']});
 updateSession();setInterval(updateSession,60000);loadPulse();setupAI();
}
window.rangeformExperience={loadNews,loadPulse,selectNewsCategory:category=>{if(CATEGORY_CONTENT[category]){newsCategory=category;loadNews()}}};
document.addEventListener('DOMContentLoaded',bind);
})();