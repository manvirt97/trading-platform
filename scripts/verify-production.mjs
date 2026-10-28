/* Public, unprivileged Rangeform production release verification.
   Evidence: serves current release.json + canonical HTML + public backend health.
   Does NOT assert authenticated owner state or actual Cloudflare Worker cron. */
import {readFileSync} from 'node:fs';
const origin=(process.env.RANGEFORM_PRODUCTION_ORIGIN||'https://rangeform.pages.dev').replace(/\/$/,'');
const expected=JSON.parse(readFileSync(new URL('../public/release.json',import.meta.url),'utf8'));
const attempts=Number(process.env.RANGEFORM_DEPLOY_ATTEMPTS||12);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const report=[];
async function retrieve(path){
 const res=await fetch(origin+path,{
  headers:{Accept:path.startsWith('/api/')?'application/json':'*/*'},
  redirect:'follow',
  cache:'no-store',
  signal:AbortSignal.timeout(12000)
 });
 return res;
}
function log(label,text){console.log(label+': '+text);report.push({label,result:text})}
let release=null;
for(let i=1;i<=attempts;i++){
 try{
  const response=await retrieve('/release.json?verification='+Date.now());
  if(!response.ok)throw Error('HTTP '+response.status);
  const value=await response.json();
  if(value.build!==expected.build)throw Error('expected '+expected.build+'; received '+String(value.build||'missing'));
  const cache=response.headers.get('cache-control')||'';
  if(!/no-store/i.test(cache))throw Error('Release metadata cache-control is not no-store: '+cache);
  release=value;
  log('Production release','matches '+value.build+' (HTTP '+response.status+', no-store)');
  break;
 }catch(e){
  console.log('Production check '+i+'/'+attempts+': '+String(e.message||e));
  if(i<attempts)await sleep(15000);
 }
}
if(!release){
 log('Release gate','FAILED: production does not serve expected release metadata');
 process.exitCode=1;
}else{
 for(const path of ['/v9.html','/account.html','/algo.html','/bot.html']){
  try{
   const response=await retrieve(path+'?verification='+Date.now());
   const body=await response.text();
   const loader='pwa-update-v'+expected.version+'.js?v='+expected.version;
   if(response.status!==200||!body.includes(loader))throw Error('HTTP '+response.status+' or missing '+loader);
   log('Page '+path,'ok; current update bootstrap present');
  }catch(e){log('Page '+path,'FAILED: '+e.message);process.exitCode=1}
 }
 for(const path of ['/api/status','/api/feed-state']){
  try{
   const response=await retrieve(path);
   const text=await response.text();
   if(!response.ok)throw Error('HTTP '+response.status+'; '+text.slice(0,120));
   let body;try{body=JSON.parse(text)}catch{throw Error('not JSON')}
   if(typeof body!=='object'||body===null)throw Error('missing status response');
   log('API '+path,'HTTP 200 JSON (public reachability only; not live-feed validation)');
  }catch(e){log('API '+path,'FAILED: '+e.message);process.exitCode=1}
 }
 try{
  const response=await retrieve('/api/auto-bot');
  let code='UNKNOWN';
  try{code=String((await response.json()).code||'not-provided')}catch{}
  if(response.status===401)log('Bot authentication','owner gating ready (signed-out 401); separate Worker cron NOT verified');
  else if(response.status===503){
   log('Bot authentication','BLOCKED: Pages NOT_CONFIGURED (503, '+code+'); owner secret/flag/DB and Pages redeploy required');
   process.exitCode=1;
  }
  else{
   log('Bot authentication','UNEXPECTED HTTP '+response.status+'; cron NOT verified');
   process.exitCode=1;
  }
 }catch(e){log('Bot authentication','FAILED: '+e.message);process.exitCode=1}
}
if(process.env.GITHUB_STEP_SUMMARY){
 const {appendFileSync}=await import('node:fs');
 const rows=report.map(x=>'| '+x.label.replaceAll('|','/')+' | '+x.result.replaceAll('|','/')+' |').join('\n');
 appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '\n### Rangeform public production verification\n\nExpected build: \x60'+expected.build+'\x60\n\n| Check | Result |\n|---|---|\n'+rows+'\n\n**Not covered:** Cloudflare deployment SHA, Pages secrets, D1 writes, authenticated bot state, real scheduled cron heartbeat, real-money orders.\n');
}
