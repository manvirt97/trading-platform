/* GitHub Actions release gate.
   Every change to app-serving public files requires bumping release metadata.
   This prevents Home Screen PWAs remaining on old builds due forgotten version bumps. */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const base=process.env.RANGEFORM_BASE_SHA||'';
const head=process.env.RANGEFORM_HEAD_SHA||'HEAD';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(!/^[0-9a-f]{40}$/.test(base)||/^0+$/.test(base)){
 console.log('Initial release baseline unavailable; skipping marker gate.');
 process.exit(0);
}
const paths=git('diff','--name-only',base,head).split('\n').filter(Boolean);
const frontend=paths.some(p=>p.startsWith('public/')&&p!=='public/release.json');
if(!frontend){
 console.log('No static application changes requiring a new build marker.');
 process.exit(0);
}
if(!paths.includes('public/release.json')){
 console.error('Frontend changed but public/release.json did not. Bump its version/build in this PR to update installed iPhone apps.');
 process.exit(1);
}
const current=JSON.parse(readFileSync('public/release.json','utf8'));
const previous=JSON.parse(git('show',base+':public/release.json'));
const ver=Number(current.version),old=Number(previous.version);
if(!(Number.isInteger(ver)&&ver>old&&current.build.startsWith('rangeform-v'+ver+'-'))){
 console.error('Installed-app release marker must strictly increase and match version (previous='+old+', current='+ver+').');
 process.exit(1);
}
console.log('PASS: deployed app files have a new monotonic Home Screen release marker: '+current.build);
