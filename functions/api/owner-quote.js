import {userId,authError} from '../_shared/auth.js';
import {checkOwnerQuote,ownerQuoteConfiguration} from '../_shared/owner-quote.js';
const respond=(value,status=200,extra={})=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
export async function onRequestGet({request,env}){
 const url=new URL(request.url),symbol=(url.searchParams.get('symbol')||'').trim().toUpperCase();
 // Don't call an external provider until all secrets and private-owner controls exist.
 const config=ownerQuoteConfiguration(env);
 if(!config.configured)return respond({error:'Quote verification is not enabled for this project owner. Set the private Alpaca keys, owner UID and enable flag in Cloudflare.',code:'QUOTE_NOT_CONFIGURED'},503);
 let uid;try{uid=await userId(request,env)}catch(e){return authError(e)}
 if(uid!==env.TRADING_QUOTE_OWNER_UID)return respond({error:'Only the authorized project owner may test licensed market-data quotes.',code:'OWNER_ONLY'},403);
 try{return respond(await checkOwnerQuote(env,symbol,uid))}
 catch(e){return respond({error:String(e.message||'Quote check unavailable').slice(0,235),code:e.code||'QUOTE_CHECK_FAILED',retry_after_seconds:e.retryAfter||null},e.httpStatus||503,e.retryAfter?{'retry-after':String(e.retryAfter)}:{})}
}
