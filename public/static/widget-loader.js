/* Load secondary TradingView web components only when near visible viewport.
   Keeps navigation responsive without changing sources, quotes or accuracy. */
(()=>{'use strict';
 const sources={
  'tv-market-overview':'https://widgets.tradingview-widget.com/w/en/tv-market-overview.js',
  'tv-news-feed':'https://widgets.tradingview-widget.com/w/en/tv-news-feed.js',
  'tv-technical-analysis':'https://widgets.tradingview-widget.com/w/en/tv-technical-analysis.js'
 };
 const loading=new Map();
 function load(tag){
  if(loading.has(tag))return loading.get(tag);
  const job=import(sources[tag]).catch(()=>{loading.delete(tag);document.querySelectorAll(tag).forEach(el=>{el.setAttribute('data-unavailable','true')});});
  loading.set(tag,job);return job;
 }
 const observe=()=>{
  const widgets=Object.keys(sources).flatMap(tag=>[...document.querySelectorAll(tag)]);
  if(!widgets.length)return;
  if(!('IntersectionObserver' in window)){for(const el of widgets)load(el.localName);return}
  const io=new IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){if(!isIntersecting)continue;load(target.localName);io.unobserve(target)}
  },{rootMargin:'750px 0px',threshold:0});
  widgets.forEach(el=>io.observe(el));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)return;widgets.forEach(el=>{if(el.getBoundingClientRect().width>0&&el.getBoundingClientRect().top<innerHeight+400&&el.getBoundingClientRect().bottom>-400)load(el.localName)})});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();