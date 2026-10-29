import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pages=['v9.html','algo.html','bot.html','account.html'];

test('all active Rangeform surfaces load one EquityClimb-inspired design layer last',()=>{
 const css=read('public/static/rangeform-design-v26.css');
 for(const page of pages){
  const html=read('public/'+page);
  const head=html.slice(0,html.indexOf('</head>'));
  assert.match(head,/rangeform-design-v26\.css\?v=29/,'shared design missing: '+page);
  const cssLinks=[...head.matchAll(/href="(\/static\/[^"]+\.css\?v=[^"]+)"/g)].map(x=>x[1]);
  assert.match(cssLinks.at(-1),/rangeform-design-v26\.css\?v=29/,'design must override older page CSS: '+page);
  assert.match(head,/manifest\.webmanifest\?v=29/,'missing common installed-app identity: '+page);
  assert.match(head,/pwa-update-v29\.js\?v=29/,'stale release marker: '+page);
  assert.match(html,/name="theme-color" content="#f3f4f2"/);
 }
 assert.match(css,/--bg:#f3f4f2/);
 assert.match(css,/--bg:#0e1116/);
 assert.match(css,/--rf-highlight:#9c7a3c/);
 assert.match(css,/--rf-highlight:#c9ab6c/);
 assert.match(css,/--sidebar:#f7f7f4/);
 assert.match(css,/--card:#fff/);
 assert.match(css,/font-family:Inter/);
});

test('Algorithmic and Autonomous have same grouped navigation and header as main',()=>{
 const main=read('public/v9.html');
 assert.match(main,/YOUR TOOLS/);
 for(const name of ['algo.html','bot.html']){
  const s=read('public/'+name);
  assert.match(s,/class="nav-tag rf-tools-label">YOUR TOOLS/);
  assert.match(s,/id="rfMobileMenu"/);
  assert.match(s,/id="rfRail"/);
  assert.match(s,/id="rfNavShade"/);
  assert.match(s,/class="topbar rf-topbar"/);
  assert.match(s,/class="rf-top-search"/);
  assert.match(s,/action="\/v9\.html#signals"/);
  assert.match(s,/name="symbol"/);
  assert.match(s,/class="rf-top-actions"/);
  assert.match(s,/RANGEFORM · STUDIO/);
  assert.match(s,/workspace-shell-v26\.js\?v=26/);
  for(const route of ['/v9.html#overview','/v9.html#daydesk','/algo.html','/bot.html','/v9.html#signals','/v9.html#scanner','/v9.html#news','/v9.html#studio','/v9.html#ai','/v9.html#risk','/v9.html#journal','/v9.html#settings','/account.html']){
   assert.ok(s.includes('href="'+route+'"'),name+' missing '+route);
  }
 }
});

test('two themes share one saved preference and never use legacy warm styling',()=>{
 const theme=read('public/static/theme-sync.js');
 const algo=read('public/static/algo.js'),bot=read('public/static/auto-bot.js');
 const main=read('public/static/v9.js');
 assert.match(theme,/const choices=\['dark','light'\]/);
 assert.doesNotMatch(theme,/choices=\['dark','light','warm'\]/);
 assert.match(theme,/localStorage\.setItem\('rf_v9_theme',t\)/);
 assert.match(main,/localStorage\.setItem\('rangeform_theme'/);
 for(const js of [algo,bot]){
  assert.match(js,/\['light','dark'\]\.includes\(theme\)/);
  assert.doesNotMatch(js,/\['light','dark','warm'\]\.includes\(theme\)/);
 }
});

test('mobile desks have actual closable slideout navigation and existing iPhone protection',()=>{
 const script=read('public/static/workspace-shell-v26.js');
 const css=read('public/static/rangeform-design-v26.css');
 assert.match(script,/aria-expanded/);
 assert.match(script,/shade\.addEventListener\('click',close\)/);
 assert.match(script,/Escape/);
 assert.match(css,/\.rail\.rf-open\{transform:translateX\(0\)\}/);
 assert.match(css,/\.rf-nav-shade\[hidden\]/);
 assert.match(css,/rangeform-ios-standalone body \.rail/);
 assert.match(css,/max\(62px,env\(safe-area-inset-top,0px\)\)/);
});

test('published release marks installed apps as V29',()=>{
 const release=JSON.parse(read('public/release.json'));
 const pwa=read('public/static/pwa-update-v29.js');
 assert.equal(release.version,'29');
 assert.equal(release.build,'rangeform-v29-mobile-drawer-scroll');
 assert.match(pwa,/const CURRENT=29,/);
});
