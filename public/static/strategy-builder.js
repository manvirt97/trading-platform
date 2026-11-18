/* Rangeform Strategy Builder: UI only. The server owns strategy rules and math. */
import { drawEmaChart } from './strategy-live.js';
const byId = id => document.getElementById(id);
const form = {
  description: byId('sbDescription'), symbol: byId('sbSymbol'), source: byId('sbSource'),
  file: byId('sbFile'), capital: byId('sbCapital'), fees: byId('sbFees'),
  slippage: byId('sbSlippage'), allocation: byId('sbAllocation'),
  entry: byId('sbEntry'), exit: byId('sbExit')
};
let lastResults = null;
let selectedTrade = -1;
function focusTrade(index) {
  const trades = lastResults?.trade_log || [];
  if (!trades.length) {
    byId('sbTradeFocus').textContent = 'No completed trades to inspect.';
    byId('sbPrevTrade').disabled = true;
    byId('sbNextTrade').disabled = true;
    return;
  }
  selectedTrade = Math.max(0, Math.min(index, trades.length - 1));
  const trade = trades[selectedTrade];
  byId('sbTradeFocus').textContent = 'Trade ' + (selectedTrade + 1) + ' of ' + trades.length +
    ' · ' + trade.entry_time + ' → ' + trade.exit_time +
    ' · net ' + String(trade.net_pnl);
  byId('sbPrevTrade').disabled = selectedTrade <= 0;
  byId('sbNextTrade').disabled = selectedTrade >= trades.length - 1;
}

