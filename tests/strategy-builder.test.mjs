import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseStrategy, runStrategyBacktest } from '../functions/_shared/strategy-builder.js';
import { onRequestPost, onRequestGet } from '../functions/api/strategy-builder.js';

const prose = 'Test a 9/21 EMA crossover on 15-minute candles. Go long when 9 EMA crosses above 21 EMA and square off by 15:00.';
function dailyBars() {
  return Array.from({ length: 105 }, (_, i) => {
    const close = i < 35 ? 100 : i < 60 ? 100 + (i - 35) * 0.8 : i < 85 ? 120 - (i - 60) * 1.1 : 92.5 + (i - 85) * 0.7;
    const open = i === 0 ? 100 : i < 36 ? 100 : i < 60 ? close - 0.25 : i < 85 ? close + 0.25 : close - 0.25;
    return { timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, close, volume: 10000 };
  });
}
function post(payload, env = {}) {
  return onRequestPost({
    request: new Request('https://rangeform.example/api/strategy-builder', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    }),
    env
  });
}
test('plain-English parser recognizes the video EMA strategy and names all assumptions', () => {
  const s = parseStrategy(prose);
  assert.equal(s.fast, 9);
  assert.equal(s.slow, 21);
  assert.equal(s.interval, '15min');
  assert.equal(s.timezone, 'America/New_York');
  assert.equal(s.square_off, '15:00');
  assert.equal(s.kind, 'ema-cross-long-only');
  assert.ok(s.assumptions.some(x => /not equivalent/i.test(x)));
  const nifty = parseStrategy('NIFTY 9/21 EMA crossover on 5-minute candles, long-only.');
  assert.equal(nifty.timezone, 'Asia/Kolkata');
  assert.equal(nifty.interval, '5min');
  assert.equal(parseStrategy('9 EMA crosses above the 21 EMA on 5-minute candles').slow, 21);
});
test('parser rejects unsupported trading and unsafe ambiguity instead of quietly inventing rules', () => {
  assert.throws(() => parseStrategy('NIFTY 9/21 EMA buy and sell options strategy'), /Options need/);
  assert.throws(() => parseStrategy('9/21 EMA use short selling on 15-minute bars'), /long-only/);
  assert.throws(() => parseStrategy('Build me a strategy from news'), /Only EMA/);
  assert.throws(() => parseStrategy('9/21 EMA with RSI confirmation on 15-minute candles'), /not supported/);
  assert.throws(() => parseStrategy('21/9 EMA crossover on 15-minute candles'), /fast/);
  assert.throws(() => parseStrategy('9/21 EMA crossover on 30-minute candles'), /30-minute/);
});
test('test uses completed signals, next candle entries, and includes trading cost drag', () => {
  const spec = parseStrategy('9/21 EMA crossover on daily candles, buy after upward crossing.');
  const bars = dailyBars();
  const free = runStrategyBacktest(bars, spec, { fee_bps_per_side: 0, slippage_bps_per_side: 0 });
  const costly = runStrategyBacktest(bars, spec, { fee_bps_per_side: 10, slippage_bps_per_side: 10 });
  assert.ok(free.trades >= 1, 'fixture must generate crosses');
  assert.equal(costly.trades, free.trades);
  assert.ok(costly.net_pnl < free.net_pnl);
  assert.ok(costly.fee_slippage_drag > 0);
  assert.equal(costly.broker_orders, false);
  const firstIndex = bars.findIndex(x => x.timestamp === costly.trade_log[0].entry_time);
  assert.ok(firstIndex >= spec.slow + 1);
  assert.ok(costly.trade_log.every(t => Date.parse(t.entry_time) < Date.parse(t.exit_time)));
  assert.ok(costly.equity_curve.length > 0);
});
test('no lookahead: increasing a following candle open changes the entry, not the signal timing', () => {
  const spec = parseStrategy('9/21 EMA crossover on daily candles');
  const bars = dailyBars();
  const original = runStrategyBacktest(bars, spec, { fee_bps_per_side: 0, slippage_bps_per_side: 0 });
  const index = bars.findIndex(x => x.timestamp === original.trade_log[0].entry_time);
  const changed = bars.map(b => ({ ...b }));
  changed[index].open *= 1.05;
  changed[index].high = Math.max(changed[index].high, changed[index].open + 1);
  const next = runStrategyBacktest(changed, spec, { fee_bps_per_side: 0, slippage_bps_per_side: 0 });
  assert.equal(next.trade_log[0].entry_time, original.trade_log[0].entry_time);
  assert.ok(next.trade_log[0].entry > original.trade_log[0].entry);
});
test('backtester rejects invalid prices, insufficient history, invalid risk and altered session times', () => {
  const bars = dailyBars(), spec = parseStrategy('9/21 EMA crossover on daily candles');
  assert.throws(() => runStrategyBacktest(bars.slice(0, 25), spec), /36/);
  assert.throws(() => runStrategyBacktest(bars, spec, { capital: 0 }), /Starting cash/);
  assert.throws(() => runStrategyBacktest(bars, { ...spec, entry_after: '16:00' }), /Entry time/);
  assert.throws(() => runStrategyBacktest(bars, { ...spec, timezone: 'Bad/Timezone' }), /Invalid/);
});
test('POST parse is free, deterministic and explicitly not AI-executable', async () => {
  const response = await post({ action: 'parse', description: prose });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.spec.fast, 9);
  assert.equal(body.ai_model_used, false);
  assert.equal(body.broker_orders, false);
});
test('POST imported historical OHLCV makes real computations but never places trades', async () => {
  const response = await post({
    action: 'backtest', description: '9/21 EMA crossover on daily candles',
    source: 'csv', symbol: 'AAPL', currency: 'CAD', bars: dailyBars()
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, 'user-csv');
  assert.equal(body.currency, 'CAD');
  assert.equal(body.bars_tested, 105);
  assert.equal(body.executions_enabled, false);
  assert.equal(body.ai_model_used, false);
  assert.ok(body.trades > 0);
});
test('no data invention: rejected demo source, invalid CSV and unavailable paid feed', async () => {
  const fake = await post({ action: 'backtest', description: prose, source: 'demo', symbol: 'SPY' });
  assert.equal(fake.status, 400);
  assert.equal((await fake.json()).code, 'INVALID_SOURCE');
  const csv = await post({ action: 'backtest', description: prose, source: 'csv', symbol: 'SPY', bars: [] });
  assert.equal(csv.status, 400);
  const feed = await post({ action: 'backtest', description: prose, source: 'twelvedata', symbol: 'SPY' });
  assert.equal(feed.status, 503);
  const detail = await feed.text();
  assert.doesNotMatch(detail, /"close":\d/);
  const discovery = await onRequestGet();
  assert.equal((await discovery.json()).executions_enabled, false);
});
test('frontend includes labelled source provenance, CSV and limitations without an order control', () => {
  const html = readFileSync(new URL('../public/strategy-builder.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/static/strategy-builder.js', import.meta.url), 'utf8');
  assert.match(html, /sbDescription/);
  assert.match(html, /sbFile/);
  assert.match(html, /SIMULATION ONLY/);
  assert.match(html, /strategy-builder\.js/);
  assert.match(js, /sbProvenance/);
  assert.match(js, /trade_log/);
  assert.doesNotMatch(html, /Place live order|Execute real trade/i);
});
