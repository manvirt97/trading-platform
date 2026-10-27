/* Explicit, authenticated, read-only diagnostics. Models API checks do not run
   paid Claude generations. No API key, email, bearer token or full provider
   response may be returned to the browser. */
import {userId,authError} from '../_shared/auth.js';
import {sanitizeModel,explainClaudeError} from './claude-desk.js';
const reply=(o,s=200)=>Response.json(o,{status:s,headers:{'cache-control':'no-store'}});
export async function checkClaudeAccess(env,fetcher=fetch){
 if(!env.ANTHROPIC_API_KEY||env.CLAUDE_AGENTS_ENABLED!=='on')
  return {configured:false,models:[],overall:'not-configured'};
 const roles=[
  {role:'specialist',model:sanitizeModel(env.CLAUDE_SPECIALIST_MODEL,'claude-haiku-5-5')},
  {role:'supervisor',model:sanitizeModel(env.CLAUDE_SUPERVISOR_MODEL,'claude-sonnet-5-5')}
 ];
 const models=[];
 for(const item of roles){
  try{
   const endpoint='https://api.anthropic.com/v1/models/'+encodeURIComponent(item.model);
   const response=await fetcher(endpoint,{headers:{
    'x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','accept':'application/json'
   },signal:AbortSignal.timeout(8500)});
   if(response.ok){const data=await response.json();models.push({role:item.role,model:item.model,status:'accessible',provider_model:String(data.id||item.model).slice(0,90)});}
   else {
    const description=explainClaudeError(response.status,await response.text(),response.headers.get('request-id'));
    models.push({role:item.role,model:item.model,status:'unavailable',http_status:response.status,code:description.kind,reason:description.message});
   }
  }catch(e){models.push({role:item.role,model:item.model,status:'unavailable',code:'MODEL_CHECK_UNAVAILABLE',reason:'Could not reach the Anthropic Models API to verify access. Confirm network connectivity and retry.'});}
 }
 return {configured:true,models,overall:models.every(x=>x.status==='accessible')?'models-accessible':'needs-attention',
  note:'Model access alone does not confirm that a generation request will succeed or that API billing is active.'};
}
export async function onRequestGet({request,env}){
 if(!env.ANTHROPIC_API_KEY||env.CLAUDE_AGENTS_ENABLED!=='on')
  return reply({error:'Claude is not configured. Set a private Anthropic API key and enable agents in Cloudflare.',code:'CLAUDE_NOT_CONFIGURED'},503);
 if(!env.DB)return reply({error:'Private account support is not configured.',code:'DB_REQUIRED'},503);
 try{await userId(request,env)}catch(e){return authError(e)}
 const result=await checkClaudeAccess(env);
 return reply(result,result.overall==='models-accessible'?200:503);
}
