// Research-only regression gates for the PAPER EMA9/21 strategy.
// These do not validate profitability, market data quality, or live execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {signalFromBars, DEFAULTS} from '../functions/_shared/auto-bot.js';
import {assumedFill} from '../public/static/algo-math.mjs';

function barsFromCloses(closes) {
  const start = 1760000000 - (1760000000 % 300);
  return closes.map((close, i) => ({
    time: start + i * 300,
    open: close, high: close * 1.001, low: close * 0.999,
    close, volume: 1
  }));
}

test('EMA paper signal for an observed prefix is unchanged by unseen future candles', () => {
  const history = barsFromCloses([...Array(38).fill(100), ...Array(12).fill(80), ...Array(12).fill(130)]);
  const observed = history.slice(0, 51);
  const before = signalFromBars(observed);
  // Two incompatible future paths must not change the decision at the earlier time.
  const futureUp = [...observed, ...barsFromCloses([300, 350, 400]).map((bar, i) => ({
    ...bar, time: observed.at(-1).time + (i + 1) * 300
  }))];
  const futureDown = [...observed, ...barsFromCloses([30, 20, 10]).map((bar, i) => ({
    ...bar, time: observed.at(-1).time + (i + 1) * 300
  }))];
  assert.deepEqual(signalFromBars(futureUp.slice(0, observed.length)), before);
  assert.deepEqual(signalFromBars(futureDown.slice(0, observed.length)), before);
  assert.equal(before.barTime, observed.at(-1).time);
});

test('EMA paper signal rejects duplicated or out-of-order candle timestamps', () => {
  const good = barsFromCloses(Array(40).fill(100));
  const duplicate = structuredClone(good);
  duplicate[30].time = duplicate[29].time;
  assert.throws(() => signalFromBars(duplicate), /Bad or unsorted candles/);
  const reversed = structuredClone(good);
  reversed[30].time = reversed[29].time - 300;
  assert.throws(() => signalFromBars(reversed), /Bad or unsorted candles/);
});

test('higher execution costs cannot improve a fixed paper round-trip P&L', () => {
  const bid = 99.9, ask = 100, qty = 1;
  const pnl = multiplier => {
    const buy = assumedFill('buy', ask, qty, DEFAULTS.feeBps * multiplier, DEFAULTS.slipBps * multiplier);
    const sell = assumedFill('sell', bid, qty, DEFAULTS.feeBps * multiplier, DEFAULTS.slipBps * multiplier);
    return sell.total - buy.total;
  };
  assert.ok(pnl(1) < 0);
  assert.ok(pnl(2) < pnl(1));
});
