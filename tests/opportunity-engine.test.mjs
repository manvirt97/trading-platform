import test from 'node:test';
import assert from 'node:assert/strict';
import {openingRange,evaluateOpportunity,candleVolumeProfile} from '../functions/_shared/opportunity.js';

const NOW=new Date('2026-10-26T14:12:00Z'); // 10:12 EDT on an ordinary Monday
const candle=(date,open=100,close=100,high=101,low=99,volume=1200)=>({
 time:new Date(date).toISOString(),open,close,high,low,volume
});
function example(){
 const bars=[];
 // Older session history provides indicators; current day opens at 09:30 ET.
 for(let i=0;i<45;i++)bars.push(candle(new Date(Date.parse('2026-10-23T13:30:00Z')+i*5*60000)));
 for(let i=0;i<6;i++)bars.push(candle(new Date(Date.parse('2026-10-26T13:30:00Z')+i*5*60000)));
 for(let i=6;i<9;i++)bars.push(candle(new Date(Date.parse('2026-10-26T13:30:00Z')+i*5*60000),101.5,102,103,100.9,2000));
 return {source:'twelvedata',symbol:'NVDA',interval:'5min',data_quality:'complete-ohlcv',score:85,
  last:102,last_bar_utc:bars.at(-1).time,bar_history:bars,
  indicators:{sma20:100,atr14:1.3,rel_volume:1.75,support20:98,resistance20:101}};
}
test('opening range requires six contiguous 5-minute candles and returns actual highs/lows',()=>{
 const a=example();
 const o=openingRange(a.bar_history,'5min',NOW);
 assert.equal(o.state,'ready');assert.equal(o.high,101);assert.equal(o.low,99);
 assert.equal(o.session_day,'2026-10-26');
 const incomplete=a.bar_history.filter(b=>b.time!=='2026-10-26T13:40:00.000Z');
 assert.equal(openingRange(incomplete,'5min',NOW).state,'incomplete');
});
test('verified bullish opening-range breakout is a watch, not an executable order',()=>{
 const x=example();
 const y=evaluateOpportunity(x,{state:'available',items:[{title:'Nvidia corporate update',url:'https://example.org/article',source:'Example',date:'2026-10-26T13:00:00Z'}]},NOW);
 assert.equal(y.status,'BUY_WATCH');assert.equal(y.plan.direction,'long');
 assert.equal(y.plan.invalidation,99);
 assert.equal(y.news.stories.length,1);
 assert.equal(y.news.interpretation.includes('no verified directional sentiment'),true);
 assert.equal(y.market_session,'regular-us-equity-session');
 assert.equal(y.volume_profile.state,'historical-proxy');
 assert.equal(y.source.includes('not an executable quote'),true);
});
test('weak or missing volume must not be promoted to buy watch',()=>{
 const x=example();x.indicators.rel_volume=0;x.bar_history.at(-1).volume=0;
 const y=evaluateOpportunity(x,{state:'unverified'},NOW);
 assert.equal(y.status,'WAIT');assert.equal(y.plan,null);
 assert.equal(y.news.state,'unverified');assert.equal(y.observations[1].state,'unavailable');
});
test('market closed, stale bar, or daily interval cannot claim live entry',()=>{
 const x=example();
 assert.equal(evaluateOpportunity(x,{},new Date('2026-10-26T21:05:00Z')).status,'WAIT_STALE');
 assert.equal(evaluateOpportunity(x,{},new Date('2026-10-26T14:45:00Z')).status,'WAIT_STALE');
 x.interval='1day';
 assert.equal(evaluateOpportunity(x,{},NOW).status,'WAIT_STALE');
});
test('bearish break needs volume, trend and candle direction',()=>{
 const x=example();const row=x.bar_history.at(-1);
 row.open=98;row.close=97;row.high=99;row.low=96.5;x.last=97;
 x.score=12;x.indicators.sma20=100;x.indicators.rel_volume=1.7;
 const y=evaluateOpportunity(x,{},NOW);
 assert.equal(y.status,'SELL_WATCH');assert.equal(y.plan.direction.includes('NOT an automatic short'),true);
 assert.equal(y.plan.invalidation,101);
});
test('history-only candle volume bins never claim level-two order book',()=>{
 const d=candleVolumeProfile(example().bar_history);
 assert.equal(d.state,'historical-proxy');assert.equal(d.bins.length,12);
 assert.ok(d.bins.every(b=>b.relative_intensity>=0&&b.relative_intensity<=100));
 assert.match(d.method,/not exchange-executed volume-at-price or order-book liquidity/i);
});
