/* Rangeform V9: real-source research UI. No synthetic prices, promises or trade execution. */
(()=>{'use strict';
/* Home Screen Safari sometimes exposes a zero top inset even while the
   native iOS status bar overlays the viewport. Mark the installed app so
   the mobile stylesheet reserves a physical status-bar zone. */
try {
 const installed=window.navigator.standalone===true||
  window.matchMedia('(display-mode: standalone)').matches;
 if(installed)document.documentElement.classList.add('rangeform-ios-standalone');
}catch{}

const $=id=>document.getElementById(id);
const $$=sel=>Array.from(document.querySelectorAll(sel));
const money=(v,d=2)=>Number.isFinite(Number(v))?'$'+Number(v).toLocaleString('en-CA',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const number=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const pct=v=>Number.isFinite(Number(v))?(Number(v)>0?'+':'')+number(v,2)+'%':'—';
const stamp=v=>{const date=new Date(v);return Number.isFinite(+date)?date.toLocaleString('en-CA',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET':'Time unavailable'};
const ageLabel=v=>{let t=Date.parse(v);if(!Number.isFinite(t))return 'Unknown';let m=Math.max(0,Math.floor((Date.now()-t)/60000));return m<60?m+' min old':m<1440?Math.floor(m/60)+'h old':Math.floor(m/1440)+'d old'};
const symbolOK=s=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(s);
const state={view:'overview',symbol:'NVDA',watch:[],configured:false,newsCategory:'all',newsCache:new Map(),market:new Map(),analysis:null,opportunity:null,agentRoom:null,agentFilter:'all',discovery:null,discoveryLoading:false,discoveryUniverse:'leaders',scanning:false,newsLoading:false,provider:'Not configured'};
let toastTimeout=0;
let newsController=null,discoveryQueued=false;
const monitor={enabled:false,timer:null,lastAlertKey:'',busy:false};
const toast=(message)=>{const el=$('toast');el.textContent=String(message).slice(0,250);el.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{el.hidden=true},4800)};
function readWatch(){let a;try{a=JSON.parse(localStorage.getItem('rf_v9_watch')||'null')}catch{}const clean=Array.isArray(a)?a.filter(x=>typeof x==='string').map(x=>x.toUpperCase()).filter(symbolOK):[];return [...new Set(clean.length?clean:['NVDA','TSLA','SHOP','AAPL','SPY'])].slice(0,6)}
function saveWatch(){try{localStorage.setItem('rf_v9_watch',JSON.stringify(state.watch))}catch{}}
function setTheme(v){
 document.body.dataset.theme=v==='dark'?'dark':'light';
 const themeMeta=document.querySelector('meta[name="theme-color"]');
 if(themeMeta)themeMeta.setAttribute('content',document.body.dataset.theme==='dark'?'#101923':'#f6f8fb');
 try{localStorage.setItem('rf_v9_theme',document.body.dataset.theme)}catch{}
}
const create=(tag,className,text)=>{let el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=String(text);return el};
async function request(url){const res=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});let d;try{d=await res.json()}catch{throw Error('Received an invalid response.')}if(!res.ok||d.error)throw Error(d.error||d.note||'Request unavailable ('+res.status+')');return d}
const oldRoutes={
  copilot:{page:'overview',focus:'assistantTitle'},ai:{page:'overview',focus:'assistantTitle'},
  radar:{page:'scanner'},market:{page:'overview'},
  risk:{page:'signals',focus:'riskAccount'},journal:{page:'signals',focus:'paperTitle'},
  backtest:{page:'signals',focus:'agentRoomTitle'},settings:{page:'signals',focus:'connectionDetails'}
};
function setPage(page,focus=null){
 if(!['overview','signals','scanner','news'].includes(page))return;
 state.view=page;state.focus=focus;
 document.body.dataset.view=page;
 $$('[data-section]').forEach(el=>el.classList.toggle('visible',el.dataset.section===page));
 $$('.nav-link[data-page]').forEach(el=>{
  const active=el.dataset.page===page&&(el.dataset.focus||null)===focus;
  el.classList.toggle('active',active);
  if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
 });
 document.title='Rangeform · '+({overview:'Overview',signals:'Trade decision desk',scanner:'Opportunity scanner',news:'News & catalysts'}[page]);
 history.replaceState(null,'','#'+page);
 closeNav();
 const discovery=document.querySelector('.discovery-card'),host=page==='scanner'?$('discoveryScannerHost'):$('discoveryHome');
 if(discovery&&host)host.after(discovery);
 if(page==='news'&&!state.newsCache.has(state.newsCategory+'|'+$('newsQuery').value.trim()))loadNews();
 if(page==='signals'&&state.analysis)renderAnalysis(state.analysis);
 if((page==='overview'||page==='scanner')&&state.configured&&!state.discovery)discoverMarket();
 if(focus){
  requestAnimationFrame(()=>{
   const el=$(focus);if(el)el.closest('.card,.assistant-card,.paper-card')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
 }else window.scrollTo({top:0,behavior:'instant'});
}
function routeFromHash(){
 const raw=location.hash.slice(1).toLowerCase();
 const legacy=oldRoutes[raw];
 if(legacy){setPage(legacy.page,legacy.focus||null);return}
 setPage(['overview','signals','scanner','news'].includes(raw)?raw:'overview');
}
function closeNav(){$('sidebar').classList.remove('open');$('navShade').hidden=true}
function initTheme(){let theme;try{theme=localStorage.getItem('rf_v9_theme')||localStorage.getItem('rangeform_theme')||'light'}catch{}setTheme(theme)}
function localClock(){try{$('localTime').textContent=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',hour:'numeric',minute:'2-digit'}).format(new Date())}catch{$('localTime').textContent='—'}}
async function loadProvider(){
 try{const p=await request('/api/status');state.configured=Boolean(p.twelvedata_enabled||p.finnhub_fallback_enabled);state.provider=p.twelvedata_enabled?'Twelve Data enabled':p.finnhub_fallback_enabled?'Finnhub authorized backup enabled':'No authorized bars';
  $('feedDot').className='status-dot '+(state.configured?'green':'amber');$('sideStatusDot').className='status-dot '+(state.configured?'green':'amber');
  $('feedLabel').textContent=state.configured?'Provider enabled':'Market feed not connected';$('sideStatus').textContent=state.configured?'History feed configured':'Market data not connected';
  $('sideStatusDetail').textContent=state.configured?'Bars may be delayed. Check timestamps.':'Connect a private provider in settings.';
  const detail=$('connectionDetails');detail.replaceChildren();
  detail.append(create('p','',state.configured?state.provider+' in Cloudflare. Completed historical bars are fetched on demand. Exchange permissions, delay and broker execution must be independently checked.':'Twelve Data is not enabled for chart analysis. You can still read public financial news. To unlock technical signals, connect an authorized API in Data & settings.'));
  $('signalFeedNotice').lastElementChild.textContent=state.configured?'Provider configured. Always check the completed bar timestamp, market status and execution spread.':'No verified market-data feed. Historical analysis and trades are unavailable until connected.';
  if(state.configured&&['overview','scanner'].includes(state.view))discoverMarket();else if(!state.configured)discoveryReset('No authorized price-data feed. Connect Twelve Data to enable automatic discovery.');
 }catch(e){discoveryReset('Could not verify market-data configuration: '+e.message);$('feedLabel').textContent='Data status unavailable';$('sideStatus').textContent='Status unavailable';$('connectionDetails').textContent='Could not check provider settings: '+e.message}
}
// Fixed-universe discovery: never present research alignment as guaranteed profit.
function discoveryReset(note){
 state.discovery=null;const root=$('discoveryResults');root.replaceChildren();
 const row=create('tr'),cell=create('td','empty-inline',note);cell.colSpan=6;row.append(cell);root.append(row);
 $('discoveryStatus').textContent=note;$('discoveryTimestamp').textContent='No verified candidates';
 window.dispatchEvent(new CustomEvent('rangeform:discovery',{detail:{state:'unavailable',reason:note,items:[]}}));
}
function discoveryRender(result){
 state.discovery=result;
 $('discoveryStatus').textContent=result.scanned+' of '+result.universe_size+' symbols checked · '+(result.actionable||0)+' conditional watches. Not a whole-market scan.';
 $('discoveryTimestamp').textContent='Checked '+stamp(result.checked_at)+' · '+(result.cache==='edge-cache'?'cached up to 10 min':'new analysis');
 const root=$('discoveryResults');root.replaceChildren();
 if(!result.items?.length){discoveryReset('No verified results. '+(result.errors?.[0]?.reason||'Check exchange coverage.'));return}
 for(const item of result.items){
  const tr=create('tr');tr.append(create('td','',item.symbol));
  const st=create('td'),label=item.status==='BUY_WATCH'?'Buy watch':item.status==='SELL_WATCH'?'Bearish watch':item.status==='WAIT_STALE'?'Historical only':'Wait';
  st.append(create('span','signal-tag '+(item.status==='BUY_WATCH'?'bull':item.status==='SELL_WATCH'?'bear':''),label));tr.append(st);
  tr.append(create('td','',item.quality_score==null?'—':item.quality_score+'/100'));
  tr.append(create('td','',item.bar_time?ageLabel(item.bar_time):'No timestamp'));
  const why=create('td','',item.supporting_patterns?.[0]?.name||item.reason||'No confirmed pattern');why.title=item.reason||'';tr.append(why);
  const cell=create('td'),button=create('button','cell-btn','Inspect ↗');button.type='button';button.onclick=()=>inspect(item.symbol);cell.append(button);tr.append(cell);root.append(tr);
 }
 window.dispatchEvent(new CustomEvent('rangeform:discovery',{detail:result}));
}
async function discoverMarket(){
 if(state.discoveryLoading){discoveryQueued=true;return;}
 if(!state.configured){discoveryReset('No authorized price-data provider. Automatic discovery is unavailable.');return}
 const target=state.discoveryUniverse;state.discoveryLoading=true;$('discoveryRefresh').disabled=true;$('discoveryRefresh').textContent='Checking sample…';
 try{
  const result=await request('/api/market-discovery?'+new URLSearchParams({universe:target}));
  if(target!==state.discoveryUniverse)return;
  discoveryRender(result);
 }catch(e){if(target===state.discoveryUniverse)discoveryReset('Automatic scan unavailable: '+e.message)}
 finally{state.discoveryLoading=false;$('discoveryRefresh').disabled=false;$('discoveryRefresh').textContent='Scan sample ↻';if(discoveryQueued){discoveryQueued=false;discoverMarket()}}
}
function scheduleDiscovery(){
 const due=()=>{const time=Date.parse(state.discovery?.checked_at);return !Number.isFinite(time)||Date.now()-time>=600000};
 setInterval(()=>{if(!document.hidden&&state.configured&&!state.discoveryLoading&&(state.view==='overview'||state.view==='scanner')&&due())discoverMarket()},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(state.view==='overview'||state.view==='scanner')&&state.configured&&due())discoverMarket()});
}

function renderWatch(){let root=$('watchList');root.replaceChildren();for(const symbol of state.watch){const row=create('div','watch-item'),open=create('button',''),rm=create('button','delete-symbol','×');open.type='button';open.append(create('strong','',symbol),create('small','',state.market.has(symbol)?money(state.market.get(symbol).last)+' · '+pct(state.market.get(symbol).change_pct):'Price not requested'));open.addEventListener('click',()=>inspect(symbol));rm.title='Remove '+symbol;rm.setAttribute('aria-label','Remove '+symbol);rm.addEventListener('click',()=>{state.watch=state.watch.filter(x=>x!==symbol);saveWatch();renderWatch()});row.append(open,rm);root.append(row)}}
function addWatch(){if($('watchNew'))return;const el=create('div','watch-item');el.id='watchNew';const input=create('input');input.maxLength=10;input.placeholder='Enter ticker';input.setAttribute('aria-label','New watchlist symbol');input.style.cssText='width:100%;border:1px solid var(--line);border-radius:8px;padding:9px;background:var(--card);color:var(--ink)';const done=create('button','cell-btn','Add');done.onclick=()=>{let sym=input.value.trim().toUpperCase();if(!symbolOK(sym)){toast('Please enter a valid ticker symbol.');return}if(!state.watch.includes(sym)&&state.watch.length>=6){toast('A watchlist scan supports up to six symbols.');return}state.watch=[...new Set([...state.watch,sym])];saveWatch();renderWatch()};input.addEventListener('keydown',e=>{if(e.key==='Enter')done.click();if(e.key==='Escape')el.remove()});el.append(input,done);$('watchList').append(el);input.focus()}
function assessment(x){const daily=x.interval==='1day',ms=Date.now()-Date.parse(x.last_bar_utc),fresh=Number.isFinite(ms)&&ms>=0&&ms<(daily?4.5*86400000:22*60000);const complete=x.data_quality==='complete-ohlcv'&&Array.isArray(x.bar_history)&&x.bar_history.length>=35;const score=Number(x.score);
let kind=!complete||!fresh?'wait':score>=65?'bull':score<=35?'bear':'wait';
return {kind,score:Number.isFinite(score)?score:null,fresh,complete,reason:!complete?'Validated OHLCV candles are missing.':!fresh?'Last completed bar is too old for a current setup.':kind==='bull'?'Bullish technical factors outweigh bearish factors.':kind==='bear'?'Bearish conditions dominate.':'Technical indicators disagree or lack strong alignment.'}}
function cacheKey(symbol,interval){return symbol+'|'+interval}
async function analyzeSymbol(symbol,interval='1day',force=false){if(!state.configured)throw Error('Private market-data provider is not enabled. Open Data & settings to connect it.');if(!symbolOK(symbol))throw Error('Please use a valid ticker symbol.');const key=cacheKey(symbol,interval);if(!force&&state.market.has(key))return state.market.get(key);const data=await request('/api/analyze?'+new URLSearchParams({symbol,source:'twelvedata',interval}));if(data.symbol!==symbol||!['twelvedata','finnhub-backup'].includes(data.source)||!Array.isArray(data.bar_history)||!Number.isFinite(Number(data.last))||!Number.isFinite(Date.parse(data.last_bar_utc)))throw Error('Provider analysis was incomplete or unverified.');state.market.set(key,data);if(interval==='1day')state.market.set(symbol,data);return data}
function setRow(root,symbol,x){const tr=create('tr');const result=x&&!x.error?assessment(x):null;const label=!x?'Not scanned':x.error?'Unavailable':result.kind==='bull'?'Bullish watch':result.kind==='bear'?'Bearish watch':result.fresh?'Wait':'Historical only';const td=(value,tag='td')=>{const el=create(tag,'',value);tr.append(el);return el};let asset=td(symbol);asset.append(create('small','',x?.error||'Completed bars'));if(root.id==='overviewResults'){const dir=td('');dir.append(create('span','signal-tag '+(result?.kind||''),label));td(result?.score!=null?result.score+'/100':'—');td(x?.last_bar_utc?ageLabel(x.last_bar_utc):'—');const last=td('');const b=create('button','cell-btn','Inspect ↗');b.onclick=()=>inspect(symbol);b.disabled=!x||Boolean(x.error);last.append(b)}else{td(x&&!x.error?money(x.last):'—');const dir=td('');dir.append(create('span','signal-tag '+(result?.kind||''),label));td(result?.score!=null?result.score+'/100':'—');td(x?.last_bar_utc?stamp(x.last_bar_utc):'—');const last=td('');const b=create('button','cell-btn','View chart ↗');b.onclick=()=>inspect(symbol);b.disabled=!x||Boolean(x.error);last.append(b)}root.append(tr)}
function renderScan(rows){for(const id of ['scannerResults','overviewResults']){let el=$(id);el.replaceChildren();if(!rows.length){let row=create('tr'),cell=create('td','empty-inline','No real provider results available.');cell.colSpan=id==='scannerResults'?6:5;row.append(cell);el.append(row)}else for(const [sym,x] of rows)setRow(el,sym,x)}renderWatch();let loaded=rows.filter(([,x])=>x&&!x.error).length;$('scanSummary').textContent=loaded+' of '+rows.length+' symbols returned dated historical evidence. Technical scores are NOT win probabilities.'}
async function scan(){if(state.scanning)return;if(!state.configured){toast('Connect a permitted Twelve Data feed before scanning.');setPage('signals');return}state.scanning=true;for(const id of ['scanButton','overviewScan']){$(id).disabled=true;$(id).textContent='Analyzing verified bars…'}
const results=[];for(const sym of state.watch){try{const x=await analyzeSymbol(sym,'1day');results.push([sym,x])}catch(e){results.push([sym,{error:e.message}])}renderScan(results)}
results.sort((a,b)=>{const sa=a[1]?.score, sb=b[1]?.score;return (Number.isFinite(sb)?sb:-1)-(Number.isFinite(sa)?sa:-1)});renderScan(results);
for(const sym of ['SPY','NVDA','TSLA','SHOP']){const x=state.market.get(sym);const q=document.querySelector('[data-quote="'+sym+'"]'),delta=document.querySelector('[data-change="'+sym+'"]');if(x){q.textContent=money(x.last);delta.textContent=pct(x.change_pct)+' · '+ageLabel(x.last_bar_utc);delta.className=Number(x.change_pct)>=0?'positive':'negative'}}
state.scanning=false;for(const id of ['scanButton','overviewScan']){$(id).disabled=false;$(id).innerHTML=id==='scanButton'?'Run watchlist scan ↗':'Explore opportunities <span>↗</span>'}
toast(results.filter(x=>!x[1]?.error).length+' of '+results.length+' symbols analyzed. Review data age before acting.')}
async function inspect(sym){setMonitor(false);state.symbol=sym;$('symbolInput').value=sym;setPage('signals');await runAnalysis()}
function clearAnalysis(message){state.analysis=null;state.opportunity=null;state.agentRoom=null;resetAgentRoom(message);resetOpportunity(message);
 window.dispatchEvent(new CustomEvent('rangeform:agent-report',{detail:{analysis:null,opportunity:null,agent_room:null}}));$('selectedPrice').textContent='—';$('selectedChange').textContent='Awaiting completed price bars';$('lastBarTime').textContent='—';$('indicatorScore').textContent='—';$('verdictCard').className='card verdict-card';$('verdictText').textContent='DATA NOT CONNECTED';$('verdictDetail').textContent=message;$('verdictFactors').textContent='No verified technical evidence. No trade levels will be invented.';$('evidenceText').textContent='The model requires real completed candles and a valid provider response.';$('longCondition').textContent='Connect validated candles to determine a buy-watch trigger.';$('shortCondition').textContent='Connect validated candles to determine a bearish invalidation.';$('waitCondition').textContent='Avoid trading without fresh, verified market data.';$('chartPlaceholder').hidden=false;$('riskResults').textContent='Entry, stop and position size require valid completed bars.'}
async function runAnalysis(options={}){if(monitor.busy)return;const silent=options?.silent===true;
 const symbol=$('symbolInput').value.trim().toUpperCase(),interval=$('barInterval').value;
 if(!symbolOK(symbol)){if(!silent)toast('Enter a valid ticker such as NVDA or SHOP.');return}
 if(!state.configured){if(!silent)toast('Connect authorized market data before running an opportunity check.');clearAnalysis('No authorized data connection.');return}
 state.symbol=symbol;monitor.busy=true;$('selectedSymbol').textContent=symbol;
 $('analyzeBtn').disabled=true;$('analyzeBtn').textContent='Checking evidence…';
 try{
  const payload=await request('/api/opportunity?'+new URLSearchParams({symbol,interval,news:'1'}));
  if(payload.analysis?.symbol!==symbol||!['twelvedata','finnhub-backup'].includes(payload.analysis?.source)||!payload.opportunity)
   throw Error('Provider response missing verified market evidence.');
  // Ignore late results after a symbol or interval change.
  if($('symbolInput').value.trim().toUpperCase()!==symbol||$('barInterval').value!==interval)return;
  const previous=state.opportunity;state.analysis=payload.analysis;state.opportunity=payload.opportunity;state.agentRoom=payload.agent_room||null;
  state.market.set(cacheKey(symbol,interval),payload.analysis);
  renderAnalysis(payload.analysis);renderOpportunity(payload.opportunity,payload.agent_room);renderAgentRoom(payload.agent_room);
  window.dispatchEvent(new CustomEvent('rangeform:agent-report',{detail:{analysis:payload.analysis,opportunity:payload.opportunity,agent_room:payload.agent_room}}));
  const signal=payload.opportunity;
  const key=[signal.symbol,signal.status,signal.last_completed_bar_utc].join('|');
  const actionableWatch=['BUY_WATCH','SELL_WATCH'].includes(payload.agent_room?.verdict);
  if(monitor.enabled&&actionableWatch&&key!==monitor.lastAlertKey&&(!previous||previous.status!==signal.status||previous.last_completed_bar_utc!==signal.last_completed_bar_utc)){
   monitor.lastAlertKey=key;toast(signal.symbol+': '+(signal.status==='BUY_WATCH'?'bullish':'bearish')+' pattern watch. Confirm with your broker before acting.');
  }
 }catch(e){clearAnalysis(e.message);if(!silent)toast(e.message)}
 finally{monitor.busy=false;$('analyzeBtn').disabled=false;$('analyzeBtn').textContent='Analyze ↗'}
}
function resetOpportunity(message){
 $('monitorChecked').textContent='Not checked';
 $('monitorStatus').textContent=message||'No confirmed opportunity. Verify market data before trading.';
 $('patternStatus').textContent='No verified setup';
 $('patternStatus').className='signal-tag';
 $('openingHigh').textContent='—';$('openingLow').textContent='—';$('confirmedVolume').textContent='—';
 $('patternExplanation').textContent='Only 9:30–10:00 ET completed intraday candles can establish an opening range.';
 $('catalystStatus').textContent='News is independently sourced and may be delayed.';
 $('catalystList').replaceChildren();$('catalystList').append(create('p','', 'No verified news context loaded.'));
 $('volumeProfile').replaceChildren();$('volumeProfile').append(create('p','', 'No historical candle volume loaded.'));
}
// All agent votes are computed on the server from independently retrieved bars.
// UI filters never change the supervisor, safety blocks or trade eligibility.
function resetAgentRoom(reason){
 const grid=$('agentRoomGrid');if(!grid)return;
 grid.replaceChildren();
 grid.append(create('p','subtle-note',reason||'No specialist report loaded.'));
 $('agentRoomVerdict').textContent='Awaiting data';$('agentRoomVerdict').className='signal-tag';
 $('agentRoomSummary').textContent='No verified specialist evidence.';
 $('agentRoomVeto').hidden=true;$('agentRoomVeto').textContent='';headlineSupervisor(null);
}
function headlineSupervisor(report){
 const h=$('supervisorHeadline'),p=$('supervisorOneLine');if(!h||!p)return;
 const status=report?.verdict||'WAIT';
 h.textContent=status==='BUY_WATCH'?'SUPERVISOR · BUY WATCH':status==='SELL_WATCH'?'SUPERVISOR · BEARISH WATCH':'SUPERVISOR · WAIT';
 h.className='supervisor-status '+(status==='BUY_WATCH'?'bull':status==='SELL_WATCH'?'bear':'');
 p.textContent=report?.next_step||'Missing or stale market evidence. No executable signal.';
}
function renderAgentRoom(report){
 if(!report?.agents){resetAgentRoom('Agent report unavailable. No multi-agent confirmation is claimed.');return}
 const result=report.verdict||'WAIT';headlineSupervisor(report);
 $('agentRoomVerdict').textContent=result==='BUY_WATCH'?'BUY WATCH':result==='SELL_WATCH'?'BEARISH WATCH':'WAIT';
 $('agentRoomVerdict').className='signal-tag '+(result==='BUY_WATCH'?'bull':result==='SELL_WATCH'?'bear':'');
 $('agentRoomSummary').textContent=report.specialist_count+' specialist checks · '+report.available_votes+' evidenced votes · '+report.abstentions+' unavailable · '+report.agreement_pct+'% directional agreement · consensus '+(report.score>0?'+':'')+report.score+'. Agreement is not profit probability.';
 const warnings=$('agentRoomVeto');warnings.replaceChildren();warnings.hidden=!(report.vetoes?.length);
 for(const v of report.vetoes||[])warnings.append(create('p','',v.agent+': '+v.reason));
 const root=$('agentRoomGrid');root.replaceChildren();
 const selected=state.agentFilter||'all';
 const visible=report.agents.filter(a=>selected==='all'||(selected==='unavailable'?a.state==='unavailable':a.group===selected));
 if(!visible.length)root.append(create('p','subtle-note','No specialists match this filter.'));
 for(const a of visible){
  const item=create('div','agent-tile'),top=create('div','agent-tile-head');
  top.append(create('strong','',a.name),create('span','agent-pill '+a.state,String(a.state).toUpperCase()));
  item.append(top,create('p','',a.note||'No evidence available'));
  if(typeof a.vote==='number')item.append(create('small','', 'Directional vote '+(a.vote>0?'+':'')+a.vote+' / 100 · rule weight '+a.weight));
  if(a.veto)item.append(create('strong','agent-block','BLOCKS ENTRY: '+a.veto));
  root.append(item);
 }
}
function bindAgentFilters(){
 document.querySelectorAll('[data-agent-filter]').forEach(button=>button.onclick=()=>{
  state.agentFilter=button.dataset.agentFilter;
  document.querySelectorAll('[data-agent-filter]').forEach(b=>{
   const selected=b===button;b.classList.toggle('selected',selected);
   b.setAttribute('aria-pressed',String(selected));
  });
  if(state.agentRoom)renderAgentRoom(state.agentRoom);
 });
}
function renderOpportunity(op,room){
 const status=room?.verdict==='WAIT'?'WAIT':op.status;
 const condition=status==='BUY_WATCH'?'Bullish watch':status==='SELL_WATCH'?'Bearish watch':status==='WAIT'?'No pattern confirmed':status==='WAIT_STALE'?'Not current':'Data unavailable';
 $('monitorStatus').textContent=condition+' · '+op.explanation;
 $('monitorChecked').textContent='Checked '+stamp(op.as_of)+' · '+(op.market_session==='regular-us-equity-session'?'US session':'outside US session');
 $('patternStatus').className='signal-tag '+(status==='BUY_WATCH'?'bull':status==='SELL_WATCH'?'bear':'');
 $('patternStatus').textContent=condition;
 $('openingHigh').textContent=op.opening_range?.state==='ready'?money(op.opening_range.high):'—';
 $('openingLow').textContent=op.opening_range?.state==='ready'?money(op.opening_range.low):'—';
 const v=(op.observations||[]).find(o=>o.name==='Volume');
 $('confirmedVolume').textContent=v?.description?.split(';')[0]||'Unverified';
 $('patternExplanation').textContent=op.opening_range?.note||('Opening range: '+(op.opening_range?.window||'needs intraday bars')+'. '+op.explanation);
 const news=op.news||{},items=Array.isArray(news.stories)?news.stories:[],root=$('catalystList');
 $('catalystStatus').textContent=news.state==='unverified'?'Publisher feed unavailable or unverified; do not infer a news catalyst.':'Publisher news: '+items.length+' relevant headlines. '+(news.recent_headlines_24h||0)+' dated within 24h. Sentiment and market reaction are NOT verified.';
 root.replaceChildren();
 if(!items.length)root.append(create('p','',news.state==='unverified'?'Could not verify news. No article or sentiment was invented.':'No matching dated headlines were returned.'));
 for(const item of items){
  const card=create('div','catalyst-item'),name=create('strong','',item.title),meta=create('small','',item.source+' · '+stamp(item.date));
  if(item.url){const link=create('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.append(name);card.append(link)}else card.append(name);
  card.append(meta);root.append(card);
 }
 const volume=$('volumeProfile');volume.replaceChildren();
 if(op.volume_profile?.state!=='historical-proxy')volume.append(create('p','','Historical candle volume is unavailable.'));
 else for(const bin of (op.volume_profile.bins||[]).slice().reverse()){
  const bar=create('div','volume-row'),price=create('span','',money(bin.price)),track=create('div','volume-track'),fill=create('div','volume-fill');
  fill.style.width=Math.max(0,Math.min(100,Number(bin.relative_intensity)||0))+'%';
  track.append(fill);bar.append(price,track);volume.append(bar);
 }
 // Historical indicators and breakout confirmation are not a broker-executable signal.
 const color=status==='BUY_WATCH'?'bull':status==='SELL_WATCH'?'bear':'';
 $('verdictCard').className='card verdict-card '+color;
 $('verdictText').textContent=status==='BUY_WATCH'?'BUY WATCH · CHECK BROKER':status==='SELL_WATCH'?'SELL WATCH · CHECK BROKER':'WAIT · NO CURRENT TRADE';
 $('verdictDetail').textContent=room?.verdict==='WAIT'&&['BUY_WATCH','SELL_WATCH'].includes(op.status)?'Underlying pattern was rejected by the specialist supervisor. '+room.next_step:op.explanation;
 $('waitCondition').textContent=op.market_session!=='regular-us-equity-session'?'US regular market session is closed. This is historical research, not a current entry.':op.explanation;
 if(op.plan&&status!=='WAIT'){$('longCondition').textContent=op.plan.direction==='long'?'Conditional bullish reference entry '+money(op.plan.reference_entry)+'; invalidation '+money(op.plan.invalidation)+'. Confirm broker spread and news.':'Bullish entry not confirmed.';
 $('shortCondition').textContent=op.plan.direction!=='long'?'Bearish watch around '+money(op.plan.reference_entry)+' with invalidation '+money(op.plan.invalidation)+'. Not an automatic short.':'Bearish entry not confirmed.'}
 renderRisk();
}
function setMonitor(enabled){
 monitor.enabled=Boolean(enabled)&&state.configured;
 if(monitor.timer){clearInterval(monitor.timer);monitor.timer=null}
 if(monitor.enabled)monitor.timer=setInterval(()=>{
  if(!document.hidden&&state.view==='signals'&&!monitor.busy)runAnalysis({silent:true});
 },60000);
 $('monitorToggle').setAttribute('aria-pressed',String(monitor.enabled));
 $('monitorToggle').textContent=monitor.enabled?'Auto-check: every 60s':'Auto-check: off';
 if(monitor.enabled)toast('Checks every 60 seconds only while this page is open and visible. Not a live streaming feed or background alert.');
}
function renderAnalysis(x){if(!x||x.symbol!==state.symbol)return;const r=assessment(x),ind=x.indicators||{},hi=Number(ind.resistance20),lo=Number(ind.support20),rv=Number(ind.rel_volume);const positive=r.kind==='bull',negative=r.kind==='bear';
$('selectedSymbol').textContent=x.symbol;$('selectedPrice').textContent=money(x.last);$('selectedChange').textContent=pct(x.change_pct)+' vs previous completed bar';$('selectedChange').className=Number(x.change_pct)>=0?'positive':'negative';$('lastBarTime').textContent=stamp(x.last_bar_utc);$('indicatorScore').textContent=(r.score??'—')+'/100';$('verdictCard').className='card verdict-card '+r.kind;$('verdictText').textContent=!r.complete?'INSUFFICIENT DATA':!r.fresh?'WAIT · STALE DATA':positive?'BUY WATCH · NOT AN ORDER':negative?'BEARISH WATCH':'WAIT · NO CONFIRMED SETUP';$('verdictDetail').textContent=r.reason+' A trade requires confirmation using a current broker quote, spread and catalyst check.';
const list=$('verdictFactors');list.replaceChildren();let components=(x.components||[]).slice().sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)).slice(0,3);if(!components.length)list.append(create('div','','No valid indicator breakdown.'));for(const c of components)list.append(create('div','',c.name+': '+(Number(c.impact)>0?'+':'')+c.impact+' alignment points.'));
$('longCondition').textContent=Number.isFinite(hi)?'Consider a bullish watch after a completed candle closes ABOVE '+money(hi)+' with relative volume ≥ 1.15× and a current spread/quote check.':'Historical resistance unavailable.';
$('shortCondition').textContent=Number.isFinite(lo)?'Review bearish/exit risk after a completed candle closes BELOW '+money(lo)+' on increased volume. Shorting has additional risks.':'Historical support unavailable.';
$('waitCondition').textContent=!r.fresh?'Last bar '+ageLabel(x.last_bar_utc)+'. No current entry based on stale information.':Number.isFinite(hi)&&Number.isFinite(lo)?'Wait while price remains inside '+money(lo)+' – '+money(hi)+' or volume and trend disagree.':'Wait for complete market data.';
const expl=$('evidenceText');expl.replaceChildren();expl.append(create('p','',x.symbol+' on '+x.interval+': alignment '+x.score+'/100 based on historical bars from Twelve Data. Last completed bar '+stamp(x.last_bar_utc)+'. This is not a calibrated chance of success.'));
for(const c of (x.components||[]).slice(0,6)){expl.append(create('div','evidence-row',(Number(c.impact)>0?'+':'')+c.impact+' · '+c.name+' — '+(c.reason||'Historical technical factor')))}
if(rv!=null&&Number.isFinite(rv))expl.append(create('p','','Relative volume: '+number(rv,2)+'× average. Breakout participation should be checked independently.'));
$('chartPlaceholder').hidden=false;try{drawChart(x);$('chartPlaceholder').hidden=true}catch{$('chartPlaceholder').hidden=false}
renderRisk()}
function renderRisk(){const x=state.analysis,root=$('riskResults');root.replaceChildren();if(!x||x.data_quality!=='complete-ohlcv'){root.append(create('p','','Validated OHLCV and a scenario are needed for a hypothetical plan.'));return}
if(state.opportunity?.status!=='BUY_WATCH'||state.agentRoom?.verdict!=='BUY_WATCH'||state.opportunity?.plan?.direction!=='long'){
 root.append(create('p','','No confirmed bullish watch. The calculator does not present stale price levels as a current trade plan. Use the separate Risk Planner for hypothetical examples.'));
 return;
}
const equity=Number($('riskAccount').value),risk=Number($('riskPercent').value),price=Number(x.last),ind=x.indicators||{},support=Number(ind.support20),atr=Number(ind.atr14);
if(!Number.isFinite(equity)||equity<=0||equity>1000000000||!Number.isFinite(risk)||risk<=0||risk>1){root.append(create('p','','Enter a positive account value and trade risk from 0.1% to 1%.'));return}
const stop=Number(state.opportunity.plan.invalidation);if(!Number.isFinite(stop)||stop<=0||stop>=price){root.append(create('p','','Unable to derive a valid hypothetical long stop from historical support.'));return}
const shares=Math.floor(Math.min((equity*risk/100)/(price-stop),equity/price)),target=price+2*(price-stop);
const grid=create('div','risk-summary-grid');for(const [name,value] of [['Reference entry',money(price)],['Example stop',money(stop)],['Hypothetical target (2R)',money(target)],['Max shares (cash only)',String(Math.max(0,shares))],['Planned risk',money(shares*(price-stop))],['Reward : risk','2 : 1 before costs']]){const cell=create('div');cell.append(create('small','',name),create('strong','',value));grid.append(cell)}root.append(grid,create('p','', 'These are hypothetical levels based on the last completed bar. Stop gaps, commissions, currency and slippage can change losses.'))}
function drawChart(x){const canvas=$('priceChart'),parent=canvas.parentElement;const bars=(x.bar_history||[]).slice(-74).filter(b=>[b.open,b.high,b.low,b.close].every(v=>Number.isFinite(Number(v))));if(bars.length<10)throw Error('No candlestick history');const cssW=parent.clientWidth,cssH=parent.clientHeight;if(cssW<30)return;let dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=cssW,h=cssH,left=14,right=85,top=26,bottom=46,volumeHeight=39,plotRight=w-right,priceBottom=h-bottom-volumeHeight;const min=Math.min(...bars.map(b=>Number(b.low))),max=Math.max(...bars.map(b=>Number(b.high))),span=Math.max(.01,max-min),pad=span*.12,maximumVolume=Math.max(1,...bars.map(b=>Number(b.volume)||0));
const y=v=>top+(max+pad-v)/(span+pad*2)*(priceBottom-top),width=(plotRight-left)/bars.length,colors={up:css('--green'),down:css('--red'),grid:css('--line'),label:css('--secondary'),res:'#5385b9'};
ctx.clearRect(0,0,w,h);ctx.strokeStyle=colors.grid;ctx.lineWidth=1;for(let i=0;i<5;i++){let Y=top+i*(priceBottom-top)/4;ctx.beginPath();ctx.moveTo(left,Y);ctx.lineTo(plotRight,Y);ctx.stroke();ctx.fillStyle=colors.label;ctx.font='11px DM Sans';const val=max+pad-i*(span+2*pad)/4;ctx.fillText(number(val,2),plotRight+9,Y+4)}
for(let i=0;i<bars.length;i++){const b=bars[i],cx=left+(i+.5)*width,o=y(b.open),c=y(b.close),high=y(b.high),low=y(b.low),up=Number(b.close)>=Number(b.open);ctx.strokeStyle=ctx.fillStyle=up?colors.up:colors.down;ctx.beginPath();ctx.moveTo(cx,high);ctx.lineTo(cx,low);ctx.stroke();ctx.fillRect(cx-Math.min(width*.32,5),Math.min(o,c),Math.max(1,Math.min(width*.64,10)),Math.max(1,Math.abs(c-o)));
const v=Math.max(0,Number(b.volume)||0),maxVol=maximumVolume;ctx.globalAlpha=.35;ctx.fillRect(cx-width*.28,priceBottom+13,Math.max(1,width*.55),v/maxVol*volumeHeight);ctx.globalAlpha=1}
const levs=[[Number(x.indicators?.resistance20),colors.res,'PRIOR HIGH'],[Number(x.indicators?.support20),colors.down,'PRIOR LOW']];for(const [value,color,label]of levs){if(!Number.isFinite(value)||value<min-pad||value>max+pad)continue;const Y=y(value);ctx.strokeStyle=color;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(left,Y);ctx.lineTo(plotRight,Y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=color;ctx.font='bold 10px DM Sans';ctx.fillText(label,plotRight+5,Y-7)}
// Conditional scenarios in a separate right-hand lane, never simulated OHLCV.
 const last=bars.at(-1),lastY=y(Number(last.close)),sourceX=plotRight-width/2,atr=Number(x.indicators?.atr14);
 if(Number.isFinite(atr)&&atr>0){
  for(const [direction,colour,caption] of [[1,colors.up,'BULL CASE'],[-1,colors.down,'BEAR CASE']]){
   const endX=Math.min(w-8,plotRight+52),endY=Math.max(top+12,Math.min(priceBottom-8,y(Number(last.close)+direction*atr)));
   ctx.strokeStyle=colour;ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(sourceX,lastY);ctx.quadraticCurveTo(plotRight+8,lastY,endX,endY);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle=colour;ctx.font='bold 9px DM Sans';ctx.fillText(caption,plotRight+7,Math.max(top+8,Math.min(priceBottom-2,endY+(direction===1?-7:11))));
  }
 }
 ctx.fillStyle=colors.label;ctx.font='10px DM Sans';for(let i=0;i<5;i++){let idx=Math.min(bars.length-1,Math.round(i*(bars.length-1)/4)),date=new Date(bars[idx].time||bars[idx].timestamp);if(Number.isFinite(+date))ctx.fillText(date.toLocaleDateString('en-CA',{month:'short',day:'numeric',timeZone:'UTC'}),left+idx*width-6,h-9)}
ctx.fillStyle=colors.label;ctx.font='11px DM Sans';ctx.fillText('COMPLETED CANDLES ONLY · NO FORECAST',left,16);
}
const css=name=>getComputedStyle(document.body).getPropertyValue(name).trim();
function dateString(t){try{return new Date(t).toLocaleDateString('en-CA',{month:'short',day:'numeric'})}catch{return 'Unknown date'}}
async function loadNews(force=false){
 const category=state.newsCategory,q=$('newsQuery').value.trim(),key=category+'|'+q;
 // Cancel stale requests immediately when the user selects another category.
 if(newsController){newsController.abort();newsController=null}
 if(!force&&state.newsCache.has(key)){renderNews(state.newsCache.get(key));return}
 const controller=new AbortController();newsController=controller;state.newsLoading=true;
 $('newsItems').replaceChildren();$('newsItems').append(create('p','empty-inline','Checking '+category+' publisher feeds…'));
 $('newsHeading').textContent=(category==='all'?'All markets':category.charAt(0).toUpperCase()+category.slice(1))+' headlines';
 try{
  const response=await fetch('/api/news?'+new URLSearchParams({category,q,region:'CA'}),{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
  let data;try{data=await response.json()}catch{throw Error('Invalid publisher-feed response.')}
  if(!response.ok||data.error)throw Error(data.error||'Publisher feeds unavailable');
  state.newsCache.set(key,data);
  if(newsController===controller&&state.newsCategory===category&&$('newsQuery').value.trim()===q)renderNews(data);
 }catch(e){
  if(e.name==='AbortError'||newsController!==controller)return;
  $('newsItems').replaceChildren();$('newsItems').append(create('p','empty-inline','News unavailable: '+e.message+' Try another filter or search.'));
  $('newsChecked').textContent='Source unavailable';
 }finally{if(newsController===controller){newsController=null;state.newsLoading=false}}
}
function renderNews(data){$('newsChecked').textContent='Checked '+dateString(data.as_of)+' · '+(data.sources_ok||0)+'/'+(data.sources_total||0)+' feeds';const root=$('newsItems');root.replaceChildren();if(!data.items?.length){root.append(create('p','empty-inline',data.note||'No recent articles matched this search.'));return}
data.items.forEach((item,i)=>{if(!/^https:\/\//.test(item.url))return;const row=create('article','news-item'),num=create('span','news-item-num',String(i+1).padStart(2,'0')),content=create('div','news-item-content'),meta=create('div','story-meta'),link=create('a','',item.title),info=create('small','',(item.source||'Publisher')+' · '+ageLabel(item.date));meta.append(create('span','',item.topic||'MARKETS'),create('span','',ageLabel(item.date)),create('span','',item.source||'Public news'));link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.className='story-link';link.append(create('span','sr-only',''));const h=create('h3');h.append(link);content.append(meta,h,info);row.append(num,content);row.addEventListener('click',e=>{if(e.target.closest('a'))return;selectArticle(item)});const select=create('button','cell-btn','Details');select.type='button';select.title='View source details';select.onclick=()=>selectArticle(item);row.append(select);root.append(row)})
}
function selectArticle(item){$('articleContextTitle').textContent=item.title;$('articleContext').textContent=(item.source||'Source')+' · published '+stamp(item.date)+'. Verify the full article and price reaction before drawing conclusions. The headline is not a trade signal.';const link=$('articleOriginal');link.href=item.url;link.hidden=false}
function bind(){initTheme();state.watch=readWatch();renderWatch();bindAgentFilters();$('showAgentRoom')?.addEventListener('click',()=>$('agentRoomTitle')?.scrollIntoView({behavior:'smooth',block:'start'}));scheduleDiscovery();localClock();setInterval(localClock,60000);
$$('[data-page]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.page,el.dataset.focus||null)));
$('mobileMenu').onclick=()=>{$('sidebar').classList.toggle('open');$('navShade').hidden=!$('sidebar').classList.contains('open')};$('navShade').onclick=closeNav;
$('themeToggle').onclick=()=>setTheme(document.body.dataset.theme==='dark'?'light':'dark');
$('providerBadge').onclick=()=>setPage('signals');
$('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){let sym=e.target.value.trim().toUpperCase();if(!symbolOK(sym)){toast('Enter a symbol like NVDA or SHOP');return}inspect(sym)}});
$('symbolInput').addEventListener('keydown',e=>{if(e.key==='Enter')runAnalysis()});
$('analyzeBtn').onclick=runAnalysis;$('monitorRefresh').onclick=()=>runAnalysis();
 $('monitorToggle').onclick=()=>setMonitor(!monitor.enabled);
$('barInterval').onchange=()=>{setMonitor(false);clearAnalysis('Interval changed. Analyze again to load valid bars.')};
$('overviewScan').onclick=()=>setPage('scanner');$('scanButton').onclick=scan;$('watchAdd').onclick=addWatch;
$('discoveryRefresh').onclick=discoverMarket;$('discoveryUniverse').onchange=()=>{state.discoveryUniverse=$('discoveryUniverse').value;state.discovery=null;discoverMarket()};
$('riskAccount').addEventListener('input',renderRisk);$('riskPercent').addEventListener('input',renderRisk);
$('newsSearchBtn').onclick=()=>loadNews(true);$('newsQuery').addEventListener('keydown',e=>{if(e.key==='Enter')loadNews(true)});
$$('[data-category]').forEach(el=>el.onclick=()=>{state.newsCategory=el.dataset.category;$$('[data-category]').forEach(x=>x.classList.toggle('selected',x===el));loadNews()});
window.addEventListener('resize',()=>{if(state.analysis)drawChart(state.analysis)});
loadProvider();window.addEventListener('hashchange',routeFromHash);
routeFromHash();
}
document.addEventListener('DOMContentLoaded',bind);
})();
