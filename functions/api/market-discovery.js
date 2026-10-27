// Rate-conscious sample-market discovery. No API key returned to browser.
import {getData,json} from '../_shared/http.js';
import {analyze} from '../_shared/core.js';
import {UNIVERSES,candidateFromAnalysis,rankCandidates} from '../_shared/discovery.js';
import {onRequestGet as getNews} from './news.js';

const expiryMs=10*60*1000;
const headers={'cache-control':'public, max-age=600','x-content-type-options':'nosniff'};
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
async function enrichNews(request,rows){
 // Only the highest-ranked candidate gets a headline cross-check in the
 // discovery result. The detail page checks more news on demand.
 for(const item of rows.slice(0,1)){
  try{
   const u=new URL('/api/news',request.url);
   u.search=new URLSearchParams({q:item.symbol,category:'all',region:'US'}).toString();
   const response=await getNews({request:new Request(u.toString())});
   if(!response.ok)continue;
   const data=await response.json();
   item.news_state=data.availability||'unverified';
   item.news_headlines=(data.items||[]).slice(0,3).map(v=>({title:v.title,source:v.source,date:v.date,url:v.url}));
  }catch{/* Do not invent a news catalyst if feeds fail. */}
 }
}
export async function onRequestGet({request,env}){
 const u=new URL(request.url),universe=u.searchParams.get('universe')||'leaders';
 if(!Object.hasOwn(UNIVERSES,universe))return json({error:'Choose a supported scanner universe.'},400);
 if(env.LIVE_DATA_ENABLED!=='on'||(!env.TWELVEDATA_API_KEY&&!(env.FINNHUB_API_KEY&&env.FINNHUB_FALLBACK_ENABLED==='on')))return json({error:'Automatic discovery requires an authorized Twelve Data feed. Configure TWELVEDATA_API_KEY and LIVE_DATA_ENABLED in Cloudflare.',code:'PROVIDER_OFF',items:[]},503);
 // Fixed server-approved 6-symbol baskets; no arbitrary universe or unbounded
 // number of provider requests, even if the client crafts a URL.
 const key=new Request(new URL('/api/market-discovery?universe='+universe,u.origin).toString());
 const cache=typeof caches!=='undefined'&&caches.default?caches.default:null;
 if(cache){
  try{const old=await cache.match(key);if(old){const payload=await old.json();if(Number.isFinite(Date.parse(payload.checked_at))&&Date.now()-Date.parse(payload.checked_at)<expiryMs)return reply({...payload,cache:'edge-cache'})}}catch{/* Proceed to bounded fetch */ }
 }
 const symbols=UNIVERSES[universe],interval='5min',started=Date.now(),result=[],errors=[];
 // Serial groups of 2 cap concurrency and prevent a single browser request from
 // requesting an entire market. Provider credit consumption: at most 6 bars calls.
 for(let i=0;i<symbols.length;i+=2){
  const batch=await Promise.allSettled(symbols.slice(i,i+2).map(async symbol=>{
   const raw=await getData(request,env,{symbol,source:'twelvedata',interval});
   const a=analyze(raw.bars,symbol,raw.meta);
   return candidateFromAnalysis(a);
  }));
  batch.forEach((p,j)=>{
   const symbol=symbols[i+j];
   if(p.status==='fulfilled')result.push(p.value);
   else errors.push({symbol,reason:String(p.reason?.message||'Data not available').slice(0,140)});
  });
 }
 const ranked=rankCandidates(result);
 await enrichNews(request,ranked);
 const data={
  scope:'CURATED_SAMPLE_NOT_WHOLE_MARKET',universe,universe_size:symbols.length,requested:symbols,
  scanned:ranked.length,interval,checked_at:new Date().toISOString(),
  source:'Twelve Data, completed historical candles; feed speed depends on subscription',
  refresh_interval_seconds:600,processing_ms:Date.now()-started,cache:'new',
  actionable:ranked.filter(x=>['BUY_WATCH','SELL_WATCH'].includes(x.status)).length,
  items:ranked.map(({priority,grade,...candidate})=>candidate),
  errors,
  note:'Automatic research across a fixed 6-symbol sample only. Ranked alignment is not probability of profit. Market-closed or stale candles never produce actionable watches.'
 };
 const response=reply(data,ranked.length?200:503);
 if(cache&&ranked.length){try{await cache.put(key,response.clone())}catch{/* Cache is optional. */}}
 return response;
}
