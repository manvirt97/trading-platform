// Rangeform V29 · educational completed-bar scenario replay.
// A Cloudflare-compatible adaptation inspired by the local MIT DayTrader Time Machine.
// No future-price prediction, executable quotes, order placement, or broker connectors.
import {sessionClock} from './day-trading.js';

const INTERVAL_MS=Object.freeze({'1min':60000,'5min':300000,'15min':900000});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const rounded=(v,n=1)=>Number(v.toFixed(n));
function seededRandom(seed){
 let a=seed>>>0;
 return ()=>{
  a=(a+0x6D2B79F5)>>>0;
  let t=a;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}
function validPrice(value){return finite(value)&&value>0&&value<1e8}
export function validateReplayInputs(input){
 const interval=String(input?.interval||'');
 const step=INTERVAL_MS[interval];
 if(!step)throw Error('Select a supported 1-, 5-, or 15-minute interval.');
 const entry=Number(input?.entry),stop=Number(input?.stop),target=Number(input?.target);
 if([input?.entry,input?.stop,input?.target].some(x=>x===''||x==null)||
  ![entry,stop,target].every(validPrice)||!(stop<entry&&entry<target)){
  throw Error('For this long-only scenario, enter positive prices with STOP < ENTRY < TARGET.');
 }
 const horizon=Number(input?.horizonBars??12),seed=Number(input?.seed??19);
 if(!Number.isInteger(horizon)||horizon<3||horizon>48)throw Error('Horizon must be between 3 and 48 completed bars.');
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('Seed must be a whole number from 0 to 4294967295.');
 return {entry,stop,target,interval,horizonBars:horizon,seed,step};
}
export function replayCompletedBars(bars,input){
 const conf=validateReplayInputs(input);
 if(!Array.isArray(bars)||bars.length<50||bars.length>8000)throw Error('Insufficient completed OHLCV bars for scenario replay.');
 // Restrict the sample to adjacent bars within the SAME regular-hours session.
 // This prevents accidentally sampling overnight gaps as ordinary 5-minute movements.
 const returns=[],sessions=new Set();
 let prev=null,prevTs=-Infinity;
 for(const b of bars){
  const ts=Date.parse(b?.timestamp||b?.time||'');
  const close=Number(b?.close);
  if(!Number.isFinite(ts)||ts<=prevTs||!validPrice(close)){
   throw Error('Historical candles have invalid prices or unordered timestamps. Replay blocked.');
  }
  const ny=sessionClock(ts);
  if(!ny)throw Error('Cannot verify the exchange-session timestamp.');
  if(prev&&ts-prev.ts===conf.step&&ny.day===prev.ny.day&&
   ny.minute>=570&&ny.minute<960&&prev.ny.minute>=570&&prev.ny.minute<960){
   const r=Math.log(close/prev.close);
   if(!Number.isFinite(r)||Math.abs(r)>Math.log(2)){
    throw Error('Historical return is invalid or anomalously large. Replay blocked.');
   }
   returns.push(r);sessions.add(ny.day);
  }
  prev={ts,close,ny};prevTs=ts;
 }
 if(returns.length<40||sessions.size<2)throw Error(
  'Not enough adjacent regular-session candles. Need at least 40 returns across 2 sessions; no simulation produced.');
 const random=seededRandom(conf.seed);
 const counts={target_first:0,stop_first:0,neither:0};
 const PATHS=10000;
 for(let i=0;i<PATHS;i++){
  let simulated=conf.entry,finished=false;
  for(let step=0;step<conf.horizonBars;step++){
   simulated*=Math.exp(returns[Math.floor(random()*returns.length)]);
   if(simulated<=conf.stop){counts.stop_first++;finished=true;break}
   if(simulated>=conf.target){counts.target_first++;finished=true;break}
  }
  if(!finished)counts.neither++;
 }
 return {
  state:'SIMULATION_ONLY',model:'historical-close-return-bootstrap',
  paths:PATHS,horizon_bars:conf.horizonBars,interval:conf.interval,seed:conf.seed,
  entry:conf.entry,stop:conf.stop,target:conf.target,
  outcomes:counts,frequency_pct:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,rounded(100*v/PATHS)])),
  evidence:{sample_returns:returns.length,sessions:sessions.size,first_bar_utc:new Date(Date.parse(bars[0].timestamp||bars[0].time)).toISOString(),
   last_bar_utc:new Date(prevTs).toISOString(),sample_quality:sessions.size<20?'LIMITED_SESSIONS':'STILL_EXPLORATORY'},
  warnings:[
   'Simulation frequencies are NOT win probabilities, trading signals or a prediction of future prices.',
   'Resamples one-step completed-bar closing returns with replacement; ignores market regimes, volatility clustering and time-of-day patterns.',
   'Stop and target checks use simulated BAR CLOSES, not intrabar highs/lows or realistic broker fills.',
   'Does not model spread, trading halts, fees, taxes, slippage, commissions or after-hours gaps.',
   ...(sessions.size<20?['Fewer than 20 observed sessions: very limited evidence. Do not use frequencies to make trading decisions.']:[])
  ],
  security:{broker_orders:false,trade_ready:false,executable_quote:false,autonomous:false}
 };
}
