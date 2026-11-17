// Fail-closed five-minute candle continuity checks for PAPER research only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {signalFromBars, inspectMarket} from '../functions/_shared/auto-bot.js';
import {publicMarket} from '../functions/_shared/auto-bot-feed.js';

const start = 1760000000 - (1760000000 % 300);
function bars() {
  return Array.from({length: 40}, (_, i) => ({
    time: start + i * 300,
    open: 100, high: 101, low: 99, close: 100, volume: 1
  }));
}

test('paper EMA accepts complete, aligned five-minute history', () => {
  const result = signalFromBars(bars());
  assert.equal(result.barTime, start + 39 * 300);
  assert.equal(result.signal, 'HOLD');
});

test('paper EMA rejects missing intervals even when timestamps are sorted', () => {
  const history = bars();
  // Simulate one missing 5-minute bar in an otherwise valid sequence.
  for (let i = 20; i < history.length; i++) history[i].time += 300;
  assert.throws(() => signalFromBars(history), /Incomplete five-minute candles/);
});

test('paper EMA rejects a candle timestamp outside five-minute boundaries', () => {
  const history = bars();
  history.forEach(bar => { bar.time += 60; });
  assert.throws(() => signalFromBars(history), /Incomplete five-minute candles/);
});

test('fresh book cannot authorize paper research from gapped candles', () => {
  const history = bars();
  for (let i = 20; i < history.length; i++) history[i].time += 300;
  const now = history.at(-1).time * 1000 + 310000;
  const snapshot = {
    fetchedAt: now, bars: history,
    book: {best_bid: 99.9, best_ask: 100, bids: [[99.9, 20]], asks: [[100, 20]]}
  };
  assert.throws(() => inspectMarket(snapshot, now), /Incomplete five-minute candles/);
});

test('Kraken OHLC gaps cannot pass through to the paper signal', async () => {
  const candles = Array.from({length: 42}, (_, i) => [
    start + (i >= 20 ? i + 1 : i) * 300,
    '100', '101', '99', '100', '100', '10', '5'
  ]);
  const fetchImpl = async url => new Response(JSON.stringify({
    error: [],
    result: url.includes('Depth')
      ? {XXBTZUSD: {bids: [['99.9', '20', '0']], asks: [['100', '20', '0']]}}
      : {XXBTZUSD: candles, last: 0}
  }));
  const snapshot = await publicMarket('XBTUSD', (start + 42 * 300) * 1000, fetchImpl);
  assert.throws(() => signalFromBars(snapshot.bars), /Incomplete five-minute candles/);
});
