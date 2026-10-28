import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('all separate pages protect the clock and island in iPhone standalone mode',()=>{
 const shared=read('public/static/theme-sync.js');
 const css=read('public/static/ios-statusbar-v22.css');
 assert.match(shared,/navigator\.standalone===true/);
 assert.match(shared,/matchMedia\('\(display-mode: standalone\)'\)/);
 assert.match(shared,/document\.documentElement\.classList\.add\('rangeform-ios-standalone'\)/);
 for(const [page,selector] of [['account.html','.account-rail'],['algo.html','.rail'],['bot.html','.rail']]){
  const html=read('public/'+page);
  assert.match(html,/theme-sync\.js\?v=22/,'installed mode detector must refresh on '+page);
  assert.match(html,/ios-statusbar-v22\.css\?v=22/,'status bar CSS must load on '+page);
  assert.ok(html.indexOf('ios-statusbar-v22.css')<html.indexOf('</head>'));
  assert.ok(css.includes('html.rangeform-ios-standalone '+selector+' {'),'safe drawer selector missing for '+page);
 }
 for(const selector of ['.account-rail','.account-topbar','.rail','.topbar']){
  const block=css.split('html.rangeform-ios-standalone '+selector+' {')[1]?.split('}')[0]||'';
  assert.ok(block.includes('padding-top:max(62px, env(safe-area-inset-top, 0px));'),
    'safe-area floor missing for '+selector);
 }
 assert.match(css,/@media \(max-width:940px\)/);
 assert.doesNotMatch(css,/body\s*\{[^}]*padding-top/,'never offset the entire page under normal Safari');
});
