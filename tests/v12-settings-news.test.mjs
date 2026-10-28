import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Settings is a first-class sidebar page, not a link to the signal data panel',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js');
 assert.match(html,/data-page="settings"[^>]*>\s*<span class="nav-icon">⚙<\/span> Settings/);
 assert.match(html,/<section class="page settings-page" data-section="settings"/);
 for(const id of ['settingsTheme','settingsNewsDensity','settingsNewsCategory','settingsProviderState','settingsProviderDescription','settingsCheckProvider'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/\['overview','daydesk','signals','scanner','news','settings','studio'\]/);
 assert.match(js,/settings:'Settings'/);
 assert.match(js,/page==='settings'/);
 assert.doesNotMatch(js,/settings:\{page:'signals',focus:'connectionDetails'\}/);
});
test('News headlines link directly to publishers with compact, expandable source details',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js'),css=read('public/static/v12-settings-news.css');
 assert.match(js,/const original=create\('a','story-original','Read article ↗'\)/);
 assert.match(js,/create\('button','story-context-toggle','Source & timing'\)/);
 assert.match(js,/details\.setAttribute\('aria-expanded','false'\)/);
 assert.match(js,/info\.hidden=true/);
 assert.match(js,/titleLink\.href=item\.url/);
 assert.match(js,/titleLink\.target='_blank'/);
 assert.match(js,/info\.append\(originalInline\)/);
 assert.doesNotMatch(js,/create\('button','cell-btn','Details'\)/);
 assert.match(css,/\.news-card \.story-actions/);
 assert.match(css,/\.story-context-panel\[hidden\]/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(html,/id="articleContextTitle"/);
});
test('Local visual and news preferences are actually bound, persisted and restored',()=>{
 const js=read('public/static/v9.js'),html=read('public/v9.html');
 assert.match(js,/function initWorkspacePrefs/);
 assert.match(js,/localStorage\.getItem\(key\)/);
 assert.match(js,/localStorage\.setItem\(key,value\)/);
 assert.match(js,/rf_news_density/);
 assert.match(js,/rf_news_category/);
 assert.match(js,/\$\$\('\[data-category\]'\)/);
 assert.match(js,/\$\('settingsTheme'\)\.onchange/);
 assert.match(js,/\$\('settingsNewsDensity'\)\.onchange/);
 assert.match(js,/\$\('settingsNewsCategory'\)\.onchange/);
 assert.match(js,/initTheme\(\);initWorkspacePrefs\(\)/);
 assert.match(html,/v12-settings-news\.css\?v=1/);
 assert.match(html,/v9\.js\?v=(?:14|21)/);
});
test('Settings never asks users to paste market data API keys into browser storage',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js');
 assert.match(html,/Never enter secret market-data keys into this page/);
 assert.match(html,/Connection status does not verify streaming quotes/);
 assert.match(html,/href="\/account\.html"/);
 assert.match(js,/syncProviderSettings/);
 assert.match(js,/loadProvider\(\)/);
 assert.doesNotMatch(html,/input[^>]*(?:api.key|secret|password)/i);
});
