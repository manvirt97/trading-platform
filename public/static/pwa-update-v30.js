/* Automatic Home Screen app updates: no service-worker cache, local data deletion or
   forced reload during editing. Release marker must change on each frontend release. */
(()=>{'use strict';
const CURRENT=30, endpoint='/release.json', interval=180000, idle=30000;
let busy=false,last=0,interaction=0,dirty=false,pending='',banner=null,dismissed='';
const standalone=()=>{try{return navigator.standalone===true||matchMedia('(display-mode: standalone)').matches}catch{return false}};
const attempted=build=>{try{return Number(sessionStorage.getItem('rf_pwa_update_'+build)||0)}catch{return 0}};
const mark=build=>{try{sessionStorage.setItem('rf_pwa_update_'+build,String(Date.now()))}catch{}};
const safe=()=>{
 if(document.hidden||dirty||interaction&&Date.now()-interaction<idle)return false;
 const active=document.activeElement;
 return !(active?.isContentEditable||(active?.matches?.('input,textarea,select')&&interaction));
};
const replace=build=>{
 mark(build);
 const url=new URL(location.href);
 url.searchParams.set('rf_release',build);
 location.replace(url.toString());
};
function prompt(build,retried=false){
 if(!document.body||banner||dismissed===build)return;
 const el=document.createElement('aside');el.id='rangeform-update-banner';
 el.setAttribute('role','status');el.setAttribute('aria-label','Rangeform update available');
 el.style.cssText='position:fixed;z-index:2147483000;bottom:max(16px,calc(env(safe-area-inset-bottom,0px) + 12px));left:12px;right:12px;max-width:480px;margin:auto;padding:15px;border:1px solid var(--line,#d9e2df);border-radius:13px;box-shadow:0 12px 35px #0003;background:var(--card,#fbfcfb);color:var(--ink,#1d2c34);font:600 13px/1.5 system-ui';
 const label=document.createElement('p');label.style.margin='0 0 10px';
 label.textContent=retried?'A newer build is still available. Try updating again when your work is saved.':'An update is ready. Save any unfinished changes before updating.';
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;justify-content:flex-end';
 const later=document.createElement('button');later.type='button';later.textContent='Later';
 const update=document.createElement('button');update.type='button';update.textContent='Update Rangeform';
 for(const b of [later,update])b.style.cssText='min-height:44px;padding:10px 13px;border:1px solid var(--line,#d9e2df);border-radius:9px;font:700 12px system-ui;cursor:pointer';
 update.style.cssText+=';background:#365e6c;color:white';
 later.onclick=()=>{dismissed=build;el.remove();banner=null};
 update.onclick=()=>replace(build); // Explicit permission to leave editing screen.
 actions.append(later,update);el.append(label,actions);document.body.append(el);banner=el;
}
function process(build){
 pending=build;
 if(safe()&&!banner){
  // Guard prevents infinite loops if the Home Screen webview still serves old HTML.
  if(Date.now()-attempted(build)<15*60000)return prompt(build,true);
  return replace(build);
 }
 prompt(build);
}
async function check(force=false){
 if(!standalone()||document.hidden||!document.body||busy)return;
 if(!force&&Date.now()-last<interval)return;
 busy=true;last=Date.now();
 try{
  const c=new AbortController(),t=setTimeout(()=>c.abort(),6500);
  let response;
  try{response=await fetch(endpoint+'?t='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'},signal:c.signal})}
  finally{clearTimeout(t)}
  if(!response.ok)return;
  const data=await response.json(),match=/^rangeform-v([0-9]+)-[a-z0-9-]+$/.exec(String(data?.build||''));
  if(match&&Number(match[1])>CURRENT)process(data.build);
 }catch{/* Offline or rejected requests never erase user data. */}
 finally{busy=false}
}
function begin(){
 if(!standalone())return;
 document.addEventListener('input',e=>{interaction=Date.now();if(e.target?.matches?.('input,textarea,select,[contenteditable]'))dirty=true},true);
 document.addEventListener('change',e=>{interaction=Date.now();if(e.target?.matches?.('input,textarea,select'))dirty=true},true);
 document.addEventListener('pointerdown',()=>{interaction=Date.now()},true);
 document.addEventListener('keydown',()=>{interaction=Date.now()},true);
 document.addEventListener('submit',()=>{dirty=false},true);
 check(true);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check(true)});
 window.addEventListener('pageshow',()=>check(true));
 window.addEventListener('focus',()=>check(true));
 const poll=setInterval(()=>check(false),interval);
 window.addEventListener('pagehide',()=>clearInterval(poll),{once:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});
else begin();
})();
