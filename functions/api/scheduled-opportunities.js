import {userId,authError} from '../_shared/auth.js';
const reply=(o,n=200)=>Response.json(o,{status:n,headers:{'cache-control':'no-store'}});
export async function onRequestGet({request,env}){
 if(!env.SCANNER_SNAPSHOTS)return reply({error:'Background scanner is not connected. Deploy the optional Worker with the shared KV namespace.',code:'SCANNER_NOT_DEPLOYED'},503);
 let uid;try{uid=await userId(request,env)}catch(e){return authError(e)}
 if(!uid)return reply({error:'Sign in required'},401);
 const raw=await env.SCANNER_SNAPSHOTS.get('latest:leaders');
 if(!raw)return reply({error:'No verified scheduled snapshot available. Scanning may be outside regular hours.',code:'NO_SCAN_YET'},404);
 let data;try{data=JSON.parse(raw)}catch{return reply({error:'Invalid snapshot'},503)}
 return reply({...data,delivery:'snapshot only; data may be delayed; never broker-executable'});
}
