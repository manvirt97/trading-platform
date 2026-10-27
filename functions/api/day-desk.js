// Rangeform V15: one licensed historical-bar request per explicit user action.
// Server never accepts a client-generated "live" signal or transmits orders.
import {getData,json} from '../_shared/http.js';
import {analyze,validateSymbol} from '../_shared/core.js';
import {evaluateDayDesk} from '../_shared/day-trading.js';
const intervals=new Set(['1min','5min','15min']);
export async function onRequestGet({request,env}){
 const url=new URL(request.url);
 let symbol,interval;
 try{
  symbol=validateSymbol(url.searchParams.get('symbol')||'');
  interval=url.searchParams.get('interval')||'5min';
  if(!intervals.has(interval))throw Error('Use a completed 1-, 5- or 15-minute interval.');
 }catch(e){return json({error:String(e.message),code:'INVALID_INPUT'},400)}
 try{
  const raw=await getData(request,env,{symbol,interval,source:'twelvedata'});
  const analysis=analyze(raw.bars,symbol,raw.meta);
  const desk=evaluateDayDesk(analysis,new Date());
  return json(desk);
 }catch(e){
  const limited=e?.code==='PROVIDER_RATE_LIMIT';
  const status=limited?429:e?.status===403?403:503;
  return new Response(JSON.stringify({error:limited?
   'Twelve Data quota reached. Day Trading Desk has paused; no setup can be confirmed until the provider recovers.':
   'Completed market history is unavailable: '+String(e?.message||'provider failure').slice(0,190),
   code:limited?'PROVIDER_RATE_LIMIT':status===403?'PROVIDER_ENTITLEMENT':'PROVIDER_UNAVAILABLE',
   retry_after_seconds:limited?(e.retryAfterSeconds||65):null,
   status:'NO_DATA',broker_orders:false}),{status,headers:{
    'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    ...(limited?{'retry-after':String(e.retryAfterSeconds||65)}:{})
   }});
 }
}
