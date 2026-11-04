/* Rangeform CSO release policy: fail build if core AI isolation is removed.
 * Narrow, explicit static checks. Not a SAST substitute or deployment guarantee.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=read('functions/api/openai-council.js');
const cso=read('functions/api/cso-status.js');
const gates=read('functions/_shared/cso-security.js');
const model=read('functions/_shared/openai-council.js');
const ui=read('public/static/openai-council.js');
const html=read('public/agent-team.html');
const headers=read('public/_headers');
const migration=read('migrations/0002_openai_council_audit.sql');
for(const source of [api,cso]){
  assert.match(source,/userId\(request,env\)/,'Owner authentication removed');
  assert.match(source,/BOT_OWNER_UID/,'Owner authorization check removed');
  assert.match(source,/uid\s*!==\s*env\.BOT_OWNER_UID/,'Owner authorization guard removed');
}
assert.match(api,/Origin/,'POST origin guard missing');
assert.match(api,/quota\(env\.DB/,'AI quota gate missing');
assert.match(api,/record\(env\.DB/,'Usage audit record missing');
assert.match(model,/store:false/,'Model persistence must stay disabled');
assert.match(model,/response\.ok/,'Model API errors must fail closed');
assert.match(gates,/live_orders_enabled:false/,'CSO must never grant live orders');
assert.match(gates,/trading_approved:false/,'CSO cannot approve trading');
assert.match(model,/execution:'NO_ORDER'/,'The hard trading policy must block orders');
assert.match(ui,/getIdToken\(\)/,'Client must use short-lived verified ID token');
assert.match(ui,/\.textContent=/,'Untrusted AI text must be inserted as text');
assert.match(ui,/confirm\(/,'Paid investigation must require click confirmation');
assert.match(html,/OPENAI INTELLIGENCE \/ OPTIONAL PAID API/);
assert.match(headers,/Content-Security-Policy:/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS rangeform_ai_council_audit/);
assert.doesNotMatch(api,/private\/AddOrder|placeOrder\(|submitOrder\(|\/api\/orders/);
assert.doesNotMatch(model,/private\/AddOrder|placeOrder\(|submitOrder\(/);
assert.doesNotMatch(ui,/innerHTML\s*=|eval\(/);
assert.doesNotMatch(html,/sk-proj-|sk-[a-zA-Z0-9]{20}/);
console.log('PASS: CSO release policy — owner auth, quota, audit, secret isolation and no order routing');
