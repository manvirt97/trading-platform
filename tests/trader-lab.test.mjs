import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replayCompletedBars,validateReplayInputs} from '../functions/_shared/trader-lab.js';
import {onRequestGet} from '../functions/api/trader-lab.js';
const input={entry:100,stop:99.5,target:101,interval:'5min',horizonBars:12,seed:19};
function bars(){
 const dates=['2026-10-21','2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28'];
 const out=[];let close=100;
 for(let day=0;day<dates.length;day++){
  const start=Date.parse(dates[day]+'T13:30:00.000Z');
  for(let i=0;i<58;i++){
   const earlier=close;close*=1+Math.sin(i*1.5+day)*0.0015;
   out.push({timestamp:new Date(start+i*300000).toISOString(),open:earlier,close,
    high:Math.max(earlier,close)*1.001,low:Math.min(earlier,close)*0.999,volume:1000});
  }
 }
 return out;
}
test('10k replay is deterministic, counts sum to 10k, never claims execution',()=>{
 const a=replayCompletedBars(bars(),input),b=replayCompletedBars(bars(),input);
 assert.deepEqual(a,b);
 assert.equal(a.paths,10000);
 assert.equal(Object.values(a.outcomes).reduce((x,y)=>x+y,0),10000);
 assert.equal(a.security.broker_orders,false);
 assert.equal(a.security.trade_ready,false);
 assert.match(a.warnings.join(' '),/NOT win probabilities/);
 assert.ok(a.evidence.sample_returns>40);
 assert.ok(a.evidence.sessions>=2);
 assert.equal(a.evidence.sample_quality,'LIMITED_SESSIONS');
});
test('Regular-session returns exclude overnight movements',()=>{
 const b=bars();
 const x=replayCompletedBars(b,input);
 assert.equal(x.evidence.sample_returns,6*57);
});
test('Long-only levels, interval, horizon and missing data fail closed',()=>{
 for(const bad of [
  {...input,stop:100}, {...input,target:100}, {...input,entry:0},
  {...input,entry:''}, {...input,interval:'1day'}, {...input,horizonBars:100},
  {...input,seed:-1}
 ])assert.throws(()=>validateReplayInputs(bad));
 assert.throws(()=>replayCompletedBars(bars().slice(0,40),input),/Insufficient/i);
 assert.throws(()=>replayCompletedBars(bars().slice(0,57),input),/Not enough/i);
 const badBars=bars();badBars[60].timestamp=badBars[59].timestamp;
 assert.throws(()=>replayCompletedBars(badBars,input),/unordered timestamps/i);
});
test('Public API validates inputs without charging provider or placing orders',async()=>{
 const fail=await onRequestGet({request:new Request('https://example.com/api/trader-lab?symbol=NVDA&interval=5min&entry=100&stop=101&target=102'),env:{}});
 assert.equal(fail.status,400);assert.equal((await fail.json()).broker_orders,false);
 const none=await onRequestGet({request:new Request('https://example.com/api/trader-lab?symbol=NVDA&interval=5min&entry=100&stop=99&target=102'),env:{}});
 assert.equal(none.status,503);
 const payload=await none.json();assert.equal(payload.state,'NO_SIMULATION');assert.equal(payload.broker_orders,false);
});
test('Trading Lab is part of existing Day Trading Desk, with no auto-polling or broker calls',()=>{
 const html=readFileSync(new URL('../public/v9.html',import.meta.url),'utf8');
 const script=readFileSync(new URL('../public/static/trader-lab.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/static/trader-lab.css',import.meta.url),'utf8');
 assert.match(html,/id="trader-lab-run"/);
 assert.match(html,/\/static\/trader-lab\.js\?v=1/);
 assert.match(html,/\/static\/trader-lab\.css\?v=1/);
 assert.match(script,/\/api\/trader-lab/);
 assert.match(script,/day-risk-calc/);
 assert.doesNotMatch(script,/\/api\/orders|\/api\/auto-bot|new WebSocket|setInterval|Math\.random|localStorage|innerHTML|broker\/approve/);
 assert.match(css,/@media\(max-width:700px\)/);
});
