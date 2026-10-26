"""Transparent, deterministic educational analytics. No prediction claims."""
import math
from datetime import datetime, timezone
from statistics import mean, pstdev


def sma(values, window):
    v = [x for x in values[-window:] if x is not None]
    return mean(v) if len(v) == window else None


def rsi(prices, window=14):
    if len(prices) < window + 1:
        return None
    changes = [b - a for a, b in zip(prices[-window-1:-1], prices[-window:])]
    gains = sum(max(0, x) for x in changes) / window
    losses = sum(max(0, -x) for x in changes) / window
    return 100.0 if losses == 0 else 100 - 100/(1 + gains/losses)


def atr(bars, window=14):
    if len(bars) < window + 1:
        return None
    tr = []
    for i in range(len(bars)-window, len(bars)):
        b, prev = bars[i], bars[i-1]
        tr.append(max(b['high']-b['low'], abs(b['high']-prev['close']), abs(b['low']-prev['close'])))
    return mean(tr)


def _pct(a, b):
    return round((a/b - 1)*100, 2) if b else None


def analyze(bars, symbol, meta=None):
    if len(bars) < 35:
        raise ValueError('At least 35 complete OHLCV bars are required to analyze a chart.')
    prices = [b['close'] for b in bars]
    full = all(k in bars[-1] for k in ('open','high','low','volume'))
    vols = [b['volume'] for b in bars] if full else []
    price = prices[-1]
    ma20, ma50 = sma(prices,20), sma(prices,50)
    r = rsi(prices)
    a = atr(bars) if full else None
    vol20 = mean(vols[-21:-1]) if len(vols)>20 else 0
    vol_ratio = round(vols[-1]/vol20,2) if vol20 else None
    change = _pct(price, prices[-2])
    high20 = max(b['high'] if full else b['close'] for b in bars[-21:-1]); low20 = min(b['low'] if full else b['close'] for b in bars[-21:-1]);
    current, prev = bars[-1], bars[-2]
    recent_mom = _pct(price, prices[-6]) if len(prices)>6 else None
    patterns = []
    if price > high20:
        patterns.append({'name':'20-bar breakout','type':'bullish','why':'Last completed close exceeds the previous 20 bars’ '+('highs.' if full else 'closes (close-only example).')})
    if price < low20:
        patterns.append({'name':'20-bar breakdown','type':'bearish','why':'Last completed close is below the previous 20 bars’ '+('lows.' if full else 'closes (close-only example).')})
    if ma20 and price > ma20 and prices[-2] <= sma(prices[:-1], 20):
        patterns.append({'name':'MA20 reclaim','type':'bullish','why':'Price crossed above its 20-bar average on the last completed bar.'})
    if ma20 and price < ma20 and prices[-2] >= sma(prices[:-1], 20):
        patterns.append({'name':'MA20 loss','type':'bearish','why':'Price crossed below its 20-bar average on the last completed bar.'})
    body = abs(current['close']-current['open']) if full else 0
    span = max(0.00001,current['high']-current['low']) if full else 1
    if full and body/span < .12:
        patterns.append({'name':'Doji / indecision','type':'neutral','why':'Open and close were close compared with the bar’s entire range.'})
    elif full and (min(current['open'],current['close'])-current['low']) > 2 * body and (current['high']-max(current['open'],current['close'])) < body:
        patterns.append({'name':'Lower-wick rejection','type':'neutral','why':'A long lower wick shows price was rejected near the low; requires confirmation.'})
    if full and (prev['close'] < prev['open'] and current['close']>current['open'] and
        current['open']<=prev['close'] and current['close']>=prev['open']):
        patterns.append({'name':'Bullish engulfing','type':'bullish','why':'The latest bullish candle’s body encloses the prior bearish candle body.'})
    if full and (prev['close'] > prev['open'] and current['close']<current['open'] and
        current['open']>=prev['close'] and current['close']<=prev['open']):
        patterns.append({'name':'Bearish engulfing','type':'bearish','why':'The latest bearish candle’s body encloses the prior bullish candle body.'})
    if r is not None and r < 30:
        patterns.append({'name':'RSI oversold','type':'neutral','why':'RSI is under 30: weak momentum, not automatically a reversal.'})
    if r is not None and r > 70:
        patterns.append({'name':'RSI overbought','type':'neutral','why':'RSI is above 70: strong momentum, not automatically a short signal.'})
    # A model-free descriptive index, explicitly NOT a probability.
    components = [
        {'name':'Trend vs MA20','impact':16 if price>ma20 else -16,'reason':f'Close {"above" if price>ma20 else "below"} 20-bar average'},
        {'name':'Trend vs MA50','impact':12 if ma50 and price>ma50 else (-12 if ma50 else 0),'reason':'Longer trend proxy' if ma50 else 'Not enough history for MA50'},
        {'name':'5-bar momentum','impact':10 if recent_mom and recent_mom>1 else (-10 if recent_mom and recent_mom < -1 else 0),'reason':'Directional momentum, not certainty'},
        {'name':'RSI regime','impact':5 if r and 50<r<70 else (-5 if r and r<40 else 0),'reason':'Momentum confirmation'},
        {'name':'Range break','impact':15 if price>high20 else (-15 if price<low20 else 0),'reason':'Close vs prior 20-bar trading range'},
        {'name':'Volume context','impact':5 if vol_ratio and vol_ratio>1.5 and price>prices[-2] else 0,'reason':'Relative activity on rising bar'},
    ]
    score = max(0,min(100,50+sum(x['impact'] for x in components)))
    state = 'Constructive' if score >= 65 else 'Caution' if score <=35 else 'Mixed'
    realized = [math.log(prices[i]/prices[i-1]) for i in range(max(1,len(prices)-21),len(prices))]
    sigma = pstdev(realized) if len(realized)>2 else 0
    band = {'lower':round(price*math.exp(-sigma*math.sqrt(5)),2),'upper':round(price*math.exp(sigma*math.sqrt(5)),2),'bars':5,'method':'Illustrative ±1σ log-return band from last 20 completed bars; NOT a calibrated forecast','bar_volatility_pct':round(sigma*100,2)}
    result = {
        'symbol':symbol, 'last':round(price,4), 'previous':round(prices[-2],4), 'change_pct':change,
        'indicators':{'sma20':round(ma20,4),'sma50':round(ma50,4) if ma50 else None,'rsi14':round(r,1) if r is not None else None,'atr14':round(a,4) if a else None,'rel_volume':vol_ratio,'momentum5_pct':recent_mom,'support20':round(low20,4),'resistance20':round(high20,4)},
        'patterns':patterns,'components':components,'score':score,'regime':state,'scenario_band':band,
        'decision':('WATCH — study entry, invalidation, and news' if score>=65 else 'STAND ASIDE — conditions are weak' if score <=35 else 'WAIT — signals disagree'),
        'takeaway':'This is an interpretable rules-based technical alignment score; it is not a predicted success rate.',
        'watch_next':{'up_level':round(high20,4),'down_level':round(low20,4),'explanation':'Observe a completed-bar close beyond the previous 20-bar range; a touch alone is not confirmation.','invalidation':'Conditions must be recomputed with new completed bars. No price level guarantees a stop fill.'},
        'sample_bars':len(bars),'last_bar_utc':bars[-1]['timestamp'],'data_quality':'complete-ohlcv' if full else 'close-only', 'bar_history':[{'time':b['timestamp'],**{k:b[k] for k in ('open','high','low','close','volume') if k in b}} for b in bars[-220:]],
    }
    if meta: result.update(meta)
    return result


