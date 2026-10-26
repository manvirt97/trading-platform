/* Rangeform standalone display enhancements. No app-store or browser-UI workarounds. */
(()=>{'use strict';
 const media=window.matchMedia?.('(display-mode: standalone)');
 const apply=()=>{const installed=Boolean(media?.matches||navigator.standalone===true);
  document.body.classList.toggle('standalone',installed);
  document.documentElement.classList.toggle('is-standalone',installed);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
 media?.addEventListener?.('change',apply);
})();
