(()=>{'use strict';
const $=s=>document.querySelector(s);
const safe=(x,n=200)=>String(x??'').slice(0,n);
const fmt=stamp=>{try{return new Date(stamp).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{return 'Unknown time'}};
function addText(parent,tag,value,cls){let el=document.createElement(tag);if(cls)el.className=cls;el.textContent=safe(value);parent.append(el);return el}
function makeLink(parent,title,url){let a=document.createElement('a');a.rel='nofollow noopener noreferrer';a.target='_blank';a.href=url;a.textContent=safe(title);parent.append(a);return a}
const view=$('#radarResults'),status=$('#radarStatus'),news=$('#radarHeadlines'),sel=$('#radarRegion'),refresh=$('#radarRefresh');
if(!view||!status||!news||!sel)return;
const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
const inCanada=/^(America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Whitehorse|Iqaluit|Yellowknife|Dawson|Atikokan|Blanc-Sablon|Goose_Bay)|Canada\/)/.test(timezone);
sel.value=localStorage.getItem('market_radar_region')|| (inCanada?'CA':'US');
const local=$('#marketLocalTime');
if(local) {local.textContent='Local: '+new Intl.DateTimeFormat(undefined,{timeZone:timezone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date())+' · '+timezone.replace('_',' ')}
const showEmpty=(message)=>{view.replaceChildren();addText(view,'p',message,'empty-info')};
async function load(force=false){refresh.disabled=true;refresh.textContent='Checking…';status.textContent='Checking selected public news feeds. Not a live trading signal.';showEmpty('Searching headlines…');news.replaceChildren();
 try{const r=await fetch('/api/radar?region='+encodeURIComponent(sel.value)+(force?'&refresh='+Date.now():''),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Public feeds unavailable');
 status.textContent='Updated '+fmt(d.as_of)+' · '+d.availability+' coverage · '+d.source+'. Market data is separate and may be delayed.';
 view.replaceChildren();
 if(!d.candidates?.length)showEmpty('No sufficiently recent ticker-specific headlines found. That is a valid reason to wait and research manually.');
 (d.candidates||[]).forEach((c,i)=>{let card=document.createElement('article');card.className='candidate';let top=document.createElement('div');top.className='candidate-head';addText(top,'span',String(i+1).padStart(2,'0'),'candidate-rank');let title=document.createElement('div');addText(title,'b',c.symbol);addText(title,'small',c.company);top.append(title);addText(top,'span',c.mentions+' recent mentions','count-pill');card.append(top);addText(card,'p',c.reason);let links=document.createElement('div');links.className='candidate-links';for(const s of (c.sources||[]).slice(0,2))makeLink(links,s.title,s.url);card.append(links);let buttons=document.createElement('div');buttons.className='candidate-actions';
 let study=document.createElement('button');study.textContent='Open chart ↗';study.type='button';study.onclick=()=>{const exchange=c.symbol==='SHOP'?'TSX':'NASDAQ';const market=exchange+':'+c.symbol;document.getElementById('exchange').value=exchange;document.getElementById('symbol').value=c.symbol;document.getElementById('symbolForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));document.querySelector('.chart')?.scrollIntoView({behavior:'smooth',block:'center'})};buttons.append(study);
 let watch=document.createElement('button');watch.type='button';watch.textContent='Save to this browser';watch.onclick=()=>{let a=[];try{a=JSON.parse(localStorage.getItem('market_guest_watch')||'[]')}catch{};a=[...new Set([...a,c.symbol])].slice(0,25);localStorage.setItem('market_guest_watch',JSON.stringify(a));watch.textContent='Saved ✓';watch.disabled=true};buttons.append(watch);card.append(buttons);view.append(card)});
 for(const h of (d.headlines||[]).slice(0,6)){let li=document.createElement('li');makeLink(li,h.title,h.url);addText(li,'span',h.category+' · '+fmt(h.at));news.append(li)}
 if(!d.headlines?.length)addText(news,'li','No recent headlines were returned. Check the linked sources directly.');
 }catch(e){status.textContent='Live public news coverage unavailable; no rankings displayed.';showEmpty('Cannot verify current headlines right now. Do not treat demo data as a recommendation.');}
 finally{refresh.disabled=false;refresh.textContent='Scan again ↻'}}
sel.addEventListener('change',()=>{localStorage.setItem('market_radar_region',sel.value);load()});refresh.addEventListener('click',()=>load(true));load();
})();