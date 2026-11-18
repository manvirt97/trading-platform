/* A genuinely interactive mode switch. Live means read-only exchange market
 * observation, never trading permission. Do not invent quotes or fill outcomes. */
const $ = id => document.getElementById(id);
const back = $('sbBacktestTab'), live = $('sbLiveTab');
const backPane = $('sbBacktestPane'), livePane = $('sbLivePane');
const state = $('sbLiveState'), note = $('sbLiveMessage');
const watched = []; // browser-session-only observation journal; not trade history
let currentMode = 'backtest', polling = null, requestController = null, lastSeen = '', sample = null;
const ns = 'http://www.w3.org/2000/svg';

function text(id, value) { $(id).textContent = String(value ?? '—'); }
function number(value, digits = 2) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}
function clearValues() {
  for (const id of ['sbLivePrice', 'sbLiveFastValue', 'sbLiveSlowValue',
    'sbLiveSignal', 'sbLiveAge', 'sbLiveAsOf', 'sbMonitorTimestamp']) text(id, '—');
  text('sbLiveTrend', 'No verified data');
  text('sbMonitorDirection', 'Waiting for data');
  text('sbMonitorExplanation', 'A crossover is confirmed only after a candle closes.');
  $('sbLiveChart').replaceChildren();
}
function disconnected(message) {
  state.textContent = 'Market unavailable';
  state.dataset.connected = 'false';
  note.textContent = message;
  note.dataset.bad = 'true';
  clearValues();
}
async function checkGrowwStatus() {
  const label = $('sbGrowwStatus');
  try {
    const response = await fetch('/api/groww-research', { cache: 'no-store' });
    if (!response.ok) throw Error('unavailable');
    const data = await response.json();
    label.textContent = data.available ? 'Configured · history only' : 'Not connected';
  } catch {
    label.textContent = 'Connection status unavailable';
  }
}
function setMode(mode) {
  currentMode = mode;
  const isLive = mode === 'live';
  live.classList.toggle('selected', isLive);
  back.classList.toggle('selected', !isLive);
  live.setAttribute('aria-selected', String(isLive));
  back.setAttribute('aria-selected', String(!isLive));
  backPane.hidden = isLive;
  livePane.hidden = !isLive;
  $('sbModeCaption').textContent = isLive ?
    'LIVE MONITOR · Confirmed exchange candles only · Broker execution OFF' :
    'BACKTEST MODE · Use historical candles to test ideas before risking capital.';
  if (isLive) {
    checkGrowwStatus();
    refresh();
    if (!polling) polling = setInterval(() => {
      if (!document.hidden && currentMode === 'live') refresh();
    }, 45_000);
  } else {
    if (requestController) requestController.abort();
    requestController = null;
    clearInterval(polling);
    polling = null;
  }
}
function addSvg(parent, tag, attrs = {}, content = null) {
  const element = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  if (content !== null) element.textContent = String(content);
  parent.append(element);
  return element;
}
export function drawEmaChart(svg, chart) {
  svg.replaceChildren();
  if (!Array.isArray(chart) || chart.length < 2) {
    svg.setAttribute('aria-label', 'No verified completed price candles');
    return;
  }
  const values = chart.flatMap(d => [d.high, d.low, d.fast, d.slow])
    .filter(Number.isFinite);
  if (!values.length) return;
  const low = Math.min(...values), high = Math.max(...values), span = Math.max(0.00001, high - low);
  const left = 14, right = 780, top = 16, bottom = 246;
  const x = index => left + (right - left) * index / (chart.length - 1);
  const y = price => bottom - (price - low) / span * (bottom - top);
  for (let k = 0; k <= 4; k++) {
    const yy = top + (bottom - top) * k / 4;
    addSvg(svg, 'line', { x1: left, y1: yy, x2: right, y2: yy, class: 'sb-chart-grid' });
  }
  // Compact high/low wicks and open/close bodies for genuine OHLC candles.
  // On dense charts, use lines only to avoid misleading overlapping bodies.
  if (chart.length <= 170) chart.forEach((bar, index) => {
    if (![bar.open, bar.high, bar.low, bar.close].every(Number.isFinite)) return;
    const cx = x(index);
    const cls = bar.close >= bar.open ? 'sb-candle-up' : 'sb-candle-down';
    addSvg(svg, 'line', { x1: cx, x2: cx, y1: y(bar.high), y2: y(bar.low),
      class: 'sb-candle-wick ' + cls, 'vector-effect': 'non-scaling-stroke' });
    const body = Math.max(1.3, Math.abs(y(bar.open) - y(bar.close)));
    const width = Math.max(1.3, Math.min(10, 640 / chart.length));
    addSvg(svg, 'rect', { x: cx - width / 2, y: Math.min(y(bar.open), y(bar.close)),
      width, height: body, class: 'sb-candle-body ' + cls });
    if (bar.entry_marker || bar.exit_marker) {
      addSvg(svg, 'line', { x1: cx, y1: top, x2: cx, y2: bottom,
        class: bar.entry_marker ? 'sb-entry-marker' : 'sb-exit-marker',
        'vector-effect': 'non-scaling-stroke' });
      addSvg(svg, 'text', { x: Math.max(8, Math.min(cx - 4, 754)), y: bar.entry_marker ? 24 : 40 },
        bar.entry_marker ? 'ENTRY' : 'EXIT');
    }
  });
  for (const [key, css] of [['close', 'sb-chart-price'], ['fast', 'sb-chart-fast'], ['slow', 'sb-chart-slow']]) {
    let segment = [];
    const flush = () => {
      if (segment.length >= 2) addSvg(svg, 'polyline', {
        points: segment.join(' '), class: css, fill: 'none',
        'vector-effect': 'non-scaling-stroke'
      });
      segment = [];
    };
    chart.forEach((bar, index) => {
      if (Number.isFinite(bar[key])) segment.push(x(index).toFixed(2) + ',' + y(bar[key]).toFixed(2));
      else flush();
    });
    flush();
  }
  // The charts do not invent interpolation or entry / option premium marks.
  addSvg(svg, 'text', { x: 18, y: 13 }, number(high));
  addSvg(svg, 'text', { x: 18, y: 261 }, number(low));
  svg.setAttribute('aria-label', 'Completed candles with closing price, fast EMA and slow EMA from ' +
    chart[0].time + ' through ' + chart.at(-1).time + '. Last close ' + number(chart.at(-1).close));
}
function rowValue(row, value) {
  const td = document.createElement('td');
  td.textContent = value;
  row.append(td);
}
function renderEvents() {
  const tbody = $('sbLiveEvents');
  tbody.replaceChildren();
  if (!watched.length) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'No confirmed crossover observed during this session.';
    tr.append(td);
    tbody.append(tr);
    return;
  }
  for (const event of watched.slice(-30).reverse()) {
    const tr = document.createElement('tr');
    for (const value of [
      event.observed_at, event.candle, event.name, event.interval, event.signal, number(event.close, 5)
    ]) rowValue(tr, value);
    tbody.append(tr);
  }
}
function captureSignal(data) {
  const key = [data.pair, data.interval, data.fast, data.slow, data.indicator?.signal_bar_utc].join(':');
  if (data.indicator?.signal === 'NONE') return;
  if (!data.indicator?.signal_bar_utc || key === lastSeen) return;
  lastSeen = key;
  watched.push({
    observed_at: new Date().toISOString(),
    candle: data.indicator.signal_bar_utc, name: data.name,
    interval: data.interval, signal: data.indicator.signal, close: data.last_close
  });
  renderEvents();
}
function renderLive(data) {
  if (!data || data.order_mode !== 'READ_ONLY_OBSERVATION' ||
      data.broker_orders !== false || !data.monitoring ||
      !Array.isArray(data.chart) || !data.chart.length ||
      !Number.isFinite(data.last_close) || !data.indicator) {
    throw Error('Live research response failed integrity checks.');
  }
  sample = data;
  state.textContent = 'Verified market candles';
  state.dataset.connected = 'true';
  note.dataset.bad = 'false';
  note.textContent = data.name + ' · ' + data.interval +
    ' · Kraken public OHLC · ' + data.bars_available + ' completed candles. No brokerage connection.';
  text('sbLivePrice', '$' + number(data.last_close, 5));
  text('sbLiveFastValue', number(data.indicator.fast_ema, 5));
  text('sbLiveSlowValue', number(data.indicator.slow_ema, 5));
  text('sbLiveFastLabel', 'EMA ' + data.fast);
  text('sbLiveSlowLabel', 'EMA ' + data.slow);
  const sig = data.indicator.signal;
  text('sbLiveSignal', sig === 'CROSS_UP' ? 'Crossed up' : sig === 'CROSS_DOWN' ? 'Crossed down' : 'No new cross');
  text('sbLiveTrend', data.indicator.trend === 'ABOVE' ?
    'Fast EMA above slow EMA' : data.indicator.trend === 'BELOW' ?
      'Fast EMA below slow EMA' : 'Not enough evidence');
  text('sbLiveAge', data.data_age_seconds < 60 ?
    data.data_age_seconds + ' sec' : Math.floor(data.data_age_seconds / 60) + ' min');
  text('sbLiveAsOf', 'Last finished: ' + data.last_completed_bar_utc);
  text('sbMonitorTimestamp', data.last_completed_bar_utc);
  const stateLabel = data.indicator.trend === 'ABOVE' ? 'Bullish alignment' :
    data.indicator.trend === 'BELOW' ? 'Bearish alignment' : 'No trend confirmation';
  text('sbMonitorDirection', stateLabel);
  text('sbMonitorExplanation', sig === 'CROSS_UP' ?
    'A bullish EMA crossover completed on the latest closed candle. No trade has been entered.' :
    sig === 'CROSS_DOWN' ?
      'A bearish EMA crossover completed on the latest closed candle. No trade has been entered.' :
      'No fresh crossover on the last closed candle. Continue to observe. No order was placed.');
  drawEmaChart($('sbLiveChart'), data.chart);
  captureSignal(data);
}
async function refresh() {
  if (currentMode !== 'live' || document.hidden) return;
  if (requestController) requestController.abort();
  const controller = new AbortController();
  requestController = controller;
  const button = $('sbLiveRefresh');
  button.disabled = true;
  const pair = $('sbLivePair').value;
  const interval = $('sbLiveInterval').value;
  const fast = Number($('sbLiveFast').value);
  const slow = Number($('sbLiveSlow').value);
  if (!Number.isInteger(fast) || !Number.isInteger(slow) ||
      fast < 2 || slow > 150 || fast >= slow) {
    disconnected('Set a valid EMA: 2 ≤ fast < slow ≤ 150.');
    button.disabled = false;
    return;
  }
  state.textContent = 'Checking exchange…';
  state.dataset.connected = 'false';
  try {
    const qs = new URLSearchParams({ pair, interval, fast: String(fast), slow: String(slow) });
    const resp = await fetch('/api/strategy-live?' + qs, { cache: 'no-store', signal: controller.signal });
    const data = await resp.json();
    if (!resp.ok) throw Error(data.error || 'Market feed unavailable');
    if (controller !== requestController || currentMode !== 'live') return;
    renderLive(data);
  } catch (error) {
    if (error.name !== 'AbortError' && controller === requestController)
      disconnected(error.message || 'Unable to confirm completed market candles.');
  } finally {
    if (controller === requestController) {
      requestController = null;
      button.disabled = false;
    }
  }
}
back.addEventListener('click', () => setMode('backtest'));
live.addEventListener('click', () => setMode('live'));
$('sbLiveRefresh').addEventListener('click', refresh);
for (const id of ['sbLivePair', 'sbLiveInterval', 'sbLiveFast', 'sbLiveSlow'])
  $(id).addEventListener('change', () => {
    if (currentMode === 'live') refresh();
  });
$('sbLiveClear').addEventListener('click', () => { watched.length = 0; lastSeen = ''; renderEvents(); });
document.addEventListener('visibilitychange', () => {
  if (currentMode === 'live' && !document.hidden) refresh();
  if (document.hidden && requestController) requestController.abort();
});
window.addEventListener('pagehide', () => {
  clearInterval(polling);
  if (requestController) requestController.abort();
});
if (location.hash === '#live') setMode('live');
