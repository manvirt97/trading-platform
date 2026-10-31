// Rangeform private gateway to the original 11 Python research skills.
// Service stays OFF until a dedicated HTTPS Python host and owner secrets exist.
// No public proxy to arbitrary URLs and NO brokerage execution.
import {userId,authError} from '../_shared/auth.js';
import {json} from '../_shared/http.js';

const allowed = new Set(['scanner','news','entry','exit','timemachine','budget','risk','broker','alerts','analyst','pelosi']);
const symbolOK=s=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(s);

export async function onRequestPost({request,env}){
 if(env.PY_SKILLS_ENABLED!=='on'||!env.PY_SKILLS_TOKEN||!env.PY_SKILLS_ORIGIN||!env.PY_SKILLS_OWNER_UID){
  return json({error:'Original Python research service has not been deployed or owner-authorized.',code:'NOT_CONFIGURED',broker_orders:false},503);
 }
 let owner;
 try{owner=await userId(request,env)}catch(e){return authError(e)}
 if(owner!==env.PY_SKILLS_OWNER_UID)return json({error:'This research service is available only to its authorized owner.',code:'OWNER_ONLY'},403);
 if(request.headers.get('Origin')&&new URL(request.headers.get('Origin')).origin!==new URL(request.url).origin)
  return json({error:'Cross-origin requests are not accepted.'},403);
 let endpoint;
 try{
  const origin=new URL(env.PY_SKILLS_ORIGIN);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||
   !/^[a-z0-9.-]+$/i.test(origin.hostname))throw Error();
  endpoint=new URL('/run',origin);
 }catch{return json({error:'Private Python service HTTPS origin is invalid.',code:'INVALID_CONFIGURATION'},503)}
 let data;
 try{
  const raw=await request.text();
  if(raw.length>8192)return json({error:'Request too large.'},413);
  data=JSON.parse(raw);
  if(!data||typeof data!=='object'||Array.isArray(data)||!allowed.has(data.skill))
   throw Error('Choose an allowed original Python research tool.');
  if(data.skill!=='pelosi'&&!symbolOK(String(data.symbol||'').trim().toUpperCase()))
   throw Error('Enter a valid stock symbol.');
 }catch(e){return json({error:e.message||'Invalid JSON request.',broker_orders:false},400)}
 try{
  const response=await fetch(endpoint.toString(),{
   method:'POST',
   headers:{'authorization':'Bearer '+env.PY_SKILLS_TOKEN,'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify(data),
   signal:AbortSignal.timeout(78000),
   redirect:'error'
  });
  const raw=await response.text();
  if(raw.length>60000)return json({error:'Research service response exceeded safety limits.',code:'INVALID_RESPONSE'},502);
  let result;
  try{result=JSON.parse(raw)}catch{return json({error:'Research service returned an invalid response.',code:'INVALID_RESPONSE'},502)}
  if(result?.broker_orders!==false && response.ok)return json({error:'Remote safety contract mismatch. No result accepted.',code:'SAFETY_BLOCK'},502);
  return json(result,response.status);
 }catch{
  return json({error:'Original Python research service unavailable or timed out. No trading action occurred.',code:'BACKEND_UNAVAILABLE',broker_orders:false},503);
 }
}
