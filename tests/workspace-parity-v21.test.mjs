import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all four Rangeform screens load the SAME last-in-cascade appearance tokens',()=>{
 for(const page of ['public/v9.html','public/account.html','public/algo.html','public/bot.html']){
  const html=read(page);
  assert.match(html,/workspace-palette-v21\.css\?v=21/,'shared palette missing on '+page);
  const lastStyle=html.slice(0,html.indexOf('</head>')).match(/href="\/static\/[^"]+\.css\?v=\d+"/g)||[];
  assert.match(lastStyle.at(-1),/ios-statusbar-v22\.css|workspace-palette-v21\.css/,'safe-area rules must follow base palette on '+page);
 }
 const tokens=read('public/static/workspace-palette-v21.css');
 for(const name of ['--bg','--sidebar','--card','--muted-card','--ink','--secondary','--line','--panel','--edge','--soft']){
  assert.ok(tokens.includes(name+':'),'shared token missing '+name);
 }
 assert.match(tokens,/body\[data-theme="light"\]/);
 assert.match(tokens,/body\[data-theme="dark"\]/);
 assert.match(tokens,/DM\+Sans/,'single font family across screens');
});

test('Account reuses the main workspace sidebar grouping, topbar and heading patterns',()=>{
 const html=read('public/account.html'),css=read('public/static/account-shell-v21.css');
 assert.match(html,/YOUR TOOLS/);
 assert.match(html,/class="account-rail-label account-rail-divider"/);
 assert.match(html,/class="account-top-search"/);
 assert.match(html,/action="\/v9\.html#signals"/);
 assert.match(html,/name="symbol"/);
 assert.match(html,/class="account-version-marker">RANGEFORM · STUDIO/);
 assert.match(css,/grid-template-columns:238px minmax\(0,1fr\)/);
 assert.match(css,/\.account-workspace>\.wrap>\.hero\{display:block;max-width:none;padding:0;margin:0 0 23px;border:0/);
 assert.match(css,/\.account-rail-divider\{border-top:1px solid var\(--line\)/);
 assert.match(css,/\.account-rail-link\{display:flex;align-items:center;gap:12px;width:100%;min-height:45px/);
 assert.match(css,/background:var\(--sidebar\)/);
 assert.match(css,/background:var\(--card\)/);
});

test('mobile Account navigation behaves like main sidebar instead of a different horizontal tab layout',()=>{
 const html=read('public/account.html'),css=read('public/static/account-shell-v21.css'),js=read('public/static/account.js');
 assert.match(html,/id="accountMobileMenu"/);
 assert.match(html,/id="accountRail"/);
 assert.match(html,/id="accountNavShade"/);
 assert.match(html,/viewport-fit=cover/);
 assert.match(css,/@media\(max-width:940px\)/);
 assert.match(css,/\.account-rail\.open\{transform:translateX\(0\)\}/);
 assert.match(css,/\.account-nav-shade:not\(\[hidden\]\)/);
 assert.match(css,/grid-template-areas:"menu brand actions" "search search search"/);
 assert.match(js,/function setupAccountNav\(\)/);
 assert.match(js,/btn\.setAttribute\('aria-expanded',String\(opening\)\)/);
 assert.match(js,/setupSharedTheme\(\);setupAccountNav\(\);syncOwnerUid/);
});

test('Account theme only toggles light/dark and carries to Trade Signals',()=>{
 const js=read('public/static/account.js'),v9=read('public/static/v9.js');
 assert.match(js,/current\(\)==='light'\?'dark':'light'/);
 assert.doesNotMatch(js,/const options=\['dark','light','warm'\]/);
 assert.match(v9,/localStorage\.setItem\('rf_v9_theme',document\.body\.dataset\.theme\)/);
 assert.match(read('public/static/theme-sync.js'),/localStorage\.setItem\('rf_v9_theme',t\)/);
});

test('Account symbol search lands on Trade Signals without inventing quotes or implicit API calls',()=>{
 const html=read('public/account.html'),js=read('public/static/v9.js');
 assert.match(html,/action="\/v9\.html#signals" method="get"/);
 assert.match(js,/const linkedSymbol=new URLSearchParams\(location\.search\)\.get\('symbol'\)/);
 assert.match(js,/if\(linkedSymbol&&symbolOK\(linkedSymbol\)\)/);
 assert.match(js,/\$\('symbolInput'\)\.value=linkedSymbol/);
 const start=js.indexOf('const linkedSymbol=new URLSearchParams');
 const end=js.indexOf('\n}',start);
 const block=js.slice(start,end);
 assert.doesNotMatch(block,/runAnalysis\(|inspect\(|request\(/);
});
