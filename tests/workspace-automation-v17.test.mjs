import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialBot} from '../functions/_shared/auto-bot.js';
import {runPaperTick} from '../functions/_shared/auto-bot-service.js';
import {onRequestGet as botApiGet} from '../functions/api/auto-bot.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function mockDb(start){
 let state=structuredClone(start),revision=0;
 return {
  get state(){return state},
  prepare(sql){
   const query=sql.trim();
   let bound=[];
   return {
    bind(...args){bound=args;return this},
    async run(){
     if(query.startsWith('UPDATE')){if(bound[1]!==revision)return {meta:{changes:0}};state=JSON.parse(bound[0]);revision++;return {meta:{changes:1}}}
     return {meta:{changes:1}};
    },
    async first(){return {revision,payload:JSON.stringify(state)}}
   };
  }
 };
}
test('one actual Worker-triggered paper tick records a distinct scheduler timestamp even if market feed fails',async()=>{
 const bot=initialBot();bot.enabled=true;
 const db=mockDb(bot),env={DB:db,BOT_OWNER_UID:'owner',BOT_SERVICE_ENABLED:'on'};
 const t=Date.parse('2026-10-27T21:51:00Z');
 const r=await runPaperTick(env,{source:'cron',now:t,fetchImpl:async()=>{throw Error('simulated feed offline')}});
 assert.equal(r.status,'FEED_UNAVAILABLE');assert.equal(db.state.mode,'PAPER_ONLY');
 assert.equal(db.state.lastCronTickAt,new Date(t).toISOString());
 assert.equal(db.state.lastSignal,'NO_DATA');
 assert.equal(db.state.position,null);
 const r2=await runPaperTick(env,{source:'manual',now:t+60000,fetchImpl:async()=>{throw Error('simulated feed offline')}});
 assert.equal(r2.status,'FEED_UNAVAILABLE');
 assert.equal(db.state.lastCronTickAt,new Date(t).toISOString(),'manual tick must never spoof scheduler availability');
});
test('bot stays disabled without owner, D1 and explicit service flag',async()=>{
 const res=await botApiGet({env:{},request:new Request('https://rangeform.pages.dev/api/auto-bot')});
 assert.equal(res.status,503);assert.equal((await res.json()).code,'NOT_CONFIGURED');
});
test('all main workspace destinations exist in both Algorithmic and Bot sidebars',()=>{
 const html=read('public/v9.html'),algo=read('public/algo.html'),bot=read('public/bot.html');
 const common=[
  '/v9.html#overview','/v9.html#daydesk','/algo.html','/bot.html',
  '/v9.html#signals','/v9.html#scanner','/v9.html#news',
  '/v9.html#studio','/v9.html#ai','/v9.html#risk','/v9.html#journal',
  '/v9.html#settings','/account.html'];
 for(const route of common){
  assert.ok(algo.includes('href="'+route+'"'),route+' missing from Algorithmic sidebar');
  assert.ok(bot.includes('href="'+route+'"'),route+' missing from Bot sidebar');
 }
 assert.match(html,//bot\.html/);
 assert.match(algo,/BROKER TRADING NOT CONNECTED/);
 assert.match(bot,/PAPER TRADING · REAL ORDERS OFF/);
 assert.match(algo,/Manual paper buys and sells work with a fresh/);
});
test('theme preference syncs dashboard to separate desks across light/dark modes',()=>{
 const v9=read('public/static/v9.js'),shared=read('public/static/theme-sync.js'),css=read('public/static/workspace-unified-v17.css');
 assert.match(v9,/localStorage\.setItem\('rangeform_theme',document\.body\.dataset\.theme\)/);
 assert.match(shared,/localStorage\.getItem\('rf_v9_theme'\)/);
 assert.match(shared,/localStorage\.setItem\('rf_v9_theme',t\)/);
 assert.match(css,/body\[data-theme="light"\]/);
 assert.match(css,/body\[data-theme="dark"\]/);
 assert.match(css,/\.rail\{display:flex;flex-direction:column;position:relative/);
 assert.match(read('public/bot.html'),/workspace-unified-v17\.css/);
 assert.match(read('public/algo.html'),/workspace-unified-v17\.css/);
});
test('background heartbeat only originates from scheduled Worker and never enables brokerage calls',()=>{
 const worker=read('worker/autonomous-paper-bot.js'),service=read('functions/_shared/auto-bot-service.js'),api=read('functions/api/auto-bot.js'),bot=read('public/static/auto-bot.js');
 assert.match(worker,/runPaperTick\(env,\{source:'cron'\}\)/);
 assert.match(service,/if\(source==='cron'\)next\.state\.lastCronTickAt/);
 assert.match(api,/background_scheduler:recentCron\?'RECENT_CRON_TICK':'NOT_VERIFIED'/);
 assert.match(bot,/background_scheduler==='RECENT_CRON_TICK'/);
 assert.match(bot,/NOT VERIFIED/);
 assert.doesNotMatch(worker,/private\/AddOrder|api\/v2\/add_order|submitOrder\(/);
 assert.match(read('wrangler.bot.toml'),/BOT_SERVICE_ENABLED = "off"/);
});
