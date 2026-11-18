/* Groww RESEARCH-only bridge. Broker credentials stay in server-side secrets.
 * Fixed GET allowlist: expiries, contracts and historical candles only.
 * No trading endpoints, no order placement, no user-entered external URLs.
 */
import { userId, authError } from '../_shared/auth.js';
import { json } from '../_shared/http.js';
const HEADERS = { 'cache-control': 'no-store' };
const actions = new Set(['expiries', 'contracts', 'candles']);
const intervals = Object.freeze({
  '1minute': 30, '2minute': 30, '3minute': 30, '5minute': 30,
  '10minute': 90, '15minute': 90, '30minute': 90,
  '1hour': 180, '4hour': 180, '1day': 180
});
const reject = (message, status = 400, code = 'REJECTED') =>
  json({ error: message, code, order_mode: 'DISABLED' }, status);
const simple = (value, re, label) => {
  if (typeof value !== 'string' || !re.test(value))
    throw Error('Invalid ' + label + '.');
  return value;
};
export function growwResearchRequest(input) {
  if (!input || typeof input !== 'object' || !actions.has(input.action))
    throw Error('Only approved historical research actions are available.');
  const exchange = simple(input.exchange || 'NSE', /^(NSE|BSE)$/, 'exchange');
  const underlying = simple(input.underlying || 'NIFTY',
    /^(NIFTY|BANKNIFTY|FINNIFTY|SENSEX)$/, 'underlying');
  const path = '/v1/historical/' + input.action;
  let query = {};
  if (input.action === 'expiries') {
    const year = Number(input.year), month = Number(input.month);
    if (!Number.isInteger(year) || year < 2020 || year > new Date().getUTCFullYear() ||
      !Number.isInteger(month) || month < 1 || month > 12) throw Error('Invalid expiry month or year.');
    query = { exchange, underlying_symbol: underlying, year: String(year), month: String(month) };
  } else if (input.action === 'contracts') {
    const expiry = simple(input.expiry_date, /^\d{4}-\d{2}-\d{2}$/, 'expiry');
    if (!Number.isFinite(Date.parse(expiry + 'T00:00:00Z'))) throw Error('Invalid expiry date.');
    query = { exchange, underlying_symbol: underlying, expiry_date: expiry };
  } else {
    const segment = simple(input.segment, /^(CASH|FNO)$/, 'segment');
    const symbol = simple(input.groww_symbol, /^[A-Za-z0-9-]{3,72}$/, 'instrument symbol');
    const start = simple(input.start_time, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'start time');
    const end = simple(input.end_time, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'end time');
    const interval = simple(input.candle_interval, /^(1minute|2minute|3minute|5minute|10minute|15minute|30minute|1hour|4hour|1day)$/, 'candle interval');
    if (!symbol.startsWith(exchange + '-' + underlying))
      throw Error('Only matching allowlisted exchange/underlying instruments are permitted.');
    if (segment === 'FNO' && !/-((CE|PE|FUT))$/.test(symbol))
      throw Error('FNO contract must specify expiry, strike and contract type.');
    if (segment === 'CASH' && /-(CE|PE|FUT)$/.test(symbol))
      throw Error('Derivative symbols require FNO segment.');
    const first = Date.parse(start.replace(' ', 'T') + '+05:30');
    const last = Date.parse(end.replace(' ', 'T') + '+05:30');
    if (!Number.isFinite(first) || !Number.isFinite(last) || first >= last ||
      last > Date.now() + 60000 || last - first > intervals[interval] * 86_400_000)
      throw Error('Invalid history range; split requests within the official interval duration limit.');
    query = { exchange, segment, groww_symbol: symbol, start_time: start, end_time: end, candle_interval: interval };
  }
  return { path, url: 'https://api.groww.in' + path + '?' + new URLSearchParams(query).toString() };
}
function normalizeCandles(payload) {
  const candles = payload?.payload?.candles;
  if (!Array.isArray(candles) || !candles.length || candles.length > 8000)
    throw Error('Groww returned zero or too many candles. Use a shorter date range.');
  let prior = -Infinity;
  return candles.map((row, index) => {
    if (!Array.isArray(row) || row.length < 6)
      throw Error('Malformed Groww historical candle at row ' + (index + 1));
    const raw = String(row[0]).replace(' ', 'T');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw))
      throw Error('Invalid Groww candle timestamp');
    const timestamp = new Date(raw + '+05:30').toISOString();
    const t = Date.parse(timestamp);
    if (!Number.isFinite(t) || t <= prior || t > Date.now() + 60000)
      throw Error('Invalid, duplicated or future Groww candle timestamp');
    prior = t;
    const [open, high, low, close, volume] = row.slice(1, 6).map(Number);
    if (![open, high, low, close, volume].every(Number.isFinite) || low <= 0 ||
      volume < 0 || high < Math.max(open, close) || low > Math.min(open, close))
      throw Error('Invalid historical Groww OHLCV prices');
    return { timestamp, open, high, low, close, volume, open_interest: row[6] ?? null };
  });
}
export async function onRequestGet({ env = {} }) {
  return json({
    available: env.GROWW_RESEARCH_ENABLED === 'on' && !!env.GROWW_ACCESS_TOKEN &&
      !!env.BOT_OWNER_UID && !!env.DB,
    configured: {
      server_secret: !!env.GROWW_ACCESS_TOKEN,
      owner_auth: !!env.BOT_OWNER_UID && !!env.FIREBASE_PROJECT_ID,
      usage_database: !!env.DB, enabled: env.GROWW_RESEARCH_ENABLED === 'on'
    },
    supported: ['historical expiries', 'historical contracts', 'historical candle OHLCV'],
    does_not_support: ['broker orders', 'live option execution', 'automatic premium backtest without contract-specific data'],
    broker_orders: false,
    documentation: 'https://groww.in/trade-api/docs/curl/backtesting'
  });
}
export async function onRequestPost({ request, env = {} }) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return reject('Send a JSON body.', 415);
  // Authentication happens before contacting Groww, and only owner may call it.
  let uid;
  try { uid = await userId(request, env); } catch (e) { return authError(e); }
  if (!env.BOT_OWNER_UID || uid !== env.BOT_OWNER_UID)
    return reject('This integration is restricted to the verified Rangeform owner.', 403, 'OWNER_REQUIRED');
  if (env.GROWW_RESEARCH_ENABLED !== 'on' || !env.GROWW_ACCESS_TOKEN || !env.DB)
    return reject('Groww historical research is not configured. No broker connection attempted.', 503, 'BROKER_NOT_CONFIGURED');
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 2500) return reject('Research request too large.', 413);
    input = JSON.parse(raw);
  } catch { return reject('Invalid research JSON.', 400); }
  let lookup;
  try { lookup = growwResearchRequest(input); }
  catch (e) { return reject(String(e.message).slice(0,160)); }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const used = await env.DB.prepare(
      'INSERT INTO ai_allowance(uid,day,calls) VALUES(?,?,1) ' +
      'ON CONFLICT(uid,day) DO UPDATE SET calls=calls+1 WHERE calls<60'
    ).bind('groww_research_'+uid, today).run();
    if (!used.meta?.changes)
      return reject('Groww research daily request limit reached.', 429, 'RESEARCH_QUOTA');
  } catch { return reject('Historical research usage protection unavailable.', 503, 'QUOTA_UNAVAILABLE'); }
  try {
    const upstream = await fetch(lookup.url, {
      headers: { Authorization: 'Bearer ' + env.GROWW_ACCESS_TOKEN,
        Accept: 'application/json', 'X-API-VERSION': '1.0' },
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) throw Error('Groww historical research provider unavailable (HTTP ' + upstream.status + ')');
    const data = await upstream.json();
    if (data?.status !== 'SUCCESS')
      throw Error('Groww did not confirm a successful historical data response.');
    let result;
    if (input.action === 'candles') result = normalizeCandles(data);
    else if (input.action === 'expiries') {
      const expiries = data?.payload?.expiries;
      if (!Array.isArray(expiries) || expiries.length > 120 ||
        expiries.some(x => typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)))
        throw Error('Invalid Groww expiries response');
      result = expiries;
    } else {
      const contracts = data?.payload?.contracts;
      if (!Array.isArray(contracts) || contracts.length > 10000 ||
        contracts.some(x => typeof x !== 'string' || !/^[A-Za-z0-9-]{3,72}$/.test(x)))
        throw Error('Invalid Groww contracts response');
      result = contracts;
    }
    return json({
      action: input.action, source: 'Groww authenticated historical API',
      result, received_at: new Date().toISOString(),
      time_zone: 'Asia/Kolkata', verified_provider_response: true,
      trading_enabled: false, broker_orders: false
    });
  } catch (error) {
    // Never return raw upstream response, credential, or query URL.
    const message = String(error?.message || 'provider unavailable').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0,170);
    return reject(message, 503, 'HISTORICAL_PROVIDER_UNAVAILABLE');
  }
}
