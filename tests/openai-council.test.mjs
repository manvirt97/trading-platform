import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLES,CSO,SUPERVISOR,ALLOWED_MODES,parseAgentResponse,callOpenAIAgent,enforceFinalDecision,researchEvidence} from '../functions/_shared/openai-council.js';
import {securityPosture} from '../functions/_shared/cso-security.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const configured={DB:{},BOT_OWNER_UID:'owner-example',OPENAI_API_KEY:'test-only-do-not-use',OPENAI_AGENTS_ENABLED:'on'};
const mockReply={model:'gpt-6-luna',output:[{content:[{type:'output_text',text:JSON.stringify({assessment:'Stale bar: wait.',uncertainty:'No spread data.',stance:'WAIT'})}]}],usage:{input_tokens:140,output_tokens:45}};
test('11 distinct AI roles plus separate CSO and supervisor with full and focused budgets',()=>{
 assert.equal(ROLES.length,11);
 assert.equal(new Set(ROLES.map(x=>x.id)).size,11);
 assert.equal(ALLOWED_MODES.full.length,11);
 assert.equal(ALLOWED_MODES.focused.length,4);
 assert.equal(CSO.id,'cso');
 assert.equal(SUPERVISOR.id,'supervisor');
});
test('deterministic security gate refuses empty credentials and reports only booleans',()=>{
 const absent=securityPosture({}, {ownerVerified:false});
 assert.equal(absent.research_ready,false);
 assert.equal(absent.live_orders_enabled,false);
 assert.equal(absent.trading_approved,false);
 const ready=securityPosture(configured,{ownerVerified:true});
 assert.equal(ready.research_ready,true);
 assert.equal(ready.checks.find(x=>x.id==='execution').state,'restricted');
 assert.equal(JSON.stringify(ready).includes(configured.OPENAI_API_KEY),false);
});
test('model cannot change hard WAIT or enable trade orders even if it claims confidence',()=>{
 const room={verdict:'BUY_WATCH',vetoes:[{agent:'Freshness',reason:'Old bar'}]};
 const decision=enforceFinalDecision(room,{status:'BUY_WATCH'},securityPosture(configured,{ownerVerified:true}));
 assert.equal(decision.research_verdict,'WAIT');
 assert.equal(decision.execution,'NO_ORDER');
 assert.equal(decision.live_orders_enabled,false);
 assert.equal(decision.paper_orders_enabled,false);
 assert.equal(enforceFinalDecision({verdict:'BUY_WATCH',vetoes:[]},{status:'WAIT'},securityPosture(configured,{ownerVerified:true})).research_verdict,'WAIT');
});
test('OpenAI Responses API request is bounded and never stores user data or exposes API key',async()=>{
 let url,opts;
 const fetchImpl=async(u,o)=>{url=u;opts=o;return new Response(JSON.stringify(mockReply),{status:200})};
 const result=await callOpenAIAgent(configured,ROLES[0],{symbol:'SPY',market_session:'closed'},{model:'gpt-6-luna',fetchImpl});
 assert.equal(result.stance,'WAIT');
 assert.equal(result.usage.input,140);
 assert.equal(url,'https://api.openai.com/v1/responses');
 assert.equal(opts.headers.Authorization,'Bearer '+configured.OPENAI_API_KEY);
 const payload=JSON.parse(opts.body);
 assert.equal(payload.store,false);
 assert.equal(payload.max_output_tokens,480);
 assert.equal(payload.text.format.strict,true);
 assert.equal(payload.tools,undefined);
 assert.equal(JSON.stringify(payload).includes(configured.OPENAI_API_KEY),false);
});
test('malformed AI output and unsupported stance are rejected',()=>{
 assert.throws(()=>parseAgentResponse({output:[{content:[{type:'output_text',text:'not json'}]}]}),/valid JSON/);
 assert.throws(()=>parseAgentResponse({output:[{content:[{type:'output_text',text:'{"assessment":"A","uncertainty":"B","stance":"BUY_NOW"}'}]}]}),/validation/);
});
test('news and price evidence stays server-derived, compact and explicitly unverified for execution',()=>{
 const evidence=researchEvidence({symbol:'SPY',interval:'5min',source:'twelvedata',indicators:{rsi:50},bar_history:[]},{status:'WAIT',opening_range:{state:'incomplete'}},{verdict:'WAIT',agents:[],vetoes:[]},{state:'unverified',items:[]});
 assert.equal(evidence.calibrated_forecast_available,false);
 assert.equal(evidence.executable_bid_ask_verified,false);
 assert.equal(evidence.broker_orders_available,false);
});
test('owner-only endpoints and UI use signed ID token and paid click confirmation',()=>{
 for(const path of ['functions/api/openai-council.js','functions/api/cso-status.js']){
  const s=read(path);
  assert.match(s,/userId\(request,env\)/);
  assert.match(s,/BOT_OWNER_UID/);
 }
 const api=read('functions/api/openai-council.js');
 assert.match(api,/quota\(env\.DB/);
 assert.match(api,/record\(env\.DB/);
 assert.match(api,/OPENAI_COUNCIL_DISABLED/);
 const ui=read('public/static/openai-council.js');
 assert.match(ui,/confirm\(/);
 assert.match(ui,/getIdToken\(\)/);
 assert.doesNotMatch(ui,/innerHTML/);
 const html=read('public/agent-team.html');
 for(const id of ['csoBadge','csoChecks','runOpenAICouncil','councilMode','councilResults'])assert.match(html,new RegExp('id="'+id+'"'));
});
