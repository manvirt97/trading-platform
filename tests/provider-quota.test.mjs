import test from 'node:test';
import assert from 'node:assert/strict';
import {getTwelveData,readTwelveState} from '../functions/_shared/provider-quota.js';
import {onRequestGet as passiveFeed} from '../functions/api/feed-state.js';
import {getData} from '../functions/_shared/http.js';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const req=new Request('https://example.com/api/analyze?source=twelvedata&symbol=AAPL&interval=5min');
const env=(key,cap='5')=>({TWELVEDATA_API_KEY:key,LIVE_DATA_ENABLED:'on',PROVIDER_MAX_CALLS_PER_MINUTE:cap});
const history=()=>({
 meta:{currency:'USD'},
 values:Array.from({length:70},(_,i)=>({
  datetime:new Date(Date.parse('2026-10-20T13:30:00Z')+i*5*60000).toISOString().slice(0,19).replace('T',' '),
  open:'100',high:'102',low:'99',close:String(100+i/100),volume:'1000'
 }))
});
test('identical market-data requests are cached and deduplicated; no repeated provider credits',async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;return Response.json(history(),{headers:{'api-credits-left':'4'}})};
 const e=env('cache-dedup-1');
 const [a,b]=await Promise.all([
  getTwelveData({request:req,env:e,symbol:'AAPL',interval:'5min',fetcher}),
  getTwelveData({request:req,env:e,symbol:'AAPL',interval:'5min',fetcher})
 ]);
 assert.equal(calls,1);
 assert.equal(a.data.values.length,70);
 assert.equal(b.data.values.length,70);
 const later=await getTwelveData({request:req,env:e,symbol:'AAPL',interval:'5min',fetcher});
 assert.equal(later.cache_state,'edge-cache');
 assert.equal(calls,1);
 const health=await readTwelveState(e);
 assert.equal(health.state,'responding');
 assert.equal(health.real_time_verified,false);
 assert.equal(health.credits_left,4);
 assert.doesNotMatch(JSON.stringify(health),/cache-dedup-1/);
});
test('provider HTTP 429 opens a cooldown and prevents immediate second provider call',async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;return Response.json({code:429,status:'error',message:'API credits exceeded'},{status:429,headers:{'retry-after':'120'}})};
 const e=env('429-http-a');
 await assert.rejects(getTwelveData({request:req,env:e,symbol:'MSFT',interval:'5min',fetcher}),x=>x.code==='PROVIDER_RATE_LIMIT'&&x.retryAfterSeconds>=65);
 await assert.rejects(getTwelveData({request:req,env:e,symbol:'NVDA',interval:'5min',fetcher}),/limit reached/i);
 assert.equal(calls,1,'should not repeatedly call a provider that has just denied credits');
 const health=await readTwelveState(e);
 assert.equal(health.state,'rate-limited');
 assert.ok(health.retry_after_seconds>=65);
});
test('a JSON-level 429 is throttled even when upstream responds HTTP 200',async()=>{
 const e=env('429-json-b');
 await assert.rejects(getTwelveData({request:req,env:e,symbol:'AAPL',interval:'5min',
  fetcher:async()=>Response.json({code:429,status:'error',message:'Daily limit reached'})}),x=>x.code==='PROVIDER_RATE_LIMIT');
 const health=await readTwelveState(e);
 assert.equal(health.state,'rate-limited');
 assert.ok(health.retry_after_seconds>65);
});
test('per-isolate credit ceiling blocks extra symbols instead of making a risky provider request',async()=>{
 let calls=0,e=env('quota-local-d','2');
 const fetcher=async()=>{calls++;return Response.json(history())};
 for(const symbol of ['AAPL','MSFT'])
  await getTwelveData({request:req,env:e,symbol,interval:'5min',fetcher});
 await assert.rejects(getTwelveData({request:req,env:e,symbol:'NVDA',interval:'5min',fetcher}),x=>x.code==='PROVIDER_RATE_LIMIT');
 assert.equal(calls,2);
});
test('passive operational health performs no upstream Twelve Data request',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('Not allowed')};
 try{
  const response=await passiveFeed({env:env('passive-empty-e')});
  const data=await response.json();
  assert.equal(response.status,200);assert.equal(calls,0);
  assert.equal(data.state,'configured-unverified');
  assert.equal(data.real_time_verified,false);
 }finally{globalThis.fetch=original}
});
test('shared Twelve fetch validates complete dated bars through existing core parser',async()=>{
 const e=env('validate-completed-f');
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json(history());
 try{const x=await getData(req,e,{source:'twelvedata',symbol:'AAPL',interval:'5min'});
  assert.equal(x.bars.length,70);
  assert.equal(x.meta.source,'twelvedata');
  assert.match(x.meta.source_detail,/historical/);
  assert.equal(x.meta.cache_state,'provider-fetch');
 }finally{globalThis.fetch=original}
});
test('frontend does not confuse a configured key with a confirmed data connection',()=>{
 const js=read('public/static/v9.js'),api=read('functions/api/market-discovery.js');
 assert.match(js,/renderFeedHealth/);
 assert.match(js,/\/api\/feed-state/);
 assert.match(js,/API quota exhausted/);
 assert.match(js,/automatic six-ticker polling is disabled/);
 assert.doesNotMatch(js,/if\(state\.configured&&\['overview','scanner'\]\.includes\(state\.view\)\)discoverMarket\(\)/);
 assert.match(api,/if\(limited\)break/);
 assert.match(api,/rate_limited:limited/);
 assert.match(read('functions/api/opportunity.js'),/retry-after/);
});
