// Rangeform Strategy Builder v1 — deterministic, non-executing EMA research.
// All entries use a signal from a COMPLETED previous candle; orders fill no earlier
// than the following open. This is not an options-pricing or broker-fill model.
import { validateBars } from './core.js';

const ROUND = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const ALLOWED = new Set(['1min', '5min', '15min', '1day']);
const MINUTES = { '1min': 1, '5min': 5, '15min': 15, '1day': 1440 };

export function parseStrategy(description) {
  if (typeof description !== 'string' || description.trim().length < 12 || description.length > 1000)
    throw Error('Describe your strategy in 12–1,000 characters.');
  const text = description.trim();
  if (/\b(options?|puts?|calls?)\s*(?:buying|selling|trading|strategy|contracts?)\b|\b(?:sell|write|short)\s+(?:options?|puts?|calls?)\b/i.test(text))
    throw Error('Options need historical option-chain premiums, expiries and contract costs. This first version tests the underlying asset only, not option buying/selling.');
  if (/\b(?:short\s+selling|short\s+(?:stocks?|the\s+market)|leverage|margin|futures?|martingale)\b/i.test(text))
    throw Error('This research engine supports long-only, unleveraged underlying positions. Short or leveraged strategies are not implemented.');
  if (/\b(?:RSI|MACD|Bollinger|stochastic|VWAP|stop[- ]loss|take[- ]profit|ATR|trailing\s+stop)\b/i.test(text))
    throw Error('Combined indicator and stop rules are not supported yet. This version evaluates an EMA crossover only.');
  let m = text.match(/\b(\d{1,3})\s*(?:\/|vs\.?|and|-)\s*(\d{1,3})\s*(?:-|\s)*(?:period\s*)?(?:EMA|exponential\s+moving\s+average)s?\b/i);
  if (!m) m = text.match(/\bEMA\s*(\d{1,3})\s*(?:\/|vs\.?|and|-)\s*(?:EMA\s*)?(\d{1,3})\b/i);
  if (!m) m = text.match(/\b(\d{1,3})\s*EMA\s+(?:crosses|cross|crossing|moves)\s+(?:above|over|below|under)\s+(?:the\s+)?(\d{1,3})\s*EMA\b/i);
  if (!m) throw Error('Only EMA crossover strategies are implemented. Example: "9/21 EMA crossover on 15-minute candles".');
  const fast = Number(m[1]), slow = Number(m[2]);
  if (!Number.isInteger(fast) || !Number.isInteger(slow) || fast < 2 || slow > 150 || fast >= slow)
    throw Error('EMA settings must be whole numbers, fast >= 2, slow <= 150 and fast < slow.');
  if (/\b30\s*[- ]?\s*(?:m|min|minute)/i.test(text))
    throw Error('30-minute historical candles are not supported yet. Use 1-, 5-, or 15-minute bars.');
  const tf = text.match(/\b(1|5|15)\s*[- ]?\s*(?:m|min|minute)s?\b/i);
  const daily = /\b(?:daily|1\s*[- ]?day)\b/i.test(text);
  const interval = daily ? '1day' : tf ? tf[1] + 'min' : '15min';
  const india = /\b(?:NIFTY|BANKNIFTY|SENSEX|INDIA|IST)\b/i.test(text);
  const zone = india ? 'Asia/Kolkata' : 'America/New_York';
  return {
    kind: 'ema-cross-long-only', fast, slow, interval,
    timezone: zone, entry_after: '09:30', square_off: '15:00',
    initial_capital: 10000, allocation_pct: 95,
    fee_bps_per_side: 5, slippage_bps_per_side: 5,
    rules: [
      'Cross up: fast EMA was at/below slow EMA, then closes above it.',
      'Buy the underlying at the NEXT completed signal bar opening; never on the signal bar.',
      'Sell at the next open after a down crossover, or at the intraday session cutoff.',
      'Only one unleveraged long position at a time. No broker orders.'
    ],
    assumptions: [
      'Time zone inferred from NIFTY/India wording; otherwise America/New_York.',
      '9:30 entry and 15:00 session exit are defaults from the video example.',
      'If omitted, 15-minute timeframe is assumed; check your original description.',
      'Intraday timestamps must represent BAR OPEN, with explicit UTC offset.',
      'Underlying OHLCV is not equivalent to historical option premium returns.'
    ]
  };
}

