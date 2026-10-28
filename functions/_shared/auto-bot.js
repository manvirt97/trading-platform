/* Rangeform autonomous PAPER bot: deterministic decision engine.
 * This module has no account credentials, no exchange order methods, no trading endpoints.
 * Simulation results cannot be treated as executed fills or promised profits. */
import {assumedFill} from '../../public/static/algo-math.mjs';
export const BOT_PAIR='XBTUSD';
export const DEFAULTS=Object.freeze({feeBps:40,slipBps:10,fast:9,slow:21,maxSpreadBps:22,positionPercent:1,maxPositionPercent:5,maxDailyLossPercent:2,maxDrawdownPercent:5,maxEntriesPerDay:5,stopPercent:1.5,targetPercent:3,maxHoldMinutes:180,cooldownMinutes:15});
export function initialBot(){return {mode:'PAPER_ONLY',enabled:false,halted:false,haltReason:'',pair:BOT_PAIR,capital:10000,cash:10000,realizedPnl:0,day:'',dayPnl:0,entriesToday:0,lossStreak:0,lastEntryAt:null,lastProcessedBar:null,lastTickAt:null,lastError:null,lastSignal:'WAITING',position:null,events:[],updatedAt:null};}
export const n=x=>typeof x==='number'?x:Number(x);
function finitePositive(x){return Number.isFinite(n(x))&&n(x)>0}
export function ema(values,period){
 if(values.length<period||!values.every(finitePositive))throw Error('Not enough valid completed candles');
 let value=values.slice(0,period).reduce((a,b)=>a+n(b),0)/period;
 const alpha=2/(period+1),out=Array(period-1).fill(null).concat(value);
 for(let i=period;i<values.length;i++){value=alpha*n(values[i])+(1-alpha)*value;out.push(value)}
 return out;
}
export function signalFromBars(bars){
 if(!Array.isArray(bars)||bars.length<35)throw Error('At least 35 completed candles required');
 for(let i=0;i<bars.length;i++){
  if(!Number.isInteger(bars[i].time)||!finitePositive(bars[i].close)||(i&&bars[i].time<=bars[i-1].time))throw Error('Bad or unsorted candles');
 }
 const closes=bars.map(b=>n(b.close)),fast=ema(closes,DEFAULTS.fast),slow=ema(closes,DEFAULTS.slow);
 const last=bars.length-1,prev=last-1,above=fast[last]>slow[last],prior=fast[prev]>slow[prev];
 return {signal:above&&!prior?'CROSS_UP':!above&&prior?'CROSS_DOWN':'HOLD',trend:above?'ABOVE':'BELOW',fast:fast[last],slow:slow[last],barTime:bars[last].time};
}
function event(state,action,now,details={}){
 const x={at:new Date(now).toISOString(),action,pair:state.pair,...details};
 state.events=[x,...state.events].slice(0,120);
 return x;
}
export function inspectMarket(market,now=Date.now()){
 const b=market?.book,bars=market?.bars;
 if(!b||!Array.isArray(bars))throw Error('Missing verified spot book and 5-minute candles');
 const bid=n(b.best_bid),ask=n(b.best_ask);
 if(!finitePositive(bid)||!finitePositive(ask)||bid>=ask||!Array.isArray(b.bids)||!Array.isArray(b.asks))throw Error('Invalid spot book');
 if(n(b.bids[0]?.[0])!==bid||n(b.asks[0]?.[0])!==ask)throw Error('Top-depth data disagrees with best quote');
 if(now-n(market.fetchedAt)>20000||n(market.fetchedAt)>now+3000)throw Error('Order book snapshot is stale');
 const sig=signalFromBars(bars);
 const barAge=now-sig.barTime*1000;
 if(barAge<300000||barAge>1000000)throw Error('Completed five-minute candle is stale or not closed');
 const spreadBps=(ask-bid)/((ask+bid)/2)*10000;
 if(!Number.isFinite(spreadBps))throw Error('Unusable spread');
 return {...sig,bid,ask,spreadBps,bidQty:n(b.bids[0][1]),askQty:n(b.asks[0][1])};
}
export function advanceBot(previous,market,now=Date.now()){
 const state=structuredClone(previous);
 if(state.mode!=='PAPER_ONLY'||state.pair!==BOT_PAIR)throw Error('Unexpected execution mode');
 state.lastTickAt=new Date(now).toISOString();
 if(!state.enabled||state.halted){state.lastSignal='STOPPED';return {state,trade:null,reason:'Bot is stopped'};}
 const currentDay=new Date(now).toISOString().slice(0,10);
 if(state.day!==currentDay){state.day=currentDay;state.dayPnl=0;state.entriesToday=0;state.lossStreak=0}
 let info;
 try{info=inspectMarket(market,now);state.lastError=null}
 catch(e){state.lastError=String(e.message).slice(0,120);state.lastSignal='NO_DATA';return {state,trade:null,reason:state.lastError};}
 state.lastSignal=info.signal;
 const cfg=DEFAULTS;
 const equity=state.cash+(state.position?state.position.qty*assumedFill('sell',info.bid,1,cfg.feeBps,cfg.slipBps).total:0);
 if(!Number.isFinite(equity))throw Error('Invalid equity');
 if(equity<=state.capital*(1-cfg.maxDrawdownPercent/100)||state.dayPnl<=-state.capital*cfg.maxDailyLossPercent/100||state.lossStreak>=3){
  state.enabled=false;state.halted=true;state.haltReason='Risk stop: drawdown, daily realized loss, or consecutive losses';
  state.lastSignal='RISK_HALT';
  return {state,trade:null,reason:state.haltReason};
 }
 const pos=state.position;
 if(pos){
  const timeHeld=(now-Date.parse(pos.openedAt))/60000;
  const stop=info.bid<=pos.entry*(1-cfg.stopPercent/100);
  const take=info.bid>=pos.entry*(1+cfg.targetPercent/100);
  const reverse=info.signal==='CROSS_DOWN'&&state.lastProcessedBar!==info.barTime;
  const expiry=timeHeld>=cfg.maxHoldMinutes;
  if(!stop&&!take&&!reverse&&!expiry)return {state,trade:null,reason:'Monitoring paper position'};
  if(!(info.bidQty>=pos.qty)){state.lastError='Top bid depth too small for safe modelled exit';return {state,trade:null,reason:state.lastError};}
  const fill=assumedFill('sell',info.bid,pos.qty,cfg.feeBps,cfg.slipBps);
  const pnl=fill.total-pos.cost;
  state.cash+=fill.total;state.realizedPnl+=pnl;state.dayPnl+=pnl;state.lossStreak=pnl<0?state.lossStreak+1:0;
  state.position=null;state.lastProcessedBar=info.barTime;
  const trade=event(state,'PAPER_SELL',now,{qty:pos.qty,price:fill.execution,fee:fill.fee,pnl,reason:stop?'STOP':take?'TARGET':reverse?'TREND_REVERSAL':'MAX_HOLD'});
  return {state,trade,reason:'Simulated exit'};
 }
 if(state.lastProcessedBar===info.barTime)return {state,trade:null,reason:'Completed bar already processed'};
 state.lastProcessedBar=info.barTime;
 if(info.signal!=='CROSS_UP')return {state,trade:null,reason:'No verified bullish crossover'};
 if(info.spreadBps>cfg.maxSpreadBps)return {state,trade:null,reason:'Spread too wide'};
 if(state.entriesToday>=cfg.maxEntriesPerDay)return {state,trade:null,reason:'Daily entry count reached'};
 if(state.lastEntryAt&&now-Date.parse(state.lastEntryAt)<cfg.cooldownMinutes*60000)return {state,trade:null,reason:'Entry cooldown'};
 if(state.dayPnl<=-state.capital*cfg.maxDailyLossPercent/100)return {state,trade:null,reason:'Daily loss limit'};
 const budget=Math.min(state.capital*cfg.positionPercent/100,state.capital*cfg.maxPositionPercent/100,state.cash);
 if(budget<10)return {state,trade:null,reason:'Insufficient paper cash'};
 const unit=assumedFill('buy',info.ask,1,cfg.feeBps,cfg.slipBps);
 const qty=budget/unit.total;
 if(!(info.askQty>=qty))return {state,trade:null,reason:'Insufficient ask depth'};
 const fill=assumedFill('buy',info.ask,qty,cfg.feeBps,cfg.slipBps);
 if(fill.total>state.cash+0.000001)return {state,trade:null,reason:'Insufficient paper cash'};
 state.cash-=fill.total;
 state.position={qty,entry:fill.execution,cost:fill.total,openedAt:new Date(now).toISOString(),entryBar:info.barTime};
 state.lastEntryAt=new Date(now).toISOString();state.entriesToday++;
 const trade=event(state,'PAPER_BUY',now,{qty,price:fill.execution,fee:fill.fee,reason:'EMA_9_21_CROSS_UP'});
 return {state,trade,reason:'Simulated entry'};
}
