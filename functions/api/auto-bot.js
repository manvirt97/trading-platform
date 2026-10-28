// Owner-authenticated paper bot controls: Firebase ID-token verified on server.
// Never accepts broker API keys or issues live exchange orders.
import {userId,authError} from '../_shared/auth.js';
import {serviceReady,snapshot,controlBot,runPaperTick} from '../_shared/auto-bot-service.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
async function authorize(request,env){
 if(!serviceReady(env))return {error:reply({code:'NOT_CONFIGURED',error:'Set BOT_OWNER_UID and BOT_SERVICE_ENABLED=on in Cloudflare Pages, and bind the existing D1 database. The scheduled Worker must be separately deployed.'},503)};
 try{const uid=await userId(request,env);if(uid!==env.BOT_OWNER_UID)return {error:reply({error:'Only the configured owner can manage this bot.'},403)};return {uid}}
 catch(e){return {error:authError(e)}}
}
export async function onRequestGet({request,env}){
 const access=await authorize(request,env);if(access.error)return access.error;
 try{
  const saved=await snapshot(env.DB);
  return reply({mode:'PAPER_ONLY',state:saved.state,revision:saved.revision,background_scheduler:'SEPARATE_WORKER_REQUIRED',broker_connected:false,live_orders_enabled:false});
 }catch(e){return reply({code:'STATE_UNAVAILABLE',error:String(e.message).slice(0,140)},503)}
}
export async function onRequestPost({request,env}){
 const access=await authorize(request,env);if(access.error)return access.error;
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return reply({error:'Cross-origin controls refused'},403);
 if(Number(request.headers.get('content-length')||0)>2000)return reply({error:'Request too large'},413);
 let data;try{data=await request.json()}catch{return reply({error:'Expected JSON body'},400)}
 if(!data||typeof data!=='object'||typeof data.action!=='string')return reply({error:'Missing action'},400);
 try{
  if(data.action==='run_once'){
   const result=await runPaperTick(env);
   return reply({...result,live_orders_enabled:false});
  }
  if(!['start','pause','reset','flatten'].includes(data.action))return reply({error:'Unsupported control'},400);
  const result=await controlBot(env,data.action,{capital:data.capital});
  return reply({ok:true,...result,live_orders_enabled:false});
 }catch(e){return reply({error:String(e.message).slice(0,180)},/Concurrent update/.test(e.message)?409:400)}
}
