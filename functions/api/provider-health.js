// Manual operational check: verifies a provider API response, not real-time exchange entitlement.
// This endpoint never exposes the private API key or a price quote.
import {json} from '../_shared/http.js';

export async function onRequestGet({env}){
 if(!env.TWELVEDATA_API_KEY)return json({state:'not-configured',connected:false,message:'Twelve Data API key is not configured.'},503);
 if(env.LIVE_DATA_ENABLED!=='on')return json({state:'disabled',connected:false,message:'Twelve Data is configured but access is disabled.'},503);
 const url=new URL('https://api.twelvedata.com/time_series');
 url.search=new URLSearchParams({symbol:'AAPL',interval:'1day',outputsize:'2',format:'JSON',timezone:'UTC',apikey:env.TWELVEDATA_API_KEY}).toString();
 const started=Date.now();
 try{
  const r=await fetch(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(6500),cf:{cacheTtl:0,cacheEverything:false}});
  if(!r.ok)return json({state:'unavailable',connected:false,message:'Provider returned HTTP '+r.status,checked_at:new Date().toISOString()},503);
  const raw=await r.json();
  const date=String(raw?.values?.[0]?.datetime||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||(!Number.isFinite(Number(raw.values[0].close))||Number(raw.values[0].close)<=0)){
   const code=String(raw?.code||'');
   return json({state:'unavailable',connected:false,message:code==='429'?'Provider request limit reached.':'Provider returned no valid historical bars. Check your subscription, exchange coverage and rate limits.',checked_at:new Date().toISOString()},503);
  }
  return json({state:'responding',connected:true,provider:'Twelve Data',checked_at:new Date().toISOString(),latest_daily_session:date,round_trip_ms:Math.max(0,Date.now()-started),data_type:'historical daily bars',real_time_verified:false,message:'Provider returned valid dated daily history. This does NOT verify real-time exchange entitlements or that an intraday setup is current.'});
 }catch(e){return json({state:'unavailable',connected:false,message:e?.name==='TimeoutError'?'Provider timed out.':'Could not retrieve valid provider data.',checked_at:new Date().toISOString()},503)}
}
