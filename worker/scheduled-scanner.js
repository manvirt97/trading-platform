/* Optional separate Cloudflare Worker Cron scan.
   Deliberately does NOT call Claude on a schedule; limited cost/credits.
   Deploy explicitly using wrangler.scanner.toml after binding KV and secrets. */
import {getData} from '../functions/_shared/http.js';
import {analyze} from '../functions/_shared/core.js';
import {UNIVERSES,candidateFromAnalysis,rankCandidates} from '../functions/_shared/discovery.js';
const reply=(o,s=200)=>Response.json(o,{status:s,headers:{'cache-control':'no-store'}});
export function isRegularResearchWindow(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value])),mins=Number(p.hour)*60+Number(p.minute);
 return !['Sat','Sun'].includes(p.weekday)&&mins>=600&&mins<960;
}
async function scan(env){
 if(env.LIVE_DATA_ENABLED!=='on'||!(env.TWELVEDATA_API_KEY||(env.FINNHUB_API_KEY&&env.FINNHUB_FALLBACK_ENABLED==='on')))
  return {status:'disabled',error:'Authorized provider is not connected'};
 if(!env.SCANNER_SNAPSHOTS)return {status:'disabled',error:'SCANNER_SNAPSHOTS KV binding is missing'};
 const symbols=UNIVERSES.leaders,items=[],errors=[];
 const request=new Request('https://rangeform.pages.dev/api/market-discovery?universe=leaders');
 for(let i=0;i<symbols.length;i+=2){
  const jobs=await Promise.allSettled(symbols.slice(i,i+2).map(async symbol=>{
   const data=await getData(request,env,{symbol,source:'twelvedata',interval:'5min'});
   return candidateFromAnalysis(analyze(data.bars,symbol,data.meta),{state:'not-checked',items:[]});
  }));
  jobs.forEach((r,j)=>{const symbol=symbols[i+j];
   if(r.status==='fulfilled')items.push(r.value);else errors.push({symbol,reason:String(r.reason?.message||'Data unavailable').slice(0,120)});
  });
 }
 const result={status:items.length?'ok':'unavailable',checked_at:new Date().toISOString(),universe:'leaders',
  scope:'CURATED_SIX_SYMBOL_SAMPLE_NOT_WHOLE_MARKET',items:rankCandidates(items).map(({priority,grade,...x})=>x),
  errors,source:'Authorized completed historical bars; market calendar and quote spreads not verified',
  disclaimer:'Watch candidates are never orders or profit guarantees. Claimed live execution unavailable.'};
 await env.SCANNER_SNAPSHOTS.put('latest:leaders',JSON.stringify(result),{expirationTtl:7200});
 return result;
}
export default {
 async scheduled(_controller,env,ctx){
  // Skip weekends/outside standard hours. Holiday calendars are not independently verified.
  if(!isRegularResearchWindow())return;
  ctx.waitUntil(scan(env).catch(e=>console.error('Authorized scheduled scan failed',String(e.message).slice(0,100))));
 },
 async fetch(request,env){
  if(new URL(request.url).pathname!=='/health')return reply({error:'not found'},404);
  return reply({worker:'rangeform-scheduled-research',run_window:'US regular hours every 30 minutes',source:env.SCANNER_SNAPSHOTS?'KV bound':'KV missing',
   data_configured:Boolean(env.LIVE_DATA_ENABLED==='on'&&(env.TWELVEDATA_API_KEY||env.FINNHUB_API_KEY)),execution:false});
 }
};
