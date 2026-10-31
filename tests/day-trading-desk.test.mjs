import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionClock,sessionVwap,evaluateDayDesk} from '../functions/_shared/day-trading.js';
import {positionPlan} from '../public/static/daydesk-math.mjs';
import {onRequestGet as dayRoute} from '../functions/api/day-desk.js';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const NOW=new Date('2026-10-26T14:16:00Z'); // Ordinary Monday 10:16 EDT
const candle=(time,open=100,close=100,high=101,low=99,volume=1000)=>({time:new Date(time).toISOString(),open,close,high,low,volume});
function market(){
 const bars=[];
 for(let i=0;i<45;i++)bars.push(candle(Date.parse('2026-10-23T13:30:00Z')+i*300000));
 for(let i=0;i<6;i++)bars.push(candle(Date.parse('2026-10-26T13:30:00Z')+i*300000));
 for(let i=6;i<8;i++)bars.push(candle(Date.parse('2026-10-26T13:30:00Z')+i*300000,100.2,100.2,101,99.4,1100));
 bars.push(candle('2026-10-26T14:10:00Z',101,103,104,100.7,2500));
 return {symbol:'NVDA',source:'twelvedata',interval:'5min',currency:'USD',last:103,
  last_bar_utc:bars.at(-1).time,bar_history:bars,data_quality:'complete-ohlcv',
  score:78,indicators:{atr14:1,rel_volume:2.1,sma20:100.2}};
}
test('Session VWAP uses regular-hours completed candles and explicit source caveat',()=>{
 const a=market(),x=sessionVwap(a.bar_history,NOW);
 assert.equal(x.state,'ready');assert.equal(x.count,9);assert.ok(x.value>99&&x.value<103);
 assert.match(x.method,/proxy from completed candle/i);
 assert.equal(sessionClock('2026-10-26T13:30:00Z').minute,570);
 const empty=sessionVwap(a.bar_history,new Date('2026-10-27T14:16:00Z'));
 assert.equal(empty.state,'insufficient');assert.equal(empty.value,null);
});
test('Confirmed bullish opening range becomes only a conditional watch, NEVER an executable signal',()=>{
 const x=evaluateDayDesk(market(),NOW);
 assert.equal(x.status,'CONDITIONAL_WATCH');
 assert.equal(x.setup,'OPENING_RANGE_BREAKOUT');
 assert.equal(x.direction,'long');
 assert.equal(x.range.high,101);
 assert.equal(x.reference.entry,103);
 assert.ok(x.reference.invalidation<x.reference.entry);
 assert.ok(x.reference.hypothetical2R>x.reference.entry);
 assert.equal(x.security.broker_orders,false);
 assert.equal(x.security.executable_quote,false);
 assert.equal(x.checks.at(-1).pass,false);
 assert.match(x.quote_status,/No live bid\/ask/);
});
test('Bearish opening-range setup remains research-only',()=>{
 const a=market();a.bar_history[a.bar_history.length-1]=candle('2026-10-26T14:10:00Z',98.5,97,98.7,96.5,2500);a.last=97;
 const r=evaluateDayDesk(a,NOW);
 assert.equal(r.status,'CONDITIONAL_WATCH');
 assert.equal(r.setup,'OPENING_RANGE_BREAKDOWN');
 assert.equal(r.reference.side,'short');
 assert.ok(r.reference.invalidation>r.reference.entry);
});
test('Stale bars, weekends, daily history and unverified source never create an actionable watch',()=>{
 const a=market();
 assert.equal(evaluateDayDesk(a,new Date('2026-10-26T15:00:00Z')).status,'WAIT_STALE');
 assert.equal(evaluateDayDesk(a,new Date('2026-10-31T14:16:00Z')).status,'WAIT_STALE');
 assert.equal(evaluateDayDesk({...a,interval:'1day'},NOW).status,'NO_DATA');
 assert.equal(evaluateDayDesk({...a,source:'user-csv'},NOW).status,'NO_DATA');
 const old={...a,last_bar_utc:'2026-10-23T14:10:00Z'};
 assert.equal(evaluateDayDesk(old,NOW).status,'WAIT_STALE');
});
test('Weak/missing relative volume blocks aggressive breakout classifications',()=>{
 const a=market();a.indicators.rel_volume=.8;
 assert.equal(evaluateDayDesk(a,NOW).status,'WAIT');
 a.indicators.rel_volume=null;
 assert.equal(evaluateDayDesk(a,NOW).status,'WAIT');
});
test('VWAP reclaim research requires crossing and confirmed current-session volume',()=>{
 const a=market();
 a.bar_history.splice(45+2,1); // incomplete opening range, but enough valid session volume
 a.bar_history.at(-2).close=99.1;
 a.bar_history[a.bar_history.length-1]=candle('2026-10-26T14:10:00Z',99.4,101.3,102,99.2,2500);a.last=101.3;
 const r=evaluateDayDesk(a,NOW);
 assert.equal(r.range.state,'incomplete');
 assert.equal(r.status,'CONDITIONAL_WATCH');
 assert.equal(r.setup,'VWAP_RECLAIM');
});
test('Risk planner respects daily drawdown and position allocation caps',()=>{
 const base={account:10000,riskPct:1,entry:100,stop:99,capitalPct:20,fees:2,slippageBps:5,dailyLoss:2,usedDailyLoss:0};
 const x=positionPlan(base);
 assert.equal(x.shares,20); // max capital $2000, even though $100 risk allows more shares
 assert.ok(x.estimatedRiskWithCosts<100);
 assert.equal(x.readyToPlaceOrder,false);
 assert.equal(positionPlan({...base,usedDailyLoss:200}).shares,0);
 assert.equal(positionPlan({...base,entry:100,stop:101}).side,'short');
 assert.throws(()=>positionPlan({...base,riskPct:12}),/risk per trade/i);
 assert.throws(()=>positionPlan({...base,entry:'',stop:99}),/valid entry/i);
});
test('API refuses missing data and malformed symbol without invented signals',async()=>{
 const invalid=await dayRoute({request:new Request('https://example.com/api/day-desk?symbol=INVALID!'),env:{}});
 assert.equal(invalid.status,400);
 const missing=await dayRoute({request:new Request('https://example.com/api/day-desk?symbol=NVDA&interval=5min'),env:{}});
 assert.equal(missing.status,503);
 assert.equal((await missing.json()).broker_orders,false);
});
test('Day Trading Desk is reachable from the sidebar and uses the same light/dark palette',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9.js'),page=read('public/static/day-desk.js'),css=read('public/static/v15-daydesk.css');
 assert.match(html,/data-page="daydesk"/);
 assert.match(html,/data-section="daydesk"/);
 assert.match(js,/daydesk:'Day Trading Desk'/);
 assert.match(js,/\['overview','scanner','ai','daydesk','signals'/);
 assert.match(html,/v15-daydesk\.css\?v=2/);
 assert.match(html,/day-desk\.js\?v=2/);
 assert.match(css,/var\(--card\)/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/body\[data-theme=dark\]/);
 assert.match(page,/\/api\/day-desk/);
 assert.match(page,/\/api\/feed-state/);
 assert.match(page,/day-risk-entry/);
 assert.doesNotMatch(page,/\/api\/orders|Math\.random\(|new WebSocket\(/);
 assert.doesNotMatch(page,/setInterval\(load\b/);
});
test('Trade planning remains local and browser safe, and a news accordion typo is fixed',()=>{
 const page=read('public/static/day-desk.js'),old=read('public/static/v9.js'),calc=read('public/static/daydesk-math.mjs');
 assert.match(page,/positionPlan\(input\)/);
 assert.match(calc,/readyToPlaceOrder:false/);
 assert.match(page,/No quote is available/);
 assert.doesNotMatch(page,/localStorage\.setItem|sessionStorage\.setItem/);
 assert.doesNotMatch(old,/\$\$\$\(/);
});
