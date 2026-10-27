import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPECIALISTS,sanitizeModel,onRequestPost as claude} from '../functions/api/claude-desk.js';
import {isTradingViewIp,secureEqual,onRequestPost as alert} from '../functions/api/tv-alert.js';
import {getData,getFinnhubBars} from '../functions/_shared/http.js';
import worker,{isRegularResearchWindow} from '../worker/scheduled-scanner.js';
import {onRequestGet as discovery} from '../functions/api/market-discovery.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('11 real Claude roles are explicit and the supervisor cannot override hard safety gates',async()=>{
 assert.equal(SPECIALISTS.length,10);
 assert.equal(new Set(SPECIALISTS.map(r=>r[0])).size,10);
 assert.ok(SPECIALISTS.some(r=>r[0]==='multi_tf'));
 assert.ok(SPECIALISTS.some(r=>r[0]==='catalysts'));
 assert.equal(sanitizeModel('claude-sonnet-5-5','x'),'claude-sonnet-5-5');
 assert.equal(sanitizeModel('unlicensed-claude-opus','claude-haiku-5-5'),'claude-haiku-5-5');
 const src=read('functions/api/claude-desk.js');
 assert.match(src,/Promise\.all\(SPECIALISTS\.map/);
 assert.match(src,/10 separate|10 distinct|10 specialist/i);
 assert.match(src,/authoritative_verdict:room\.verdict/);
 assert.match(src,/decision:room\.verdict/);
 assert.match(src,/room\.verdict==='WAIT'\?null:opportunity\.plan/);
 assert.match(src,/daily|per account|WHERE calls<2/);
 const notConfigured=await claude({request:new Request('https://example.org/api/claude-desk',{method:'POST'}),env:{}});
 assert.equal(notConfigured.status,503);
 assert.equal((await notConfigured.json()).code,'CLAUDE_NOT_CONFIGURED');
});
test('TradingView alert endpoint rejects unknown sender and never executes orders',async()=>{
 assert.ok(isTradingViewIp('52.89.214.238'));
 assert.equal(isTradingViewIp('127.0.0.1'),false);
 assert.equal(secureEqual('abc','abc'),true);
 assert.equal(secureEqual('abc','abcd'),false);
 assert.equal(secureEqual('abc','aba'),false);
 const req=new Request('https://example.org/api/tv-alert',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'127.0.0.1'},body:JSON.stringify({auth:'x'})});
 const res=await alert({request:req,env:{TRADINGVIEW_WEBHOOK_TOKEN:'x'.repeat(40),TV_EVENTS:{}}});
 assert.equal(res.status,403);
 assert.match(read('functions/api/tv-alert.js'),/execution:false/);
 assert.match(read('functions/api/tv-alert.js'),/expirationTtl:172800/);
});
test('TradingView alert replay and expiry blocked with mocked KV',async()=>{
 const saved=new Map();
 const kv={get:async k=>saved.get(k)||null,put:async(k,v)=>{saved.set(k,v)}};
 const env={TV_EVENTS:kv,TRADINGVIEW_WEBHOOK_TOKEN:'long-dedicated-test-token-is-at-least-32-bytes'};
 const event={id:'20261026-NVDA-long-bar-01',symbol:'NVDA',action:'BUY_WATCH',time:new Date().toISOString(),auth:env.TRADINGVIEW_WEBHOOK_TOKEN};
 const build=()=>new Request('https://example.org/api/tv-alert',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'52.89.214.238'},body:JSON.stringify(event)});
 const first=await alert({request:build(),env});assert.equal(first.status,200);assert.equal((await first.json()).duplicate,false);
 const second=await alert({request:build(),env});assert.equal(second.status,200);assert.equal((await second.json()).duplicate,true);
 event.time=new Date(Date.now()-3600000).toISOString();
 const stale=await alert({request:build(),env});assert.equal(stale.status,400);
});
test('licensed Finnhub provider backup normalizes OHLCV but never substitutes Yahoo scraping',async()=>{
 const old=globalThis.fetch;
 const end=Date.now()-600000;
 const t=Array.from({length:65},(_,i)=>Math.floor((end-(64-i)*300000)/1000));
 globalThis.fetch=async url=>{
  assert.ok(String(url).includes('finnhub.io/api/v1/stock/candle'));
  return new Response(JSON.stringify({s:'ok',t,o:t.map(()=>100),h:t.map(()=>102),l:t.map(()=>99),c:t.map(()=>101),v:t.map(()=>2000)}),{status:200});
 };
 try{
  const env={LIVE_DATA_ENABLED:'on',FINNHUB_FALLBACK_ENABLED:'on',FINNHUB_API_KEY:'server-only-test'};
  const b=await getData(new Request('https://example.org/api/analyze'),env,{symbol:'NVDA',source:'twelvedata',interval:'5min'});
  assert.equal(b.meta.source,'finnhub-backup');
  assert.ok(b.bars.length>=36);
  assert.ok(b.bars.every(c=>c.timestamp&&c.high>=c.close&&c.low<=c.close));
 }finally{globalThis.fetch=old}
 assert.doesNotMatch(read('functions/_shared/http.js'),/query1\.finance\.yahoo\.com|query2\.finance\.yahoo\.com/);
});
test('background scanner runs only in US regular-hours window and requires explicit deployment',()=>{
 assert.equal(isRegularResearchWindow(new Date('2026-10-26T14:00:00Z')),true);
 assert.equal(isRegularResearchWindow(new Date('2026-10-25T14:00:00Z')),false);
 assert.equal(isRegularResearchWindow(new Date('2026-10-26T01:00:00Z')),false);
 const cfg=read('wrangler.scanner.toml');
 assert.match(cfg,/crons = \["\*\/30 \* \* \* \*"\]/);
 assert.match(read('worker/scheduled-scanner.js'),/SCANNER_SNAPSHOTS/);
 assert.ok(typeof worker.scheduled==='function');
});
test('V10 visible scanner, 11-Claude console, supervisor and verified provider states',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js'),auth=read('public/static/v9-ai.js');
 for(const id of ['discoveryScannerHost','discoveryHome','supervisorHeadline','claudeDeskStatus','claudeDeskTitle','claudeAgentResults','claudeSupervisor','runClaudeCouncil','tvRefresh','cronRefresh'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/V10 · CLAUDE COUNCIL/);
 assert.match(html,/Opportunity scanner/);
 assert.match(js,/host\.after\(discovery\)/);
 assert.match(js,/headlineSupervisor/);
 assert.match(auth,/\/api\/claude-desk/);
 assert.match(auth,/\/api\/scheduled-opportunities/);
 assert.match(auth,/\/api\/tv-alerts/);
 assert.match(html,/Paper|paper/i);
});
