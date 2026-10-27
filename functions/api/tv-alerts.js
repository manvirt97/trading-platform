import {userId,authError} from '../_shared/auth.js';
const reply=(obj,status=200)=>Response.json(obj,{status,headers:{'cache-control':'no-store'}});
export async function onRequestGet({request,env}){
 if(!env.TV_EVENTS||!env.TV_OWNER_UID)return reply({error:'Private TradingView alerts are not configured'},503);
 let uid;try{uid=await userId(request,env)}catch(e){return authError(e)}
 if(uid!==env.TV_OWNER_UID)return reply({error:'Private research alert feed not authorized'},403);
 const list=await env.TV_EVENTS.list({prefix:'tv:',limit:60});
 const items=[];
 for(const k of list.keys||[]){
  try{const raw=await env.TV_EVENTS.get(k.name);if(raw)items.push(JSON.parse(raw))}catch{}
 }
 items.sort((a,b)=>Date.parse(b.received_at)-Date.parse(a.received_at));
 return reply({items:items.slice(0,25),total:items.length,source:'authenticated TradingView research alerts, not verified prices or trades'});
}
