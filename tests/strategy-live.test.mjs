import test from 'node:test';
import assert from 'node:assert/strict';
import { emaDecisionAt } from '../functions/_shared/strategy-builder.js';
import { normalizeKrakenCandles, onRequestGet } from '../functions/api/strategy-live.js';
import { readFileSync } from 'node:fs';

function krakenPayload(now = Date.now(), count = 120, interval = 5) {
  const minute = 60 * 1000;
  const step = interval * minute;
  const first = Math.floor((now - (count + 1) * step) / 1000);
  const rows = Array.from({ length: count }, (_, i) => {
    const close = i < 45 ? 100 : i < 80 ? 100 + (i - 45) * 0.8 : 128 - (i - 80) * 0.4;
    const open = close - 0.25;
    return [first + i * interval * 60, String(open), String(close + 1),
      String(open - 1), String(close), String(close), String(0.8 + i / 300), String(10)];
  });
  // Last entry is deliberately uncommitted, and must never enter EMA calculations.
  rows.push([Math.floor(now / 1000), '1000000', '1000000', '999999', '999999', '1000000', '1', '5']);
  return { error: [], result: { XXBTZUSD: rows, last: '1720000000' } };
}
const request = (query = '') => new Request('https://rangeform.example/api/strategy-live' + query);
test('Kraken parser drops final unfinished candle, checks provenance and chronology', () => {
  const now = Date.now();
  const normalized = normalizeKrakenCandles(krakenPayload(now), 'XBTUSD', '5min', now);
  assert.equal(normalized.bars.length, 120);
  assert.ok(normalized.bars.every(bar => bar.close < 200));
  assert.ok(normalized.data_age_seconds >= 0);
  const bars = normalized.bars;
  const spec = { fast: 9, slow: 21 };
  const decision = emaDecisionAt(bars, spec, bars.length);
  assert.equal(decision.signal_bar_utc, bars.at(-1).timestamp);
  assert.equal(decision.entry_policy.includes('Next candle opening'), true);
});
test('Kraken parser denies no history, crossed candles, duplicate timestamps and error responses', () => {
  assert.throws(() => normalizeKrakenCandles({ error: ['EGeneral'] }, 'XBTUSD', '5min'), /invalid/);
  const bad = krakenPayload();
  bad.result.XXBTZUSD[30][2] = '1'; // high < open or close
  assert.throws(() => normalizeKrakenCandles(bad, 'XBTUSD', '5min'), /Invalid OHLCV/);
  const duplicate = krakenPayload();
  duplicate.result.XXBTZUSD[50][0] = duplicate.result.XXBTZUSD[49][0];
  assert.throws(() => normalizeKrakenCandles(duplicate, 'XBTUSD', '5min'), /unordered|duplicated/);
});
test('Kraken public live endpoint returns read-only actual mock data with no option or order claim', async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /api\.kraken\.com\/0\/public\/OHLC/);
    return new Response(JSON.stringify(krakenPayload()), { status: 200 });
  };
  try {
    const response = await onRequestGet({ request: request('?pair=XBTUSD&interval=5min&fast=9&slow=21') });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.monitoring, true);
    assert.equal(data.broker_orders, false);
    assert.equal(data.order_mode, 'READ_ONLY_OBSERVATION');
    assert.equal(data.source, 'Kraken public REST OHLC');
    assert.ok(data.indicator.fast_ema > 0);
    assert.equal(data.chart.length, 120);
    assert.equal(data.bars_available, 120);
    assert.ok(Date.parse(data.last_completed_bar_utc) <= Date.now());
  } finally { globalThis.fetch = before; }
});
test('ineligible live requests fail closed before contacting provider', async () => {
  let called = false;
  const before = globalThis.fetch;
  globalThis.fetch = async () => { called = true; throw Error('unexpected network call'); };
  try {
    for (const q of ['?pair=INVALID&interval=5min', '?pair=XBTUSD&interval=30min',
      '?pair=XBTUSD&interval=5min&fast=21&slow=9']) {
      const response = await onRequestGet({ request: request(q) });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).broker_orders, false);
    }
    assert.equal(called, false);
  } finally { globalThis.fetch = before; }
});
test('Kraken upstream outage never fabricates a live price', async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('offline'); };
  try {
    const response = await onRequestGet({ request: request() });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.data_available, false);
    assert.equal(body.monitoring, false);
    assert.equal(body.broker_orders, false);
    assert.equal(body.last_close, undefined);
  } finally { globalThis.fetch = before; }
});
test('centered Backtest/Live UI visibly distinguishes broker trading from market monitoring', () => {
  const html = readFileSync(new URL('../public/strategy-builder.html', import.meta.url), 'utf8');
  const liveJs = readFileSync(new URL('../public/static/strategy-live.js', import.meta.url), 'utf8');
  assert.match(html, /id="sbBacktestTab"/);
  assert.match(html, /id="sbLiveTab"/);
  assert.match(html, /id="sbLivePane"/);
  assert.match(html, /Broker order permissions/);
  assert.match(html, /Disabled/);
  assert.match(html, /sb-live-dot/);
  assert.match(liveJs, /role/);
  assert.match(liveJs, /visibilitychange/);
  assert.doesNotMatch(liveJs, /private\/AddOrder|\/api\/orders|submitOrder|placeOrder/);
});
