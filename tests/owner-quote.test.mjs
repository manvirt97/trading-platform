import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerQuoteConfiguration,checkOwnerQuote} from '../functions/_shared/owner-quote.js';
import {onRequestGet} from '../functions/api/owner-quote.js';
import {onRequestGet as status} from '../functions/api/status.js';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const env=(tag='test')=>({
 REALTIME_QUOTE_CHECKS_ENABLED:'on',ALPACA_DATA_KEY_ID:'test-id-'+tag,ALPACA_DATA_SECRET_KEY:'test-private-secret-'+tag,
 TRADING_QUOTE_OWNER_UID:'expected-uid',ALPACA_DATA_FEED:'iex',FIREBASE_PROJECT_ID:'test-project'
});
const quote=(date='2026-10-27T15:00:15.123456789Z')=>({symbol:'AAPL',quote:{
 t:date,bp:230.1,ap:230.14,bs:4,as:2,bx:'V',ax:'V'
}});
test('Private quote feature is disabled until keys, owner UID and explicit enable are present',()=>{
 assert.equal(ownerQuoteConfiguration({}).configured,false);
 assert.equal(ownerQuoteConfiguration({...env(),TRADING_QUOTE_OWNER_UID:''}).configured,false);
 assert.equal(ownerQuoteConfiguration({...env(),REALTIME_QUOTE_CHECKS_ENABLED:'off'}).configured,false);
 assert.equal(ownerQuoteConfiguration(env()).configured,true);
 assert.equal(ownerQuoteConfiguration({...env(),ALPACA_DATA_FEED:'unknown'}).feed,'iex');
 assert.equal(ownerQuoteConfiguration({...env(),ALPACA_DATA_FEED:'sip'}).feed,'sip');
});
test('Unauthenticated/unconfigured requests cannot retrieve private quotes',async()=>{
 const request=new Request('https://example.com/api/owner-quote?symbol=AAPL');
 const r=await onRequestGet({request,env:env()});assert.equal(r.status,401);
 const p=await onRequestGet({request,env:{}});assert.equal(p.status,503);
 const x=await p.json();assert.equal(x.code,'QUOTE_NOT_CONFIGURED');
});
test('Wrong account UID cannot force quote checks or consume API provider calls',async()=>{
 let hits=0;
 await assert.rejects(checkOwnerQuote(env('wrong'), 'AAPL','intruder',{fetcher:async()=>{hits++;return Response.json(quote())}}),
  e=>e.code==='OWNER_ONLY'&&e.httpStatus===403);
 assert.equal(hits,0);
});
test('Real dated bid/ask snapshot is normalized and reveals no credentials',async()=>{
 let hits=0,passedUrl='';
 const x=await checkOwnerQuote(env('normal'),'AAPL','expected-uid',{now:Date.parse('2026-10-27T15:00:18Z'),
  fetcher:async(url,opts)=>{
   hits++;passedUrl=url;assert.equal(opts.headers['APCA-API-KEY-ID'],'test-id-normal');
   assert.equal(opts.headers['APCA-API-SECRET-KEY'],'test-private-secret-normal');
   return Response.json(quote());
  }});
 assert.equal(hits,1);assert.match(passedUrl,/feed=iex/);
 assert.equal(x.symbol,'AAPL');assert.equal(x.spread,0.04);assert.ok(x.spread_bps>0);
 assert.equal(x.quote_state,'RECENT_SNAPSHOT');assert.equal(x.execution_ready,false);
 assert.equal(x.feed,'iex');assert.match(x.coverage,/not consolidated/i);
 assert.doesNotMatch(JSON.stringify(x),/test-private-secret|test-id-normal|expected-uid/);
 const cache=await checkOwnerQuote(env('normal'),'AAPL','expected-uid',{now:Date.parse('2026-10-27T15:00:19Z'),fetcher:async()=>{hits++;throw Error('should be cached')}});
 assert.equal(hits,1);assert.equal(cache.cache_status,'recent-owner-check');
});
test('Stale snapshot always denied trade-readiness claims even if provider responds HTTP 200',async()=>{
 const x=await checkOwnerQuote(env('stale'),'AAPL','expected-uid',{
  now:Date.parse('2026-10-27T18:00:00Z'),fetcher:async()=>Response.json(quote('2026-10-27T14:00:00Z'))
 });
 assert.equal(x.quote_state,'STALE_SNAPSHOT');assert.equal(x.execution_ready,false);
 assert.match(x.note,/stale/i);
});
test('SIP entitlement errors are explained but never expose provider secrets',async()=>{
 await assert.rejects(checkOwnerQuote({...env('sip'),ALPACA_DATA_FEED:'sip'},'AAPL','expected-uid',{
  fetcher:async()=>Response.json({message:'subscription does not permit querying recent SIP data'},{status:422})
 }),e=>e.code==='QUOTE_ENTITLEMENT'&&/SIP/.test(e.message));
});
test('Quote provider 429 is preserved with retry recommendation',async()=>{
 await assert.rejects(checkOwnerQuote(env('rate'),'AAPL','expected-uid',{
  fetcher:async()=>Response.json({message:'limited'},{status:429,headers:{'retry-after':'30'}})
 }),e=>e.code==='QUOTE_RATE_LIMIT'&&e.retryAfter===30);
});
test('Invalid, crossed or future quote prices never become recent tradeable quotes',async()=>{
 await assert.rejects(checkOwnerQuote(env('cross'),'AAPL','expected-uid',{
  now:Date.parse('2026-10-27T15:00:18Z'),fetcher:async()=>Response.json({quote:{t:'2026-10-27T15:00:17Z',bp:111,ap:100}})
 }),e=>e.code==='QUOTE_INVALID_RESPONSE');
 await assert.rejects(checkOwnerQuote(env('future'),'AAPL','expected-uid',{
  now:Date.parse('2026-10-27T15:00:18Z'),fetcher:async()=>Response.json(quote('2026-10-27T16:05:00Z'))
 }),e=>e.code==='QUOTE_INVALID_RESPONSE');
});
test('Status shows configuration only and does not leak private credentials',async()=>{
 const x=await status({env:env('status')});const data=await x.json();
 assert.equal(data.owner_quote_checks_configured,true);
 assert.equal(data.owner_quote_feed,'iex');
 assert.equal(data.app_version,'V16');
 assert.doesNotMatch(JSON.stringify(data),/test-id-status|test-private-secret-status|expected-uid/);
});
test('Owner quote UI requires explicit click, authenticated bearer, and keeps technical research separate',()=>{
 const html=read('public/v9.html'),js=read('public/static/day-desk.js'),css=read('public/static/v15-daydesk.css'),api=read('functions/api/owner-quote.js');
 assert.match(html,/id="day-quote-test"/);
 assert.match(html,/ALPACA_DATA_KEY_ID/);
 assert.match(html,/TRADING_QUOTE_OWNER_UID/);
 assert.match(html,/v15-daydesk\.css\?v=2/);
 assert.match(html,/day-desk\.js\?v=2/);
 assert.match(js,/addEventListener\('click',testOwnerQuote\)/);
 assert.match(js,/getIdToken\(\)/);
 assert.match(js,/\/api\/owner-quote/);
 assert.match(js,/\/api\/status/);
 assert.match(css,/\.daydesk-quote-grid/);
 assert.match(api,/userId\(request,env\)/);
 assert.match(api,/uid!==env\.TRADING_QUOTE_OWNER_UID/);
 assert.doesNotMatch(js,/ALPACA_DATA_SECRET_KEY|Math\.random\(/);
 assert.doesNotMatch(api,/\/api\/orders|api\.alpaca\.markets\/v2\/orders/);
});
