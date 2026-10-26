import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('V9 is a new modern application and does not reuse the legacy page styling',()=>{
 const html=file('public/v9.html'),css=file('public/static/v9.css');
 assert.match(html,/Rangeform — Market intelligence/);
 assert.match(html,/public|MARKET INTELLIGENCE/);
 for(const page of ['overview','signals','scanner','news'])assert.match(html,new RegExp('data-section="'+page+'"'));
 assert.match(html,/static\/v9\.css/);
 assert.match(html,/static\/v9\.js/);
 assert.match(css,/\.overview-grid/);
 assert.match(css,/\.signal-grid/);
 assert.match(css,/\.news-layout/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.doesNotMatch(html,/readerRegular|readerLarge|A\/A\+/);
});
test('V9 prices and market setup scores are empty until fetched, never fabricated',()=>{
 const html=file('public/v9.html'),js=file('public/static/v9.js');
 assert.match(html,/Provider required/);
 assert.match(html,/No verified price history loaded/);
 assert.match(html,/No scan results/);
 assert.doesNotMatch(html,/\$138\.72|LIVE FEED CONNECTED|Guaranteed/);
 assert.match(js,/\/api\/status/);
 assert.match(js,/\/api\/analyze/);
 assert.match(js,/\/api\/news/);
 assert.match(js,/state\.configured/);
 assert.doesNotMatch(js,/Math\.random\(/);
 assert.doesNotMatch(js,/ENABLE_TEST_FIXTURES/);
});
test('V9 supports explicit provider caution and does not submit brokerage orders',()=>{
 const js=file('public/static/v9.js');
 assert.match(js,/source:'twelvedata'/);
 assert.match(js,/No authorized market-data feed|No verified market-data feed|not enabled/);
 assert.match(js,/not a calibrated chance|NOT win probabilities|NOT win probabilit/i);
 assert.match(js,/risk>1/);
 assert.doesNotMatch(js,/\/api\/order|\/api\/trade\b/);
});
test('V9 links existing research tools rather than removing them',()=>{
 const html=file('public/v9.html'),legacy=file('public/research.html');
 assert.match(html,/research\.html\?classic=1#risk/);
 assert.match(html,/research\.html\?classic=1#copilot/);
 assert.match(html,/research\.html\?classic=1#journal/);
 assert.match(legacy,/id="page-risk"/);
 assert.match(legacy,/id="page-journal"/);
});
