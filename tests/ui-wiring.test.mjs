import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all Rangeform screens have identical primary navigation and standalone manifest',()=>{
 for(const path of ['public/research.html','public/market.html','public/account.html']){
  const html=load(path);
  assert.match(html,/href="\/market\.html"/);
  assert.match(html,/href="\/research"/);
  assert.match(html,/href="\/account\.html"/);
  assert.match(html,/rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html,/href="\/static\/apple-touch-icon\.png"/);
  assert.match(html,/rangeform-mark\.svg/);
 }
 const manifest=JSON.parse(load('public/manifest.webmanifest'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.scope,'/');
 assert.ok(manifest.icons.some(x=>x.sizes==='192x192'));
 assert.ok(manifest.icons.some(x=>x.sizes==='512x512'));
});

test('mobile navigation drawer closes on backdrop and buttons',()=>{
 const html=load('public/research.html'),script=load('public/static/app.js'),mobile=load('public/static/experience.js');
 assert.match(html,/id="sidebarBackdrop"/);
 assert.match(script,/sidebarBackdrop.*onclick=closeSidebar/);
 assert.match(script,/function closeSidebar/);
 assert.match(mobile,/rangeformSidebar\?\.open\(\)/);
});

test('Google sign-in prompts account choice and isolates data by validated uid',()=>{
 const page=load('public/account.html'),client=load('public/static/account.js');
 const aiClient=load('public/static/experience.js');
 const profile=load('functions/api/profile.js'),server=load('functions/api/research-ai.js');
 assert.match(page,/id="switchAccount"/);
 assert.match(client,/prompt:'select_account'/);
 assert.match(client,/browserSessionPersistence/);
 assert.match(aiClient,/prompt:'select_account'/);
 assert.match(aiClient,/browserSessionPersistence/);
 assert.match(aiClient,/getAuth\(initializeApp\(config\.firebase\)\)/);
 assert.match(profile,/userId\(request,env\)/);
 assert.match(profile,/WHERE uid=\?/);
 assert.match(server,/userId\(request,env\)/);
 assert.match(server,/WHERE uid=\?/);
});

test('model selector is a real backend allowlist, not unsupported model branding',()=>{
 const html=load('public/research.html'),account=load('public/account.html'),server=load('functions/api/research-ai.js');
 for(const id of ['fast','balanced','reasoning']){
  assert.match(html,new RegExp('value="'+id+'"'));
  assert.match(account,new RegExp('value="'+id+'"'));
  assert.match(server,new RegExp('(?:^|[,{])'+id+':\\{'));
 }
 assert.match(server,/env\.AI\.run\(selected\.id/);
 assert.doesNotMatch(server,/env\.AI\.run\(data\.model/);
});
