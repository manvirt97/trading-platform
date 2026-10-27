// Passive operational status. Does not spend any Twelve Data credits.
import {readTwelveState} from '../_shared/provider-quota.js';
import {json} from '../_shared/http.js';
export async function onRequestGet({env}){
 const state=await readTwelveState(env);
 return json({provider:'Twelve Data',...state,data_type:'completed historical OHLCV',real_time_verified:false,
  guidance:state.state==='rate-limited'?'Provider credit limit reached. Stop refreshing until the retry window ends.':state.state==='responding'?'Provider previously returned dated bars. The display does not confirm streaming exchange quotes.':'An enabled API key is not proof of a successful provider request.'},200);
}
