import test from 'node:test';
import assert from 'node:assert/strict';
import {UNIVERSES,candidateFromAnalysis,rankCandidates} from '../functions/_shared/discovery.js';
import {onRequestGet} from '../functions/api/market-discovery.js';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const now=new Date('2026-10-26T21:20:00Z'); // after normal US session
const bar=(d)=>({time:d.toISOString(),timestamp:d.toISOString(),open:100,high:102,low:99,close:101,volume:1200});
test('market discovery uses fixed, bounded baskets, not a claim to screen all stocks',()=>{
 assert.deepEqual(Object.keys(UNIVERSES),['leaders','diversified']);
 for(const symbols of Object.values(UNIVERSES)){
  assert.equal(symbols.length,6);
  assert.equal(new Set(symbols).size,symbols.length);
  assert.ok(symbols.every(s=>/^[A-Z]{2,5}$/.test(s)));
 }
});
test('real-bar candidate remains historical outside session; no fabricated execution',()=>{
 const bars=Array.from({length:50},(_,i)=>bar(new Date(Date.parse('2026-10-23T13:30:00Z')+i*300000)));
 const x={symbol:'NVDA',interval:'5min',source:'twelvedata',data_quality:'complete-ohlcv',bar_history:bars,
  last:101,last_bar_utc:bars.at(-1).time,score:88,indicators:{sma20:100,rel_volume:1.3,atr14:2},
  patterns:[{name:'Doji',type:'neutral',why:'Small body'}]};
 const y=candidateFromAnalysis(x,{state:'not-checked',items:[]},now);
 assert.equal(y.status,'WAIT_STALE');
 assert.equal(y.signal,null);
 assert.equal(y.directional_bias,'bullish');
 assert.equal(y.supporting_patterns[0].name,'Doji');
 assert.match(y.note,/not include broker spread/);
 assert.equal(y.quality_score,88);
});
test('sorting favors confirmed valid watches over stale history, without win probability',()=>{
 const ranked=rankCandidates([{symbol:'AAA',priority:1},{symbol:'BBB',priority:201},{symbol:'CCC',priority:102}]);
 assert.deepEqual(ranked.map(x=>x.symbol),['BBB','CCC','AAA']);
});
test('API rejects unsupported universes and missing provider without making network calls',async()=>{
 let result=await onRequestGet({request:new Request('https://example.org/api/market-discovery?universe=unknown'),env:{}});
 assert.equal(result.status,400);
 result=await onRequestGet({request:new Request('https://example.org/api/market-discovery?universe=leaders'),env:{}});
 assert.equal(result.status,503);
 assert.equal((await result.json()).code,'PROVIDER_OFF');
});
test('new home includes on-demand discovery and both AI experiences with setup visibility',()=>{
 const html=read('public/v9.html'),client=read('public/static/v9.js'),ai=read('public/static/v9-ai.js');
 for(const id of ['discoveryResults','discoveryUniverse','discoveryRefresh','assistantAnswer','assistantUseAI','assistantExplain','assistantSignIn','assistantQuestion'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(client,/\/api\/market-discovery/);
 assert.match(client,/rangeform:discovery/);
 assert.match(client,/automatic six-ticker polling is disabled/);
 assert.match(ai,/\/api\/profile-config/);
 assert.match(ai,/\/api\/research-ai/);
 assert.match(ai,/getIdToken/);
 assert.match(ai,/RULE-BASED MARKET EVIDENCE/);
 assert.match(ai,/AI MODEL UNAVAILABLE/);
 assert.doesNotMatch(html,/LIVE FEED CONNECTED/);
});
