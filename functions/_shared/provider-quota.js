// Shared credit-aware fetch. No secrets are returned to the browser.
// Cloudflare Cache API + short-lived isolate memory reduce repeated fetches.
// IMPORTANT: cache/isolates are per-colo; a cross-region global credit guarantee
// needs a Durable Object, separate licensed provider, or server-wide coordinator.
const minute=60_000;
const CACHE_SEC={'1min':65,'5min':180,'15min':420,'1day':900};
const hold=new Map(), inFlight=new Map();
const cache=()=>typeof caches!=='undefined'&&caches.default?caches.default:null;
const jsonResponse=(body,seconds)=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json','cache-control':'public,max-age='+seconds}});
const hashKey=async key=>{
 const bytes=new TextEncoder().encode(key);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].slice(0,14).map(x=>x.toString(16).padStart(2,'0')).join('');
};
const memoryPut=(key,payload,ms)=>{
 if(hold.size>160)for(const id of [...hold.keys()].slice(0,45))hold.delete(id);
 hold.set(key,{payload,until:Date.now()+ms});
};
async function readCache(key){
 const m=hold.get(key);
 if(m){if(Date.now()<m.until)return m.payload;hold.delete(key)}
 const c=cache();if(!c)return null;
 try{const r=await c.match(new Request(key));if(!r)return null;const data=await r.json();if(Date.now()<data.until){memoryPut(key,data,data.until-Date.now());return data}}catch{}
 return null;
}
async function saveCache(key,data,seconds){
 const payload={...data,until:Date.now()+seconds*1000};
 memoryPut(key,payload,seconds*1000);
 const c=cache();if(c){try{await c.put(new Request(key),jsonResponse(payload,seconds))}catch{}}
}
function parseRetryAfter(header,body){
 const seconds=Number(header);
 const ttl=Number.isFinite(seconds)&&seconds>0?seconds:Date.parse(header)-Date.now();
 const daily=/daily|per day|800 credits|midnight UTC/i.test(String(body?.message||''));
 if(daily){const now=Date.now();return Math.max(75,Math.ceil((Math.floor(now/86400000)+1)*86400000/1000-now/1000));}
 return Math.min(600,Math.max(65,Number.isFinite(ttl)&&ttl>0?(seconds>0?Math.ceil(seconds):Math.ceil(ttl/1000)):65));
}
export function quotaError(message,retrySeconds=65){
 const e=new Error(message);e.code='PROVIDER_RATE_LIMIT';e.status=429;e.retryAfterSeconds=retrySeconds;
 return e;
}
export async function getTwelveData({request,env,symbol,interval,fetcher=fetch}){
 const keyDigest=await hashKey(env.TWELVEDATA_API_KEY);
 const base='https://rangeform-private-cache.invalid/'+keyDigest;
 const statusKey=base+'/status';
 const dataKey=base+'/'+encodeURIComponent(symbol)+'/'+interval;
 const prior=await readCache(dataKey);
 if(prior?.body)return {...prior.body,cache_state:'edge-cache',fetched_at:prior.body.fetched_at};
 const stat=await readCache(statusKey);
 if(stat?.kind==='rate-limited'&&stat.retry_at>Date.now()){
  throw quotaError('Twelve Data API credit limit reached. Retry after '+new Date(stat.retry_at).toISOString()+'. Market signals are paused; historical data has not been replaced with fictional quotes.',Math.ceil((stat.retry_at-Date.now())/1000));
 }
 const active=inFlight.get(dataKey);
 if(active)return active;
 const work=(async()=>{
  // Extra per-isolate budget protects small plans. It is not global across
  // all Cloudflare data centres. Choose a lower value than your actual quota.
  const windowKey=base+'/calls';
  const limit=Number(env.PROVIDER_MAX_CALLS_PER_MINUTE);
  const max=Number.isInteger(limit)&&limit>=1&&limit<=1000?limit:5;
  const used=hold.get(windowKey),now=Date.now();
  const current=used&&now<used.until?used.payload:{count:0,start:now};
  if(current.count>=max){
   const retry=Math.ceil((current.start+minute-now)/1000);
   throw quotaError('Rangeform paused new provider requests to preserve your Twelve Data API credits. Cached bars may still be available. Retry in about '+Math.max(1,retry)+' seconds.',Math.max(1,retry));
  }
  memoryPut(windowKey,{count:current.count+1,start:current.start},Math.max(1000,current.start+minute-now));
  const q=new URLSearchParams({symbol,interval,outputsize:'300',apikey:env.TWELVEDATA_API_KEY,format:'JSON',timezone:'UTC'});
  let response;
  try{
   response=await fetcher('https://api.twelvedata.com/time_series?'+q,{headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(9000),cf:{cacheTtl:0,cacheEverything:false}});
  }catch(error){await saveCache(statusKey,{kind:'network-error',checked_at:new Date().toISOString()},20);throw error}
  let body;try{body=await response.json()}catch{body=null}
  const code=Number(body?.code||response.status);
  if(code===429||response.status===429){
   const seconds=parseRetryAfter(response.headers.get('retry-after'),body);
   await saveCache(statusKey,{kind:'rate-limited',retry_at:Date.now()+seconds*1000,
    checked_at:new Date().toISOString(),message:'Twelve Data API credit limit reached; market analysis is paused.'},seconds);
   throw quotaError('Twelve Data API credit limit reached (HTTP 429). New market analyses are paused until the provider quota recovers.',seconds);
  }
  if(!response.ok||body?.status==='error'){
   await saveCache(statusKey,{kind:'provider-error',http_status:code,checked_at:new Date().toISOString()},30);
   const err=new Error('Twelve Data rejected market history (HTTP '+code+'). Verify symbol and exchange entitlement.');
   err.code=code===403?'PROVIDER_ENTITLEMENT':'PROVIDER_UNAVAILABLE';err.status=code===403?403:503;throw err;
  }
  if(!body||!Array.isArray(body.values))throw Error('Twelve Data returned no verified dated price bars.');
  // Check prices, timestamps and enough *completed* candles BEFORE marking the
  // provider healthy or caching a supposed success.
  const {parseTwelve}=await import('./core.js');
  try{parseTwelve(body,interval)}
  catch(e){
   await saveCache(statusKey,{kind:'invalid-bars',checked_at:new Date().toISOString()},30);
   throw e;
  }
  const credits=Number(response.headers.get('api-credits-left'));
  const headersCredits=Number.isFinite(credits)&&response.headers.has('api-credits-left')?credits:null;
  const fetched_at=new Date().toISOString();
  const cacheSeconds=CACHE_SEC[interval]||90;
  const value={data:body,fetched_at,credits_left:headersCredits};
  await saveCache(dataKey,{body:value},cacheSeconds);
  await saveCache(statusKey,{kind:'responding',fetched_at,checked_at:fetched_at,interval,credits_left:headersCredits,real_time_verified:false},Math.max(80,cacheSeconds));
  return {...value,cache_state:'provider-fetch'};
 })();
 inFlight.set(dataKey,work);
 try{return await work}finally{inFlight.delete(dataKey)}
}
export async function readTwelveState(env){
 if(!env.TWELVEDATA_API_KEY)return {state:'not-configured',usable:false};
 if(env.LIVE_DATA_ENABLED!=='on')return {state:'disabled',usable:false};
 const digest=await hashKey(env.TWELVEDATA_API_KEY);
 const s=await readCache('https://rangeform-private-cache.invalid/'+digest+'/status');
 if(!s)return {state:'configured-unverified',usable:false,note:'Provider enabled; no successful API response verified recently.'};
 const now=Date.now(),throttled=s.kind==='rate-limited'&&s.retry_at>now;
 return {state:throttled?'rate-limited':s.kind,usable:s.kind==='responding',
  checked_at:s.checked_at||null,last_success_at:s.fetched_at||null,
  retry_after_seconds:throttled?Math.ceil((s.retry_at-now)/1000):null,
  credits_left:Number.isFinite(s.credits_left)?s.credits_left:null,
  real_time_verified:false,
  note:throttled?'Provider API quota exhausted; no current signal can be confirmed.':'Status from earlier server-side requests; this is not a streaming or broker quote.'};
}
