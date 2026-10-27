import test from 'node:test';
import assert from 'node:assert/strict';
import {isLegacyEntry,onRequest} from '../functions/_middleware.js';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const legacy=['/','/index.html','/research','/research/','/research.html','/market','/market/','/market.html','/market-classic','/market-classic.html','/v8','/v8.html','/terminal'];
test('old home, V8 Research and all market aliases immediately redirect before HTML loads',async()=>{
 for(const path of legacy){
  assert.equal(isLegacyEntry(path),true,path);
  let called=false;
  const response=await onRequest({request:new Request('https://rangeform.pages.dev'+path+'?classic=1'),next:()=>{called=true;throw Error('Legacy UI must not load')}});
  assert.equal(called,false);
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),'https://rangeform.pages.dev/v9.html');
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal(response.headers.get('x-rangeform-routing'),'V10.3-current-only');
 }
});
test('private account, APIs, assets and the new workspace pass through unchanged',async()=>{
 for(const path of ['/v9.html','/account.html','/api/status','/api/claude-desk','/static/v9.js','/manifest.webmanifest']){
  let calls=0;
  const result=await onRequest({request:new Request('https://rangeform.pages.dev'+path),next:()=>{calls++;return new Response('allowed',{status:200})}});
  assert.equal(calls,1,path);
  assert.equal(result.status,200);
  assert.equal(await result.text(),'allowed');
 }
});
test('fallback redirects and old-page scripts cannot expose classic Research',()=>{
 const redirects=read('public/_redirects'),research=read('public/research.html'),oldMarket=read('public/market.html');
 for(const path of legacy.filter(p=>['/','/index.html','/research','/research/','/research.html','/market','/market/','/market.html','/market-classic','/market-classic.html','/v8','/v8.html','/terminal'].includes(p)))
  assert.ok(redirects.includes(path+' /v9.html 302'),'missing static backup '+path);
 assert.match(research,/location\.replace\('\/v9\.html'\+location\.hash\)/);
 assert.doesNotMatch(research,/if\(!new URLSearchParams\(location\.search\)\.has\('classic'\)\)/);
 assert.match(oldMarket,/<script>location\.replace\('\/v9\.html'\+location\.hash\)<\/script>/);
 assert.doesNotMatch(read('public/v9.html'),/Open classic workspace|href="\/research\.html\?classic=1"/);
});
test('built version makes stale Cloudflare projects easily identifiable',()=>{
 assert.match(read('functions/api/status.js'),/app_version:'V13'/);
 assert.match(read('public/v9.html'),/V13 · RESEARCH &amp; DECISIONS/);
});
