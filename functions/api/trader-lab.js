// Explicit, one-shot historical-data simulation endpoint. NEVER executes trades.
import {getData,json} from '../_shared/http.js';
import {validateSymbol} from '../_shared/core.js';
import {replayCompletedBars,validateReplayInputs} from '../_shared/trader-lab.js';

export async function onRequestGet({request,env}){
 const q=new URL(request.url).searchParams;
 let symbol,inputs;
 try{
  symbol=validateSymbol(q.get('symbol'));
  inputs=validateReplayInputs({
   entry:q.get('entry'),stop:q.get('stop'),target:q.get('target'),
   interval:q.get('interval'),horizonBars:q.get('horizonBars')??12,seed:19
  });
 }catch(e){return json({error:e.message,code:'INVALID_INPUT',broker_orders:false},400)}
 try{
  // Existing quota, licensed-history and completed-bar validation; never a client-provided price feed.
  const source=await getData(request,env,{symbol,interval:inputs.interval,source:'twelvedata'});
  if(!['twelvedata','finnhub-backup'].includes(source.meta?.source))
   throw Error('Verified licensed market history is required.');
  const result=replayCompletedBars(source.bars,inputs);
  return json({...result,symbol,currency:source.meta?.currency||'USD',
   source:source.meta.source,data_fetched_at:source.meta.fetched_at||null,
   data_note:source.meta?.source_detail||'Completed OHLCV historical bars; exchange delays vary by provider'});
 }catch(e){
  const limited=e?.code==='PROVIDER_RATE_LIMIT';
  const insufficient=/Not enough|Insufficient/.test(e?.message||'');
  const status=limited?429:e?.status===403?403:insufficient?422:503;
  return json({error:limited?'Data-provider quota reached; simulation unavailable until the feed recovers.':
   String(e?.message||'Market-data or scenario engine unavailable.').slice(0,230),
   code:limited?'PROVIDER_RATE_LIMIT':insufficient?'INSUFFICIENT_HISTORY':status===403?'PROVIDER_ENTITLEMENT':'PROVIDER_UNAVAILABLE',
   retry_after_seconds:limited?(e.retryAfterSeconds||65):null,
   state:'NO_SIMULATION',broker_orders:false,trade_ready:false},status);
 }
}
