// Owner-only, on-demand market quote check. Never a streaming or broker endpoint.
// Keys are Cloudflare secrets; the response deliberately excludes credentials and raw vendor payloads.
const SYMBOL=/^[A-Z][A-Z0-9.-]{0,9}$/;
const maxText=(x,n=160)=>String(x||'').slice(0,n);
const round=(n,d=4)=>Number(Number(n).toFixed(d));
const quoteCache=new Map();
const MIN_SPACING_MS=15000;
const httpError=(status,code,message,retry=0)=>Object.assign(new Error(message),{httpStatus:status,code,retryAfter:retry});
export function ownerQuoteConfiguration(env){
 const enabled=env.REALTIME_QUOTE_CHECKS_ENABLED==='on';
 const owner=Boolean(env.TRADING_QUOTE_OWNER_UID);
 const credentials=Boolean(env.ALPACA_DATA_KEY_ID&&env.ALPACA_DATA_SECRET_KEY);
 const feed=env.ALPACA_DATA_FEED==='sip'?'sip':'iex';
 return {enabled,owner,credentials,feed,configured:enabled&&owner&&credentials,
  stream_connected:false,execution_available:false,redistribution_permitted:false};
}
export async function checkOwnerQuote(env,symbol,uid,{fetcher=fetch,now=Date.now()}={}){
 const config=ownerQuoteConfiguration(env);
 if(!SYMBOL.test(symbol))throw httpError(400,'INVALID_SYMBOL','Enter a valid US stock symbol.');
 if(!config.configured)throw httpError(503,'QUOTE_NOT_CONFIGURED','Owner-only Alpaca quote checks are not configured in Cloudflare.');
 if(uid!==env.TRADING_QUOTE_OWNER_UID)throw httpError(403,'OWNER_ONLY','Private data access is restricted to the authorized project owner.');
 const cacheKey=uid+'|'+symbol+'|'+config.feed,prior=quoteCache.get(cacheKey);
 if(prior&&now<prior.until)return {...prior.result,cache_status:'recent-owner-check'};
 if(quoteCache.size>120)for(const key of [...quoteCache.keys()].slice(0,40))quoteCache.delete(key);
 const url='https://data.alpaca.markets/v2/stocks/'+encodeURIComponent(symbol)+'/quotes/latest?feed='+config.feed;
 let response;
 try{
  response=await fetcher(url,{headers:{
   'APCA-API-KEY-ID':env.ALPACA_DATA_KEY_ID,
   'APCA-API-SECRET-KEY':env.ALPACA_DATA_SECRET_KEY,
   'Accept':'application/json'
  },signal:AbortSignal.timeout(8000),cf:{cacheEverything:false,cacheTtl:0}});
 }catch{
  throw httpError(503,'QUOTE_NETWORK_ERROR','Alpaca market-data request timed out or could not be completed.');
 }
 if(response.status===429){const raw=Number(response.headers.get('retry-after'));throw httpError(429,'QUOTE_RATE_LIMIT','Alpaca rate limit reached. Do not repeatedly refresh quotes.',Number.isFinite(raw)&&raw>0?Math.min(300,Math.ceil(raw)):60)}
 if(response.status===401)throw httpError(503,'QUOTE_CREDENTIALS','Alpaca rejected the quote API credentials. Check encrypted Cloudflare secrets.');
 if(response.status===403||response.status===422)throw httpError(503,'QUOTE_ENTITLEMENT','The selected Alpaca feed may not be allowed on your account. Try entitled IEX access, or confirm SIP subscription and display rights.');
 if(!response.ok)throw httpError(503,'QUOTE_PROVIDER_ERROR','Alpaca market-data provider returned HTTP '+response.status+'.');
 let body;try{body=await response.json()}catch{throw httpError(503,'QUOTE_INVALID_RESPONSE','Alpaca returned an invalid quote response.')}
 const quote=body?.quote;
 const bid=Number(quote?.bp),ask=Number(quote?.ap);
 const bidSize=Number(quote?.bs),askSize=Number(quote?.as),timestamp=Date.parse(quote?.t||'');
 if(!Number.isFinite(bid)||bid<=0||!Number.isFinite(ask)||ask<=0||ask<bid||!Number.isFinite(timestamp)||timestamp<=0||timestamp>now+60000)
  throw httpError(503,'QUOTE_INVALID_RESPONSE','No valid, dated bid and ask quote was returned for this symbol.');
 const age=Math.max(0,Math.round((now-timestamp)/1000));
 const spread=ask-bid,mid=(ask+bid)/2;
 const recent=age<=30;
 const result={
  symbol,provider:'alpaca',feed:config.feed,coverage:config.feed==='iex'?'Single exchange (IEX) — not consolidated NBBO':'Consolidated US SIP feed — rights require verification',
  currency:'USD',bid:round(bid),ask:round(ask),bid_size:Number.isFinite(bidSize)&&bidSize>=0?bidSize:null,ask_size:Number.isFinite(askSize)&&askSize>=0?askSize:null,
  spread:round(spread),spread_bps:round(10000*spread/mid,1),quote_time:new Date(timestamp).toISOString(),
  quote_age_seconds:age,checked_at:new Date(now).toISOString(),
  quote_state:recent?'RECENT_SNAPSHOT':'STALE_SNAPSHOT',
  cache_status:'new-owner-check',stream_connected:false,broker_orders:false,execution_ready:false,
  note:recent?'Recent quote snapshot at request time. Not streaming; other venue prices may differ.':'Quote is stale or from a closed session. Not suitable for current entry or execution decisions.',
  legal_note:'Access is restricted to the project owner. Verify individual or commercial/exchange display permissions before sharing data with other users.'
 };
 quoteCache.set(cacheKey,{until:now+MIN_SPACING_MS,result});
 return result;
}
