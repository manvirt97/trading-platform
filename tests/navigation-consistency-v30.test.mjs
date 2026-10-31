import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Explore opportunities opens a dedicated top-of-page scanner, never moves a shared card',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js');
 const overview=html.split('data-section="overview">')[1]?.split('data-section="daydesk"')[0]||'';
 const scanner=html.split('data-section="scanner"')[1]?.split('data-section="news"')[0]||'';
 assert.match(overview,/id="overviewScan">Open Opportunity Scanner/);
 assert.doesNotMatch(overview,/class="card discovery-card"/);
 assert.match(scanner,/class="card discovery-card"/);
 assert.equal((html.match(/class="card discovery-card"/g)||[]).length,1);
 assert.ok(scanner.indexOf('Opportunity scanner</h1>')<scanner.indexOf('class="card discovery-card"'));
 assert.match(js,/\$\('overviewScan'\)\.onclick=\(\)=>setPage\('scanner'\)/);
 assert.doesNotMatch(js,/discoveryScannerHost|discoveryHome/);
});
test('sidebar, breadcrumb, browser Back and focused tools share canonical history',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js');
 for(const label of ['workspaceOverview','workspaceLocation'])assert.ok(html.includes('id="'+label+'"'));
 assert.match(js,/history\.pushState\(\{rangeformRoute:token\}/);
 assert.match(js,/window\.addEventListener\('popstate',routeFromHash\)/);
 assert.doesNotMatch(js,/history\.replaceState/);
 for(const route of ["'ai'","'risk'","'journal'","'backtest'"])assert.ok(js.includes('return '+route));
 assert.match(js,/document\.scrollingElement\?\.scrollTo\(\{top:0,behavior:'instant'\}\)/);
 assert.match(js,/\$\('workspaceOverview'\)\?\.addEventListener\('click',\(\)=>setPage\('overview'\)\)/);
});
test('V30 navigation styling follows shared system and keeps iPhone header untouched',()=>{
 const html=read('public/v9.html'),css=read('public/static/workspace-navigation-v30.css');
 assert.match(html,/workspace-navigation-v30\.css\?v=30/);
 assert.match(css,/\.workspace-crumbs/);
 assert.match(css,/\.workspace-crumb-back\[hidden\]/);
 assert.match(css,/body\[data-theme="dark"\]/);
 assert.doesNotMatch(css,/\.topbar\s*\{|\.mobile-menu\s*\{/);
});
