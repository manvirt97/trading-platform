import test from 'node:test';
import assert from 'node:assert/strict';
import {rank} from '../functions/api/radar.js';
import {onRequestGet as config} from '../functions/api/profile-config.js';
import {onRequestPost as ai} from '../functions/api/research-ai.js';
const sample=(title,cat='Technology')=>({title,category:cat,at:new Date().toISOString(),url:'https://news.google.com/rss/articles/test'});
test('radar ranks only companies actually mentioned by public headline',()=>{
 let rows=rank([sample('NVIDIA announces quarterly results'),sample('Tesla shares react to earnings','Macro & markets')]);
 assert.deepEqual(rows.map(x=>x.symbol),['NVDA','TSLA']);assert.equal(rows[0].mentions,1);
 assert.equal(rows[0].sources[0].url.startsWith('https://'),true);
});
test('radar never fabricates opportunities from unrelated news',()=>{assert.deepEqual(rank([sample('Energy prices increase')]),[])});
test('configuration is disabled until database and Firebase are both supplied',async()=>{
 const r=await config({env:{FIREBASE_PROJECT_ID:'x',FIREBASE_API_KEY:'public',FIREBASE_AUTH_DOMAIN:'x.firebaseapp.com',FIREBASE_APP_ID:'y'}});
 let c=await r.json();assert.equal(c.enabled,false);assert.equal(c.ai_enabled,false);
});
test('AI refuses requests until private authorization and backend exist',async()=>{
 const r=await ai({env:{},request:new Request('https://example.org/api/research-ai',{method:'POST'})});
 assert.equal(r.status,503);
});
