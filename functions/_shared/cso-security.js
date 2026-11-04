/* Rangeform CSO: deterministic security gate, NOT a security guarantee.
 * LLM opinions never change these checks or enable brokerage orders.
 * Avoid returning secrets or user identifiers in status payloads.
 */
export function securityPosture(env,{ownerVerified=false}={}){
  const checks=[
    {id:'owner_auth',name:'Owner authentication',state:ownerVerified?'pass':'blocked',detail:ownerVerified?'Firebase ID verified against configured owner UID.':'Authenticated owner access is required.'},
    {id:'database',name:'Private quota and audit storage',state:env?.DB?'pass':'blocked',detail:env?.DB?'D1 binding present; table readiness checked on use.':'Missing D1 DB binding.'},
    {id:'openai_secret',name:'Server-side OpenAI secret',state:env?.OPENAI_API_KEY?'pass':'blocked',detail:env?.OPENAI_API_KEY?'API key is configured server-side, not returned to clients.':'OPENAI_API_KEY must be set as a Cloudflare encrypted secret.'},
    {id:'feature_flag',name:'Explicit AI opt-in',state:env?.OPENAI_AGENTS_ENABLED==='on'?'pass':'blocked',detail:env?.OPENAI_AGENTS_ENABLED==='on'?'OPENAI_AGENTS_ENABLED is on.':'OpenAI agent calls remain disabled until enabled.'},
    {id:'execution',name:'Broker order permission',state:'restricted',detail:'This council has no order placement tools, broker credentials or order execution permissions.'},
    {id:'security_audit',name:'Security checks coverage',state:'limited',detail:'Repository CI performs source-policy checks; runtime checks do not replace penetration testing, dependency scanning or secret-rotation review.'}
  ];
  return {
    agent:'CSO Security Agent',
    mode:'READ_ONLY',
    checked_at:new Date().toISOString(),
    checks,
    blockers:checks.filter(x=>x.state==='blocked').map(x=>x.name),
    research_ready:checks.every(x=>x.state!=='blocked'),
    trading_approved:false,
    live_orders_enabled:false,
    paper_orders_enabled:false,
    remediation:'Security issues require reviewed code changes and owner approval. The CSO cannot edit credentials, accounts, broker settings or risk limits.'
  };
}
