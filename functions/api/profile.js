import {userId,authError} from '../_shared/auth.js';
const response=(x,status=200)=>Response.json(x,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
function clean(v,n=80){return String(v??'').trim().slice(0,n)}
async function who(request,env){if(!env.DB)return {error:response({error:'Accounts not activated. Configure a dedicated D1 database and Firebase Authentication first.'},503)};try{return {uid:await userId(request,env)}}catch(e){return {error:authError(e)}}}
export async function onRequestGet({request,env}){const a=await who(request,env);if(a.error)return a.error;try{
 let p=await env.DB.prepare('SELECT nickname,region,timezone,risk_profile,watchlist_json,updated_at FROM profiles WHERE uid=?').bind(a.uid).first();
 let rows=await env.DB.prepare('SELECT id,symbol,kind,note,created_at FROM research_history WHERE uid=? ORDER BY created_at DESC LIMIT 100').bind(a.uid).all();
 return response({profile:p?{...p,watchlist:JSON.parse(p.watchlist_json||'[]')}:null,history:rows.results||[]})
 }catch{return response({error:'Workspace database not initialized. Apply the provided SQL migration.'},503)}}
export async function onRequestPost({request,env}){const a=await who(request,env);if(a.error)return a.error;if(!request.headers.get('content-type')?.includes('application/json'))return response({error:'JSON required'},415);
 const body=await request.text();if(body.length>8000)return response({error:'Too much data'},413);let data;try{data=JSON.parse(body)}catch{return response({error:'Invalid JSON'},400)}
 try{
 if(data.action==='saveProfile'){
 const nickname=clean(data.nickname,40),region=['US','CA','GLOBAL'].includes(data.region)?data.region:'CA',timezone=clean(data.timezone,60),risk=['learning','conservative','moderate'].includes(data.risk_profile)?data.risk_profile:'learning';
 const watchlist=Array.isArray(data.watchlist)?[...new Set(data.watchlist.map(x=>clean(x,12).toUpperCase()).filter(x=>/^[A-Z0-9._-]{1,12}$/.test(x)))].slice(0,25):[];
 await env.DB.prepare("INSERT INTO profiles(uid,nickname,region,timezone,risk_profile,watchlist_json,updated_at) VALUES(?,?,?,?,?,?,datetime('now')) ON CONFLICT(uid) DO UPDATE SET nickname=excluded.nickname,region=excluded.region,timezone=excluded.timezone,risk_profile=excluded.risk_profile,watchlist_json=excluded.watchlist_json,updated_at=datetime('now')").bind(a.uid,nickname,region,timezone,risk,JSON.stringify(watchlist)).run();
 return response({saved:true,watchlist})
 }
 if(data.action==='saveHistory'){let symbol=clean(data.symbol,12).toUpperCase(),kind=clean(data.kind,22),note=clean(data.note,500);if(!/^[A-Z0-9._-]{1,12}$/.test(symbol)||!['research','watch','paper-idea'].includes(kind))return response({error:'Invalid history item'},400);let id=crypto.randomUUID();await env.DB.prepare('INSERT INTO research_history(uid,id,symbol,kind,note) VALUES(?,?,?,?,?)').bind(a.uid,id,symbol,kind,note).run();return response({saved:true,id})}
 if(data.action==='removeHistory'){let id=clean(data.id,70);if(!/^[a-f0-9-]{30,40}$/i.test(id))return response({error:'Invalid item'},400);await env.DB.prepare('DELETE FROM research_history WHERE uid=? AND id=?').bind(a.uid,id).run();return response({deleted:true})}
 return response({error:'Unsupported action'},400)
 }catch{return response({error:'Could not update your workspace. Check that the D1 database migration was applied.'},503)}}
export async function onRequestDelete({request,env}){const a=await who(request,env);if(a.error)return a.error;try{await env.DB.batch([env.DB.prepare('DELETE FROM research_history WHERE uid=?').bind(a.uid),env.DB.prepare('DELETE FROM profiles WHERE uid=?').bind(a.uid),env.DB.prepare('DELETE FROM ai_allowance WHERE uid=?').bind(a.uid)]);return response({deleted:true})}catch{return response({error:'Account data deletion failed'},503)}}
