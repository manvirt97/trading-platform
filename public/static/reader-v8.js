/* Clear View text sizing. Preferences remain private to this browser. */
(()=>{'use strict';
 const key='rangeform_reading_size_v8';
 const read=()=>{try{return localStorage.getItem(key)==='large'?'large':'regular'}catch{return 'regular'}};
 const apply=mode=>{
  const next=mode==='large'?'large':'regular';
  document.documentElement.dataset.reader=next;
  for(const [id,v] of [['readerRegular','regular'],['readerLarge','large']]){
   const b=document.getElementById(id);
   if(b)b.setAttribute('aria-pressed',String(next===v));
  }
  try{localStorage.setItem(key,next)}catch{}
 };
 const bind=()=>{
  document.getElementById('readerRegular')?.addEventListener('click',()=>apply('regular'));
  document.getElementById('readerLarge')?.addEventListener('click',()=>apply('large'));
  apply(read());
 };
 document.documentElement.dataset.reader=read();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
