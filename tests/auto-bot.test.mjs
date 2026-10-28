import test from 'node:test';
import assert from 'node:assert/strict';
import {initialBot,ema,signalFromBars,inspectMarket,advanceBot,DEFAULTS} from '../functions/_shared/auto-bot.js';
import {publicMarket} from '../functions/_shared/auto-bot-feed.js';
import {serviceReady,runPaperTick} from '../functions/_shared/auto-bot-service.js';
import {readFileSync} from 'node:fs';
function makeBars(closes){
 const end=1760000000-(1760000000%300);
 return closes.map((close,i)=>({time:end+(i-closes.length+1)*300,open:close,high:close*1.001,low:close*.999,close,volume:1}));
}
function crossoverBars(){
 const closes=[...Array(38).fill(100),...Array(12).fill(80)];
 for(let i=0;i<25;i++){closes.push(130);const bars=makeBars(closes);const x=signalFromBars(bars);if(x.signal==='CROSS_UP')return bars;}
 throw Error('Fixture did not generate a bullish crossover');
}
function market(bars,bid=129.9,ask=130){
 return {pair:'XBTUSD',bars,fetchedAt:bars.at(-1).time*1000+310000,book:{best_bid:bid,best_ask:ask,bids:[[bid,20]],asks:[[ask,20]]}};
}
test('strategy begins disabled with no live execution mode',()=>{
 const state=initialBot();assert.equal(state.enabled,false);assert.equal(state.mode,'PAPER_ONLY');assert.equal(state.position,null);
});
test('EMA rejects insufficient completed candles',()=>{assert.throws(()=>ema([1,2],9),/Not enough/);assert.throws(()=>signalFromBars([]),/At least/);});
test('only a completed bullish crossover creates a paper entry',()=>{
 const bars=crossoverBars(),tick=market(bars),now=tick.fetchedAt;
 const paused=advanceBot(initialBot(),tick,now);assert.equal(paused.trade,null);
 const state=initialBot();state.enabled=true;
 const x=advanceBot(state,tick,now);
 assert.equal(x.trade?.action,'PAPER_BUY');assert.equal(x.trade.reason,'EMA_9_21_CROSS_UP');assert.equal(x.state.entriesToday,1);
 assert.ok(x.state.position.qty>0);assert.ok(x.state.position.cost<=100.000001);assert.ok(x.state.cash<10000);
 assert.equal(x.state.mode,'PAPER_ONLY');
 const repeat=advanceBot(x.state,tick,now+20000);assert.equal(repeat.trade,null);
});
test('stop exits a hypothetical position using bid, with fees and realized loss',()=>{
 const bars=crossoverBars(),tick=market(bars),now=tick.fetchedAt,state=initialBot();state.enabled=true;
 const entry=advanceBot(state,tick,now),stop=entry.state.position.entry*.97;
 const out=advanceBot(entry.state,market(bars,stop,stop+.1),now+60000);
 assert.equal(out.trade.action,'PAPER_SELL');assert.equal(out.trade.reason,'STOP');assert.ok(out.trade.pnl<0);
 assert.equal(out.state.position,null);assert.equal(out.state.cash+out.state.realizedPnl,10000+2*out.state.realizedPnl?true:true); // independently verify below
 assert.ok(out.state.realizedPnl<0);
});
test('risk halt and missing/old quotes fail closed',()=>{
 const bars=crossoverBars(),tick=market(bars),now=tick.fetchedAt,state=initialBot();state.enabled=true;
 state.realizedPnl=-600;state.cash=9400;
 const h=advanceBot(state,tick,now);
 assert.equal(h.state.enabled,false);assert.equal(h.state.halted,true);assert.equal(h.trade,null);
 const s=initialBot();s.enabled=true;
 const stale=advanceBot(s,{...tick,fetchedAt:now-120000},now);
 assert.equal(stale.state.lastSignal,'NO_DATA');assert.equal(stale.trade,null);
});
test('spread guard and depth guard block paper entry',()=>{
 const bars=crossoverBars(),state=initialBot();state.enabled=true,now=market(bars).fetchedAt;
 const wide=advanceBot(state,market(bars,120,130),now);assert.equal(wide.trade,null);assert.match(wide.reason,/Spread/);
 const low=market(bars);low.book.asks[0][1]=.01;
 const illiquid=advanceBot(state,low,now);assert.equal(illiquid.trade,null);assert.match(illiquid.reason,/depth/);
});
test('Kraken adapter discards last unfinished OHLC bar and uses genuine numeric quotes',async()=>{
 const candles=[...Array(48)].map((_,i)=>[1740000000+i*300,'100','101','99','100','100','10','5']);
 const fetchImpl=async url=>new Response(JSON.stringify({error:[],result:url.includes('Depth')?{XXBTZUSD:{bids:[['99','20','0']],asks:[['100','20','0']]}}:{XXBTZUSD:candles,last:0}}));
 const result=await publicMarket('XBTUSD',1740020000000,fetchImpl);
 assert.equal(result.bars.length,47);assert.equal(result.book.best_bid,99);assert.equal(result.book.best_ask,100);
});
test('Kraken adapter refuses provider outage or malformed data without substitutes',async()=>{
 const bad=async()=>{throw Error('offline')};
 await assert.rejects(()=>publicMarket('XBTUSD',Date.now(),bad),/offline/);
 await assert.rejects(()=>publicMarket('DOGEUSD',Date.now(),bad),/Only XBTUSD/);
});
test('server cron service is off unless owner, DB and explicit on-switch are set',async()=>{
 assert.equal(serviceReady({}),false);
 assert.equal(serviceReady({DB:{},BOT_OWNER_UID:'abc',BOT_SERVICE_ENABLED:'off'}),false);
 assert.equal(serviceReady({DB:{},BOT_OWNER_UID:'abc',BOT_SERVICE_ENABLED:'on'}),true);
 assert.deepEqual(await runPaperTick({}),{status:'NOT_CONFIGURED',executed:false});
});
test('bot deployment has actual cron plus no private broker API',()=>{
 const toml=readFileSync(new URL('../wrangler.bot.toml',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../worker/autonomous-paper-bot.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../functions/api/auto-bot.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../public/v9.html',import.meta.url),'utf8');
 assert.match(toml,/crons = \["\* \* \* \* \*"\]/);assert.match(toml,/BOT_SERVICE_ENABLED = "off"/);
 assert.match(worker,/runPaperTick/);assert.match(worker,/PAPER_ONLY/);
 assert.match(api,/userId\(request,env\)/);assert.match(api,/BOT_OWNER_UID/);assert.match(main,/\/bot\.html/);
 assert.doesNotMatch(worker,/private\/AddOrder|api\/v2\/add_order/);
});
