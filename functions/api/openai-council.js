/* Rangeform OpenAI council v1.
 * Real, separately invoked OpenAI research roles + CSO + supervisor.
 * Owner-authenticated and quota limited, no model controls broker orders.
 * Per-role outputs contain no market-order tool and never alter the deterministic gate.
 */
import {userId,authError} from '../_shared/auth.js';
import {getData} from '../_shared/http.js';
import {analyze,validateSymbol} from '../_shared/core.js';
import {evaluateOpportunity} from '../_shared/opportunity.js';
import {runAgentRoom} from '../_shared/agent-room.js';
import {runAgentTeam} from '../_shared/agent-team.js';
import {onRequestGet as getNews} from './news.js';
import {securityPosture} from '../_shared/cso-security.js';
import {ROLES,CSO,SUPERVISOR,ALLOWED_MODES,researchEvidence,callOpenAIAgent,enforceFinalDecision} from '../_shared/openai-council.js';

const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const today=()=>new Date().toISOString().slice(0,10);
const models=Object.freeze({specialist:'gpt-6-luna',supervisor:'gpt-6.1-terra',cso:'gpt-6-luna'});
async function owner(request,env){
  let uid;try{uid=await userId(request,env)}catch(e){return {error:authError(e)}}
  if(!env.BOT_OWNER_UID)return {error:reply({error:'Private owner configuration is missing.',code:'OWNER_NOT_CONFIGURED'},503)};
  if(uid!==env.BOT_OWNER_UID)return {error:reply({error:'OpenAI council is owner-only.'},403)};
  return {uid};
}
async function record(db,uid,symbol,mode,state,usage={input:0,output:0}){
  await db.prepare('INSERT INTO rangeform_ai_council_audit(uid,created_at,symbol,mode,status,model_input_tokens,model_output_tokens) VALUES(?,?,?,?,?,?,?)')
    .bind(uid,new Date().toISOString(),symbol,mode,state,usage.input,usage.output).run();
}
async function quota(db,uid,mode){
  const key='openai_council_'+mode+'_'+uid,limit=mode==='full'?1:3;
  const result=await db.prepare('INSERT INTO ai_allowance(uid,day,calls) VALUES(?,?,1) ON CONFLICT(uid,day) DO UPDATE SET calls=calls+1 WHERE calls<?')
    .bind(key,today(),limit).run();
  if(!result?.meta?.changes)return 'Daily owner limit reached: '+limit+' '+mode+' investigation(s).';
  const global=await db.prepare('INSERT INTO ai_allowance(uid,day,calls) VALUES(?,?,1) ON CONFLICT(uid,day) DO UPDATE SET calls=calls+1 WHERE calls<?')
    .bind('__openai_council_'+mode+'_global__',today(),mode==='full'?8:24).run();
  if(!global?.meta?.changes)return 'Shared OpenAI investigation limit reached for today.';
  return null;
}
async function newsFor(request,symbol){
  try{
    const url=new URL('/api/news',request.url);
    url.search=new URLSearchParams({q:symbol,category:'all',region:'US'}).toString();
    const response=await getNews({request:new Request(url.toString())});
    if(response.ok){
      const data=await response.json();
      return {state:data.availability||'unverified',items:(data.items||[]).slice(0,4)};
    }
  }catch{/* Missing news never becomes invented sentiment. */}
  return {state:'unverified',items:[]};
}
export async function onRequestGet({request,env}){
  const access=await owner(request,env);if(access.error)return access.error;
  const security=securityPosture(env,{ownerVerified:true});
  return reply({configured:security.research_ready,security,available_modes:Object.keys(ALLOWED_MODES),models,
    limitation:'Separate OpenAI API billing required; this is not included in a ChatGPT subscription. No brokerage orders.'});
}
export async function onRequestPost({request,env}){
  const access=await owner(request,env);if(access.error)return access.error;
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)return reply({error:'Cross-origin control refused.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
  if(Number(request.headers.get('content-length')||0)>1500)return reply({error:'Request too large.'},413);
  const raw=await request.text();if(raw.length>1500)return reply({error:'Request too large.'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON body.'},400)}
  const mode=String(body.mode||'focused');
  if(!Object.hasOwn(ALLOWED_MODES,mode))return reply({error:'Choose focused or full mode.'},400);
  let symbol;try{symbol=validateSymbol(String(body.symbol||''))}catch(e){return reply({error:String(e.message).slice(0,100)},400)}
  const interval=String(body.interval||'5min');
  if(!['1min','5min','15min'].includes(interval))return reply({error:'Unsupported intraday interval.'},400);
  const security=securityPosture(env,{ownerVerified:true});
  if(!security.research_ready)return reply({code:'OPENAI_COUNCIL_DISABLED',error:'Private OpenAI council configuration is incomplete. Set the server-side OpenAI secret, feature flag and D1 owner controls.',security},503);

  let analysis,opportunity,room,team,news;
  try{
    const rawBars=await getData(request,env,{symbol,interval,source:'twelvedata'});
    analysis=analyze(rawBars.bars,symbol,rawBars.meta);
    news=await newsFor(request,symbol);
    opportunity=evaluateOpportunity(analysis,news);
    room=runAgentRoom(analysis,opportunity);
    team=runAgentTeam(analysis,opportunity,room);
  }catch(e){return reply({code:'MARKET_FEED_UNAVAILABLE',error:'Verified market data unavailable; AI agents did not run. '+String(e.message||'').slice(0,130)},503)}

  const decision=enforceFinalDecision(room,opportunity,security);
  try{
    // Check required migration BEFORE reserving a daily paid-call allowance.
    await env.DB.prepare('SELECT id FROM rangeform_ai_council_audit LIMIT 1').first();
  }catch{return reply({code:'COUNCIL_AUDIT_UNAVAILABLE',error:'Private AI audit storage missing. Apply the D1 migration before paid model calls.'},503)}
  try{
    const denied=await quota(env.DB,access.uid,mode);
    if(denied)return reply({code:'AI_DAILY_LIMIT',error:denied},429);
    await record(env.DB,access.uid,symbol,mode,'STARTED');
  }catch{return reply({code:'COUNCIL_AUDIT_UNAVAILABLE',error:'AI usage counter or audit recording unavailable. No AI call was started.'},503)}
  const evidence=researchEvidence(analysis,opportunity,room,news);
  const selected=ROLES.filter(r=>ALLOWED_MODES[mode].includes(r.id));
  const specialistResults=[];
  let anyFailure=false;
  // Preflight validates that model permissions and billing work before fan-out.
  let first;
  try{first=await callOpenAIAgent(env,selected[0],evidence,{model:models.specialist})}
  catch(e){
    try{await record(env.DB,access.uid,symbol,mode,'MODEL_UNAVAILABLE')}catch{}
    return reply({code:'OPENAI_PREFLIGHT_FAILED',error:String(e.message).slice(0,200),decision,security},502);
  }
  specialistResults.push({id:selected[0].id,name:selected[0].name,state:'completed',...first});
  // Bounded batches: no uncontrolled parallel API fan-out.
  for(let i=1;i<selected.length;i+=3){
    const batch=await Promise.all(selected.slice(i,i+3).map(async role=>{
      try{return {id:role.id,name:role.name,state:'completed',...(await callOpenAIAgent(env,role,evidence,{model:models.specialist}))}}
      catch{return {id:role.id,name:role.name,state:'unavailable',assessment:'Model request unavailable; no conclusion was invented.',uncertainty:'AI provider failure or timeout.',stance:'ABSTAIN'}}
    }));
    if(batch.some(x=>x.state!=='completed'))anyFailure=true;
    specialistResults.push(...batch);
  }
  let csoReport;
  try{csoReport={id:'cso',name:CSO.name,state:'completed',...(await callOpenAIAgent(env,CSO,{
    security,
    known_limits:['No GitHub/Cloudflare audit log inspection by this model','No dependency vulnerability scan in this request','No direct access to secrets','No independent penetration testing'],
    financial_execution:'disabled'
  },{model:models.cso}))}}
  catch{csoReport={id:'cso',name:CSO.name,state:'unavailable',assessment:'CSO model call unavailable. Deterministic security gate remains in force.',uncertainty:'Provider or billing may be unavailable.',stance:'ABSTAIN'};anyFailure=true}
  let supervisor;
  try{
    supervisor={id:'supervisor',name:SUPERVISOR.name,state:'completed',...(await callOpenAIAgent(env,SUPERVISOR,{
      deterministic_final_decision:decision,
      research:{symbol,interval,evidence_status:opportunity.status,bar_time:analysis.last_bar_utc},
      specialist_reports:specialistResults.map(r=>({name:r.name,state:r.state,assessment:r.assessment?.slice(0,330),uncertainty:r.uncertainty?.slice(0,200)})),
      cso:{hard_gate:security.research_ready,report_state:csoReport.state,assessment:csoReport.assessment?.slice(0,450)}
    },{model:models.supervisor,maxTokens:650}))};
  }catch{supervisor={id:'supervisor',name:SUPERVISOR.name,state:'unavailable',assessment:'Supervisor AI response unavailable. Deterministic verdict stands.',uncertainty:'Provider failure.',stance:'ABSTAIN'};anyFailure=true}
  const usage=[...specialistResults,csoReport,supervisor].reduce((sum,r)=>({input:sum.input+(r.usage?.input||0),output:sum.output+(r.usage?.output||0)}),{input:0,output:0});
  try{await record(env.DB,access.uid,symbol,mode,anyFailure?'PARTIAL':'COMPLETED',usage)}
  catch{/* Already recorded STARTED. Report missing final audit status without exposing data. */}
  const omitted=ROLES.filter(x=>!ALLOWED_MODES[mode].includes(x.id)).map(x=>({id:x.id,name:x.name,state:'not-run',assessment:'Focused mode skips this specialist to limit API usage.'}));
  return reply({
    mode:'OPENAI_RESEARCH_ONLY',investigation:mode,
    symbol,interval,as_of:new Date().toISOString(),
    specialist_model:models.specialist,supervisor_model:models.supervisor,
    specialists:[...specialistResults,...omitted],
    cso:csoReport,supervisor,
    security,decision,existing_rule_team:team,
    usage,
    partial:anyFailure,
    limitation:'AI reasoning is not a verified forecast; missing data requires abstention. 0 brokerage or paper orders were placed. AI calls may incur separate API charges.'
  });
}
