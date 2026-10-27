/* TradingView -> Rangeform: strictly inbound, research alerts only.
   Requires a dedicated webhook token, IP allowlist and bound KV namespace.
   NEVER initiates orders or trusts webhook price as verified OHLCV. */
import {validateSymbol} from '../_shared/core.js';
const ips=new Set(['52.89.214.238','34.212.75.30','54.218.53.128','52.32.178.7']);
const reply=(obj,status=200)=>Response.json(obj,{status,headers:{'cache-control':'no-store'}});
export const isTradingViewIp=ip=>ips.has(String(ip||''));
export const secureEqual=(a,b)=>{
 const x=String(a||''),y=String(b||'');
 let diff=x.length^y.length;
 const length=Math.max(x.length,y.length);
 for(let i=0;i<length;i++)diff|=(x.charCodeAt(i)||0)^(y.charCodeAt(i)||0);
 return diff===0;
};
export async function onRequestPost({request,env}){
 if(!env.TRADINGVIEW_WEBHOOK_TOKEN||!env.TV_EVENTS)return reply({error:'TradingView receiver not configured'},503);
 if(!isTradingViewIp(request.headers.get('CF-Connecting-IP')))return reply({error:'Not a permitted TradingView sender'},403);
 const type=request.headers.get('content-type')||'';
 if(!type.startsWith('application/json'))return reply({error:'Valid JSON TradingView alert required'},415);
 const raw=await request.text();
 if(raw.length>1500)return reply({error:'Webhook message too large'},413);
 let event;try{event=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
 if(String(env.TRADINGVIEW_WEBHOOK_TOKEN).length<32||!secureEqual(event.auth,env.TRADINGVIEW_WEBHOOK_TOKEN))
  return reply({error:'Webhook verification failed'},401);
 let symbol;try{symbol=validateSymbol(String(event.symbol||''))}catch{return reply({error:'Invalid symbol'},400)}
 const side=String(event.action||'').toUpperCase();
 if(!['BUY_WATCH','SELL_WATCH','BUY','SELL','WAIT'].includes(side))return reply({error:'Unsupported watch action'},400);
 const eventId=String(event.id||'').trim();
 if(!/^[A-Za-z0-9_.:-]{8,120}$/.test(eventId))return reply({error:'Provide a stable unique event ID of 8–120 characters'},400);
 const ts=Date.parse(event.time||'');
 if(!Number.isFinite(ts)||Math.abs(Date.now()-ts)>5*60000)return reply({error:'TradingView alert timestamp missing, old or in the future'},400);
 const key='tv:'+String(ts).padStart(13,'0')+':'+eventId;
 const exists=await env.TV_EVENTS.get(key);
 if(exists)return reply({accepted:true,duplicate:true,execution:false});
 const safe={id:eventId,symbol,action:side,alert_time:new Date(ts).toISOString(),
   received_at:new Date().toISOString(),chart_interval:String(event.interval||'').slice(0,20),
   source:'tradingview-webhook',verified_market_data:false,execution:false,
   description:'External chart alert only. Recheck all prices and safety gates through the licensed market-data endpoint.'};
 await env.TV_EVENTS.put(key,JSON.stringify(safe),{expirationTtl:172800});
 return reply({accepted:true,duplicate:false,execution:false});
}
