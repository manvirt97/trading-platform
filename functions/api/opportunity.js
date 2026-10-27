// Combines server-side authorized historical OHLCV with dated public news context.
// No orders, no invented quotes, no guessed headline sentiment or probability.
import {getData,json} from '../_shared/http.js';
import {analyze,validateSymbol} from '../_shared/core.js';
import {evaluateOpportunity} from '../_shared/opportunity.js';
import {onRequestGet as getNews} from './news.js';

export async function onRequestGet({request,env}){
 const url=new URL(request.url);
 let symbol,interval;
 try{symbol=validateSymbol(url.searchParams.get('symbol')||'');interval=url.searchParams.get('interval')||'5min';
  if(!['1min','5min','15min','1day'].includes(interval))throw Error('Choose an available interval.');
 }catch(e){return json({error:String(e.message)},400)}
 const includeNews=url.searchParams.get('news')!=='0';
 let technical;
 try{
  const raw=await getData(request,env,{symbol,interval,source:'twelvedata'});
  technical=analyze(raw.bars,symbol,raw.meta);
 }catch(e){
  return json({error:'Verified provider history unavailable. '+String(e.message||'').slice(0,180),status:'NO_DATA',provider_ready:false},503);
 }
 let news={state:'not-checked',items:[]};
 if(includeNews){
  try{
   const newsUrl=new URL('/api/news',request.url);
   newsUrl.search=new URLSearchParams({q:symbol,category:'all',region:'CA'}).toString();
   const response=await getNews({request:new Request(newsUrl.toString())});
   const data=await response.json();
   news={state:response.ok?data.availability:'unverified',items:data.items||[]};
  }catch{news={state:'unverified',items:[]}}
 }
 const signal=evaluateOpportunity(technical,news);
 return json({opportunity:signal,analysis:technical,news_checked:includeNews});
}
