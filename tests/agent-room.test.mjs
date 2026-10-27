import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgentRoom} from '../functions/_shared/agent-room.js';
import {candidateFromAnalysis} from '../functions/_shared/discovery.js';
import {readFileSync} from 'node:fs';

const now=new Date('2026-10-26T14:22:00Z');
function candles(){
 const older=Array.from({length:100},(_,i)=>{
  const time=new Date(Date.parse('2026-10-23T13:30:00Z')+i*300_000);
  const close=98+i*.035;
  return {time:time.toISOString(),open:close-.2,high:close+.4,low:close-.4,close,volume:1200};
 });
 const today=Array.from({length:10},(_,i)=>{
  const time=new Date(Date.parse('2026-10-26T13:30:00Z')+i*300_000);
  const close=102+i*.08;
  return {time:time.toISOString(),open:close-.15,high:close+.4,low:close-.4,close,volume:2000};
 });
 return older.concat(today);
}
function analysis(){
 const bars=candles();
 return {symbol:'NVDA',interval:'5min',source:'twelvedata',data_quality:'complete-ohlcv',
  score:88,last:bars.at(-1).close,last_bar_utc:bars.at(-1).time,bar_history:bars,
  indicators:{atr14:1.2,rel_volume:1.6,rsi14:62,ma20:102,sma20:102,resistance20:101,support20:98},
  patterns:[{name:'Bullish engulfing',type:'bullish',why:'Confirmed body pattern'}]
 };
}
const opportunity=()=>({status:'BUY_WATCH',opening_range:{state:'ready',high:102,low:100},
 plan:{direction:'long',reference_entry:103,invalidation:100,illustrative_target_2r:109},
 news:{state:'unverified',stories:[]}});
test('22 distinct specialist checks distinguish votes, missing evidence and hard safety vetoes',()=>{
 const x=runAgentRoom(analysis(),opportunity(),now);
 assert.equal(x.specialist_count,22);
 assert.equal(x.agents.length,22);
 assert.equal(new Set(x.agents.map(a=>a.id)).size,22);
 assert.ok(x.available_votes>=5);
 assert.ok(x.abstentions>=3);
 assert.ok(x.agents.some(a=>a.id==='crossquote'&&a.state==='unavailable'));
 assert.ok(x.agents.some(a=>a.id==='earnings'&&a.state==='unavailable'));
 assert.equal(x.caveat.includes('not 22 independent AI models'),true);
 assert.ok(['WAIT','BUY_WATCH'].includes(x.verdict));
});
test('closed market and stale bars must veto despite bullish technical indicators',()=>{
 const end=new Date('2026-10-26T22:05:00Z');
 const x=runAgentRoom(analysis(),opportunity(),end);
 assert.equal(x.verdict,'WAIT');
 assert.ok(x.vetoes.some(v=>v.agent.includes('Session')));
 assert.ok(x.vetoes.some(v=>v.agent.includes('Freshness')));
});
test('missing OHLCV, no validated plan and bad risk/reward cannot be upgraded by agents',()=>{
 const a=analysis();
 a.source='archived-demo';
 const x=runAgentRoom(a,opportunity(),now);
 assert.equal(x.verdict,'WAIT');
 assert.ok(x.vetoes.some(v=>v.agent.includes('Data Integrity')));
 const bad={...opportunity(),plan:{direction:'long',reference_entry:103,invalidation:100,illustrative_target_2r:103.2}};
 const y=runAgentRoom(analysis(),bad,now);
 assert.equal(y.verdict,'WAIT');
 assert.ok(y.vetoes.some(v=>v.agent.includes('Reward')));
});
test('scanner never promotes a blocked pattern to a watch',()=>{
 const a=analysis();
 const row=candidateFromAnalysis(a,{state:'unverified',items:[]},new Date('2026-10-26T22:05:00Z'));
 assert.equal(row.status,'WAIT_STALE');
 assert.ok(row.agent_summary.specialists===22);
 assert.equal(row.signal,null);
});
test('new agent room visible in app and API sends real server-computed specialist votes',()=>{
 const html=readFileSync(new URL('../public/v9.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/static/v9.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../functions/api/opportunity.js',import.meta.url),'utf8');
 for(const id of ['agentRoomVerdict','agentRoomSummary','agentRoomVeto','agentRoomGrid'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/function renderAgentRoom/);
 assert.match(js,/agent_room/);
 assert.match(api,/runAgentRoom\(technical,signal\)/);
 assert.match(js,/state\.agentRoom\?\.verdict/);
});
