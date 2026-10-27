import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Ten pictured research disciplines are accessible from the main Rangeform sidebar',()=>{
 const html=read('public/v9.html'),code=read('public/static/v9.js');
 assert.match(html,/data-page="studio"/);
 assert.match(html,/data-section="studio"/);
 for(const name of ['Stock screener','DCF valuation','Portfolio risk','Earnings','Portfolio blueprint','Chart breakdown','Dividends','Competitive edge','Historical patterns','Macro impact'])assert.match(html,new RegExp(name));
 assert.match(code,/studio:'Research Studio'/);
 assert.match(code,/\['overview','signals','scanner','news','settings','studio'\]/);
 assert.match(html,/research-studio\.js\?v=1/);
});
test('Premium design is last-loaded, respects small screens, and uses restrained graphite and stone colours',()=>{
 const html=read('public/v9.html'),css=read('public/static/v13-premium.css');
 assert.ok(html.indexOf('v13-premium.css?v=1')>html.indexOf('v12-settings-news.css?v=1'));
 for(const term of ['.studio-layout','.studio-nav','.studio-work','.studio-form-grid','body[data-theme=dark]','@media(max-width:640px)'])assert.ok(css.includes(term),term);
 assert.match(css,/--sidebar:#17232f/);
 assert.doesNotMatch(css,/#0ff|#f0f|neon|fluorescen/i);
});
test('All quantitative research tools use explicit inputs or verified completed bars, never fabricated fundamentals',()=>{
 const code=read('public/static/research-studio.js'),math=read('public/static/research-math.mjs');
 assert.match(code,/\/api\/market-discovery/);
 assert.match(code,/\/api\/analyze/);
 assert.match(code,/unavailable until reliable fundamental data is licensed/i);
 assert.match(code,/portfolio prices and orders are separate|broker quotes and orders are separate/i);
 assert.match(code,/No current economic release/i);
 assert.match(code,/not an executable broker quote/i);
 assert.match(math,/Pure functions: no APIs, random prices/);
 assert.doesNotMatch(code,/Math\.random\(/);
 assert.doesNotMatch(code,/api\.openai\.com|api\.anthropic\.com/);
});
test('Research tools include prominent data provenance and are not executable broker orders',()=>{
 const code=read('public/static/research-studio.js');
 assert.match(code,/t\.source/);
 assert.match(code,/user-provided EPS figures|user-entered price/i);
 assert.match(code,/No sample prices or financial results are prefilled/);
 assert.doesNotMatch(code,/\/api\/orders|\/api\/buy|\/api\/sell/);
 assert.match(read('public/v9.html'),/No broker orders or return guarantees/);
});
