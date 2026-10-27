export const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
export async function wrap(fn){try{return json(await fn())}catch(e){return json({error:e.message||'Request failed'},e instanceof TypeError?500:400)}}
export const WATCH=['AAPL','NVDA','TSLA','MSFT','AMZN','AMD','META','GOOGL','SOFI'];

const INTERVAL_MS={ '1min':60000,'5min':300000,'15min':900000,'1day':86400000 };
function backupEnabled(env){return env.LIVE_DATA_ENABLED==='on'&&env.FINNHUB_FALLBACK_ENABLED==='on'&&Boolean(env.FINNHUB_API_KEY)}
export async function getFinnhubBars(env,symbol,interval){
 const {validateBars}=await import('./core.js');
 const minutes={'1min':'1','5min':'5','15min':'15','1day':'D'}[interval];
 if(!minutes)throw Error('Finnhub fallback cannot cover requested interval');
 const to=Math.floor(Date.now()/1000),from=to-(interval==='1day'?350*86400:interval==='15min'?28*86400:interval==='5min'?12*86400:5*86400);
 const q=new URLSearchParams({symbol,resolution:minutes,from:String(from),to:String(to),token:env.FINNHUB_API_KEY});
 const response=await fetch('https://finnhub.io/api/v1/stock/candle?'+q,{
  headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000),
  cf:{cacheTtl:interval==='1day'?900:60,cacheEverything:true}
 });
 if(!response.ok)throw Error('Backup market-data provider unavailable (HTTP '+response.status+')');
 const body=await response.json();
 if(body.s!=='ok'||![body.t,body.o,body.h,body.l,body.c,body.v].every(Array.isArray))throw Error('Backup provider returned no entitled OHLCV candles');
 if(body.t.length<36||body.t.length>8000)throw Error('Backup provider returned insufficient candles');
 const sorted=body.t.map((time,i)=>({
  timestamp:new Date(Number(time)*1000).toISOString(),
  open:Number(body.o[i]),high:Number(body.h[i]),low:Number(body.l[i]),close:Number(body.c[i]),volume:Number(body.v[i])
 })).filter(b=>Date.now()-Date.parse(b.timestamp)>=INTERVAL_MS[interval])
 .sort((x,y)=>x.timestamp.localeCompare(y.timestamp)).slice(-400);
 const bars=validateBars(sorted);
 return {bars,meta:{source:'finnhub-backup',interval,currency:'USD',data_quality:'complete-ohlcv',
 freshness:'BACKUP HISTORICAL BARS — VERIFY DELAYS',source_detail:'Finnhub OHLCV fallback; only enabled with licensed entitlement. This is not a broker quote.'}};
}
export async function getData(request,env,force){
 const {validateSymbol,validateBars,demo,parseTwelve}=await import('./core.js');
 const u=new URL(request.url),symbol=validateSymbol(force?.symbol??u.searchParams.get('symbol')??'TSLA');
 const source=force?.source??u.searchParams.get('source')??'none';
 const interval=force?.interval??u.searchParams.get('interval')??'1day';
 if(!Object.hasOwn(INTERVAL_MS,interval))throw Error('Invalid interval');
 if(source==='demo'){
  if(env.ENABLE_TEST_FIXTURES==='on')return demo(symbol,interval);
  throw Error('Synthetic example prices are disabled in the live application.');
 }
 if(source==='csv'){
  if(!force?.bars)throw Error('Imported CSV is stored only on your device.');
  return {bars:validateBars(force.bars),meta:{source:'user-csv',freshness:'USER IMPORT — VERIFY TIMESTAMPS',source_detail:'User-supplied bars; not independently verified',currency:force.currency==='CAD'?'CAD':'USD',interval,data_quality:'complete-ohlcv'}};
 }
 if(source!=='twelvedata')throw Error('Unsupported data source');
 if(env.LIVE_DATA_ENABLED!=='on')throw Error('Price-data gate is off. Authorize your provider, protect public endpoints, then set LIVE_DATA_ENABLED=on.');
 let primaryError='';
 if(env.TWELVEDATA_API_KEY){
  try{
   const q=new URLSearchParams({symbol,interval,outputsize:'300',apikey:env.TWELVEDATA_API_KEY,format:'JSON',timezone:'UTC'});
   const response=await fetch('https://api.twelvedata.com/time_series?'+q,{
    headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000),
    cf:{cacheTtl:interval==='1day'?900:60,cacheEverything:true}
   });
   if(!response.ok)throw Error('Twelve Data HTTP '+response.status);
   const body=await response.json();
   return {bars:parseTwelve(body,interval),meta:{source:'twelvedata',freshness:'PROVIDER BARS — CHECK LAST BAR / EXCHANGE DELAY',source_detail:'Twelve Data OHLCV; delays and exchange rights vary by plan',currency:body.meta?.currency||'USD',interval}};
  }catch(e){primaryError=String(e?.message||'Primary provider unavailable').slice(0,100)}
 }else primaryError='Twelve Data secret is not configured';
 if(backupEnabled(env))return getFinnhubBars(env,symbol,interval);
 throw Error('Verified historical bars unavailable: '+primaryError+'. Authorized backup disabled or unavailable.');
}
export const postData=async req=>{let raw=await req.text();if(raw.length>1_000_000)throw Error('Upload too large');return JSON.parse(raw)};