/* Rangeform V26: shared navigation behaviour for Algorithmic and Autonomous desks.
   Layout only. Does not touch market feeds, auth, paper state or order execution. */
(()=>{'use strict';
 function init(){
  const rail=document.getElementById('rfRail');
  const menu=document.getElementById('rfMobileMenu');
  const shade=document.getElementById('rfNavShade');
  if(!rail||!menu||!shade)return;
  const close=()=>{
   rail.classList.remove('rf-open');shade.hidden=true;
   menu.setAttribute('aria-expanded','false');
   menu.setAttribute('aria-label','Open navigation');
   document.body.classList.remove('rf-nav-open');
  };
  const open=()=>{
   rail.classList.add('rf-open');shade.hidden=false;
   menu.setAttribute('aria-expanded','true');
   menu.setAttribute('aria-label','Close navigation');
   document.body.classList.add('rf-nav-open');
  };
  menu.addEventListener('click',()=>rail.classList.contains('rf-open')?close():open());
  shade.addEventListener('click',close);
  rail.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  window.addEventListener('resize',()=>{if(innerWidth>940)close()});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