function status(message, bad = false) {
  const element = byId('sbStatus');
  element.textContent = message;
  element.dataset.bad = bad ? 'true' : 'false';
}
function cell(row, text) {
  const td = document.createElement('td');
  td.textContent = text == null ? '—' : String(text);
  row.append(td);
}
async function api(payload) {
  const response = await fetch('/api/strategy-builder', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let json;
  try { json = await response.json(); } catch { throw Error('The strategy service is unavailable.'); }
  if (!response.ok) throw Error(json.error || 'Request rejected.');
  return json;
}
function rulePreview(spec) {
  const parent = byId('sbRules');
  parent.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = 'Parsed rules: ' + spec.fast + '/' + spec.slow + ' EMA · ' + spec.interval;
  parent.append(heading);
  const details = document.createElement('p');
  details.textContent = 'Long-only underlying asset · ' + spec.timezone + ' · entries ' +
    form.entry.value + '–' + form.exit.value + '. Uses NEXT candle open for signal fills.';
  parent.append(details);
  const list = document.createElement('ol');
  for (const explanation of spec.rules) {
    const item = document.createElement('li');
    item.textContent = explanation;
    list.append(item);
  }
  parent.append(list);
  const caveat = document.createElement('p');
  caveat.className = 'sb-muted';
  caveat.textContent = spec.assumptions.join(' ');
  parent.append(caveat);
}
function parseLine(line) {
  const values = [];
  let quote = false, value = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quote && line[i + 1] === '"') { value += '"'; i++; }
      else quote = !quote;
    } else if (ch === ',' && !quote) { values.push(value.trim()); value = ''; }
    else value += ch;
  }
  if (quote) throw Error('CSV has an unclosed quotation mark.');
  values.push(value.trim());
  return values;
}
function parseCsv(raw) {
  if (raw.length > 1_000_000) throw Error('CSV must be smaller than 1 MB.');
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 37 || lines.length > 8001) throw Error('CSV needs 36–8,000 completed OHLCV rows.');
  const head = parseLine(lines[0]).map(x => x.toLowerCase());
  const keys = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
  const positions = keys.map(key => head.indexOf(key));
  if (positions.some(x => x < 0)) throw Error('CSV must have headers: timestamp,open,high,low,close,volume.');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const columns = parseLine(lines[i]);
    const timestamp = columns[positions[0]];
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp || ''))
      throw Error('CSV line ' + (i + 1) + ': use timezone-aware ISO candle-start timestamp, e.g. 2026-10-01T09:30:00-04:00.');
    if (!Number.isFinite(Date.parse(timestamp)))
      throw Error('CSV line ' + (i + 1) + ': invalid timestamp.');
    const prices = positions.slice(1).map(position => {
      const text = columns[position];
      return text === '' || text == null ? NaN : Number(text);
    });
    if (!prices.every(Number.isFinite))
      throw Error('CSV line ' + (i + 1) + ': invalid OHLCV number.');
    rows.push({
      timestamp: new Date(timestamp).toISOString(),
      open: prices[0], high: prices[1], low: prices[2],
      close: prices[3], volume: prices[4]
    });
  }
  return rows;
}
async function review() {
  try {
    status('Validating rules...');
    const result = await api({ action: 'parse', description: form.description.value });
    rulePreview(result.spec);
    status('Rule review complete. No AI model or broker was called.');
    return result.spec;
  } catch (error) {
    byId('sbRules').textContent = error.message;
    status(error.message, true);
    throw error;
  }
}
const fmt = x => x == null ? '—' : Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 });
function metric(name, value, extra = '') {
  const wrapper = document.createElement('div');
  wrapper.className = 'sb-metric';
  const caption = document.createElement('span');
  caption.textContent = name;
  const number = document.createElement('strong');
  number.textContent = value;
  const foot = document.createElement('small');
  foot.textContent = extra;
  wrapper.append(caption, number, foot);
  return wrapper;
}
function drawCurve(data) {
  const svg = byId('sbCurve');
  svg.replaceChildren();
  if (!data || data.length < 2) {
    svg.setAttribute('aria-label', 'Insufficient equity observations to plot.');
    return;
  }
  const ys = data.map(row => row.equity);
  const lower = Math.min(...ys), upper = Math.max(...ys);
  const span = Math.max(1, upper - lower);
  const points = data.map((row, i) => {
    const x = 15 + (770 * i / (data.length - 1));
    const y = 205 - (175 * (row.equity - lower) / span);
    return x.toFixed(2) + ',' + y.toFixed(2);
  }).join(' ');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', points);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  line.setAttribute('stroke-linejoin', 'round');
  svg.append(line);
  svg.setAttribute('aria-label', 'Historical simulated equity from ' + fmt(ys[0]) + ' to ' + fmt(ys.at(-1)));
}
function render(data) {
  lastResults = data;
  byId('sbResults').hidden = false;
  byId('sbProvenance').textContent = data.symbol + ' · ' + data.source + ' · ' +
    data.spec.interval + ' · ' + data.first_bar + ' to ' + data.last_bar;
  const metrics = byId('sbMetrics');
  metrics.replaceChildren(
    metric('NET PROFIT / LOSS', fmt(data.net_pnl) + ' ' + (data.currency || ''), 'Costs included'),
    metric('TOTAL RETURN', fmt(data.total_return_pct) + '%', 'Initial capital basis'),
    metric('WIN RATE', data.win_rate_pct == null ? '—' : fmt(data.win_rate_pct) + '%', data.trades + ' completed trades'),
    metric('MAX DRAWDOWN', fmt(data.max_mark_to_market_drawdown_pct) + '%', 'Mark-to-market estimate'),
    metric('PROFIT FACTOR', fmt(data.profit_factor), 'Net winning / losing P&L'),
    metric('COST DRAG', fmt(data.fee_slippage_drag), 'Estimated fees and slippage')
  );
  drawCurve(data.equity_curve);
  drawEmaChart(byId('sbPriceChart'), data.price_chart);
  focusTrade(data.trade_log.length - 1);
  byId('sbSegments').textContent =
    'Development-labelled trades: ' + data.development.trades + ', P&L ' + fmt(data.development.net_pnl) +
    ' · Last 20% holdout-labelled: ' + data.holdout.trades + ', P&L ' + fmt(data.holdout.net_pnl) +
    '. This split is descriptive only, not independent validation.';
  const tbody = byId('sbTrades');
  tbody.replaceChildren();
  for (const trade of data.trade_log.slice(-50).reverse()) {
    const tr = document.createElement('tr');
    for (const key of ['entry_time', 'exit_time', 'entry', 'exit', 'gross_pnl', 'net_pnl', 'exit_reason'])
      cell(tr, typeof trade[key] === 'number' ? fmt(trade[key]) : trade[key]);
    tbody.append(tr);
  }
  if (!data.trade_log.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = 'No completed crossover trades within the supplied history.';
    tr.append(td);
    tbody.append(tr);
  }
  const notes = byId('sbLimitations');
  notes.replaceChildren();
  for (const note of [...(data.warning_flags || []), ...(data.limitations || [])]) {
    const li = document.createElement('li');
    li.textContent = note;
    notes.append(li);
  }
}
async function runBacktest() {
  const button = byId('sbRun');
  button.disabled = true;
  try {
    const spec = await review();
    const source = form.source.value;
    let bars;
    if (source === 'csv') {
      const file = form.file.files[0];
      if (!file) throw Error('Choose a CSV with actual historical candles first.');
      if (file.size > 1_000_000) throw Error('CSV must be smaller than 1 MB.');
      bars = parseCsv(await file.text());
    }
    if (source === 'twelvedata' && !['1min', '5min', '15min', '1day'].includes(spec.interval))
      throw Error('The feed does not support this interval.');
    status('Testing completed candles. No orders will be sent.');
    const payload = {
      action: 'backtest', description: form.description.value,
      symbol: form.symbol.value.trim().toUpperCase(), source,
      entry_after: form.entry.value, square_off: form.exit.value,
      bars,
      settings: {
        capital: Number(form.capital.value), allocation_pct: Number(form.allocation.value),
        fee_bps_per_side: Number(form.fees.value), slippage_bps_per_side: Number(form.slippage.value)
      }
    };
    const data = await api(payload);
    render(data);
    status('Backtest complete: ' + data.trades + ' hypothetical completed trades. No broker orders.');
    byId('sbResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    status(error.message, true);
  } finally {
    button.disabled = false;
  }
}
function csvSafe(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function exportLog() {
  if (!lastResults) return;
  const fields = ['entry_time', 'exit_time', 'side', 'quantity', 'entry', 'exit', 'gross_pnl', 'net_pnl', 'return_pct', 'phase', 'exit_reason'];
  const lines = [fields.join(','), ...lastResults.trade_log.map(trade => fields.map(key => csvSafe(trade[key])).join(','))];
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  link.href = url;
  link.download = 'rangeform-strategy-backtest.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
byId('sbSource').addEventListener('change', () => {
  byId('sbCsvWrap').hidden = form.source.value !== 'csv';
});
byId('sbParse').addEventListener('click', () => { review().catch(() => {}); });
byId('sbRun').addEventListener('click', runBacktest);
byId('sbExport').addEventListener('click', exportLog);
byId('sbPrevTrade').addEventListener('click', () => focusTrade(selectedTrade - 1));
byId('sbNextTrade').addEventListener('click', () => focusTrade(selectedTrade + 1));
byId('sbTheme').addEventListener('click', () => {
  const theme = window.RangeformTheme;
  if (theme) theme.apply(theme.read() === 'dark' ? 'light' : 'dark');
});
review().catch(() => {});
