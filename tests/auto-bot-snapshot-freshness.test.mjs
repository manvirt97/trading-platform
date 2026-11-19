import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectMarket, advanceBot, initialBot} from '../functions/_shared/auto-bot.js';

// Valid synthetic completed candles and a consistent top-of-book snapshot.
const barEnd = 1760000000 - (1760000000 % 300);
const bars = Array.from({length: 40}, (_, i) => ({
  time: barEnd + (i - 39) * 300,
  open: 100, high: 100.1, low: 99.9, close: 100, volume: 1
}));
const now = barEnd * 1000 + 310000;
const market = () => ({
  pair: 'XBTUSD',
  fetchedAt: now - 1000,
  bars,
  book: {
    best_bid: 99.9, best_ask: 100,
    bids: [[99.9, 10]], asks: [[100, 10]]
  }
});

test('completed paper market snapshot accepts a fresh finite millisecond timestamp', () => {
  assert.equal(inspectMarket(market(), now).barTime, barEnd);
});

test('paper market rejects missing, non-finite and invalid snapshot timestamps', () => {
  const invalid = [undefined, null, NaN, Infinity, -Infinity, 'not-a-time', 0, -1, now - 20001, now + 3001];
  for (const fetchedAt of invalid) {
    const snapshot = market();
    if (fetchedAt === undefined) delete snapshot.fetchedAt;
    else snapshot.fetchedAt = fetchedAt;
    assert.throws(() => inspectMarket(snapshot, now), /snapshot is stale or missing timestamp/, String(fetchedAt));
  }
});

test('invalid snapshot timestamp prevents a paper trade and records NO_DATA', () => {
  const snapshot = market();
  delete snapshot.fetchedAt;
  const state = initialBot();
  state.enabled = true;
  const result = advanceBot(state, snapshot, now);
  assert.equal(result.trade, null);
  assert.equal(result.state.lastSignal, 'NO_DATA');
  assert.match(result.reason, /missing timestamp/);
  assert.equal(result.state.position, null);
});
