#!/usr/bin/env python3
"""Rangeform local-only research dashboard. Python stdlib. NO broker execution.
Run: python3 dashboard/server.py, visit http://127.0.0.1:8765
"""
import csv
import gzip
import io
import json
import os
import re
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analytics import analyze, backtest, risk_plan

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'
STATIC=ROOT/'static'
STATE=Path(os.getenv('RANGEFORM_STATE_DIR',str(Path.home()/'.rangeform')))
STATE.mkdir(parents=True,exist_ok=True)
DB=STATE/'journal.sqlite3'
SYMBOL=re.compile(r'^[A-Z][A-Z0-9.\-]{0,9}$')
CACHE={}; LOCK=threading.Lock()
WATCH=['AAPL','NVDA','TSLA','MSFT','AMZN','AMD','META','GOOGL','SOFI']
HEADERS={'User-Agent':'RangeformResearch/1.0 (local user market research; contact via provider dashboard)','Accept':'application/json, application/xml, text/xml'}


def init_db():
    with sqlite3.connect(DB) as c:
        c.execute("CREATE TABLE IF NOT EXISTS journal (id INTEGER PRIMARY KEY AUTOINCREMENT, created_utc TEXT NOT NULL, symbol TEXT NOT NULL, source TEXT NOT NULL, entry REAL NOT NULL, stop REAL NOT NULL, target REAL NOT NULL, shares INTEGER NOT NULL, note TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD')")
        if 'currency' not in [x[1] for x in c.execute('PRAGMA table_info(journal)')]:
            c.execute("ALTER TABLE journal ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'")


def read_url(url, timeout=9):
    req=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=timeout) as r:
        if int(r.headers.get('Content-Length','0'))>3_000_000:raise ValueError('Provider response too large')
        raw=r.read(3_000_001)
        if len(raw)>3_000_000:raise ValueError('Provider response too large')
        return raw


def from_chart(data, symbol):
    result=(data.get('chart',{}).get('result') or [None])[0]
    if not result:raise ValueError('No chart data for symbol')
    timestamps=result.get('timestamp',[])
    quote=result.get('indicators',{}).get('quote',[{}])[0]
    bars=[]
    for i,t in enumerate(timestamps):
        try:
            o,h,l,c,v=[quote.get(k,[])[i] for k in ('open','high','low','close','volume')]
            if any(x is None for x in (o,h,l,c)) or min(float(o),float(h),float(l),float(c))<=0:continue
            bars.append({'timestamp':datetime.fromtimestamp(t,timezone.utc).isoformat(),'open':float(o),'high':float(h),'low':float(l),'close':float(c),'volume':int(v or 0)})
        except (ValueError,IndexError,TypeError,OverflowError):continue
    return bars


def from_spark(entry):
    """Archived spark has closing prices only: never manufacture OHLC or volumes."""
    x=entry['response'][0]; quote=x['indicators']['quote'][0];bars=[]
    for i,t in enumerate(x['timestamp']):
        try:
            c=quote['close'][i]
            if c is None or float(c)<=0:continue
            bars.append({'timestamp':datetime.fromtimestamp(t,timezone.utc).isoformat(),'close':float(c)})
        except (KeyError,IndexError,ValueError,TypeError):continue
    return bars


def demo_tsla_daily():
    """Aggregate recorded 5m bars into actual daily OHLCV; exclude incomplete days."""
    bars,_=get_demo('TSLA','5min')
    grouped={}
    ny=ZoneInfo('America/New_York')
    for b in bars:
        day=datetime.fromisoformat(b['timestamp']).astimezone(ny).date().isoformat()
        grouped.setdefault(day,[]).append(b)
    out=[]
    for day,group in sorted(grouped.items()):
        if len(group)<70:continue
        group.sort(key=lambda b:b['timestamp'])
        out.append({'timestamp':group[-1]['timestamp'], 'open':group[0]['open'],
                    'high':max(x['high'] for x in group),'low':min(x['low'] for x in group),
                    'close':group[-1]['close'],'volume':sum(x['volume'] for x in group)})
    return out

