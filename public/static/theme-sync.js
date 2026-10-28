/* Shared early appearance and lightweight navigation preload for all Rangeform screens. */
(()=>{'use strict';
 const key='rangeform_theme';
 const choices=['dark','light','warm'];
 const read=()=>{try{const x=localStorage.getItem('rf_v9_theme')||localStorage.getItem(key);return choices.includes(x)?x:'light'}catch{return 'light'}};
 const paint=theme=>{
   const t=choices.includes(theme)?theme:'dark';
   document.documentElement.dataset.rfTheme=t;
   document.documentElement.style.colorScheme=t==='light'?'light':'dark';
   document.documentElement.style.backgroundColor=t==='light'?'#f2f4f2':t==='warm'?'#181713':'#101a22';
   if(document.body){document.body.dataset.theme=t;document.body.classList.toggle('dark',t!=='light');document.body.classList.toggle('warm',t==='warm')}
   document.querySelectorAll('meta[name="theme-color"]').forEach(el=>el.content=t==='light'?'#f2f4f2':t==='warm'?'#181713':'#101a22');
   document.querySelectorAll('tv-advanced-chart,tv-technical-analysis,tv-market-overview,tv-news-feed').forEach(el=>{const desired=t==='light'?'light':'dark';if(el.getAttribute('theme')!==desired)el.setAttribute('theme',desired)});
   return t;
 };
 const apply=theme=>{let t=paint(theme);try{localStorage.setItem(key,t);if(t!=='warm')localStorage.setItem('rf_v9_theme',t)}catch{};return t};
 window.RangeformTheme={read,apply,paint};
 paint(read());
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>paint(read()),{once:true});else paint(read());
 window.addEventListener('pageshow',()=>paint(read()));
 window.addEventListener('storage',ev=>{if(ev.key===key||ev.key==='rf_v9_theme')paint(read())});
 document.addEventListener('DOMContentLoaded',()=>{
   const seen=new Set();
   document.querySelectorAll('a[href^="/market"],a[href^="/research"],a[href^="/account"]').forEach(a=>{
     const href=a.getAttribute('href');if(!href)return;
     const go=()=>{let path=href.startsWith('/market')?'/market.html':href.startsWith('/account')?'/account.html':'/research';if(seen.has(path))return;seen.add(path);let link=document.createElement('link');link.rel='prefetch';link.as='document';link.href=path;document.head.append(link)};
     a.addEventListener('pointerenter',go,{once:true,passive:true});
     a.addEventListener('focus',go,{once:true});
     a.addEventListener('touchstart',go,{once:true,passive:true});
   });
 },{once:true});
})();