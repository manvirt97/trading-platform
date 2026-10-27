// Rangeform V15 · deterministic intraday conditions, NOT broker-ready orders.
// No synthetic quotes, options Greeks, performance probabilities or execution.
import {openingRange} from './opportunity.js';

const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const round=(x,n=4)=>number(x)===null?null:Number(x.toFixed(n));
const NY=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'});
export function sessionClock(value){
 const d=new Date(value);if(!Number.isFinite(+d))return null;
 const p=Object.fromEntries(NY.formatToParts(d).map(x=>[x.type,x.value]));
 return {day:p.year+'-'+p.month+'-'+p.day,minute:Number(p.hour)*60+Number(p.minute),weekday:p.weekday};
}
export function sessionVwap(bars,now=new Date()){
 const c=sessionClock(now);if(!c)return {state:'invalid-time',value:null,volume:0,count:0};
 const session=(bars||[]).filter(b=>{
  const t=sessionClock(b.time||b.timestamp);
  return t?.day===c.day&&t.minute>=570&&t.minute<960&&
   [b.high,b.low,b.close,b.volume].every(v=>number(Number(v))!==null)&&Number(b.volume)>0;
 });
 const totalVolume=session.reduce((v,b)=>v+Number(b.volume),0);
 if(session.length<6||!totalVolume)return {state:'insufficient',value:null,volume:totalVolume,count:session.length,
  note:'Need at least six valid completed regular-session candles with positive volume.'};
 const total=session.reduce((v,b)=>v+((Number(b.high)+Number(b.low)+Number(b.close))/3)*Number(b.volume),0);
 return {state:'ready',value:round(total/totalVolume),volume:round(totalVolume,0),count:session.length,
  method:'Session VWAP proxy from completed candle typical price × volume. Not trade-level VWAP or an executable quote.'};
}
export function positionPlan(input){
 const a=Object.fromEntries(['account','riskPct','entry','stop','capitalPct','fees','slippageBps','dailyLoss','usedDailyLoss'].map(k=>[k,Number(input[k])]));
 const finite=k=>Number.isFinite(a[k]);
 for(const k of Object.keys(a))if(!finite(k))throw Error('Enter a valid number for '+k+'.');
 if(a.account<=0||a.account>1e10)throw Error('Account value must be positive.');
 if(a.riskPct<=0||a.riskPct>5)throw Error('Risk per trade must be greater than 0% and at most 5%.');
 if(a.capitalPct<=0||a.capitalPct>100)throw Error('Maximum position allocation must be 1–100%.');
 if(a.entry<=0||a.stop<=0||a.entry===a.stop)throw Error('Entry and stop must be positive and different.');
 if(a.slippageBps<0||a.slippageBps>500||a.fees<0||a.fees>1e6)throw Error('Costs must be non-negative and within sensible bounds.');
 if(a.dailyLoss<=0||a.dailyLoss>20||a.usedDailyLoss<0||a.usedDailyLoss>a.account)throw Error('Check the daily loss limit and recorded losses.');
 const side=a.stop<a.entry?'long':'short';const distance=Math.abs(a.entry-a.stop);
 const slippagePerShare=2*a.entry*a.slippageBps/10000;
 const riskPerShare=distance+slippagePerShare;
 const riskBudget=a.account*a.riskPct/100;
 const dailyAvailable=Math.max(0,a.account*a.dailyLoss/100-a.usedDailyLoss);
 const remaining=Math.min(riskBudget,dailyAvailable);
 const available=side==='short'?Math.floor(a.account*a.capitalPct/100/a.entry):Math.floor(a.account*a.capitalPct/100/a.entry);
 const shares=Math.max(0,Math.min(available,Math.floor(Math.max(0,remaining-a.fees)/riskPerShare)));
 const notional=shares*a.entry;
 const estimatedLoss=shares*riskPerShare+(shares?a.fees:0);
 return {side,shares,notional:round(notional,2),entry:a.entry,stop:a.stop,
  theoreticalTarget2r:round(Math.max(.01,a.entry+(side==='long'?1:-1)*distance*2)),
  grossRiskBudget:round(riskBudget,2),dailyRemaining:round(dailyAvailable,2),effectiveBudget:round(remaining,2),
  stopDistance:round(distance),estimatedRiskWithCosts:round(estimatedLoss,2),riskRewardIllustrative:'2:1 before fees and slippage on target',
  readyToPlaceOrder:false,
  note:'Hypothetical shares only. Stop fills, spreads, borrowing/margin constraints, partial fills, fees and taxes may differ. No broker execution. Short sales have additional risks and may require margin.'};
}
export function evaluateDayDesk(analysis,now=new Date()){
 const interval=String(analysis?.interval||'');
 const intervalMin={'1min':1,'5min':5,'15min':15}[interval];
 const bars=Array.isArray(analysis?.bar_history)?analysis.bar_history:[];
 const latest=bars.at(-1),previous=bars.at(-2);
 const last=number(Number(analysis?.last));
 const clock=sessionClock(now),lastClock=sessionClock(analysis?.last_bar_utc);
 const inMarket=Boolean(clock&&!['Sat','Sun'].includes(clock.weekday)&&clock.minute>=570&&clock.minute<960);
 const age=Date.parse(analysis?.last_bar_utc||''),ageMin=(+now-age)/60000;
 const usable=Boolean(['twelvedata','finnhub-backup'].includes(analysis?.source)&&
  analysis?.data_quality==='complete-ohlcv'&&intervalMin&&bars.length>=36&&last!==null&&last>0&&latest&&
  [latest.open,latest.high,latest.low,latest.close,latest.volume].every(v=>Number.isFinite(Number(v))));
 const sessionAligned=Boolean(usable&&inMarket&&lastClock?.day===clock?.day);
 const fresh=Boolean(sessionAligned&&ageMin>=0&&ageMin<=intervalMin*2.5+2);
 const range=usable?openingRange(bars,interval,now):{state:'unavailable',note:'No verified completed intraday OHLCV.'};
 const vwap=usable?sessionVwap(bars,now):{state:'unavailable',value:null,volume:0,count:0};
 const rel=number(Number(analysis?.indicators?.rel_volume));
 const vol=Boolean(rel!==null&&rel>=1.2&&Number(latest?.volume)>0);
 const close=number(Number(latest?.close));
 const prior=number(Number(previous?.close));
 const longOrb=Boolean(range.state==='ready'&&close>range.high&&close>Number(latest.open)&&
  vwap.state==='ready'&&close>vwap.value&&vol);
 const shortOrb=Boolean(range.state==='ready'&&close<range.low&&close<Number(latest.open)&&
  vwap.state==='ready'&&close<vwap.value&&vol);
 const crossLong=Boolean(vwap.state==='ready'&&prior!==null&&prior<=vwap.value&&close>vwap.value&&vol&&close>Number(latest.open));
 const crossShort=Boolean(vwap.state==='ready'&&prior!==null&&prior>=vwap.value&&close<vwap.value&&vol&&close<Number(latest.open));
 let kind='NONE',direction=null;
 if(fresh){
  if(longOrb){kind='OPENING_RANGE_BREAKOUT';direction='long'}
  else if(shortOrb){kind='OPENING_RANGE_BREAKDOWN';direction='short'}
  else if(crossLong){kind='VWAP_RECLAIM';direction='long'}
  else if(crossShort){kind='VWAP_REJECTION';direction='short'}
 }
 const validity=!usable?'NO_DATA':!fresh?'STALE_OR_CLOSED':'HISTORICAL_BAR_CURRENT';
 const status=!usable?'NO_DATA':!fresh?'WAIT_STALE':direction?'CONDITIONAL_WATCH':'WAIT';
 const atr=number(Number(analysis?.indicators?.atr14));
 const buffer=atr!==null&&atr>0?atr*.1:0;
 const stop=direction==='long'?(kind.startsWith('OPENING')?range.high-buffer:vwap.value-buffer):
  direction==='short'?(kind.startsWith('OPENING')?range.low+buffer:vwap.value+buffer):null;
 const validStop=stop!==null&&((direction==='long'&&stop<close)||(direction==='short'&&stop>close));
 const reference=direction&&validStop?{side:direction,entry:round(close),invalidation:round(stop),distance:round(Math.abs(close-stop)),
  hypothetical2R:round(Math.max(.01,close+(direction==='long'?1:-1)*Math.abs(close-stop)*2)),
  basis:'Most recent completed candle close, NOT a fill price or a live quote.'}:null;
 const checks=[
  {name:'Exchange session',pass:inMarket,state:inMarket?'Regular US hours':'Outside regular US hours / weekends; holiday calendar not verified'},
  {name:'Completed bar freshness',pass:fresh,state:usable?(round(ageMin,1)+' min since last bar start · '+interval+' interval'):'Historical quote unavailable'},
  {name:'Opening range',pass:range.state==='ready',state:range.note||'9:30–10:00 ET, completed candles'},
  {name:'Session VWAP',pass:vwap.state==='ready',state:vwap.note||'Volume-weighted typical price of completed candles'},
  {name:'Relative volume',pass:vol,state:rel===null?'Unavailable':round(rel,2)+'× prior 20 completed bars (min 1.20×)'},
  {name:'Tradeable bid/ask spread',pass:false,state:'Not verified: execution readiness is never approved by this tool'}
 ];
 return {symbol:analysis?.symbol||'',interval,
  checked_at:new Date(now).toISOString(),last_completed_bar_utc:analysis?.last_bar_utc||null,
  age_minutes:Number.isFinite(ageMin)?round(ageMin,1):null,
  market_session:inMarket?'REGULAR_US':'CLOSED_OR_UNKNOWN',data_validity:validity,status,setup:kind,direction,
  historical_close:last,source:analysis?.source||'unavailable',currency:analysis?.currency||'USD',
  range,vwap,relative_volume:rel,indicators:analysis?.indicators||{},checks,reference,
  quote_status:'Historical completed bars only. No live bid/ask, consolidated tape or brokerage execution verified.',
  explanation:status==='NO_DATA'?'No verified completed bars.':status==='WAIT_STALE'?'No current eligible conditions. The session is closed, the bar is stale, or the date is not the current session.':
    status==='WAIT'?'No qualified opening-range or VWAP watch with sufficient volume on the latest completed bar.':
    'Conditional '+(direction==='long'?'bullish':'bearish')+' '+kind.replaceAll('_',' ').toLowerCase()+' on historical completed bars. Independently verify live quote, spread, event risk and execution conditions.',
  candles:bars.slice(-95).map(x=>({time:x.time||x.timestamp,open:x.open,high:x.high,low:x.low,close:x.close,volume:x.volume})),
  security:{broker_orders:false,executable_quote:false,stop_guaranteed:false,probability_estimated:false}};
}