def get_demo(symbol, interval='1day'):
    if interval=='5min' and symbol=='TSLA':
        with gzip.open(DATA/'TSLA-archived-5m.json.gz','rt') as f:raw=json.load(f)
        bars=from_chart(raw,symbol)
        # Drop the final potentially unfinished 5-minute bar in the archived snapshot.
        bars=[b for b in bars if b['timestamp'] <= '2026-10-19T14:45:00+00:00']
    elif interval=='1day' and symbol=='TSLA':
        bars=demo_tsla_daily()
    elif interval=='1day':
        with open(DATA/'archived-daily-multi.json') as f: raw=json.load(f)
        entry=next((x for x in raw['spark']['result'] if x['symbol']==symbol),None)
        if entry is None:raise ValueError('Symbol not in bundled archived dataset; use AAPL, TSLA, NVDA, MSFT, AMZN, AMD, META, GOOGL, SOFI or live provider.')
        bars=from_spark(entry)[:-1]  # Exclude most recent archived daily bar: snapshot may have been taken intraday.
    else:raise ValueError('Archived 5-minute bars are included only for TSLA. Select daily, or configure a real provider.')
    close_only = 'open' not in bars[0]
    return bars, {'source':'archived-demo','freshness':'ARCHIVED — October 2026; NOT LIVE' + (' · CLOSES ONLY (limited analysis)' if close_only else ''), 'source_detail':'Bundled historical bars from original project; use for demonstration only', 'currency':'USD', 'interval':interval, 'data_quality':'close-only' if close_only else 'complete-ohlcv'}


def get_twelve(symbol, interval='1day'):
    api_key=os.environ.get('TWELVEDATA_API_KEY','').strip()
    if not api_key:raise ValueError('Twelve Data is not configured. Set TWELVEDATA_API_KEY in your Terminal (see README).')
    if interval not in ('1day','5min','1min','15min'):raise ValueError('Unsupported interval')
    params=urllib.parse.urlencode({'symbol':symbol,'interval':interval,'outputsize':'300','apikey':api_key,'format':'JSON','timezone':'America/New_York'})
    try: raw=json.loads(read_url('https://api.twelvedata.com/time_series?'+params).decode('utf-8'))
    except (OSError,ValueError) as exc:raise ValueError('Twelve Data request failed: '+str(exc)[:150])
    if raw.get('status')=='error' or not isinstance(raw.get('values'),list):raise ValueError('Twelve Data: '+str(raw.get('message','No OHLCV returned'))[:180])
    now=datetime.now(timezone.utc);ny=ZoneInfo('America/New_York')
    duration={'1day':timedelta(hours=16), '1min':timedelta(minutes=1),'5min':timedelta(minutes=5),'15min':timedelta(minutes=15)}[interval]
    bars=[]
    for x in raw['values']:
        try:
            local=datetime.strptime(x['datetime'],'%Y-%m-%d' if interval=='1day' else '%Y-%m-%d %H:%M:%S').replace(tzinfo=ny)
            complete_at=(local.replace(hour=16, minute=0) if interval=='1day' else local+duration)
            if complete_at.astimezone(timezone.utc)>now:continue
            o,h,l,c=map(float,(x['open'],x['high'],x['low'],x['close']))
            if min(o,h,l,c)<=0:continue
            bars.append({'timestamp':local.astimezone(timezone.utc).isoformat(), 'open':o,'high':h,'low':l,'close':c,'volume':int(float(x.get('volume') or 0))})
        except (ValueError,TypeError,KeyError):continue
    bars.sort(key=lambda b:b['timestamp'])
    if not bars:raise ValueError('No completed bars returned. Verify data entitlement and symbol.')
    return bars,{'source':'twelvedata','freshness':'PROVIDER DATA — check last completed bar time', 'source_detail':'Twelve Data API: coverage, delays and licensing depend on plan/exchange', 'currency':raw.get('meta',{}).get('currency','USD'), 'interval':interval}


