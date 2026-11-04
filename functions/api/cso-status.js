/* Owner-only CSO status. No secrets, security scans or cloud permissions exposed.
 * This is a truthful posture summary, not a penetration test.
 */
import {userId,authError} from '../_shared/auth.js';
import {securityPosture} from '../_shared/cso-security.js';
const reply=(obj,code=200)=>Response.json(obj,{status:code,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function onRequestGet({request,env}){
  let uid;
  try{uid=await userId(request,env)}catch(e){return authError(e)}
  if(!env.BOT_OWNER_UID)return reply({code:'OWNER_NOT_CONFIGURED',error:'Private CSO owner verification is not configured.'},503);
  if(uid!==env.BOT_OWNER_UID)return reply({error:'CSO is accessible to the configured owner only.'},403);
  return reply({security:securityPosture(env,{ownerVerified:true}),agent_model_enabled:env.OPENAI_AGENTS_ENABLED==='on'&&Boolean(env.OPENAI_API_KEY),note:'Read-only runtime checks. This is not a complete security audit; see CI test results and security documentation.'});
}
