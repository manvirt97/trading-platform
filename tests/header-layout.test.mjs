import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('classic header loads final responsive stylesheet after all other visual CSS',()=>{
 const html=read('public/research.html');
 const nav=html.indexOf('<nav class="global-nav"');
 assert.ok(nav>0,'navigation exists');
 assert.ok(html.indexOf('class="command-trigger"')>nav,'search button remains present');
 assert.ok(html.indexOf('id="dataPill"')>nav,'source indicator remains present');
 const topbar=html.indexOf('data-header-layout="grid-v10"');
 assert.ok(topbar>0);
 const clarity=html.indexOf('clarity-v8.css?v=1');
 const repair=html.indexOf('topbar-v10.css?v=1');
 assert.ok(repair>clarity,'repair rules loaded last');
});
test('header does not absolutely overlay navigation over search',()=>{
 const old=read('public/static/experience.css');
 const fix=read('public/static/topbar-v10.css');
 assert.doesNotMatch(old,/\.topbar \.global-nav\{position:absolute/);
 assert.match(fix,/\.topbar > \.global-nav\s*\{[\s\S]*?position:\s*static\s*!important/);
 assert.match(fix,/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
 assert.match(fix,/\.topbar > \.top-actions > \.command-trigger\s*\{[\s\S]*?min-width:\s*170px/);
});
test('laptop and mobile layouts have reserved navigation and search rows',()=>{
 const css=read('public/static/topbar-v10.css');
 assert.match(css,/@media \(min-width: 701px\) and \(max-width: 1640px\)/);
 assert.match(css,/grid-template-rows:\s*45px 45px/);
 assert.match(css,/grid-column:\s*1 \/ -1/);
 assert.match(css,/@media \(max-width: 700px\)/);
 assert.match(css,/grid-template-rows:\s*44px 42px/);
 assert.match(css,/@media \(max-width: 365px\)/);
 assert.match(css,/\.topbar > \.top-actions > \.demo-pill\s*\{\s*display:\s*none/);
});
