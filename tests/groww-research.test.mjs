import test from 'node:test';
import assert from 'node:assert/strict';
import { growwResearchRequest, onRequestGet, onRequestPost } from '../functions/api/groww-research.js';
import { readFileSync } from 'node:fs';
test('Groww historical API url builder is a strict read-only fixed-domain allowlist', () => {
  const a = growwResearchRequest({
    action: 'candles', exchange: 'NSE', underlying: 'NIFTY', segment: 'FNO',
    groww_symbol: 'NSE-NIFTY-30Sep25-24650-CE',
    candle_interval: '5minute',
    start_time: '2025-09-24 09:15:00', end_time: '2025-09-25 15:30:00'
  });
  assert.match(a.url, /^https:\/\/api\.groww\.in\/v1\/historical\/candles\?/);
  assert.match(a.url, /segment=FNO/);
  assert.doesNotMatch(a.url, /order|place|token/i);
  const b = growwResearchRequest({ action: 'expiries', exchange: 'NSE', underlying: 'NIFTY', year: 2025, month: 2 });
  assert.match(b.url, /historical\/expiries/);
  const c = growwResearchRequest({ action: 'contracts', exchange: 'NSE', underlying: 'NIFTY', expiry_date: '2025-01-25' });
  assert.match(c.url, /historical\/contracts/);
});
test('Groww builder rejects injection, arbitrary domains, live order actions and excessive ranges', () => {
  const safe = {
    action: 'candles', exchange: 'NSE', underlying: 'NIFTY', segment: 'CASH',
    groww_symbol: 'NSE-NIFTY', candle_interval: '1minute',
    start_time: '2025-09-01 09:15:00', end_time: '2025-09-20 15:30:00'
  };
  assert.throws(() => growwResearchRequest({ ...safe, action: 'order/create' }), /approved/);
  assert.throws(() => growwResearchRequest({ ...safe, groww_symbol: 'NSE-NIFTY%0A' }), /symbol/);
  assert.throws(() => growwResearchRequest({ ...safe, end_time: '2025-12-30 15:30:00' }), /history range/);
  assert.throws(() => growwResearchRequest({ ...safe, segment: 'FNO' }), /FNO contract/);
  assert.throws(() => growwResearchRequest({ ...safe, exchange: 'BTC' }), /exchange/);
});
test('configuration status never returns server API token or broker order permission', async () => {
  const secret = 'SENTINEL_DO_NOT_EXPOSE';
  const response = await onRequestGet({ env: { GROWW_RESEARCH_ENABLED: 'on', GROWW_ACCESS_TOKEN: secret, BOT_OWNER_UID: 'abc' } });
  const body = await response.text();
  assert.doesNotMatch(body, new RegExp(secret));
  const data = JSON.parse(body);
  assert.equal(data.available, false);
  assert.equal(data.broker_orders, false);
});
test('unauthenticated Groww POST fails closed and cannot call provider even with API token configured', async () => {
  const before = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw Error('untrusted external request'); };
  try {
    const response = await onRequestPost({
      request: new Request('https://rangeform.example/api/groww-research', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'expiries', year: 2025, month: 1 })
      }),
      env: { GROWW_RESEARCH_ENABLED: 'on', GROWW_ACCESS_TOKEN: 'SECRET',
        FIREBASE_PROJECT_ID: 'rangeform-test', BOT_OWNER_UID: 'abc' }
    });
    assert.equal(response.status, 401);
    assert.equal(called, false);
  } finally { globalThis.fetch = before; }
});
test('read-only integration source contains no brokerage execution endpoints or leaked tokens', () => {
  const file = readFileSync(new URL('../functions/api/groww-research.js', import.meta.url), 'utf8');
  assert.doesNotMatch(file, /\/v1\/order\/create|private\/AddOrder/);
  assert.match(file, /uid !== env\.BOT_OWNER_UID/);
  assert.match(file, /GROWW_ACCESS_TOKEN/);
  assert.match(file, /ai_allowance/);
});
