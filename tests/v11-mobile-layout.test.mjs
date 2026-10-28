import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Mobile V11 loads last, retains desktop CSS and introduces an accessible mobile brand',()=>{
 const html=text('public/v9.html'),css=text('public/static/v11-mobile.css');
 assert.match(html,/mobile-header-brand/);
 assert.match(html,/Rangeform overview/);
 assert.match(html,/v11-mobile\.css\?v=1/);
 assert.ok(html.indexOf('v11-mobile.css?v=1')>html.indexOf('v9.css?v=8'));
 assert.match(css,/\.mobile-header-brand\s*\{\s*display:none/);
 assert.match(css,/@media \(max-width:940px\)/);
 assert.match(css,/@media \(max-width:640px\)/);
 assert.match(css,/@media \(max-width:360px\)/);
});
test('iOS standalone header reserves status bar and leaves search in its own row',()=>{
 const css=text('public/static/v11-mobile.css'),js=text('public/static/v9.js');
 assert.match(css,/grid-template-areas:"menu brand actions" "search search search"/);
 assert.match(css,/\.topbar \.top-search\s*\{\s*grid-area:search/);
 assert.match(css,/padding-top:max\(56px, env\(safe-area-inset-top, 0px\)\)/);
 assert.match(css,/display-mode:standalone/);
 assert.match(js,/navigator\.standalone===true/);
 assert.match(js,/rangeform-ios-standalone/);
 assert.match(css,/#globalSearch\s*\{[\s\S]*?font-size:16px/);
 assert.match(css,/max-width:none/);
});
test('mobile header contains no bulky time/version status and provider retains accessible name',()=>{
 const css=text('public/static/v11-mobile.css'),html=text('public/v9.html');
 assert.match(css,/\.topbar \.version-marker,\.topbar \.market-time,\.topbar \.user-circle/);
 assert.match(css,/\.topbar \.provider-pill #feedLabel\s*\{[\s\S]*?clip-path:inset\(50%\)/);
 assert.match(html,/id="feedLabel"/);
 assert.match(html,/id="mobileMenu"/);
 assert.match(html,/id="themeToggle"/);
});
test('mobile sample scanner and watchlist results become compact full-width cards without hiding actions',()=>{
 const css=text('public/static/v11-mobile.css');
 for(const id of ['discoveryResults','scannerResults'])assert.match(css,new RegExp('#'+id));
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto/);
 assert.match(css,/#discoveryResults td:nth-child\(6\)/);
 assert.match(css,/#scannerResults td:nth-child\(6\)/);
 assert.match(css,/\.discovery-card \.scanner-table thead,[\s\S]*?clip-path:inset\(50%\)/);
 assert.doesNotMatch(css,/\.discovery-card \.scanner-table thead[^}]*display:none/);
 assert.match(css,/scroll-margin-top:135px/);
});
test('dark theme synchronizes browser status bar without leaking private market data',()=>{
 const js=text('public/static/v9.js');
 assert.match(js,/document\.querySelector\('meta\[name="theme-color"\]'\)/);
 assert.match(js,/dataset\.theme==='dark'\?'#0e1116':'#f3f4f2'/);
 assert.doesNotMatch(text('public/static/v11-mobile.css'),/TWELVEDATA_API_KEY|apiKey\s*=/);
});
