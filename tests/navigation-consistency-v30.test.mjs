import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Overview is a short launcher, scanner is next, and AI has its own page',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js');
 const overview=html.split('data-section="overview">')[1]?.split('data-section="scanner"')[0]||'';
 const scanner=html.split('data-section="scanner"')[1]?.split('data-section="ai"')[0]||'';
 const ai=html.split('data-section="ai"')[1]?.split('data-section="daydesk"')[0]||'';
 assert.match(overview,/id="overviewScan"/);
 assert.match(overview,/class="overview-launcher"/);
 assert.equal((overview.match(/class="overview-launch(?: overview-launch-featured)?"/g)||[]).length,4);
 assert.match(overview,/id="overviewResults"/);
 assert.match(overview,/id="watchList"/);
 assert.match(overview,/class="overview-snapshot"/);
 assert.doesNotMatch(overview,/class="card assistant-card"|class="card explain-card"|class="card discovery-card"/);
 assert.match(scanner,/id="scannerResults"/);
 assert.match(scanner,/id="discoveryResults"/);
 assert.match(scanner,/id="scannerTabWatchlist"/);
 assert.match(scanner,/id="scannerTabSample"/);
 assert.match(scanner,/id="scannerSample"[^>]+hidden/);
 assert.equal((html.match(/class="card discovery-card"/g)||[]).length,1);
 assert.match(ai,/class="card assistant-card"/);
 assert.match(ai,/id="assistantTitle"/);
 assert.match(js,/\$\('overviewScan'\)\.onclick=\(\)=>setPage\('scanner'\)/);
 assert.doesNotMatch(js,/discoveryScannerHost|discoveryHome/);
});

test('Scanner tabs are stateful, keyboard accessible and never call provider automatically',()=>{
 const js=read('public/static/v9.js'),css=read('public/static/workspace-hub-v31.css');
 assert.match(js,/function setScannerMode\(mode\)/);
 assert.match(js,/button\.setAttribute\('aria-selected',String\(active\)\)/);
 assert.match(js,/if\(watch\)watch\.hidden=next!=='watchlist'/);
 assert.match(js,/if\(sample\)sample\.hidden=next!=='sample'/);
 assert.match(js,/\['ArrowLeft','ArrowRight','Home','End'\]/);
 assert.match(css,/\.scanner-mode-panel\[hidden\]\{display:none!important\}/);
 const start=js.indexOf('function setScannerMode(');
 const end=js.indexOf('function setPage(',start);
 assert.doesNotMatch(js.slice(start,end),/fetch\(|request\(|runAnalysis\(|discoverMarket\(/);
});
test('Browser Back, AI route and breadcrumb remain consistent across pages',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js');
 for(const label of ['workspaceOverview','workspaceLocation'])assert.ok(html.includes('id="'+label+'"'));
 assert.match(js,/history\.pushState\(\{rangeformRoute:token\}/);
 assert.match(js,/window\.addEventListener\('popstate',routeFromHash\)/);
 assert.doesNotMatch(js,/history\.replaceState/);
 assert.match(js,/ai:\{page:'ai'\}/);
 assert.match(js,/const validPages=\['overview','scanner','ai'/);
 for(const route of ["'risk'","'journal'","'backtest'"])assert.ok(js.includes('return '+route));
 assert.match(js,/document\.scrollingElement\?\.scrollTo\(\{top:0,behavior:'instant'\}\)/);
 assert.match(js,/\$\('workspaceOverview'\)\?\.addEventListener\('click',\(\)=>setPage\('overview'\)\)/);
});
test('Focused V31 style is last, mobile-friendly and does not override topbar',()=>{
 const html=read('public/v9.html'),css=read('public/static/workspace-hub-v31.css');
 assert.match(html,/workspace-hub-v31\.css\?v=31/);
 assert.match(css,/\.overview-launcher/);
 assert.match(css,/\.scanner-mode-tabs/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.doesNotMatch(css,/\.topbar\s*\{|\.mobile-menu\s*\{/);
});
