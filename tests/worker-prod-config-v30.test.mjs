import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Cloudflare Workers Builds production uses durable paper-only config and existing D1',()=>{
 const safe=read('wrangler.bot.toml');
 const prod=read('wrangler.bot.production.toml');
 const worker=read('worker/autonomous-paper-bot.js');
 assert.match(safe,/BOT_SERVICE_ENABLED = "off"/);
 assert.match(prod,/BOT_SERVICE_ENABLED = "on"/);
 assert.match(prod,/keep_vars = true/);
 assert.match(prod,/required = \["BOT_OWNER_UID"\]/);
 for(const required of [
  'name = "rangeform-autonomous-paper-bot"',
  'main = "worker/autonomous-paper-bot.js"',
  'binding = "DB"',
  'database_name = "rangeform-users"',
  'database_id = "6aa50056-4a2d-4ba1-8517-da4de248322f"',
  'crons = ["* * * * *"]',
 ]){
  assert.ok(safe.includes(required)&&prod.includes(required),'Production divergence: '+required);
 }
 assert.doesNotMatch(prod,/^BOT_OWNER_UID\s*=|BROKER_SECRET|API_TOKEN\s*=/m);
 assert.match(worker,/if\(!serviceReady\(env\)\)return/);
 assert.match(worker,/mode:'PAPER_ONLY'/);
 assert.match(worker,/execution:'NO_LIVE_BROKER_ORDERS'/);
 assert.match(worker,/owner_secret_present:Boolean\(env\.BOT_OWNER_UID\)/);
 assert.match(worker,/d1_bound:Boolean\(env\.DB\)/);
 assert.match(worker,/paper_service_enabled:env\.BOT_SERVICE_ENABLED==='on'/);
 assert.doesNotMatch(worker,/placeOrder|submitOrder|sendOrder|broker\.place|executeLive/);
});
