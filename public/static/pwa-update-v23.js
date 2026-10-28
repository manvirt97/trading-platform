/* Rangeform PWA release observer.
   Installed Home Screen apps can hold an old page alive after a deployment.
   This is intentionally a tiny independent script, with no login or market APIs.
   It compares against a no-store version endpoint and offers a user-triggered
   reload, preserving the current section and avoiding unsaved-form data loss. */
(()=>{'use strict';
 const CURRENT='rangeform-v23-pwa-recovery';
 const ENDPOINT='/release.json';
 let checkedAt=0,busy=false,notice=null,dismissedBuild='';
 const installed=()=>{
  try{return navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches}
  catch{return false}
 };
 const show=build=>{
  if(notice||dismissedBuild===build||!document.body)return;
  const box=document.createElement('section');
  box.id='rangeform-update-banner';
  box.setAttribute('role','status');
  box.setAttribute('aria-label','Rangeform update available');
  box.style.cssText=[
   'position:fixed','z-index:2147483000','left:max(12px,env(safe-area-inset-left,0px))',
   'right:max(12px,env(safe-area-inset-right,0px))',
   'bottom:max(16px,calc(env(safe-area-inset-bottom,0px) + 12px))',
   'max-width:480px','margin:0 auto','padding:14px 16px',
   'border:1px solid var(--line,var(--edge,#d9e2df))','border-radius:13px',
   'box-shadow:0 12px 40px rgba(8,23,33,.21)',
   'background:var(--card,var(--panel,#fbfcfb))',
   'color:var(--ink,var(--text,#1d2c34))',
   'font:600 13px/1.5 system-ui,sans-serif'
  ].join(';');
  const msg=document.createElement('div');
  msg.textContent='A newer Rangeform version is ready. Refresh to apply the latest fixes.';
  const actions=document.createElement('div');
  actions.style.cssText='display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px';
  const later=document.createElement('button');
  later.type='button';later.textContent='Later';
  const refresh=document.createElement('button');
  refresh.type='button';refresh.textContent='Update Rangeform';
  for(const b of [later,refresh]){
   b.style.cssText='font:700 12px system-ui;min-height:42px;padding:9px 12px;border-radius:9px;border:1px solid var(--line,var(--edge,#d9e2df));cursor:pointer';
  }
  later.style.background='transparent';later.style.color='inherit';
  refresh.style.background='#365e6c';refresh.style.color='#fff';
  later.addEventListener('click',()=>{dismissedBuild=build;box.remove();notice=null});
  refresh.addEventListener('click',()=>{
   // Change the query string to force a fresh document request, but keep the
   // original route and hash (including active Trade Signals sections).
   const url=new URL(location.href);
   url.searchParams.set('rf_release',build);
   location.replace(url.toString());
  });
  actions.append(later,refresh);box.append(msg,actions);
  document.body.append(box);notice=box;
 };
 async function check(force=false){
  if(!installed()||!document.body||busy)return;
  if(!force&&Date.now()-checkedAt<60000)return;
  busy=true;checkedAt=Date.now();
  try{
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),6500);
   let response;
   try{
    response=await fetch(ENDPOINT+'?t='+Date.now(),{
     cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal
    });
   }finally{clearTimeout(timeout)}
   if(!response.ok)return;
   const data=await response.json();
   const build=String(data?.build||'');
   if(/^rangeform-v[0-9]+-[a-z0-9-]+$/.test(build)&&build!==CURRENT)show(build);
  }catch{/* Offline or provider errors should never block research. */}
  finally{busy=false}
 }
 function start(){
  check(true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check(true)});
  window.addEventListener('pageshow',()=>check(true));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