def get_csv(symbol, interval='1day'):
    path=STATE/'imports'/f'{symbol}.json'
    if not path.exists():raise ValueError('No CSV imported for this ticker on this machine.')
    data=json.loads(path.read_text());bars=data.get('bars',[])
    if data.get('interval')!=interval:raise ValueError('Imported file is '+data.get('interval','unknown')+' interval; change interval.')
    return bars, {'source':'user-csv','freshness':'USER-IMPORTED — manually verify timestamp', 'source_detail':'Locally uploaded OHLCV; not validated against an exchange', 'currency':data.get('currency','USD'),'interval':interval}


def market_data(symbol,source='demo',interval='1day'):
    symbol=symbol.upper().strip()
    if not SYMBOL.fullmatch(symbol):raise ValueError('Ticker must contain 1–10 letters, digits, periods or dashes.')
    if source not in ('demo','twelvedata','csv'):raise ValueError('Choose a supported data source.')
    key=(source,symbol,interval)
    with LOCK:
        found=CACHE.get(key)
        if found and time.time()-found[0]<(60 if interval!='1day' else 900):return found[1]
    data={'demo':get_demo,'twelvedata':get_twelve,'csv':get_csv}[source](symbol,interval)
    with LOCK:CACHE[key]=(time.time(),data)
    return data


def headlines(symbol):
    if not SYMBOL.fullmatch(symbol):raise ValueError('Invalid ticker')
    key=os.environ.get('FINNHUB_API_KEY','').strip()
    if key:
        from_date=(datetime.now(timezone.utc)-timedelta(days=5)).date().isoformat()
        to_date=datetime.now(timezone.utc).date().isoformat()
        url='https://finnhub.io/api/v1/company-news?'+urllib.parse.urlencode({'symbol':symbol,'from':from_date,'to':to_date,'token':key})
        data=json.loads(read_url(url))
        if isinstance(data,dict):raise ValueError('Finnhub: '+str(data.get('error','unexpected response'))[:140])
        return [{'title':x.get('headline',''), 'url':x.get('url',''), 'source':x.get('source','Finnhub'), 'date':datetime.fromtimestamp(x.get('datetime',0),timezone.utc).isoformat()} for x in data[:18] if x.get('headline') and str(x.get('url','')).startswith('https://')], 'Finnhub API (provider-keyed)'
    # Google News publicly accessible RSS feed. Not licensed as trade-grade real-time news.
    url='https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':symbol+' stock when:7d','hl':'en-US','gl':'US','ceid':'US:en'})
    root=ET.fromstring(read_url(url))
    items=[]
    for x in root.findall('./channel/item')[:18]:
        title=x.findtext('title',''); link=x.findtext('link','')
        if link.startswith('https://'):
            items.append({'title':title,'url':link,'date':x.findtext('pubDate',''),'source':x.findtext('source','Google News RSS')})
    return items,'Google News RSS (may be delayed/incomplete)'


def validate_csv(raw, symbol, interval):
    if len(raw)>1_200_000:raise ValueError('CSV too large (1.2 MB maximum).')
    text=raw.decode('utf-8-sig'); reader=csv.DictReader(io.StringIO(text))
    required={'timestamp','open','high','low','close','volume'}
    if not reader.fieldnames or not required.issubset(set(x.lower().strip() for x in reader.fieldnames)):
        raise ValueError('CSV headers required: timestamp,open,high,low,close,volume')
    bars=[]
    for r in reader:
        r={k.lower().strip():v for k,v in r.items() if k}
        try:
            stamp=r['timestamp'].replace('Z','+00:00')
            dt=datetime.fromisoformat(stamp)
            if dt.tzinfo is None:raise ValueError('Timestamp must specify time zone, e.g. 2026-10-19T14:30:00+00:00')
            vals=[float(r[k]) for k in ['open','high','low','close','volume']]
            if any(not (abs(v)<1e14) for v in vals) or min(vals[:4])<=0 or vals[4]<0:raise ValueError('Invalid OHLCV values')
            o,h,l,c,v=vals
            if not (l <= min(o,c) and h>=max(o,c) and h>=l):raise ValueError('OHLC inconsistent')
            bars.append({'timestamp':dt.astimezone(timezone.utc).isoformat(),'open':o,'high':h,'low':l,'close':c,'volume':int(v)})
        except (KeyError,TypeError,ValueError,OverflowError) as e:raise ValueError(f'Invalid CSV row {len(bars)+2}: {str(e)[:100]}')
        if len(bars)>30000:raise ValueError('CSV exceeds 30,000 bars')
    if len(bars)<36:raise ValueError('CSV needs at least 36 bars')
    bars.sort(key=lambda b:b['timestamp'])
    if len(set(b['timestamp'] for b in bars))!=len(bars):raise ValueError('Duplicate timestamps found')
    return bars


