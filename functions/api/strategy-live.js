// Kraken live data adapter: public read-only market observation, NO orders.
// Kraken OHLC API last row is not committed. We always drop that row.
// We use completed candles only to match the EMA decision core in backtests.
import { emaDecisionAt, emaChartSeries } from '../_shared/strategy-builder.js';
import { validateBars } from '../_shared/core.js';
import { json } from '../_shared/http.js';

const PAIRS = Object.freeze({ XBTUSD: 'BTC / USD', ETHUSD: 'ETH / USD' });
const INTERVALS = Object.freeze({ '1min': 1, '5min': 5, '15min': 15, '1day': 1440 });
const ERROR_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const unavailable = (error, code = 'LIVE_FEED_UNAVAILABLE', status = 503) =>
  json({ error, code, monitoring: false, broker_orders: false, data_available: false }, status);

export function normalizeKrakenCandles(payload, pair, interval, now = Date.now()) {
  if (!payload || !Array.isArray(payload.error) || payload.error.length ||
      !payload.result || typeof payload.result !== 'object')
    throw Error('Kraken returned an invalid or rejected market-data response.');
  const marketKey = Object.keys(payload.result).find(key => key !== 'last');
  const rows = payload.result[marketKey];
  if (!Array.isArray(rows) || rows.length < 40 || rows.length > 750)
    throw Error('Kraken returned insufficient valid OHLC market history.');
  const closedRows = rows.slice(0, -1);
  const bars = closedRows.map((row, index) => {
    if (!Array.isArray(row) || row.length < 7) throw Error('Malformed OHLC row ' + index);
    const start = Number(row[0]);
    if (!Number.isSafeInteger(start) || start <= 0 || start * 1000 > now)
      throw Error('Invalid Kraken OHLC timestamp.');
    const [open, high, low, close, volume] = [row[1], row[2], row[3], row[4], row[6]].map(Number);
    if (![open, high, low, close, volume].every(Number.isFinite))
      throw Error('Invalid Kraken OHLC market price.');
    return { timestamp: new Date(start * 1000).toISOString(), open, high, low, close, volume };
  });
  // validateBars enforces chronology, positive prices and high/low consistency.
  const validated = validateBars(bars);
  const milliseconds = INTERVALS[interval] * 60_000;
  // Some providers may return an "ongoing" bar as second last; fail closed.
  if (Date.parse(validated.at(-1).timestamp) + milliseconds > now + 1500)
    throw Error('Latest Kraken OHLC candle is not complete yet.');
  const dataAgeMs = now - (Date.parse(validated.at(-1).timestamp) + milliseconds);
  if (dataAgeMs > Math.max(3 * milliseconds, 15 * 60_000))
    throw Error('Kraken completed candles are stale; live monitoring is paused.');
  return { bars: validated, data_age_seconds: Math.max(0, Math.round(dataAgeMs / 1000)) };
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const pair = url.searchParams.get('pair') || 'XBTUSD';
  const interval = url.searchParams.get('interval') || '5min';
  const fast = Number(url.searchParams.get('fast') || 9);
  const slow = Number(url.searchParams.get('slow') || 21);
  if (!Object.hasOwn(PAIRS, pair) || !Object.hasOwn(INTERVALS, interval))
    return unavailable('Select a supported public Kraken market and interval.', 'INVALID_PAIR_OR_INTERVAL', 400);
  if (!Number.isInteger(fast) || !Number.isInteger(slow) || fast < 2 || slow > 150 || fast >= slow)
    return unavailable('EMA lengths must be whole numbers with 2 <= fast < slow <= 150.', 'INVALID_EMA', 400);
  try {
    const response = await fetch('https://api.kraken.com/0/public/OHLC?' +
      new URLSearchParams({ pair, interval: String(INTERVALS[interval]) }), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(8500),
        cf: { cacheEverything: true, cacheTtl: 30 }
      });
    if (!response.ok) throw Error('Kraken history request failed (HTTP ' + response.status + ').');
    const data = await response.json();
    const capturedAt = Date.now();
    const { bars, data_age_seconds } = normalizeKrakenCandles(data, pair, interval, capturedAt);
    if (bars.length < slow + 15)
      throw Error('Not enough completed historical candles for the selected slow EMA.');
    const spec = { kind: 'ema-cross-long-only', fast, slow, interval, timezone: 'UTC' };
    const decision = emaDecisionAt(bars, spec, bars.length);
    return json({
      pair, name: PAIRS[pair], interval, fast, slow,
      source: 'Kraken public REST OHLC',
      provenance: 'Exchange public completed OHLCV bars only; not an executable quote',
      fetched_at: new Date(capturedAt).toISOString(),
      last_completed_bar_utc: bars.at(-1).timestamp,
      last_close: bars.at(-1).close, data_age_seconds,
      indicator: decision,
      bars_available: bars.length,
      chart: emaChartSeries(bars, spec, 150),
      monitoring: true, market_type: 'crypto_spot',
      order_mode: 'READ_ONLY_OBSERVATION',
      simulated_fill_only: true, broker_orders: false,
      warnings: [
        'The Live switch does not authorize or send orders to any broker.',
        'Kraken public candles update on polling and are not continuous exchange quotes.',
        'The latest unfinished Kraken candle is excluded to prevent lookahead.',
        'This market trades 24/7; Indian/US stock-market session times do not apply.',
        'A completed-candle crossover is research context, not a guarantee or recommendation.'
      ]
    });
  } catch (error) {
    return unavailable('Verified Kraken candles unavailable: ' +
      String(error?.message || 'unknown upstream error').slice(0,170));
  }
}
