import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Algorithmic and Autonomous desks now share the current Rangeform mobile header',()=>{
 const css=read('public/static/rangeform-design-v26.css');
 const js=read('public/static/workspace-shell-v26.js');
 assert.match(css,/grid-template-areas:"menu brand actions" "search search search"/);
 assert.match(css,/\.workspace>\.topbar/);
 assert.match(css,/\.rf-top-actions/);
 assert.match(css,/\.rf-top-search\{grid-area:search/);
 assert.match(css,/\.rail\.rf-open\{transform:translateX\(0\)\}/);
 assert.match(css,/rangeform-ios-standalone/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/max\(62px,env\(safe-area-inset-top,0px\)\)/);
 assert.match(js,/shade\.addEventListener\('click',close\)/);
 assert.match(js,/aria-expanded/);
 for(const file of ['public/algo.html','public/bot.html']){
  const html=read(file);
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/<header class="topbar rf-topbar">/);
  assert.match(html,/id="rfMobileMenu"/);
  assert.match(html,/class="rf-top-actions"/);
  assert.match(html,/id="theme"/);
  assert.match(html,/class="rf-top-search"/);
  assert.match(html,/id="rfNavShade"/);
  assert.match(html,/rangeform-design-v26\.css\?v=27/);
 }
 assert.match(read('public/algo.html'),/id="feedPill"/);
 assert.match(read('public/bot.html'),/id="botBadge"/);
});