class Handler(BaseHTTPRequestHandler):
    def _response(self,status,obj):
        payload=json.dumps(obj,allow_nan=False).encode('utf-8')
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(payload)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers();self.wfile.write(payload)

    def _html(self,path,mime):
        raw=path.read_bytes();self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(raw)))
        self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; object-src 'none'; base-uri 'none'")
        self.end_headers();self.wfile.write(raw)

    def do_GET(self):
        u=urllib.parse.urlparse(self.path); q=urllib.parse.parse_qs(u.query)
        try:
            if u.path=='/':return self._html(STATIC/'index.html','text/html; charset=utf-8')
            if u.path=='/static/favicon.svg':return self._html(STATIC/'favicon.svg','image/svg+xml')
            if u.path=='/static/app.css':return self._html(STATIC/'app.css','text/css; charset=utf-8')
            if u.path=='/static/app.js':return self._html(STATIC/'app.js','application/javascript; charset=utf-8')
            if u.path=='/api/status':return self._response(200,{'app':'Rangeform','execution':'DISABLED — journal only','twelvedata_configured':bool(os.getenv('TWELVEDATA_API_KEY')),'finnhub_configured':bool(os.getenv('FINNHUB_API_KEY')),'default':'demo','watchlist':WATCH,'local_only':True,'polling':'manual / browser-initiated','app_version':'3.0'})
            if u.path=='/api/analyze':
                symbol=q.get('symbol',['TSLA'])[0];source=q.get('source',['demo'])[0];interval=q.get('interval',['1day'])[0]
                bars,meta=market_data(symbol,source,interval)
                return self._response(200,analyze(bars,symbol.upper(),meta))
            if u.path=='/api/backtest':
                symbol=q.get('symbol',['TSLA'])[0];source=q.get('source',['demo'])[0];interval=q.get('interval',['1day'])[0];cost=float(q.get('cost_bps',['8'])[0])
                bars,meta=market_data(symbol,source,interval)
                return self._response(200,{**backtest(bars,cost),**meta,'symbol':symbol.upper()})
            if u.path=='/api/overview':
                source=q.get('source',['demo'])[0]; symbols=q.get('symbols',['AAPL,NVDA,TSLA,MSFT,AMZN,AMD'])[0].split(',')[:12]
                entries=[]
                for symbol in symbols:
                    try:
                        bars,meta=market_data(symbol,source,'1day');x=analyze(bars,symbol.upper(),meta)
                        entries.append({k:x.get(k) for k in ('symbol','last','change_pct','score','regime','decision','last_bar_utc','source','freshness','currency')})
                    except (ValueError,OSError) as exc:entries.append({'symbol':symbol,'error':str(exc)[:150]})
                return self._response(200,{'rows':entries,'source':source})
            if u.path=='/api/news':
                sym=q.get('symbol',['AAPL'])[0].upper()
                items,provider=headlines(sym)
                return self._response(200,{'symbol':sym,'provider':provider,'items':items,'note':'Headlines are not validated, live or complete. Read original reporting before making a decision.'})
            if u.path=='/api/journal':
                with sqlite3.connect(DB) as c:
                    c.row_factory=sqlite3.Row
                    rows=[dict(row) for row in c.execute('SELECT * FROM journal ORDER BY id DESC LIMIT 60')]
                return self._response(200,{'rows':rows})
            return self._response(404,{'error':'Not found'})
        except (ValueError,urllib.error.URLError,TimeoutError,ET.ParseError) as e:return self._response(400,{'error':str(e)[:300]})
        except Exception as e:
            print('Request error:',repr(e),file=sys.stderr)
            return self._response(500,{'error':'Internal error; see terminal for details.'})

    def do_POST(self):
        try:
            n=int(self.headers.get('Content-Length','0'))
            if n<1 or n>1_300_000:raise ValueError('Request too large or empty')
            if self.path=='/api/import':
                q=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                # Use supplied headers not URL to keep request format simple.
                symbol=self.headers.get('X-Symbol','').upper().strip();interval=self.headers.get('X-Interval','1day')
                if not SYMBOL.fullmatch(symbol):raise ValueError('Invalid ticker')
                if interval not in ('1day','5min','1min','15min'):raise ValueError('Invalid interval')
                bars=validate_csv(self.rfile.read(n),symbol,interval)
                currency=self.headers.get('X-Currency','USD')
                if currency not in ('USD','CAD'):raise ValueError('Choose USD or CAD.')
                directory=STATE/'imports';directory.mkdir(parents=True,exist_ok=True)
                (directory/f'{symbol}.json').write_text(json.dumps({'bars':bars,'interval':interval,'currency':currency}))
                with LOCK:
                    for k in list(CACHE):
                        if k[0]=='csv' and k[1]==symbol:CACHE.pop(k,None)
                return self._response(200,{'symbol':symbol,'bars':len(bars),'mode':'user-csv','stored_locally':True,'currency':currency})
            if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':raise ValueError('Expected application/json')
            payload=json.loads(self.rfile.read(n))
            if self.path=='/api/risk':
                plan=risk_plan(float(payload['equity']),float(payload['risk_pct']),float(payload['entry']),float(payload['stop']),float(payload['target']),float(payload.get('daily_risk_pct',2)))
                return self._response(200,plan)
            if self.path=='/api/journal':
                sym=str(payload.get('symbol','')).upper().strip()
                if not SYMBOL.fullmatch(sym):raise ValueError('Invalid ticker')
                plan=risk_plan(*[float(payload[k]) for k in ('equity','risk_pct','entry','stop','target')])
                if plan['shares']<=0:raise ValueError('Position size would be zero; scenario not saved.')
                source=str(payload.get('source','manual'))[:40]
                if source not in ('demo','twelvedata','csv','manual'):raise ValueError('Invalid source')
                note=str(payload.get('note',''))[:260]
                currency=str(payload.get('currency','USD'))
                if currency not in ('CAD','USD'):raise ValueError('Invalid account currency')
                with sqlite3.connect(DB) as c:
                    c.execute('INSERT INTO journal(created_utc,symbol,source,entry,stop,target,shares,note,currency) VALUES(?,?,?,?,?,?,?,?,?)',(
                        datetime.now(timezone.utc).isoformat(),sym,source,float(payload['entry']),float(payload['stop']),float(payload['target']),plan['shares'],note,currency))
                return self._response(201,{'saved':True,'plan':plan,'executed':False,'message':'Saved an educational hypothetical trade plan. NO ORDER SENT.'})
            return self._response(404,{'error':'Not found'})
        except (KeyError,TypeError,ValueError,UnicodeError) as e:return self._response(400,{'error':str(e)[:250]})
        except Exception as e:
            print('Request error:',repr(e),file=sys.stderr)
            return self._response(500,{'error':'Internal error; see terminal for details.'})

    def do_DELETE(self):
        try:
            if not self.path.startswith('/api/journal/'):raise ValueError('Unsupported delete path')
            ident=self.path.rsplit('/',1)[-1]
            if not ident.isdigit() or int(ident)<1:raise ValueError('Invalid journal entry ID')
            with sqlite3.connect(DB) as c:
                result=c.execute('DELETE FROM journal WHERE id=?',(int(ident),))
            return self._response(200,{'removed':result.rowcount>0,'executed':False})
        except ValueError as e:return self._response(400,{'error':str(e)})

    def log_message(self, fmt, *args):
        pass


def main():
    init_db()
    host='127.0.0.1';port=int(os.getenv('RANGEFORM_PORT','8777'))
    print(f'Rangeform running: http://{host}:{port}')
    print('LOCAL ONLY | broker execution disabled | data labeled by source')
    try:ThreadingHTTPServer((host,port),Handler).serve_forever()
    except KeyboardInterrupt:print('\nStopped.')

if __name__=='__main__':main()
