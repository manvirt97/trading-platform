import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {explainClaudeError,onRequestPost} from '../functions/api/claude-desk.js';
import {checkClaudeAccess,onRequestGet} from '../functions/api/claude-health.js';
import {onRequestGet as status} from '../functions/api/status.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Anthropic HTTP 400 identifies request errors without leaking a secret',()=>{
 const err=explainClaudeError(400,JSON.stringify({error:{type:'invalid_request_error',message:'thinking.type.disabled invalid; sk-test-secret-123456789 hello@example.com'}}),'req_9z');
 assert.equal(err.kind,'CLAUDE_THINKING_CONFIG');
 assert.equal(err.reference,'req_9z');
 assert.match(err.message,/HTTP 400/);
 assert.match(err.message,/thinking|output-effort/i);
 assert.doesNotMatch(err.message,/sk-test-secret-123456789|hello@example.com/);
 assert.match(err.message,/\[redacted\]/);
});
test('Provider model-configuration failures and billing failures are explicit',()=>{
 assert.equal(explainClaudeError(400,JSON.stringify({error:{message:'model: claude-x unsupported'}})).kind,'CLAUDE_MODEL_CONFIG');
 assert.equal(explainClaudeError(402,'{}').kind,'CLAUDE_BILLING');
 assert.equal(explainClaudeError(401,'{}').kind,'CLAUDE_ACCESS');
 assert.equal(explainClaudeError(429,'{}').kind,'CLAUDE_RATE_LIMIT');
});
test('Read-only Claude diagnostic tests both model IDs with no paid /messages call',async()=>{
 const urls=[];
 const fetcher=async(url,options)=>{
  urls.push(String(url));
  assert.equal(options.headers['x-api-key'],'test-private-key');
  assert.match(String(url),/\/v1\/models\//);
  if(String(url).endsWith('claude-haiku-5-5'))return Response.json({id:'claude-haiku-5-5'});
  return Response.json({error:{message:'No model access'}},{status:404});
 };
 const result=await checkClaudeAccess({ANTHROPIC_API_KEY:'test-private-key',CLAUDE_AGENTS_ENABLED:'on'},fetcher);
 assert.equal(urls.length,2);
 assert.equal(result.models[0].status,'accessible');
 assert.equal(result.models[1].http_status,404);
 assert.equal(result.overall,'needs-attention');
 assert.doesNotMatch(JSON.stringify(result),/test-private-key/);
});
test('A fully accessible Models API produces a narrow configuration result, not an execution claim',async()=>{
 const fetcher=async url=>Response.json({id:decodeURIComponent(new URL(url).pathname.split('/').at(-1))});
 const result=await checkClaudeAccess({ANTHROPIC_API_KEY:'private',CLAUDE_AGENTS_ENABLED:'on'},fetcher);
 assert.equal(result.overall,'models-accessible');
 assert.match(result.note,/does not confirm/);
 const absent=await checkClaudeAccess({});
 assert.equal(absent.overall,'not-configured');
});
test('Unauthenticated and unconfigured Claude endpoints fail closed',async()=>{
 const request=new Request('https://example.com/api/claude-desk',{method:'POST'});
 const res=await onRequestPost({request,env:{}});
 assert.equal(res.status,503);assert.equal((await res.json()).code,'CLAUDE_NOT_CONFIGURED');
 const check=await onRequestGet({request:new Request('https://example.com/api/claude-health'),env:{}});
 assert.equal(check.status,503);
});
test('TradingView needs a token, KV namespace and private owner; scanner binding is distinct',async()=>{
 const k={get:async()=>null};
 const partial=(await status({env:{TRADINGVIEW_WEBHOOK_TOKEN:'secure',TV_EVENTS:k}}));
 const payload=await partial.json();
 assert.equal(payload.tradingview_bridge_configured,false);
 assert.equal(payload.tradingview_components.private_owner,false);
 assert.equal(payload.scheduled_scanner_storage_bound,false);
 const ready=await status({env:{TRADINGVIEW_WEBHOOK_TOKEN:'secure',TV_EVENTS:k,TV_OWNER_UID:'private-uid',SCANNER_SNAPSHOTS:k}});
 const data=await ready.json();
 assert.equal(data.tradingview_bridge_configured,true);
 assert.equal(data.scheduled_scanner_storage_bound,true);
 assert.equal(data.app_version,'V14');
 assert.doesNotMatch(JSON.stringify(data),/secure|private-uid/);
});
test('Unified palette uses one theme across sidebar, workspace, news and studio',()=>{
 const html=read('public/v9.html'),css=read('public/static/v14-unified.css');
 assert.ok(html.indexOf('v14-unified.css?v=1')>html.indexOf('v13-premium.css?v=1'));
 assert.match(css,/body\[data-theme="light"\]/);
 assert.match(css,/body\[data-theme="dark"\]/);
 assert.match(css,/body \.sidebar \{/);
 assert.match(css,/body \.topbar \{/);
 assert.match(css,/body \.studio-work/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(html,/data-page="settings"/);
 assert.match(html,/id="checkClaudeHealth"/);
});
test('Optional integrations are moved off trade-signal desk and have honest readiness gates',()=>{
 const html=read('public/v9.html'),js=read('public/static/v9-ai.js');
 const shortcut=html.indexOf('integrations-shortcut'),card=html.indexOf('integrations-card'),settings=html.indexOf('data-section="settings"');
 assert.ok(shortcut>0&&settings>shortcut&&card>settings);
 assert.match(html,/id="tvRefresh"[^>]*disabled/);
 assert.match(html,/id="cronRefresh"[^>]*disabled/);
 assert.match(js,/tradingview_bridge_configured/);
 assert.match(js,/scheduled_scanner_storage_bound/);
 assert.match(js,/tvRefresh'\)\.disabled=!tv/);
 assert.match(js,/cronRefresh'\)\.disabled=!scanner/);
 assert.match(js,/\/api\/claude-health/);
 assert.match(html,/Set up TradingView securely/);
 assert.match(html,/Set up scheduled market scans/);
});
