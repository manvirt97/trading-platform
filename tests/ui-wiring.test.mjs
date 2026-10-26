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
  assert.match(html,/href="\/static\/rangeform-official-icon\.png\?v=1"/);
  assert.match(html,/rangeform-official-icon\.png/);
 }
 const manifest=JSON.parse(load('public/manifest.webmanifest'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.scope,'/');
 assert.ok(manifest.icons.some(x=>x.sizes==='96x96'));
 assert.ok(manifest.icons.some(x=>x.type==='image/png'));
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


test('mobile dock is solid, edge-attached and never exposes scrolling content',()=>{
 const html=load('public/research.html'),css=load('public/static/mobile-polish.css'),manifest=JSON.parse(load('public/manifest.webmanifest'));
 assert.match(html,/mobile-polish\.css\?v=2/);
 assert.match(html,/class="mobile-brand-mark"/);
 assert.match(css,/--rf-dock-bar-height:64px/);
 assert.match(css,/height:49px/);
 assert.match(css,/bottom:0/);
 assert.match(css,/left:0/);
 assert.match(css,/right:0/);
 assert.match(css,/background:var\(--surface\)/);
 assert.match(css,/backdrop-filter:none/);
 assert.match(css,/border-radius:0/);
 assert.match(css,/padding-bottom:calc\(var\(--rf-dock-total-height\) \+ 24px\)!important/);
 assert.match(css,/\.app-footer\{display:none!important\}/);
 assert.match(css,/body\.standalone \.mobile-dock/);
 assert.equal(manifest.icons[0].src,'/static/rangeform-official-icon.png');
 for(const path of ['public/market.html','public/account.html'])assert.match(load(path),/rangeform-official-icon\.png/);
});


test('every top-level view shares saved palette before first paint',()=>{
 for(const path of ['public/research.html','public/market.html','public/account.html']){
  const html=load(path);
  assert.match(html,/theme-sync\.js\?v=1/);
  assert.match(html,/theme-sync\.css\?v=2/);
 }
 const theme=load('public/static/theme-sync.js');
 assert.match(theme,/rangeform_theme/);
 assert.match(theme,/dataset\.rfTheme/);
 assert.match(theme,/link\.rel='prefetch'/);
 assert.match(load('public/static/market.js'),/RangeformTheme\?\.apply/);
 assert.match(load('public/static/app.js'),/RangeformTheme\?\.apply/);
});

test('public default is real provider widget coverage, never generated prices',()=>{
 const html=load('public/research.html'),app=load('public/static/app.js'),server=load('functions/_shared/http.js');
 assert.match(html,/<tv-market-overview mode="market-movers"/);
 assert.doesNotMatch(html,/<option value="demo">/);
 assert.match(html,/<option value="none">Not connected<\/option>/);
 assert.match(app,/source:'none'/);
 assert.match(app,/if\(state\.source==='none'\)/);
 assert.match(server,/ENABLE_TEST_FIXTURES==='on'/);
 assert.match(server,/Synthetic example prices are disabled/);
 assert.doesNotMatch(load('public/static/market-shared.css'),/@view-transition\{navigation:auto\}/);
 assert.doesNotMatch(html,/TradingView market desk<\/a>WORKSPACE/);
});
