import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestGet} from '../functions/api/algo-book.js';

test('Kraken endpoint rejects pairs not in the allowlist without requesting provider',async()=>{
 let called=false,old=globalThis.fetch;globalThis.fetch=async()=>{called=true;throw Error('unexpected')};
 try{const r=await onRequestGet({request:new Request('https://rangeform.example/api/algo-book?pair=FAKE')});assert.equal(r.status,400);assert.equal(called,false);assert.equal((await r.json()).code,'INVALID_PAIR');}
 finally{globalThis.fetch=old}
});
test('Kraken endpoint returns verified order book and no broker order path',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async u=>{assert.match(u,/api\.kraken\.com\/0\/public\/Depth/);return new Response(JSON.stringify({error:[],result:{XXBTZUSD:{bids:[['100','5','0'],['99','1','0']],asks:[['101','4','0'],['102','2','0']]}}}),{status:200})};
 try{const res=await onRequestGet({request:new Request('https://rangeform.example/api/algo-book?pair=XBTUSD')});assert.equal(res.status,200);
 const d=await res.json();assert.equal(d.source,'Kraken Spot REST /Depth');assert.equal(d.best_bid,100);assert.equal(d.best_ask,101);
 assert.equal(d.broker_orders,false);assert.equal(d.bids.length,2);assert.match(d.observed_at,/Z$/);assert.equal(res.headers.get('cache-control'),'no-store, max-age=0');
 }finally{globalThis.fetch=old}
});
test('Kraken endpoint fails closed on exchange outage, never creates fake prices',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline')};
 try{const r=await onRequestGet({request:new Request('https://rangeform.example/api/algo-book?pair=ETHUSD')});assert.equal(r.status,503);
 const d=await r.json();assert.equal(d.code,'EXCHANGE_UNAVAILABLE');assert.equal(d.broker_orders,false);assert.equal(d.best_bid,undefined);assert.equal(d.best_ask,undefined);
 }finally{globalThis.fetch=old}
});
test('strategy desk navigation, safety and modules remain visibly wired',()=>{
 const html=readFileSync(new URL('../public/algo.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../public/v9.html',import.meta.url),'utf8');
 assert.match(main,/href="\/algo\.html"/);assert.match(html,/id="feedMessage"/);assert.match(html,/id="buy"/);assert.match(html,/id="sell"/);
 assert.match(html,/id="pairEdge"/);assert.match(html,/BROKER TRADING NOT CONNECTED/);assert.match(html,/static\/algo\.js/);
 assert.doesNotMatch(html,/<script(?:\s[^>]*)?>[^\s<]/);
});
