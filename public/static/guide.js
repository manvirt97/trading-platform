/* Rangeform Signal Desk 4.0: transparent, educational, no execution. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=v=>Number.isFinite(Number(v))?'$'+Number(v).toLocaleString('en-CA',{maximumFractionDigits:2,minimumFractionDigits:2}):'—';
let active=null,enabled=false,connected=false,shownFor='',liveMode=false;
const night=()=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false}).format(new Date());
const freshness=x=>{
 if(!x||x.source!=='twelvedata')return {fresh:false,reason:'Illustration only — not real market data'};
 if(!['1min','5min','15min'].includes(x.interval))return {fresh:false,reason:'Daily bars cannot trigger a day trade'};
 const stamp=Date.parse(x.last_bar_utc),dur={'1min':60000,'5min':300000,'15min':900000}[x.interval];
 if(!Number.isFinite(stamp)||stamp>Date.now()+30000)return {fresh:false,reason:'Invalid timestamp — verify provider data'};
 let age=Date.now()-stamp;
 if(age>dur*3+60000){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).map(p=>[p.type,p.value]));const minute=Number(parts.hour)*60+Number(parts.minute);const outside=['Sat','Sun'].includes(parts.weekday)||minute<570||minute>=960;const ageLabel=age>=86400000?(age/86400000).toFixed(1)+' days':Math.round(age/60000)+' min';return {fresh:false,reason:outside?'Outside normal U.S. equity session (9:30–16:00 ET). Last completed bar '+ageLabel+' old — not a current quote.':'Last completed bar '+ageLabel+' old — stale for intraday trading.'}};
 return {fresh:true,reason:'Last completed bar: '+Math.max(0,Math.round(age/60000))+' min old; not a streaming quote'};
};
function direction(x){
 const f=freshness(x),score=Number(x.score),r=x.indicators||{};
 const up=score>=65,down=score<=35,breakUp=Number(x.last)>Number(r.resistance20),breakDown=Number(x.last)<Number(r.support20),rel=Number(r.rel_volume||0);
 const bullish=up&&breakUp&&rel>=1.1&&x.data_quality==='complete-ohlcv';
 const bearish=down&&breakDown&&rel>=1.1&&x.data_quality==='complete-ohlcv';
 let bias=score>=65?'BULLISH WATCH':score<=35?'BEARISH WATCH':'NO CLEAR EDGE',kind=up?'buy':down?'sell':'wait';
 if(bullish){bias='BUY SETUP DETECTED';kind='buy';}
 if(bearish){bias='SELL PRESSURE DETECTED';kind='sell';}
 if(!f.fresh){bias=x.source==='archived-demo'?'DEMO · '+bias:'WAIT · '+(x.interval==='1day'?'DAILY DATA':'STALE OR IMPORTED');kind='wait';}
 const impact=(x.components||[]).slice().sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)).slice(0,3).map(z=>z.name+': '+(z.impact>0?'+':'')+z.impact+' pts');
 const atr=Number(r.atr14||0),last=Number(x.last),hi=Number(r.resistance20),lo=Number(r.support20);
 const invalidBuy=atr>0?last-1.2*atr:lo,invalidSell=atr>0?last+1.2*atr:hi;
 return {kind,bias,fresh:f.fresh,reason:f.reason,bullish,bearish,impact,entry:kind==='buy'?hi:kind==='sell'?lo:null,stop:kind==='buy'?invalidBuy:kind==='sell'?invalidSell:null,watch:kind==='buy'?'Look for a fresh completed bar above the 20-bar high WITH volume. A sudden move alone is not confirmation.':kind==='sell'?'Look for a fresh completed bar below support with volume. A bearish reading is not a command to short.':'Wait for trend, volume and a confirmed range break to agree.',detail:f.fresh?'Provider data available — not proof that the setup will work':f.reason};
}
function mount(){
 const controls=document.querySelector('#page-signals .controls-panel');
 if(controls&&!$('decisionDeck')){
  const panel=document.createElement('section');panel.id='decisionDeck';panel.className='decision-deck';panel.innerHTML=`<div class="desk-title"><span class="eyebrow">THE DECISION DESK / TIME SENSITIVE</span><span id="deskSource" class="desk-data">NO DATA YET</span></div><div class="desk-row"><div class="desk-verdict" id="deskVerdict"><span class="desk-eyebrow">RESEARCH SIGNAL</span><strong id="deskBias">WAIT FOR ANALYSIS</strong><span id="deskLine">Never act on demo, stale or unverified quotes.</span></div><div class="desk-metric"><small>ALIGNMENT</small><strong id="deskScore">—</strong><span>Indicator agreement · not win probability</span></div><div class="desk-metric"><small>LAST PRICE</small><strong id="deskPrice">—</strong><span id="deskTime">Latest completed candle</span></div></div><div class="desk-guide"><div><b>WHY THE SIGNAL?</b><p id="deskWhy">Run an analysis to see the strongest factors.</p></div><div><b>WHAT TO WATCH NEXT</b><p id="deskWatch">The app will explain confirmation and invalidation conditions.</p></div><div><b>REFERENCE LEVELS</b><p id="deskLevels">No levels available yet.</p></div></div><div class="desk-actions"><button class="desk-choice" id="deskBuy" aria-pressed="false">▲ Bullish conditions</button><button class="desk-choice" id="deskSell" aria-pressed="false">▼ Bearish conditions</button><button class="desk-choice" id="deskWait" aria-pressed="true">◷ Wait / no trade</button><button class="desk-risk" id="deskRisk">Open risk planner →</button></div><div id="deskChoiceNote" class="desk-choice-note">These are research views, not brokerage order buttons. No trades are executed.</div></section>`;
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
  let el=document.createElement('div');el.id='liveOverviewStrip';el.className='live-strip';el.innerHTML=`<span id="liveStripDot" class="strip-dot"></span><div><strong id="liveStripTitle">Demo market — no live data connected</strong><small id="liveStripSub">Connect a licensed provider in Cloudflare to unlock current completed bars.</small></div><button class="strip-action" id="liveStripAction">Connection setup →</button>`;
  intro.after(el);$('liveStripAction').onclick=()=>document.querySelector('[data-page="settings"]')?.click();
 }
 const status=document.querySelector('#page-settings .connection-list');
 if(status&&!$('setupLive')){
  let el=document.createElement('div');el.className='live-setup';el.id='setupLive';el.innerHTML=`<div class="setting-caption">PERSONAL LIVE-DATA CONNECTION</div><h3>Turn on your own market feed</h3><p>① Protect this Pages website with Cloudflare Access (only you can sign in). ② Add <code>TWELVEDATA_API_KEY</code> as an encrypted Cloudflare secret. ③ Add <code>LIVE_DATA_ENABLED</code> with value <code>on</code>. ④ Redeploy and reload this page.</p><p>Without an API key, the app intentionally shows synthetic prices. Individual data plans cannot be used to redistribute quotes on a public site. This feature uses REST polling, not tick-by-tick streaming.</p><button id="checkConnection" class="btn btn-primary">Check provider connection ↻</button><span id="connectionMessage" class="conn-note">Waiting for connection check</span>`;
  status.parentElement.append(el);
  $('checkConnection').onclick=()=>checkProvider(true);
 }
 let toolbar=$('page-signals')?.querySelector('.controls-panel');
 if(toolbar&&!$('sourceHint')){let el=document.createElement('div');el.id='sourceHint';el.className='source-hint';el.textContent='Data source and timestamp must be verified before using an intraday setup.';toolbar.after(el)}
}
window.renderTradeGuide=(x)=>{
 mount();active=x;let s=direction(x),r=x.indicators||{},stamp=x.last_bar_utc||'';
 $('deskSource').textContent=x.source==='twelvedata'?'TWELVE DATA · CHECK MARKET HOURS':x.source==='user-csv'?'IMPORTED CSV · UNVERIFIED':'SYNTHETIC DEMO';
 $('deskVerdict').dataset.bias=s.kind;$('deskBias').textContent=s.bias;$('deskLine').textContent=s.detail;
 $('deskScore').textContent=x.score+'/100';$('deskPrice').textContent=usd(x.last);$('deskTime').textContent=x.interval+' • '+(stamp?new Date(stamp).toLocaleString('en-CA',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' ET':'—');
 $('deskWhy').textContent=s.impact.join(' • ')||'Not enough information.';
 $('deskWatch').textContent=s.watch;
 $('deskLevels').textContent='Prior high '+usd(r.resistance20)+' • Prior low '+usd(r.support20)+(s.stop?' • Illustrative invalidation '+usd(s.stop):'')+'. Verify current bid/ask and costs.';
 $('deskChoiceNote').textContent=s.fresh?'This is a time-sensitive research setup, not an order. Check market hours, liquidity, spread and breaking news.':'No actionable trade signal: '+s.reason;
 for(let [id,bias] of [['deskBuy','buy'],['deskSell','sell'],['deskWait','wait']]){$(id).classList.toggle('chosen',bias===s.kind);$(id).setAttribute('aria-pressed',String(bias===s.kind))}
 if(s.fresh && (s.bullish||s.bearish)&&shownFor!==x.symbol+'|'+x.interval+'|'+stamp+'|'+s.kind){shownFor=x.symbol+'|'+x.interval+'|'+stamp+'|'+s.kind;if(localStorage.getItem('rangeform_alerts')==='yes'){try{window.toast?.('New '+s.kind.toUpperCase()+' setup: '+x.symbol+' • verify timestamp and spread.')}catch{}}}
};
window.renderOverviewGuide=(x,radar)=>{
 mount();let fresh=freshness(x),n=(radar?.rows||[]).filter(y=>y.source==='twelvedata'&&!y.error).length;
 $('liveStripDot').classList.toggle('on',x.source==='twelvedata'&&fresh.fresh);
 $('liveStripTitle').textContent=x.source==='twelvedata'?'Twelve Data connected • '+x.symbol+' '+x.interval:'Synthetic demo • no live quotes';
 $('liveStripSub').textContent=x.source==='twelvedata'?(fresh.reason+' • '+n+' watchlist symbols loaded. Data may be delayed.'):'See the TradingView chart above. The rule-based model is illustrative until licensed market history is available.';
 $('liveStripAction').textContent=x.source==='twelvedata'?'Review setup →':'Connect market data →';
};
window.renderOverviewError=message=>{mount();$('liveStripTitle').textContent='Market data unavailable';$('liveStripSub').textContent=message};
async function checkProvider(show){mount();let msg=$('connectionMessage');if(msg)msg.textContent='Checking connection…';
 try{let r=await fetch('/api/status',{cache:'no-store'}),d=await r.json();connected=Boolean(d.twelvedata_configured);enabled=Boolean(d.twelvedata_enabled);if(msg)msg.textContent=enabled?'Personal provider detected. Public redistribution needs licensing review and timestamps must be checked.':connected?'API key found, but live data is locked. Protect the website and set LIVE_DATA_ENABLED=on.':'No provider key detected. Follow the steps above.';
  const live=$('sourceSelect');if(live){live.value='demo';$('intervalSelect').value='1day';}
  if(enabled && !liveMode){liveMode=true;/* Public landing never silently exhausts a personal data subscription. */}
  if(show){let check=$('checkConnection');if(check){check.classList.add('pressed');setTimeout(()=>check.classList.remove('pressed'),300)}}
 }catch(e){if(msg)msg.textContent='Cannot reach app status API. '+e.message;}
}
document.addEventListener('DOMContentLoaded',()=>{mount();checkProvider(false);document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;b.classList.add('tap-feedback');setTimeout(()=>b.classList.remove('tap-feedback'),300);});});
})();