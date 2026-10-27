// Deterministic, evidence-first opportunity engine. No forecasts or execution.
// Prices and OHLCV must come from the existing validated server-side provider.
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const nyParts=value=>{
 const date=value instanceof Date?value:new Date(value);
 if(!Number.isFinite(+date))return null;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(date);
 const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));
 return {day:p.year+'-'+p.month+'-'+p.day,minute:Number(p.hour)*60+Number(p.minute),weekday:p.weekday};
};
export function openingRange(bars,interval,now=new Date()){
 const size={'1min':1,'5min':5,'15min':15}[interval];
 if(!size)return {state:'not-intraday',note:'Opening range needs 1-, 5- or 15-minute completed bars.'};
 const session=nyParts(now),today=session?.day;
 const morning=(bars||[]).filter(b=>{
  const p=nyParts(b.time||b.timestamp);
  return p&&p.day===today&&p.minute>=570&&p.minute<600&&Number.isFinite(Number(b.high))&&Number.isFinite(Number(b.low));
 });
 const expected=30/size;
 if(morning.length<expected){
  return {state:'incomplete',note:'Need '+expected+' complete and valid opening-range candles from 9:30–10:00 a.m. New York time.',observed:morning.length,required:expected};
 }
 const distinct=new Set(morning.map(b=>nyParts(b.time||b.timestamp).minute));
 // Reject missing minutes or duplicate bars; do not treat irregular history as a range.
 for(let minute=570;minute<600;minute+=size)if(!distinct.has(minute))return {state:'incomplete',note:'Opening range has missing intervals.',observed:distinct.size,required:expected};
 const openingHigh=Math.max(...morning.map(b=>Number(b.high)));
 const openingLow=Math.min(...morning.map(b=>Number(b.low)));
 return {state:'ready',high:round(openingHigh,4),low:round(openingLow,4),session_day:today,required:expected,observed:distinct.size,window:'09:30–10:00 America/New_York'};
}
export function evaluateOpportunity(analysis, news={state:'not-checked',items:[]}, now=new Date()){
 const bars=Array.isArray(analysis?.bar_history)?analysis.bar_history:[];
 const symbol=String(analysis?.symbol||'').slice(0,10);
 const interval=String(analysis?.interval||'1day');
 const last=Number(analysis?.last);
 const lastBar=new Date(analysis?.last_bar_utc||'');
 const age=+now-+lastBar;
 const size={'1min':1,'5min':5,'15min':15,'1day':1440}[interval];
 const usable=analysis?.source==='twelvedata'&&analysis?.data_quality==='complete-ohlcv'&&bars.length>=36&&last>0&&Number.isFinite(last)&&Number.isFinite(age)&&age>=0&&Boolean(size);
 const ny=nyParts(now),lastNY=nyParts(lastBar);
 const inSession=Boolean(ny&&!['Sat','Sun'].includes(ny.weekday)&&ny.minute>=570&&ny.minute<960);
 const intraday=interval!=='1day';
 const sessionAligned=Boolean(intraday&&inSession&&lastNY?.day===ny?.day);
 const fresh=Boolean(usable&&sessionAligned&&age<=(size*2.5+2)*60_000);
 const indicator=analysis?.indicators||{};
 const score=Number(analysis?.score);
 const range=usable?openingRange(bars,interval,now):{state:'unavailable',note:'No independently validated OHLCV candles.'};
 const latest=bars.at(-1)||{},prior=bars.at(-2)||{};
 const relative=Number(indicator.rel_volume);
 const hasVolume=Number.isFinite(relative)&&relative>0&&Number(latest.volume)>0;
 const volumeConfirmed=hasVolume&&relative>=1.2;
 const bullish=Number.isFinite(score)&&score>=65;
 const bearish=Number.isFinite(score)&&score<=35;
 const orUp=range.state==='ready'&&last>range.high;
 const orDown=range.state==='ready'&&last<range.low;
 const candleUp=Number(latest.close)>Number(latest.open);
 const candleDown=Number(latest.close)<Number(latest.open);
 const above20=Number.isFinite(Number(indicator.sma20))&&last>Number(indicator.sma20);
 const below20=Number.isFinite(Number(indicator.sma20))&&last<Number(indicator.sma20);
 const upConfirmed=Boolean(fresh&&bullish&&orUp&&candleUp&&volumeConfirmed&&above20);
 const downConfirmed=Boolean(fresh&&bearish&&orDown&&candleDown&&volumeConfirmed&&below20);
 const status=!usable?'NO_DATA':!fresh?'WAIT_STALE':upConfirmed?'BUY_WATCH':downConfirmed?'SELL_WATCH':'WAIT';
 const candlestick=Number.isFinite(Number(prior.open))&&Number.isFinite(Number(prior.close))&&Number.isFinite(Number(latest.open))&&Number.isFinite(Number(latest.close))?
   (Number(prior.close)<Number(prior.open)&&Number(latest.close)>Number(latest.open)&&Number(latest.open)<=Number(prior.close)&&Number(latest.close)>=Number(prior.open)?'bullish-engulfing':
    Number(prior.close)>Number(prior.open)&&Number(latest.close)<Number(latest.open)&&Number(latest.open)>=Number(prior.close)&&Number(latest.close)<=Number(prior.open)?'bearish-engulfing':'none'):'unavailable';
 const observations=[
  {name:'Opening range',state:range.state==='ready'?(orUp?'breakout':orDown?'breakdown':'inside-range'):range.state,description:range.state==='ready'?'9:30–10:00 ET range; close must confirm outside the range.':range.note},
  {name:'Volume',state:volumeConfirmed?'confirmed':hasVolume?'weak':'unavailable',description:hasVolume?round(relative,2)+'× previous 20-bar average; criterion ≥1.20×.':'Zero or missing volume: no confirmation.'},
  {name:'Trend alignment',state:bullish?'bullish':bearish?'bearish':'mixed',description:'Rule-based indicator agreement '+(Number.isFinite(score)?score+'/100':'unavailable')+', not a win probability.'},
  {name:'Candle pattern',state:candlestick,description:'Engulfing patterns require subsequent confirmation; not standalone trading signals.'}
 ];
 const newsItems=Array.isArray(news?.items)?news.items.filter(v=>v&&typeof v.title==='string').slice(0,5).map(v=>({title:v.title.slice(0,160),source:String(v.source||'Publisher').slice(0,80),date:v.date,url:/^https:\/\//.test(v.url||'')?v.url:null})):[];
 const newsState=news?.state==='available'||news?.state==='partial'?news.state:'unverified';
 const recentCount=newsItems.filter(v=>{const t=Date.parse(v.date);return Number.isFinite(t)&&+now-t>=0&&+now-t<=24*3600000}).length;
 const atr=Number(indicator.atr14);
 const stopLong=range.state==='ready'?range.low:NaN;
 const stopShort=range.state==='ready'?range.high:NaN;
 const longRisk=last-stopLong,shortRisk=stopShort-last;
 const plan=upConfirmed&&longRisk>0?{direction:'long',reference_entry:round(last,4),invalidation:round(stopLong,4),illustrative_target_2r:round(last+2*longRisk,4)}:downConfirmed&&shortRisk>0?{direction:'bearish / possible exit, NOT an automatic short',reference_entry:round(last,4),invalidation:round(stopShort,4),illustrative_target_2r:round(Math.max(.01,last-2*shortRisk),4)}:null;
 return {
  symbol,interval,status,as_of:new Date(now).toISOString(),
  last_completed_bar_utc:Number.isFinite(+lastBar)?lastBar.toISOString():null,
  bar_age_minutes:Number.isFinite(age)?round(age/60_000,1):null,
  market_session:inSession?'regular-us-equity-session':'outside-regular-us-equity-session',
  source:'Twelve Data historical OHLCV (not an executable quote)',source_status:usable?'historical-verified-structure':'unavailable',
  setup_score:Number.isFinite(score)?score:null,opening_range:range,
  observations,news:{state:newsState,stories:newsItems,recent_headlines_24h:recentCount,interpretation:'Headlines are context only; no verified directional sentiment, event impact or real-time price reaction is inferred.'},
  plan,
  explanation:status==='NO_DATA'?'No valid authorized completed OHLCV bars.':status==='WAIT_STALE'?'No current confirmation: the market is closed, the daily interval is historical, or the last intraday bar is stale.':status==='BUY_WATCH'?'Conditional bullish opening-range breakout with volume and trend confirmation. Broker execution conditions and news impact remain unverified.':status==='SELL_WATCH'?'Conditional bearish opening-range breakdown with volume and trend confirmation; not a short order or a sell mandate.':'No confirmed opening-range setup. Wait for complete opening bars, volume, direction and a fresh session.',
  cautions:['Research/watch signal ONLY; not advice, a quote, or an order.','Never use indicator alignment as probability of profit.','Opening-range breakout cannot guarantee profitable trades.','No bid/ask spread, slippage, options chain, level-2/order-book depth, or broker position data verified.','Market news can be late, irrelevant or incomplete.']
 };
}
