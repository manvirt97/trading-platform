/* Rangeform Signal Desk 4.0: transparent, educational, no execution. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=v=>Number.isFinite(Number(v))?'$'+Number(v).toLocaleString('en-CA',{maximumFractionDigits:2,minimumFractionDigits:2}):'—';
let active=null,enabled=false,connected=false,shownFor='',liveMode=false;
const night=()=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false}).format(new Date());
const freshness=x=>{
 if(!x||x.source!=='twelvedata')return {fresh:false,reason:'No verified intraday provider data. Historical CSV can support research, not a live buy/sell alert.'};
 if(!['1min','5min','15min'].includes(x.interval))return {fresh:false,reason:'Daily bars show context, not a current intraday entry.'};
 const now=new Date(),clock=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now).map(z=>[z.type,z.value]));
 const minute=Number(clock.hour)*60+Number(clock.minute);
 if(['Sat','Sun'].includes(clock.weekday)||minute<570||minute>=960)return {fresh:false,reason:'Outside the regular US stock session. No active intraday setup; verify exchange holidays separately.'};
 const stamp=Date.parse(x.last_bar_utc),duration={'1min':60000,'5min':300000,'15min':900000}[x.interval];
 if(!Number.isFinite(stamp)||stamp>Date.now()+30000)return {fresh:false,reason:'Market-data timestamp invalid or in the future.'};
 const age=Date.now()-stamp;
 if(age>duration*3+60000)return {fresh:false,reason:'Latest completed bar '+Math.ceil(age/60000)+' minutes old — too stale for an intraday signal.'};
 return {fresh:true,reason:'Latest completed bar '+Math.max(0,Math.round(age/60000))+' minutes old. Check exchange entitlement and broker quote before trading.'}
};
function direction(x){
 const status=freshness(x),r=x.indicators||{},price=Number(x.last),hi=Number(r.resistance20),lo=Number(r.support20),vol=Number(r.rel_volume),score=Number(x.score);
 const complete=x.data_quality==='complete-ohlcv'&&[price,hi,lo,vol,score].every(Number.isFinite)&&lo>0&&hi>=lo;
 const rising=score>=65&&price>hi&&vol>=1.15;
 const falling=score<=35&&price<lo&&vol>=1.15;
 const bullish=status.fresh&&complete&&rising,bearish=status.fresh&&complete&&falling;
 const kind=bullish?'buy':bearish?'sell':'wait';
 const atr=Number(r.atr14),riskSize=Number.isFinite(atr)&&atr>0?atr:null;
 const longStop=complete?(riskSize?Math.max(0,price-1.2*riskSize):lo):null;
 const shortInvalid=complete?(riskSize?price+1.2*riskSize:hi):null;
 const stop=kind==='buy'?longStop:kind==='sell'?shortInvalid:null;
 const risk=Number.isFinite(stop)?Math.abs(price-stop):null;
 const target=risk>0?(kind==='buy'?price+2*risk:price-2*risk):null;
 const waitWhy=!status.fresh?status.reason:!complete?'Price, OHLCV or support/resistance is missing; no actionable research signal.':score>35&&score<65?'Indicators disagree. No directional edge is confirmed.':vol<1.15?'The move lacks a volume confirmation (minimum 1.15×).':'Wait for a completed breakout or breakdown candle to confirm the move.';
 const checks=[
   {ok:status.fresh,label:'Completed bar recent enough for the session'},
   {ok:complete,label:'Source contains complete OHLCV history'},
   {ok:complete&&((rising||falling)),label:'Trend, range break and volume agree'},
   {ok:false,label:'Independent broker quote, spread and event calendar must still be checked'}
 ];
 return {
  kind,bias:kind==='buy'?'BUY SETUP':kind==='sell'?'SELL / REDUCE SETUP':'WAIT · NO CONFIRMED SETUP',
  reason:kind==='wait'?waitWhy:status.reason,fresh:status.fresh,bullish,bearish,checks,
  impact:(x.components||[]).slice().sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)).slice(0,3).map(z=>z.name+': '+(z.impact>0?'+':'')+z.impact+' pts'),
  entry:kind==='wait'?null:price,stop,target,
  watch:kind==='buy'?'A bullish setup is detected on the last completed bar. Confirm bid/ask, spread, major news, and that the next bar holds above resistance.':kind==='sell'?'Bearish pressure is detected. If already invested, review exit conditions. This is not a recommendation to open a short position.':'No entry today based on available evidence. Compare trend, volume, price levels and data age before considering a position.',
  detail:kind==='wait'?waitWhy:'Conditional technical research, NOT an order. Verify live broker quotes, spread, earnings and corporate events.'
 }
}

function mount(){
 const controls=document.querySelector('#page-signals .controls-panel');
 if(controls&&!$('decisionDeck')){
  const panel=document.createElement('section');panel.id='decisionDeck';panel.className='decision-deck';panel.innerHTML=`<div class="desk-title"><span class="eyebrow">THE OPPORTUNITY DESK / EVIDENCE FIRST</span><span id="deskSource" class="desk-data">AWAITING VERIFIED DATA</span></div>
 <div class="desk-row"><div class="desk-verdict" id="deskVerdict" data-bias="wait"><span class="desk-eyebrow">SIGNAL · WHAT IT MEANS</span><strong id="deskBias">WAIT · NO CONFIRMED SETUP</strong><span id="deskLine">No validated price feed is connected. Charts and news are available, but there is no verified entry yet.</span><span id="deskReadiness" class="desk-readiness">DATA CHECK REQUIRED</span></div>
 <div class="desk-metric"><small>INDICATORS AGREE</small><strong id="deskScore">—</strong><span>Technical factors agreeing, not the chance of profit.</span></div>
 <div class="desk-metric"><small>LAST COMPLETED PRICE</small><strong id="deskPrice">—</strong><span id="deskTime">Verify the timestamp</span></div></div>
 <div class="desk-plan"><div class="desk-plan-top"><span>CONDITIONAL TRADE PLAN</span><span id="deskGate">WAIT FOR REAL MARKET DATA</span></div>
 <div class="desk-plan-levels"><div><small>REFERENCE ENTRY</small><strong id="deskEntry">—</strong></div><div><small>INVALIDATION / STOP</small><strong id="deskInvalid">—</strong></div><div><small>ILLUSTRATIVE 2R TARGET</small><strong id="deskTarget">—</strong></div></div>
 <p id="deskPlanNote">No current entry or target is shown without a validated provider bar and confirmed rules. Even a detected setup needs a live broker quote and risk review.</p></div>
 <div class="desk-guide"><div><b>WHY?</b><p id="deskWhy">Waiting for valid quantitative evidence.</p></div><div><b>WHAT TO WATCH</b><p id="deskWatch">Confirm price, market hours, volume and upcoming events.</p></div><div><b>CONFIRMATION CHECKLIST</b><div class="desk-checklist" id="deskChecklist">Source • Freshness • Range • Volume • Broker confirmation</div></div></div>
 <div class="desk-actions"><button type="button" class="desk-choice" id="deskBuy" aria-pressed="false">↗ When to consider buying</button><button type="button" class="desk-choice" id="deskSell" aria-pressed="false">↘ When to consider selling</button><button type="button" class="desk-choice chosen" id="deskWait" aria-pressed="true">◷ Wait for confirmation</button><button type="button" class="desk-risk" id="deskRisk">Plan position risk ↗</button></div>
 <div id="deskChoiceNote" class="desk-choice-note">Conditional setups, not guaranteed trades. A verified quote, costs, market hours and news must be checked before any decision.</div></section>`;
  controls.after(panel);
  for(let [id,type] of [['deskBuy','buy'],['deskSell','sell'],['deskWait','wait']])$(id).onclick=()=>{
   document.querySelectorAll('.desk-choice').forEach(btn=>{btn.classList.remove('chosen');btn.setAttribute('aria-pressed','false')});$(id).classList.add('chosen');$(id).setAttribute('aria-pressed','true');
   let x=active,hi=x?.indicators?.resistance20,lo=x?.indicators?.support20;
   $('deskChoiceNote').textContent=type==='buy'?`Bullish scenario: wait for a completed candle above ${usd(hi)} with volume; define your stop before any decision.`:type==='sell'?`Bearish scenario: watch a completed candle below ${usd(lo)}. This does not suggest opening an uncovered short position.`:'No trade is a valid decision. Wait until price, volume, trend and data freshness agree.';
  };
  $('deskWait').classList.add('chosen');
  $('deskRisk').onclick=()=>{document.querySelector('[data-page="risk"]')?.click();$('riskFromSignal')?.click()};
 }
 const intro=document.querySelector('#page-overview .notice');
 if(intro&&!$('liveOverviewStrip')){
  let el=document.createElement('div');el.id='liveOverviewStrip';el.className='live-strip';el.innerHTML=`<span id="liveStripDot" class="strip-dot"></span><div><strong id="liveStripTitle">TradingView charts · exchange delays vary</strong><small id="liveStripSub">Connect a licensed provider in Cloudflare to unlock current completed bars.</small></div><button class="strip-action" id="liveStripAction">Connection setup →</button>`;
  intro.after(el);$('liveStripAction').onclick=()=>document.querySelector('[data-page="settings"]')?.click();
 }
 const status=document.querySelector('#page-settings .connection-list');
 if(status&&!$('setupLive')){
  let el=document.createElement('div');el.className='live-setup';el.id='setupLive';el.innerHTML=`<div class="setting-caption">PERSONAL LIVE-DATA CONNECTION</div><h3>Turn on your own market feed</h3><p>① Protect this Pages website with Cloudflare Access (only you can sign in). ② Add <code>TWELVEDATA_API_KEY</code> as an encrypted Cloudflare secret. ③ Add <code>LIVE_DATA_ENABLED</code> with value <code>on</code>. ④ Redeploy and reload this page.</p><p>Without a licensed API, Rangeform shows independent TradingView market charts and news instead of generating prices. Individual plans may not be redistributed to public visitors. Provider REST bars are not tick-by-tick streaming.</p><button id="checkConnection" class="btn btn-primary">Check provider connection ↻</button><span id="connectionMessage" class="conn-note">Waiting for connection check</span>`;
  status.parentElement.append(el);
  $('checkConnection').onclick=()=>checkProvider(true);
 }
 let toolbar=$('page-signals')?.querySelector('.controls-panel');
 if(toolbar&&!$('sourceHint')){let el=document.createElement('div');el.id='sourceHint';el.className='source-hint';el.textContent='Data source and timestamp must be verified before using an intraday setup.';toolbar.after(el)}
}
window.renderTradeGuide=x=>{
 mount();active=x;const sig=direction(x),ind=x.indicators||{},stamp=x.last_bar_utc||'';
 $('deskSource').textContent=x.source==='twelvedata'?'LICENSED PROVIDER · '+x.interval:x.source==='user-csv'?'IMPORTED HISTORICAL DATA':'UNVERIFIED HISTORY';
 $('deskVerdict').dataset.bias=sig.kind;
 $('deskBias').textContent=sig.bias;$('deskLine').textContent=sig.detail;
 $('deskReadiness').textContent=sig.kind==='wait'?'NO VERIFIED SETUP':'CONDITIONAL SETUP · VERIFY BROKER';
 $('deskScore').textContent=x.score+'/100';$('deskPrice').textContent=usd(x.last);
 $('deskTime').textContent=x.interval+' · '+(stamp?new Date(stamp).toLocaleString('en-CA',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' ET':'Time unknown');
 $('deskGate').textContent=sig.kind==='wait'?'NOT ACTIONABLE':sig.kind==='buy'?'BULLISH CONDITIONS MET':'BEARISH CONDITIONS MET';
 $('deskEntry').textContent=sig.entry==null?'—':usd(sig.entry);
 $('deskInvalid').textContent=sig.stop==null?'—':usd(sig.stop);
 $('deskTarget').textContent=sig.target==null?'—':usd(sig.target);
 $('deskPlanNote').textContent=sig.kind==='wait'?'No trade levels without validated current bars and confirmed rules. '+sig.reason:'Illustrative 2R is arithmetic, not a predicted profit. Confirm market price and upcoming catalysts before making any decision.';
 $('deskWhy').textContent=sig.impact.join(' · ')||'Not enough reliable inputs.';
 $('deskWatch').textContent=sig.watch;
 const checklist=$('deskChecklist');checklist.replaceChildren();
 for(const check of sig.checks){const row=document.createElement('div');row.className='desk-check '+(check.ok?'yes':'pending');const dot=document.createElement('span');dot.textContent=check.ok?'✓':'—';const label=document.createElement('span');label.textContent=check.label;row.append(dot,label);checklist.append(row)}
 $('deskChoiceNote').textContent=sig.kind==='wait'?'WAIT — '+sig.reason:'This is a conditional technical setup. An independent live broker price, spread, exchange status and breaking news must still be checked.';
 for(const [id,mode] of [['deskBuy','buy'],['deskSell','sell'],['deskWait','wait']]){$(id).classList.toggle('chosen',mode===sig.kind);$(id).setAttribute('aria-pressed',String(mode===sig.kind))}
 if(sig.kind!=='wait'&&shownFor!==x.symbol+'|'+x.interval+'|'+stamp+'|'+sig.kind){shownFor=x.symbol+'|'+x.interval+'|'+stamp+'|'+sig.kind;if(localStorage.getItem('rangeform_alerts')==='yes')window.toast?.('Conditional '+sig.kind+' setup on '+x.symbol+'. Independently verify quote and news.')}
};

window.renderOverviewGuide=(x,radar)=>{
 mount();let fresh=freshness(x),n=(radar?.rows||[]).filter(y=>y.source==='twelvedata'&&!y.error).length;
 $('liveStripDot').classList.toggle('on',x.source==='twelvedata'&&fresh.fresh);
 $('liveStripTitle').textContent=x.source==='twelvedata'?'Twelve Data connected • '+x.symbol+' '+x.interval:'Exchange-delayed market widgets · quant API not connected';
 $('liveStripSub').textContent=x.source==='twelvedata'?(fresh.reason+' • '+n+' watchlist symbols loaded. Data may be delayed.'):'TradingView widgets are available above. Quant model values require real, authorized historical data.';
 $('liveStripAction').textContent=x.source==='twelvedata'?'Review setup →':'Connect market data →';
};
window.renderOverviewError=message=>{mount();$('liveStripTitle').textContent='Market data unavailable';$('liveStripSub').textContent=message};
async function checkProvider(show){mount();let msg=$('connectionMessage');if(msg)msg.textContent='Checking connection…';
 try{let r=await fetch('/api/status',{cache:'no-store'}),d=await r.json();connected=Boolean(d.twelvedata_configured);enabled=Boolean(d.twelvedata_enabled);if(msg)msg.textContent=enabled?'Personal provider detected. Public redistribution needs licensing review and timestamps must be checked.':connected?'API key found, but live data is locked. Protect the website and set LIVE_DATA_ENABLED=on.':'No provider key detected. Follow the steps above.';
  const live=$('sourceSelect');if(live){if(live.value==='none'&&enabled)live.title='Private provider available only with authorized access';}
  if(enabled && !liveMode){liveMode=true;/* Public landing never silently exhausts a personal data subscription. */}
  if(show){let check=$('checkConnection');if(check){check.classList.add('pressed');setTimeout(()=>check.classList.remove('pressed'),300)}}
 }catch(e){if(msg)msg.textContent='Cannot reach app status API. '+e.message;}
}
document.addEventListener('DOMContentLoaded',()=>{mount();checkProvider(false);document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;b.classList.add('tap-feedback');setTimeout(()=>b.classList.remove('tap-feedback'),300);});});
})();