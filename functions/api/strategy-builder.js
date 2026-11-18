// No arbitrary AI code execution and no brokerage order endpoint.
// Claude/ChatGPT may help phrase a rule, but this server compiles only
// an explicitly allowed deterministic EMA strategy specification.
import { parseStrategy, runStrategyBacktest } from '../_shared/strategy-builder.js';
import { getData, json, postData } from '../_shared/http.js';
import { validateSymbol } from '../_shared/core.js';

export async function onRequestPost({ request, env = {} }) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json'))
    return json({ error: 'Send a JSON body.', code: 'JSON_REQUIRED' }, 415);
  let input;
  try { input = await postData(request); }
  catch { return json({ error: 'Invalid JSON or request exceeds 1 MB.', code: 'INVALID_BODY' }, 400); }
  if (!input || typeof input !== 'object')
    return json({ error: 'Invalid request body.', code: 'INVALID_BODY' }, 400);
  if (!['parse', 'backtest'].includes(input.action))
    return json({ error: 'Only parse and backtest actions are supported.', code: 'INVALID_ACTION' }, 400);
  let spec;
  try {
    spec = parseStrategy(input.description);
    if (input.entry_after !== undefined) spec.entry_after = String(input.entry_after);
    if (input.square_off !== undefined) spec.square_off = String(input.square_off);
  } catch (error) {
    return json({ error: error.message, code: 'INVALID_STRATEGY' }, 400);
  }
  if (input.action === 'parse')
    return json({ spec, mode: 'DETERMINISTIC_RULE_PARSER', ai_model_used: false, broker_orders: false });
  let symbol;
  try { symbol = validateSymbol(input.symbol || 'SPY'); }
  catch (error) { return json({ error: error.message, code: 'INVALID_SYMBOL' }, 400); }
  const source = String(input.source || '');
  if (!['csv', 'twelvedata'].includes(source))
    return json({ error: 'Only explicitly imported OHLCV CSV or an authorized historical provider is allowed. No invented data.', code: 'INVALID_SOURCE' }, 400);
  if (source === 'csv' && !Array.isArray(input.bars))
    return json({ error: 'Upload CSV candles with timestamp, open, high, low, close and volume.', code: 'CSV_REQUIRED' }, 400);
  try {
    const { bars, meta } = await getData(request, env, {
      symbol, source, interval: spec.interval, bars: source === 'csv' ? input.bars : undefined,
      currency: input.currency
    });
    const result = runStrategyBacktest(bars, spec, input.settings || {});
    return json({
      ...result, symbol, source: meta.source,
      currency: source === 'csv' && ['USD', 'CAD', 'INR'].includes(input.currency) ? input.currency : meta.currency,
      freshness: meta.freshness, source_detail: meta.source_detail,
      ai_model_used: false, executions_enabled: false
    });
  } catch (error) {
    const reason = String(error.message || 'Backtest could not be completed.').slice(0,240);
    const unavailable = /data|provider|feed|entitlement|twelvedata|configured|locked|connected/i.test(reason) && source !== 'csv';
    return json({ error: reason, code: unavailable ? 'PRICE_FEED_UNAVAILABLE' : 'BACKTEST_REJECTED', broker_orders: false }, unavailable ? 503 : 400);
  }
}
export async function onRequestGet() {
  return json({
    name: 'Rangeform Strategy Builder', available: true,
    modes: ['parse', 'backtest'], strategies: ['EMA crossover: long-only underlying'],
    data: ['user-provided OHLCV CSV', 'authorized Twelve Data historical feed'],
    unsupported: ['historical options premium performance', 'broker execution', 'AI-generated executable code'],
    executions_enabled: false
  });
}