def backtest(bars, cost_bps=8):
    """Long-only trend rule, at each close t compute signal using <=t; enter NEXT bar at open and exit same bar close.
    Repeated trades are independent; costs total bps roundtrip. Explicitly not a day trading execution engine.
    """
    if len(bars)<36: raise ValueError('Need at least 36 completed bars.')
    if any('open' not in b for b in bars):raise ValueError('Cannot backtest next-bar entries from a closes-only archive. Use TSLA sample, Twelve Data or import genuine OHLCV.')
    if not 0<=cost_bps<=300: raise ValueError('Invalid fee/slippage assumption.')
    trades=[]
    allreturns=[]
    for i in range(35,len(bars)):
        closes=[b['close'] for b in bars[:i]]
        active = sma(closes,10) > sma(closes,30) and closes[-1] > sma(closes,10)
        if not active: continue
        b=bars[i]; op=b['open']; cl=b['close']
        if not op or not cl:continue
        net = (cl/op-1) - cost_bps/10000
        trades.append({'time':b['timestamp'],'entry':round(op,4),'exit':round(cl,4),'return_pct':round(net*100,3)})
        allreturns.append(net)
    curve=1.0; peak=1.0; worst=0
    for r in allreturns:
        curve*=1+r
        peak=max(peak,curve)
        worst=min(worst,curve/peak-1)
    wins=[t for t in allreturns if t>0]
    losses=[t for t in allreturns if t<0]
    pf = sum(wins)/abs(sum(losses)) if losses else None
    return {
        'rule':'If previous bar SMA10 > SMA30 and previous close > SMA10, buy next bar open, exit at that bar close',
        'avoids_lookahead':True, 'cost_bps_roundtrip':cost_bps,'trades':len(trades),
        'win_rate':round(100*len(wins)/len(trades),1) if trades else None,
        'average_return_pct':round(100*mean(allreturns),3) if trades else None,
        'total_return_pct':round((curve-1)*100,2),'max_drawdown_pct':round(worst*100,2),
        'profit_factor':round(pf,2) if pf is not None else None,
        'last_trades':trades[-25:],
        'caveat':'Exploratory in-sample single-asset test. Not out-of-sample validation; no bid/ask or market-impact modelling beyond simplified bps costs.'
    }


def risk_plan(equity, risk_pct, entry, stop, target, max_daily_pct=2):
    vals=(equity,risk_pct,entry,stop,target,max_daily_pct)
    if not all(math.isfinite(x) for x in vals):raise ValueError('Non-finite input.')
    if not (0 < equity <= 1e9 and 0 < risk_pct <= 5 and 0 < max_daily_pct <= 10):raise ValueError('Check equity and percentage limits.')
    if not (0 < stop < entry < target):raise ValueError('Long-only: stop must be below entry and target above.')
    allowed = equity*risk_pct/100
    size = max(0,min(math.floor(allowed/(entry-stop)), math.floor(equity/entry)))
    return {'shares':size,'notional':round(size*entry,2),'estimated_stop_loss':round(size*(entry-stop),2),'target_gain_before_costs':round(size*(target-entry),2),'reward_risk':round((target-entry)/(entry-stop),2),'trade_risk_budget':round(allowed,2),'daily_loss_limit':round(equity*max_daily_pct/100,2),'message':'Stop orders can slip or gap; actual losses may exceed the planned amount.'}
