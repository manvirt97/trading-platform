/* Historical NIFTY options analysis only. A strategy signal cannot become an order. */
import { runNiftyOptionBacktest, DEFAULT_OPTION_COSTS } from '../_shared/nifty-options.js';
import { json } from '../_shared/http.js';
export async function onRequestGet() {
 return json({
  name:'NIFTY 9/21 EMA Options Trade Audit',status:'AWAITING_HISTORICAL_DATA',
  modes:['itm5_buy','atm_buy','atm_sell'],
  timeframes:[5,15,30],signal_source:'NIFTY SPOT one-minute OHLCV',
  option_data:'One-minute option contract OHLCV per strike and expiry; NEVER derived from spot',
  required:['spot_bars','option_bars'],cost_assumptions:DEFAULT_OPTION_COSTS,
  live_trading_enabled:false,broker_orders:false,
  evidence:'No results are shown until actual spot and contract history are provided.'
 });
}
export async function onRequestPost({request}) {
 if(!request.headers.get('content-type')?.includes('application/json'))
  return json({error:'Expected JSON request.',code:'INVALID_CONTENT_TYPE'},415);
 const size=Number(request.headers.get('content-length')||'0');
 if(size>4_000_000)return json({error:'Data upload exceeds 4 MB. Split by trading session.',code:'DATA_TOO_LARGE'},413);
 let body;
 try {
  const raw=await request.text();
  if(raw.length>4_000_000)return json({error:'Data upload exceeds 4 MB. Split by trading session.',code:'DATA_TOO_LARGE'},413);
  body=JSON.parse(raw);
 } catch {return json({error:'Malformed historical-data request.',code:'INVALID_JSON'},400)}
 try {
  return json(runNiftyOptionBacktest(body));
 } catch(e) {
  return json({error:String(e.message||'Research test rejected').slice(0,280),
   code:'HISTORICAL_BACKTEST_REJECTED',broker_orders:false},400);
 }
}
