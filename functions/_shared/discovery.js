// Fixed, transparent US-listed research universes. These are samples, not whole-market coverage.
// No invented volume, quotes, or broker orders.
import {evaluateOpportunity} from './opportunity.js';
import {runAgentRoom} from './agent-room.js';

export const UNIVERSES=Object.freeze({
 leaders:Object.freeze(['NVDA','AAPL','MSFT','AMZN','TSLA','AMD']),
 diversified:Object.freeze(['SPY','QQQ','META','GOOGL','XOM','JPM'])
});
const rounded=v=>Number.isFinite(Number(v))?Number(v):null;
export function candidateFromAnalysis(analysis,news={state:'not-checked',items:[]},now=new Date()){
 const opportunity=evaluateOpportunity(analysis,news,now);
 const agentRoom=runAgentRoom(analysis,opportunity,now);
 const ind=analysis?.indicators||{};
 const score=Number(analysis?.score),vol=Number(ind.rel_volume),range=opportunity.opening_range||{};
 const patterns=(analysis?.patterns||[]).filter(p=>p&&typeof p.name==='string').slice(0,5).map(p=>({name:p.name,type:p.type,why:p.why}));
 const status=['BUY_WATCH','SELL_WATCH'].includes(opportunity.status)&&agentRoom.verdict==='WAIT'?'WAIT':opportunity.status;
 // A directional technical alignment score is not a prediction of probability.
 // Rank fully confirmed *watches* over tentative and stale historical setups.
 const grade=status==='BUY_WATCH'||status==='SELL_WATCH'?3:status==='WAIT'?2:status==='WAIT_STALE'?1:0;
 const agreement=Number.isFinite(score)?Math.abs(score-50):0;
 const reason=opportunity.explanation;
 return {
  symbol:analysis.symbol,interval:analysis.interval,price:rounded(analysis.last),
  bar_time:opportunity.last_completed_bar_utc,bar_age_minutes:opportunity.bar_age_minutes,
  status,grade,quality_score:Number.isFinite(score)?score:null,
  directional_bias:score>=65?'bullish':score<=35?'bearish':'mixed',
  supporting_patterns:patterns,relative_volume:rounded(vol),
  opening_range:range.state==='ready'?{high:range.high,low:range.low,window:range.window}:null,
  signal:status==='WAIT'?null:opportunity.plan,reason:status==='WAIT'&&opportunity.status!==status?'Supervisor veto: '+agentRoom.next_step:reason,
  agent_summary:{specialists:agentRoom.specialist_count,available_votes:agentRoom.available_votes,agreement_pct:agentRoom.agreement_pct,score:agentRoom.score,vetoes:agentRoom.vetoes.length,abstentions:agentRoom.abstentions,verdict:agentRoom.verdict},
  news_state:opportunity.news.state,
  news_headlines:opportunity.news.stories.slice(0,3),
  priority:grade*100+agreement+(Number.isFinite(vol)?Math.min(10,vol*2):0),
  reviewed:opportunity.source_status==='historical-verified-structure',
  note:'Research candidate only; does not include broker spread, exchange entitlement or execution.'
 };
}
export function rankCandidates(items){
 return [...items].sort((a,b)=>b.priority-a.priority||a.symbol.localeCompare(b.symbol));
}
export function missingCandidates(universe,items){
 const seen=new Set(items.map(x=>x.symbol));
 return (UNIVERSES[universe]||[]).filter(x=>!seen.has(x));
}
