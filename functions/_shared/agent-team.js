/* Rangeform Agent Team v1.
 * Composes existing validated, deterministic specialist evidence into 11
 * explainable desk roles plus a supervisor. RESEARCH ONLY.
 * This is NOT 11 separately hosted LLMs, not a calibrated forecast,
 * and it cannot place a broker or paper order.
 */
const ROLE_DEFS=Object.freeze([
  {id:'regime',name:'Market Regime',description:'Checks whether price conditions support a trend.',checks:['trend','vwap','structure']},
  {id:'scanner',name:'Opportunity Scanner',description:'Looks for a confirmed opening-range setup.',checks:['opening','volume']},
  {id:'trend',name:'Trend',description:'Reads moving averages, VWAP and price structure.',checks:['trend','vwap','structure']},
  {id:'momentum',name:'Momentum',description:'Measures price acceleration and strength.',checks:['rsi','macd','momentum']},
  {id:'patterns',name:'Patterns',description:'Looks for candlestick and breakout evidence.',checks:['candles','opening','extension']},
  {id:'volume',name:'Volume',description:'Checks participation and volume reliability.',checks:['volume','liquidity']},
  {id:'levels',name:'Support & Resistance',description:'Checks the current opening range and historical levels.',checks:['levels','opening']},
  {id:'macro',name:'Macro',description:'Needs independent economic calendar and macro data.',checks:[]},
  {id:'news',name:'News & Catalysts',description:'Reviews dated headlines without guessing sentiment.',checks:[]},
  {id:'risk',name:'Risk Manager',description:'Applies non-negotiable data, session and risk vetoes.',checks:['integrity','freshness','session','liquidity','volatility','payoff']},
  {id:'execution',name:'Execution & Monitoring',description:'Requires a separately authorized order route and controls.',checks:[]}
]);
const clip=x=>String(x??'').slice(0,240);
const pick=(room,ids)=>ids.map(id=>(room?.agents||[]).find(a=>a.id===id)).filter(Boolean);
function study(def,room,opportunity){
  const selected=pick(room,def.checks);
  const notes=selected.map(a=>({check:a.name,status:a.state,note:clip(a.note)}));
  if(def.id==='macro')return {...def,status:'unavailable',summary:'No verified economic-calendar or market-regime macro feed connected.',evidence:[],vote:null};
  if(def.id==='news'){
    const count=opportunity?.news?.recent_headlines_24h||0;
    return {...def,status:count>0?'context':'unavailable',summary:count>0?count+' dated headlines available for manual context, not a verified directional prediction.':'No independently verified recent market-moving news context.',evidence:[],vote:null};
  }
  if(def.id==='execution')return {...def,status:'disabled',summary:'No stock broker execution adapter, order permissions or paper-order connection. This team issues research watches only.',evidence:[],vote:null};
  if(def.id==='risk'){
    const vetoes=Array.isArray(room?.vetoes)?room.vetoes:[];
    return {...def,status:vetoes.length?'blocked':'research-pass',summary:vetoes.length?vetoes.length+' hard safety veto(s). No execution allowed.':'No hard research veto. Brokerage spread, events, fills and tested profitability still unverified.',evidence:notes,vote:null};
  }
  if(def.id==='scanner'){
    const watch=['BUY_WATCH','SELL_WATCH'].includes(opportunity?.status)&&room?.verdict===opportunity.status;
    return {...def,status:watch?'supportive':'neutral',summary:watch?'Validated conditional '+opportunity.status.replace('_',' ').toLowerCase()+' setup. Research only.':'No supervisor-approved fresh breakout/breakdown watch.',evidence:notes,vote:null};
  }
  const voters=selected.filter(a=>typeof a.vote==='number'&&Number.isFinite(a.vote));
  const vote=voters.length?Math.round(voters.reduce((s,a)=>s+a.vote,0)/voters.length):null;
  return {...def,status:vote===null?'unavailable':vote>15?'bullish':vote< -15?'bearish':'neutral',summary:vote===null?'Not enough validated indicators for this role.':voters.length+' evidence checks; directional alignment '+vote+' (NOT profit probability).',evidence:notes,vote};
}
export function runAgentTeam(analysis,opportunity,room,at=new Date()){
  const roles=ROLE_DEFS.map(def=>study(def,room,opportunity));
  const vetoes=(room?.vetoes||[]).map(v=>({agent:clip(v.agent),reason:clip(v.reason)}));
  const same=room?.verdict===opportunity?.status&&['BUY_WATCH','SELL_WATCH'].includes(room?.verdict);
  const watch=Boolean(same&&!vetoes.length);
  const action=watch?room.verdict:'WAIT';
  return {
    version:'agent-team-v1',
    timestamp:new Date(at).toISOString(),
    symbol:clip(analysis?.symbol||opportunity?.symbol||''),
    interval:clip(analysis?.interval||opportunity?.interval||''),
    architecture:'11 deterministic role summaries of existing specialist evidence; 1 coordinating supervisor. No independent LLM calls.',
    mode:'RESEARCH_ONLY',
    supervisor:{
      status:watch?'RESEARCH_WATCH':'WAIT',
      action,
      reasoning:watch?'Conditional setup confirmed by the existing 22-check research room, with no hard research veto. An executable order is NOT approved.':vetoes.length?'Hard veto: '+vetoes[0].reason:'No sufficiently evidenced, fresh and aligned research watch.',
      agreement_pct:Number.isFinite(room?.agreement_pct)?room.agreement_pct:null,
      research_score:Number.isFinite(room?.score)?room.score:null,
      caveat:'Agreement is not a calibrated chance of a winning trade.'
    },
    specialists:roles,
    checks:{underlying_research_specialists:room?.specialist_count||0,hard_vetoes:vetoes,unavailable_evidence:room?.abstentions||0},
    execution_gate:{
      research_watch:watch,
      paper_orders_enabled:false,
      live_orders_enabled:false,
      broker_connected:false,
      independent_quote_verified:false,
      strategy_validated_out_of_sample:false,
      decision:'NO_ORDER',
      reason:'No order routing. A watch does not authorize paper or live execution.'
    }
  };
}
