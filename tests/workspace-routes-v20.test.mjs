import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const canonical=[
 '/v9.html#overview','/v9.html#daydesk','/algo.html','/bot.html',
 '/v9.html#signals','/v9.html#scanner','/v9.html#news',
 '/v9.html#studio','/v9.html#ai','/v9.html#risk',
 '/v9.html#journal','/v9.html#settings','/account.html'
];

test('Account and both trading desks navigate to the same canonical destinations',()=>{
 const account=read('public/account.html');
 const algo=read('public/algo.html');
 const bot=read('public/bot.html');
 for(const href of canonical){
  for(const [name,page] of [['account',account],['algo',algo],['bot',bot]]){
   assert.ok(page.includes('href="'+href+'"'),name+' missing '+href);
  }
 }
 assert.match(account,/class="account-rail"/);
 assert.match(account,/account-workspace-v20\.css\?v=20/);
 assert.match(account,/class="account-workspace"/);
 assert.doesNotMatch(account,/Back to V10 workspace|RANGEFORM V10/);
});

test('account owner UID is visible after authentication without visiting an obscure bot section',()=>{
 const account=read('public/account.html');
 const js=read('public/static/account.js');
 const bot=read('public/bot.html');
 assert.match(account,/id="ownerSetupHeading"/);
 assert.match(account,/id="accountOwnerUid"/);
 assert.match(account,/id="copyAccountOwnerUid"/);
 assert.match(account,/account\.js\?v=20/);
 assert.match(js,/function syncOwnerUid\(user\)/);
 assert.match(js,/syncOwnerUid\(u\)/);
 assert.match(js,/navigator\.clipboard\.writeText\(activeUser\.uid\)/);
 assert.match(js,/\.account-rail-brand strong/);
 assert.match(bot,/href="\/account\.html#ownerSetupHeading"/);
});

test('main SPA deep-links are mapped to the current single workspace',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js');
 const sections=['overview','daydesk','signals','scanner','news','settings','studio'];
 for(const section of sections)assert.ok(html.includes('data-section="'+section+'"'),'missing section '+section);
 assert.match(js,/journal:\{page:'signals',focus:'paperTitle'\}/);
 assert.match(js,/risk:\{page:'signals',focus:'riskAccount'\}/);
 assert.match(js,/ai:\{page:'overview',focus:'assistantTitle'\}/);
 assert.match(html,/href="\/account\.html"/);
});
