/* Dedicated autonomous PAPER bot Worker. Cron runs when all tabs are closed.
 * Deploy explicitly: npx wrangler deploy --config wrangler.bot.toml.
 * Strictly no exchange private endpoints, credentials, signing or order placement. */
import {runPaperTick,serviceReady} from '../functions/_shared/auto-bot-service.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {
 async scheduled(controller,env,ctx){
  if(controller.cron!=='* * * * *')return;
  // Disabled by default. Fail closed if secrets, D1 or service flag are absent.
  if(!serviceReady(env))return;
  ctx.waitUntil(runPaperTick(env,{source:'cron'}).then(x=>{
   if(x.status==='FEED_UNAVAILABLE')console.warn('Rangeform paper bot feed missing; no trade.');
  }).catch(e=>console.error('Autonomous PAPER bot tick failed:',String(e.message).slice(0,160))));
 },
 async fetch(request,env){
  if(new URL(request.url).pathname!=='/health'||request.method!=='GET')return json({error:'not found'},404);
  return json({worker:'rangeform-paper-bot',configured:serviceReady(env),mode:'PAPER_ONLY',execution:'NO_LIVE_BROKER_ORDERS',schedule:'UTC minute cron'});
 }
};
