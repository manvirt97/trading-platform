import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runAgentTeam} from '../functions/_shared/agent-team.js';

const role=(id,vote=30)=>({id,name:id,group:'Research',vote,state:'bullish',note:'Synthetic TEST indicator only'});
const baseRoom=()=>({specialist_count:22,agreement_pct:75,score:43,abstentions:3,
  verdict:'BUY_WATCH',vetoes:[],agents:['trend','vwap','structure','rsi','macd','momentum','candles','opening','extension','volume','liquidity','levels','integrity','freshness','session','volatility','payoff'].map(id=>role(id))});
const opportunity=()=>({status:'BUY_WATCH',news:{state:'unverified',recent_headlines_24h:0}});
const analysis={symbol:'SPY',interval:'5min'};
test('exactly 11 named research roles plus an independent supervisor, without order permissions',()=>{
  const team=runAgentTeam(analysis,opportunity(),baseRoom(),new Date('2026-11-04T15:30:00Z'));
  assert.equal(team.specialists.length,11);
  assert.equal(new Set(team.specialists.map(x=>x.id)).size,11);
  assert.equal(team.supervisor.status,'RESEARCH_WATCH');
  assert.equal(team.supervisor.action,'BUY_WATCH');
  assert.equal(team.execution_gate.decision,'NO_ORDER');
  assert.equal(team.execution_gate.live_orders_enabled,false);
  assert.equal(team.execution_gate.paper_orders_enabled,false);
  assert.equal(team.mode,'RESEARCH_ONLY');
  assert.equal(team.specialists.find(x=>x.id==='macro').status,'unavailable');
  assert.equal(team.specialists.find(x=>x.id==='news').status,'unavailable');
  assert.equal(team.specialists.find(x=>x.id==='execution').status,'disabled');
});
test('research hard veto always wins even over bullish specialist votes',()=>{
  const room=baseRoom();room.vetoes=[{agent:'Data Integrity',reason:'Data unverified'}];
  const team=runAgentTeam(analysis,opportunity(),room);
  assert.equal(team.supervisor.status,'WAIT');
  assert.equal(team.supervisor.action,'WAIT');
  assert.equal(team.execution_gate.research_watch,false);
  assert.equal(team.specialists.find(x=>x.id==='risk').status,'blocked');
});
test('no valid underlying opportunity means WAIT even with matching directional votes',()=>{
  const room=baseRoom();room.verdict='WAIT';
  const team=runAgentTeam(analysis,opportunity(),room);
  assert.equal(team.supervisor.status,'WAIT');
  assert.equal(team.execution_gate.broker_connected,false);
});
test('agent API and dashboard use the same server-computed result, with no simulated orders',()=>{
  const api=readFileSync(new URL('../functions/api/opportunity.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/agent-team.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/static/agent-team.js',import.meta.url),'utf8');
  assert.match(api,/const agent_team=runAgentTeam\(technical,signal,agent_room\)/);
  assert.match(api,/agent_room,agent_team,analysis/);
  for(const field of ['teamForm','agentGrid','supervisorVerdict','teamVeto','teamMessage'])assert.match(html,new RegExp('id="'+field+'"'));
  assert.match(js,/agent_team/);
  assert.match(js,/fetch\('\/api\/opportunity\?/);
  assert.doesNotMatch(js,/\/api\/auto-bot|\/api\/orders|placeOrder/);
  assert.match(html,/PAPER orders|Paper orders/i);
});