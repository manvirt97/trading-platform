import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pages=['v9','algo','bot','agent-team','account','forecast-ledger','strategy-builder'];
test('seven live workspaces all use ONE premium CSS and navigation script, loaded last',()=>{
 for(const page of pages){
  const html=read('public/'+page+'.html');
  const head=html.split('</head>')[0];
  const styles=[...head.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(styles.at(-1),'/static/rangeform-premium-v38.css?v=38',page);
  assert.match(head,/rangeform-premium-v38\.js\?v=38/,page);
  assert.match(html,/<body data-rf-ui="v38"/,page);
  assert.match(head,/pwa-update-v38\.js\?v=38/,page);
  assert.match(head,/manifest.webmanifest\?v=38/,page);
 }
});
test('PWA update preserves existing install identity and homepage and adds no forced cache clear',()=>{
 const m=JSON.parse(read('public/manifest.webmanifest'));
 assert.equal(m.id,'/');assert.equal(m.scope,'/');
 assert.equal(m.start_url,'/v9.html#overview');
 const marker=JSON.parse(read('public/release.json'));
 assert.equal(marker.version,'38');
 assert.match(read('public/static/pwa-update-v38.js'),/const CURRENT=38,/);
 assert.doesNotMatch(read('public/static/pwa-update-v38.js'),/caches\.delete|localStorage\.clear|location\.reload\(\)/);
});
test('shared layout retains original pages and connects all core tools without duplicate IDs',()=>{
 const js=read('public/static/rangeform-premium-v38.js');
 const dest=['/v9.html#overview','/v9.html#scanner','/v9.html#daydesk',
  '/strategy-builder.html','/algo.html','/bot.html','/agent-team.html','/forecast-ledger.html','/account.html'];
 for(const route of dest)assert.ok(js.includes(route),route);
 assert.match(js,/aria-current/);
 assert.match(js,/hashchange/);
 assert.match(js,/popstate/);
 assert.doesNotMatch(js,/\.innerHTML\s*=|placeOrder|executeTrade|\/api\/orders|private\/AddOrder/);
 const v9=read('public/v9.html');
 assert.match(v9,/id="overviewScan"/);
 assert.match(v9,/href="\/strategy-builder.html"/);
 const agent=read('public/agent-team.html');
 assert.match(agent,/id="teamForm"/);
 assert.match(agent,/id="openaiCouncilTitle"/);
 const bot=read('public/bot.html');
 assert.match(bot,/id="rfRail"/);
 const strategy=read('public/strategy-builder.html');
 assert.match(strategy,/id="sbLiveTab"/);
 assert.match(strategy,/id="rfTradeList"/);
});
test('premium visual layer uses shared screenshot-style controls, dark mode and responsive navigation',()=>{
 const css=read('public/static/rangeform-premium-v38.css');
 for(const term of ['--rf38-canvas','--rf38-surface','--rf38-primary','--rf38-border',
  '.rf-suite-bar','.rf-suite-link','.rf-toolbar','.rf-kpis','.rf-comparisons',
  '.rf-trade-row','@media(max-width:600px)','html[data-rf-theme="dark"]'])assert.ok(css.includes(term),term);
 assert.match(css,/focus-visible/);
 assert.match(css,/overflow-x:auto/);
 assert.doesNotMatch(css,/\bdisplay:none!important\b/);
});
test('Forecast Ledger now uses the same PWA, theme preference and workspace navigation',()=>{
 const ledger=read('public/forecast-ledger.html');
 assert.match(ledger,/theme-sync\.js\?v=22/);
 assert.match(ledger,/theme-sync\.css\?v=2/);
 assert.match(ledger,/rangeform-premium-v38/);
 assert.match(ledger,/id="prediction"/);
 assert.match(ledger,/id="export"/);
});
