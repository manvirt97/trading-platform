import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('all canonical pages load same installed-app release checker',()=>{
 const paths=['public/v9.html','public/account.html','public/algo.html','public/bot.html'];
 for(const path of paths){
  const html=read(path);
  assert.match(html,/pwa-update-v32\.js\?v=32/,'missing refresh code on '+path);
  assert.match(html,/viewport-fit=cover/,'must protect installed iPhone safe areas on '+path);
 }
 const checker=read('public/static/pwa-update-v32.js');
 assert.match(checker,/navigator\.standalone===true/);
 assert.match(checker,/document\.addEventListener\('visibilitychange'/);
 assert.match(checker,/window\.addEventListener\('pageshow'/);
 assert.match(checker,/cache:'no-store'/);
 assert.match(checker,/location\.replace\(url\.toString\(\)\)/);
 assert.match(checker,/url\.searchParams\.set\('rf_release',build\)/);
 assert.match(checker,/Number\(match\[1\]\)>CURRENT/);
 assert.match(checker,/return replace\(build\)/);
 assert.match(checker,/sessionStorage\.setItem\('rf_pwa_update_'/);
 assert.match(checker,/document\.addEventListener\('input'/);
 assert.match(checker,/textContent='Update Rangeform'/);
 assert.match(checker,/textContent='Later'/);
 assert.doesNotMatch(checker,/localStorage\.clear|indexedDB\.deleteDatabase|caches\.delete|serviceWorker\.unregister/);
});

test('release metadata is revalidated rather than retaining a stale offline shell',()=>{
 const meta=JSON.parse(read('public/release.json'));
 assert.equal(meta.version,'32');
 assert.equal(meta.build,'rangeform-v32-iphone-shell-overlap-fix');
 const headers=read('public/_headers');
 assert.match(headers,/\/release\.json\n  Cache-Control: no-store, max-age=0/);
 for(const path of ['algo.html','bot.html','account.html','v9.html'])
  assert.match(headers,new RegExp('\\/'+path.replace('.','\\.')+'\\n  Cache-Control: no-store, max-age=0'));
 assert.match(read('public/_redirects'),/\/research \/v9\.html 302/);
});
