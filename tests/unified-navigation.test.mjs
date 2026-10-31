import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('legacy Market Desk links redirect to new workspace, not old HTML',()=>{
 const redirects=read('public/_redirects').trim().split('\n').filter(s=>!s.startsWith('#'));
 for(const path of ['/market.html','/market','/market/','/research','/research.html','/market-classic.html','/']){
  assert.ok(redirects.includes(path+' /v9.html 302'),path+' must redirect');
 }
 assert.ok(read('public/market-classic.html').includes('Legacy Market Desk'));
 assert.match(read('public/research.html'),/location\.replace\('\/v9\.html'\+location\.hash\)/);
});
test('phone app manifests and each shortcut target modern pages',()=>{
 const m=JSON.parse(read('public/manifest.webmanifest'));
 assert.equal(m.id,'/','preserve installed PWA identity');
 assert.equal(m.start_url,'/v9.html#overview');
 assert.ok(m.shortcuts.some(x=>x.url==='/v9.html#scanner'));
 assert.ok(m.shortcuts.some(x=>x.url==='/v9.html#signals'));
 assert.ok(m.shortcuts.some(x=>x.url==='/account.html'));
 assert.match(read('public/v9.html'),/rel="manifest" href="\/manifest.webmanifest\?v=31"/);
 assert.match(read('public/v9.html'),/apple-mobile-web-app-capable/);
});
test('modern sidebar routes tools inside V10 without accidental classic navigation',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js');
 for(const label of ['Research AI','Risk planner','Paper journal','Settings'])assert.ok(html.includes(label));
 for(const focus of ['assistantTitle','riskAccount','paperTitle'])
  assert.match(html,new RegExp('data-focus="'+focus+'"'));
 assert.match(html,/data-page="settings"/);
 assert.match(html,/data-section="settings"/);
 assert.doesNotMatch(html,/<a class="nav-link" href="\/research\.html\?classic=1#/);
 assert.doesNotMatch(html,/Open classic workspace/);
 assert.match(js,/function routeFromHash\(\)/);
 assert.match(js,/function setPage\(page,focus=null\)/);
 assert.match(js,/window\.addEventListener\('hashchange',routeFromHash\)/);
});
test('account remains fully functional but looks/links like V10',()=>{
 const html=read('public/account.html'),css=read('public/static/account-v11.css');
 for(const id of ['signIn','signOut','profileForm','historyForm','aiForm','deleteData'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/href="\/v9.html#overview"/);
 assert.match(html,/href="\/v9.html#scanner"/);
 assert.match(html,/href="\/v9.html#signals"/);
 assert.match(css,/\.bar \.nav/);
 assert.match(css,/@media\(max-width:740px\)/);
});
test('old app shells and the phone manifest revalidate on return visits',()=>{
 const headers=read('public/_headers');
 for(const path of ['/','/v9.html','/research','/account.html','/manifest.webmanifest']){
  assert.ok(headers.includes(path+'\n  Cache-Control: no-store, max-age=0'));
 }
});
