import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/provider-health.js';

test('market data connection flags do not claim provider reachability',async()=>{
 const res=await onRequestGet({env:{TWELVEDATA_API_KEY:'secret-test',LIVE_DATA_ENABLED:'off'}});
 assert.equal(res.status,503);
 const data=await res.json();
 assert.equal(data.connected,false);
 assert.equal(data.state,'disabled');
});

test('manual provider check verifies a dated historical response, not live permission',async()=>{
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({values:[{datetime:'2026-10-23',close:'372.22'}]}),{status:200,headers:{'Content-Type':'application/json'}});
 try{
  const result=await onRequestGet({env:{TWELVEDATA_API_KEY:'secret-test',LIVE_DATA_ENABLED:'on'}});
  assert.equal(result.status,200);
  const data=await result.json();
  assert.equal(data.connected,true);
  assert.equal(data.real_time_verified,false);
  assert.equal(data.latest_daily_session,'2026-10-23');
  assert.ok(!JSON.stringify(data).includes('secret-test'));
  assert.ok(!Object.hasOwn(data,'price'));
 }finally{globalThis.fetch=prior}
});

test('malformed and invalid historical provider bars fail closed',async()=>{
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({values:[{datetime:'2026-10-23',close:'0'}]}),{status:200});
 try{
  const result=await onRequestGet({env:{TWELVEDATA_API_KEY:'secret-test',LIVE_DATA_ENABLED:'on'}});
  assert.equal(result.status,503);
  assert.equal((await result.json()).connected,false);
 }finally{globalThis.fetch=prior}
});