const clockFormatters = new Map();
function localClock(timestamp, timeZone) {
  if (!clockFormatters.has(timeZone)) clockFormatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }));
  const parts = Object.fromEntries(clockFormatters.get(timeZone).formatToParts(new Date(timestamp)).map(p => [p.type, p.value]));
  return { day: parts.year + '-' + parts.month + '-' + parts.day, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
function minuteOf(hhmm) {
  if (typeof hhmm !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm))
    throw Error('Session time must be HH:MM in 24-hour format.');
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function emas(bars, period) {
  const result = Array(bars.length).fill(null);
  if (bars.length < period) return result;
  let average = 0;
  for (let i = 0; i < period; i++) average += bars[i].close;
  average /= period;
  result[period - 1] = average;
  const alpha = 2 / (period + 1);
  for (let i = period; i < bars.length; i++) {
    average = bars[i].close * alpha + average * (1 - alpha);
    result[i] = average;
  }
  return result;
}
// Shared EMA decision core for historic and read-only live observations.
// When currentIndex === bars.length, the last completed bar is the signal bar
// and any future entry would need an independently observed next bar open.
export function emaDecisionAt(bars, spec, currentIndex, fastSeries = null, slowSeries = null) {
  const fast = fastSeries || emas(bars, spec.fast);
  const slow = slowSeries || emas(bars, spec.slow);
  const valid = currentIndex >= spec.slow + 1 &&
    [fast[currentIndex - 2], slow[currentIndex - 2], fast[currentIndex - 1], slow[currentIndex - 1]].every(Number.isFinite);
  const crossUp = valid && fast[currentIndex - 2] <= slow[currentIndex - 2] &&
    fast[currentIndex - 1] > slow[currentIndex - 1];
  const crossDown = valid && fast[currentIndex - 2] >= slow[currentIndex - 2] &&
    fast[currentIndex - 1] < slow[currentIndex - 1];
  return {
    crossUp: Boolean(crossUp), crossDown: Boolean(crossDown),
    signal: crossUp ? 'CROSS_UP' : crossDown ? 'CROSS_DOWN' : 'NONE',
    trend: valid ? fast[currentIndex - 1] > slow[currentIndex - 1] ? 'ABOVE' : 'BELOW' : 'UNAVAILABLE',
    signal_bar_utc: valid ? bars[currentIndex - 1].timestamp : null,
    fast_ema: valid ? ROUND(fast[currentIndex - 1], 5) : null,
    slow_ema: valid ? ROUND(slow[currentIndex - 1], 5) : null,
    entry_policy: 'Next candle opening only; current closed candle is not a fill'
  };
}
export function emaChartSeries(bars, spec, maxBars = 200) {
  const f = emas(bars, spec.fast), s = emas(bars, spec.slow);
  const start = Math.max(0, bars.length - maxBars);
  return bars.slice(start).map((bar, index) => {
    const i = index + start;
    return { time: bar.timestamp, open: ROUND(bar.open, 5),
      high: ROUND(bar.high, 5), low: ROUND(bar.low, 5),
      close: ROUND(bar.close, 5), fast: ROUND(f[i], 5), slow: ROUND(s[i], 5) };
  });
}
function finiteNumber(name, value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw Error(name + ' must be between ' + min + ' and ' + max + '.');
  return n;
}
export function runStrategyBacktest(inputBars, rawSpec, settings = {}) {
  const bars = validateBars(inputBars);
  const spec = { ...rawSpec };
  if (spec?.kind !== 'ema-cross-long-only' || !Number.isInteger(spec.fast) || !Number.isInteger(spec.slow) ||
      spec.fast < 2 || spec.slow > 150 || spec.fast >= spec.slow || !ALLOWED.has(spec.interval) ||
      !['America/New_York', 'Asia/Kolkata'].includes(spec.timezone))
    throw Error('Invalid or unsupported strategy configuration.');
  if (bars.length < Math.max(36, spec.slow + 15)) throw Error('Not enough history to warm up both EMAs and test subsequent signals.');
  if (bars.some(b => b.open === undefined)) throw Error('Backtesting requires OHLCV bars (not close-only prices).');
  const capital = finiteNumber('Starting cash', settings.capital ?? spec.initial_capital, 100, 1_000_000);
  const allocation = finiteNumber('Allocation %', settings.allocation_pct ?? spec.allocation_pct, 1, 100) / 100;
  const fees = finiteNumber('Fee bps per side', settings.fee_bps_per_side ?? spec.fee_bps_per_side, 0, 250) / 10000;
  const slip = finiteNumber('Slippage bps per side', settings.slippage_bps_per_side ?? spec.slippage_bps_per_side, 0, 250) / 10000;
  const entryTime = minuteOf(spec.entry_after), exitTime = minuteOf(spec.square_off);
  if (entryTime >= exitTime) throw Error('Entry time must be earlier than the square-off time.');
  const isDaily = spec.interval === '1day';
  const stepMinutes = MINUTES[spec.interval];
  const fastEMA = emas(bars, spec.fast), slowEMA = emas(bars, spec.slow);
  const clocks = isDaily ? [] : bars.map(bar => localClock(bar.timestamp, spec.timezone));
  const trades = [], curve = [];
  const holdoutBar = Math.floor(bars.length * 0.8);
  let cash = capital, position = null, equityHigh = capital, worstDrawdown = 0, forcedMissingCutoff = 0;
  const buy = (index, barPrice) => {
    const costPerShare = barPrice * (1 + slip) * (1 + fees);
    const quantity = cash * allocation / costPerShare;
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const paid = quantity * costPerShare;
    position = { index, timestamp: bars[index].timestamp, quantity, entry_mark: barPrice, entry_all_in: costPerShare, cash_paid: paid };
    cash -= paid;
  };
  const sell = (index, barPrice, reason) => {
    if (!position) return;
    const proceeds = position.quantity * barPrice * (1 - slip) * (1 - fees);
    const gross = position.quantity * (barPrice - position.entry_mark);
    const net = proceeds - position.cash_paid;
    cash += proceeds;
    trades.push({
      entry_time: position.timestamp, exit_time: bars[index].timestamp, side: 'LONG',
      quantity: ROUND(position.quantity, 6), entry: ROUND(position.entry_mark, 5),
      exit: ROUND(barPrice, 5), gross_pnl: ROUND(gross), net_pnl: ROUND(net),
      return_pct: ROUND(100 * net / position.cash_paid, 3),
      phase: position.index >= holdoutBar ? 'holdout' : 'development', exit_reason: reason
    });
    position = null;
  };
  const equityMark = (index) => {
    const equity = cash + (position ? position.quantity * bars[index].close * (1 - slip) * (1 - fees) : 0);
    equityHigh = Math.max(equityHigh, equity);
    worstDrawdown = Math.min(worstDrawdown, equity / equityHigh - 1);
    curve.push({ time: bars[index].timestamp, equity: ROUND(equity) });
  };
  for (let i = 1; i < bars.length; i++) {
    if (!isDaily && position && clocks[i].day !== clocks[i - 1].day) {
      // Missing end-of-day candle: forced liquidation at LAST observed prior close,
      // not an invented quote. Mark this as a data-quality warning.
      sell(i - 1, bars[i - 1].close, 'last_available_prior_close');
      forcedMissingCutoff++;
    }
    const { crossUp, crossDown } = emaDecisionAt(bars, spec, i, fastEMA, slowEMA);
    const minute = isDaily ? null : clocks[i].minute;
    const entryAllowed = isDaily || (minute >= entryTime && minute + stepMinutes < exitTime);
    if (position && crossDown) sell(i, bars[i].open, 'ema_cross_down_next_open');
    if (!position && crossUp && entryAllowed) buy(i, bars[i].open);
    if (!isDaily && position) {
      const lastEligible = minute < exitTime && minute + stepMinutes >= exitTime;
      const noNextBarToday = i === bars.length - 1 || clocks[i + 1].day !== clocks[i].day;
      if (lastEligible) sell(i, bars[i].close, 'scheduled_session_square_off');
      else if (noNextBarToday) {
        sell(i, bars[i].close, 'last_available_session_close');
        forcedMissingCutoff++;
      }
    }
    equityMark(i);
  }
  if (position) {
    sell(bars.length - 1, bars.at(-1).close, 'end_of_available_history');
    curve[curve.length - 1].equity = ROUND(cash);
  }
  const wins = trades.filter(t => t.net_pnl > 0);
  const losses = trades.filter(t => t.net_pnl < 0);
  const winSum = wins.reduce((sum, t) => sum + t.net_pnl, 0);
  const lossSum = losses.reduce((sum, t) => sum + t.net_pnl, 0);
  const netTotal = trades.reduce((sum, t) => sum + t.net_pnl, 0);
  const grossTotal = trades.reduce((sum, t) => sum + t.gross_pnl, 0);
  const summarize = subset => ({
    trades: subset.length,
    net_pnl: ROUND(subset.reduce((sum, t) => sum + t.net_pnl, 0)),
    win_rate_pct: subset.length ? ROUND(100 * subset.filter(t => t.net_pnl > 0).length / subset.length, 2) : null
  });
  return {
    spec, bars_tested: bars.length, first_bar: bars[0].timestamp, last_bar: bars.at(-1).timestamp,
    trades: trades.length, gross_pnl: ROUND(grossTotal), net_pnl: ROUND(netTotal), fee_slippage_drag: ROUND(grossTotal - netTotal),
    total_return_pct: ROUND(100 * (cash / capital - 1), 3),
    win_rate_pct: trades.length ? ROUND(100 * wins.length / trades.length, 2) : null,
    net_expectancy_per_trade: trades.length ? ROUND(netTotal / trades.length) : null,
    profit_factor: lossSum < 0 ? ROUND(winSum / -lossSum, 3) : null,
    max_mark_to_market_drawdown_pct: ROUND(100 * worstDrawdown, 2),
    development: summarize(trades.filter(t => t.phase === 'development')),
    holdout: summarize(trades.filter(t => t.phase === 'holdout')),
    equity_curve: curve.filter((_, index) => index % Math.max(1, Math.floor(curve.length / 280)) === 0 || index === curve.length - 1),
    price_chart: emaChartSeries(bars, spec, 200),
    trade_log: trades,
    warning_flags: forcedMissingCutoff ? ['History lacks an expected cutoff candle on ' + forcedMissingCutoff + ' session(s); liquidation used last observed close.'] : [],
    limitations: [
      'Exploratory backtest, not a validated strategy or recommendation.',
      'Trades fill at historical OHLCV opens/closes with ASSUMED fees and slippage; no actual bid-ask, market impact, tax, latency, corporate actions or broker fills.',
      'Intraday dates interpreted in the chosen exchange time zone; timestamps represent candle START.',
      'Trade-log classification uses last 20% of bars as a holdout label, not evidence of external forward validation.',
      'No option chain, Greeks, expiry, strike selection, margin, early assignment or live execution.'
    ],
    broker_orders: false
  };
}
