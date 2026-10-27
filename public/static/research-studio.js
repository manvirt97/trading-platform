import {discountedCashFlow,portfolioRisk,earningsSurprises,allocationReview,dividendReview,competitiveRubric,monthlySeasonality,macroSensitivity} from './research-math.mjs';

/* Research Studio v13: interactive, source-aware research workflows.
 * Data supplied by user or authorized Cloudflare history; never invent live fundamentals.
 */
const root=document.getElementById('studioRoot');
const nav=document.getElementById('studioNav');
const state={selected:'screener',portfolio:null,loading:false,lastBrief:''};
const money=(x,d=2)=>Number.isFinite(x)?x.toLocaleString('en-CA',{minimumFractionDigits:d,maximumFractionDigits:d}):'Not available';
const n=x=>x===''?NaN:Number(x);
const signed=x=>Number.isFinite(x)?(x>=0?'+':'')+money(x,1)+'%':'Not available';
const cleanSymbol=x=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(String(x||'').trim().toUpperCase());
const escapeStr=x=>String(x??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const box=(id,title,description,source,body)=>({id,title,description,source,body});
const input=(id,label,placeholder='',type='number',value='')=>`<label class="research-field"><span>${label}</span><input id="rs-${id}" name="${id}" type="${type}" ${type==='number'?'step="any"':''} placeholder="${placeholder}" value="${value}" autocomplete="off"></label>`;
const select=(id,label,options)=>{const ratings=["pricing","cost","switching","distribution","innovation"];const entries=ratings.includes(id)?[["","Choose an evidence rating"],...options]:options;return `<label class="research-field"><span>${label}</span><select id="rs-${id}" name="${id}">${entries.map(([value,title])=>`<option value="${value}">${title}</option>`).join("")}</select></label>`;};
const textarea=(id,label,example,rows=5)=>`<label class="research-field wide"><span>${label}</span><textarea id="rs-${id}" name="${id}" rows="${rows}" spellcheck="false" placeholder="${example}"></textarea></label>`;
const action=(id,label)=>`<button type="button" class="primary-btn studio-action" data-run="${id}">${label} <span aria-hidden="true">↗</span></button>`;
const tools=[
box('screener','Stock screener','Compare a small verified list of symbols against market momentum and pattern evidence. Fundamental ratios require a separate licensed issuer-data feed.','Source: server-side curated universe / completed OHLCV',
 `<div class="studio-form-grid">${select('universe','Universe',[['leaders','US large-cap leaders'],['diversified','Diversified US sample']])}</div>
  ${action('screener','Scan verified sample')}
  <div class="research-footnote">This is a restricted six-symbol sample—not a whole-market screen. P/E, sector-average valuation, revenue growth and debt-to-equity are shown as unavailable until reliable fundamental data is licensed.</div>`),
box('dcf','DCF valuation','Model five years of operating cash flow and explore how fair-value estimates move when assumptions change.','Source: your assumptions only · not current market value',
 `<div class="studio-form-grid">${input('revenue','Latest annual revenue · millions','e.g. 5000')}
  ${input('shares','Diluted shares outstanding · millions','e.g. 100')}
  ${input('growth','Annual revenue growth %','e.g. 7')}
  ${input('margin','Operating margin %','e.g. 18')}
  ${input('tax','Tax rate %','e.g. 25')}
  ${input('reinvest','Capital/reinvestment as % of revenue','e.g. 6')}
  ${input('wacc','Discount rate / WACC %','e.g. 10')}
  ${input('terminal','Perpetual growth %','e.g. 2')}
  ${input('netDebt','Net debt · millions (negative = net cash)','e.g. 200')}${select('dcfcurrency','Model currency',[['CAD','CAD'],['USD','USD']])}</div>
  ${action('dcf','Calculate five-year DCF')}
  <div class="research-footnote">Simplified unlevered FCF = operating profit after tax − assumed reinvestment. All amounts entered in the same currency. Working capital, non-operating assets, dilution and capital structure require further modelling.</div>`),
box('portfolio','Portfolio risk check','See where positions, sectors and currencies concentrate, and how a specified uniform downturn would affect their marked value.','Source: your entered portfolio values · kept only in this tab session',
 `<div class="studio-form-grid">${textarea('holdings','Holdings: ticker, CAD-equivalent value, sector, currency','SHOP,12000,Technology,CAD\nAAPL,5000,Technology,USD\nXEG,4000,Energy,CAD',6)}
 ${input('stress','Uniform market shock % · negative value','-20','number','-20')}</div>
 ${action('portfolio','Check concentration & stress')}
 <div class="research-footnote">Enter each position's market value already converted to CAD. The currency column indicates exposure only; it does not convert prices. Correlations, liquidity and tax-lot effects require additional data.</div>`),
box('earnings','Earnings breakdown','Compare EPS results with the consensus assumptions you supply, quarter by quarter. Flag surprises without pretending we have an earnings calendar.','Source: manually verified earnings reports and dated consensus estimates',
 `<div class="studio-form-grid">${input('issuer','Company / ticker','e.g. SHOP','text')}
 ${textarea('quarters','Quarter, consensus EPS, actual EPS','2026-Q2,0.25,0.29\n2026-Q1,0.20,0.22\n2025-Q4,0.18,0.17',5)}
 ${textarea('earnNotes','Management guidance or segment trends (optional)','Provide a verified issuer or filing reference, if known.',3)}</div>
 ${action('earnings','Review EPS surprises')}
 <div class="research-footnote">Earnings dates, revenue segmentation, historical stock reactions and the analyst consensus are not automatically fetched. Enter those only from a dated filing or reputable earnings-data provider.</div>`),
box('blueprint','Portfolio blueprint','Explore allocation trade-offs and check that an illustrative mix of assets adds up to 100%.','Source: hypothetical allocation values entered by you',
 `<div class="studio-form-grid">${input('equity','Equities %','e.g. 60')}
 ${input('bonds','Bonds %','e.g. 30')}
 ${input('cash','Cash %','e.g. 10')}
 ${input('alternatives','Other / alternatives %','e.g. 0')}</div>
 ${action('blueprint','Review asset allocation')}
 <div class="research-footnote">This is an educational allocation sandbox—not a recommendation personalized to your age, goals or risk capacity. Tax treatment and account type matter.</div>`),
box('chart','Chart breakdown','Translate verified completed daily candles into plain-English momentum, trend, support, resistance and pattern observations.','Source: authorized Twelve Data / licensed fallback · actual bar timestamps',
 `<div class="studio-form-grid">${input('chartSymbol','Company ticker','e.g. NVDA','text')}</div>
 ${action('chart','Analyze real chart history')}
 <div class="research-footnote">50-day and 200-day averages require enough completed daily bars. If a moving average or lookback period cannot be verified, we show “unavailable” rather than estimate it.</div>`),
box('dividend','Dividend research','Calculate yield, payout coverage and historical dividend growth from numbers supplied from issuer filings.','Source: entered price, EPS, dividend and free cash flow per share',
 `<div class="studio-form-grid">${input('price','Reference share price','e.g. 50')}
 ${input('annual','Annual dividend per share','e.g. 2')}
 ${input('eps','Trailing annual EPS','e.g. 3.5')}
 ${input('fcf','Trailing FCF per share','e.g. 3')}
 ${input('oldDividend','Annual dividend per share five years ago','e.g. 1.4')}</div>
 ${action('dividend','Assess dividend coverage')}
 <div class="research-footnote">The platform does not claim issuer payout streaks, real-time yields or approved dividends without a sourced fundamental-data connection. A large yield can indicate financial distress.</div>`),
box('edge','Competitive edge','Structure a business-moat comparison: pricing power, costs, switching costs, distribution and innovation.','Source: analyst/user qualitative assessment · NOT verified industry rankings',
 `<div class="studio-form-grid">${input('edgeName','Company or industry','e.g. Canadian integrated energy','text')}
 ${select('pricing','Pricing power',[['1','1 · Weak'],['2','2 · Limited'],['3','3 · Mixed'],['4','4 · Strong'],['5','5 · Exceptional']])}
 ${select('cost','Cost advantage',[['1','1 · Weak'],['2','2 · Limited'],['3','3 · Mixed'],['4','4 · Strong'],['5','5 · Exceptional']])}
 ${select('switching','Customer switching costs',[['1','1 · Weak'],['2','2 · Limited'],['3','3 · Mixed'],['4','4 · Strong'],['5','5 · Exceptional']])}
 ${select('distribution','Brand, distribution or network',[['1','1 · Weak'],['2','2 · Limited'],['3','3 · Mixed'],['4','4 · Strong'],['5','5 · Exceptional']])}
 ${select('innovation','Technology / innovation',[['1','1 · Weak'],['2','2 · Limited'],['3','3 · Mixed'],['4','4 · Strong'],['5','5 · Exceptional']])}
 ${textarea('evidence','Evidence / research references','Paste a short explanation and sources for each score.',4)}</div>
 ${action('edge','Build moat research brief')}
 <div class="research-footnote">All ratings are yours. Market shares, rival financials and five-year competitive outcomes require independently sourced reports; this rubric does not infer them.</div>`),
box('patterns','Historical pattern finder','Explore month-of-year returns and sample sizes from dated closing-price history, with warnings about weak evidence.','Source: your CSV of historical daily closes · data is processed locally',
 `<div class="studio-form-grid">${input('patternSymbol','Ticker / market','e.g. SPY','text')}
 ${textarea('dailyPrices','Daily closes as date,close (YYYY-MM-DD)','2023-01-03,380.82\n2023-01-04,383.76\n...\n2026-10-26,...',6)}</div>
 <label class="studio-file-field"><span>Or import a price-history CSV from your device (no upload)</span><input type="file" id="rs-priceFile" accept=".csv,text/csv"></label>
 ${action('patterns','Measure monthly patterns')}
 <div class="research-footnote">Requires at least 13 monthly observations; multi-year samples are much more meaningful. Rate-change reactions, earnings-day returns and recovery studies require separate dated event data, not just price bars.</div>`),
box('macro','Macro impact','Study qualitative links between rates, inflation, growth and currency changes, with a transparent currency-only scenario for a portfolio you enter.','Source: hypothetical macro changes you set · no automatically verified latest economic release',
 `<div class="studio-form-grid">${input('rateBps','Policy rate change · basis points','e.g. 25','number','0')}
 ${input('inflationPp','Inflation change · percentage points','e.g. 1','number','0')}
 ${input('growthPp','GDP growth change · percentage points','e.g. -1','number','0')}
 ${input('usdCadPct','Change in USD/CAD exchange rate %','e.g. 5','number','0')}</div>
 ${action('macro','Explain macro exposure')}
 <div class="research-footnote">Use the Portfolio Risk tool first for an optional USD currency-exposure estimate. A rate or growth shock is NOT translated into an assumed stock-market return without a calibrated model.</div>
 <div class="official-sources"><span>Official data to verify:</span><a href="https://www.bankofcanada.ca/rates/interest-rates/" target="_blank" rel="noopener noreferrer">Bank of Canada ↗</a><a href="https://www150.statcan.gc.ca/n1/en/type/data" target="_blank" rel="noopener noreferrer">Statistics Canada ↗</a><a href="https://fred.stlouisfed.org/" target="_blank" rel="noopener noreferrer">FRED ↗</a><a href="https://www.bls.gov/cpi/" target="_blank" rel="noopener noreferrer">US CPI ↗</a></div>`)
];
function $(id){return document.getElementById('rs-'+id)}
function val(id){return $(id)?.value?.trim()??''}
function elem(tag,cls,txt){const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=String(txt);return el}
function statement(text,kind='plain'){const e=elem('p','result-note '+kind,text);return e}
function valuesResult(title,values,notes=[],rows=[]){
 const area=$('result');if(!area)return;
 area.replaceChildren();
 area.append(elem('div','result-eyebrow','RESEARCH OUTPUT'),elem('h3','',title));
 const metrics=elem('div','studio-metrics');
 for(const [key,value] of values){const cell=elem('div','studio-metric');cell.append(elem('span','',key),elem('strong','',String(value)));metrics.append(cell)}
 if(values.length)area.append(metrics);
 if(rows.length)area.append(makeTable(rows));
 for(const note of notes){area.append(statement(note))}
 const source=tools.find(t=>t.id===state.selected)?.source||'User-provided inputs';
 state.lastBrief=[
   'Rangeform Research Studio · '+title,
   'Generated: '+new Date().toISOString(),
   'Source: '+source,
   'Metrics:',...values.map(([k,v])=>'- '+k+': '+v),
   'Observations:',...notes.map(x=>'- '+x),
   'Supporting table:',...rows.slice(0,35).map(x=>x.join(' | ')),
   'No guaranteed outcomes. Confirm cited data and use independent broker quotes before trading.'
 ].join('\n');
 const actions=elem('div','studio-result-actions');
 const copy=elem('button','subtle-btn','Copy research brief');copy.type='button';copy.dataset.researchAction='copy';
 const draft=elem('button','subtle-btn','Draft question for Research AI');draft.type='button';draft.dataset.researchAction='draft';
 actions.append(copy,draft);
 area.append(actions,statement('Nothing is submitted to an AI model automatically. Copying or drafting a question is your choice.'));
}
function makeTable(rows){const table=elem('table','studio-table');const body=elem('tbody');
 for(const row of rows){const tr=elem('tr');
 for(const [i,v] of row.entries()){const e=elem(i===0?'th':'td','',v);if(i===0)e.scope='row';tr.append(e)}
 body.append(tr)}
 table.append(body);const scroll=elem('div','studio-table-scroll');scroll.append(table);return scroll}
function error(message){state.lastBrief='';const area=$('result');if(!area)return;area.replaceChildren(statement(message,'error'))}
function parseRows(input,min=1){
 const lines=String(input).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length<min)throw Error('Enter at least '+min+' properly formatted row'+(min===1?'':'s')+'.');
 return lines.map(line=>line.split(',').map(s=>s.trim()));
}
function present(tool){
 state.selected=tool;state.lastBrief='';
 for(const tab of nav.querySelectorAll('[data-studio]')){const active=tab.dataset.studio===tool;tab.classList.toggle('active',active);tab.setAttribute('aria-current',active?'true':'false')}
 const t=tools.find(x=>x.id===tool);if(!t)return;
 // Body contains fixed, bundled templates only; never interpolates remote news or portfolio values.
 root.innerHTML=`<div class="studio-heading"><div><div class="eyebrow">STUDIO / ${escapeStr(t.id.toUpperCase())}</div><h2>${escapeStr(t.title)}</h2><p>${escapeStr(t.description)}</p></div><span class="studio-evidence-label">Evidence-first</span></div><div class="studio-form">${t.body}</div><div class="studio-output" id="rs-result" role="status" aria-live="polite"><p class="studio-empty">Enter the relevant information or load authorized historical data to generate a research brief. No sample prices or financial results are prefilled.</p></div><div class="studio-source"><span aria-hidden="true">ⓘ</span> ${escapeStr(t.source)}</div>`;
 // All inputs are empty except the clearly labelled macro baseline and stress assumptions.
}
async function getJSON(path){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),14000);
 try{const res=await fetch(path,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});const data=await res.json();if(!res.ok||data.error)throw Error(data.error||'Data provider request failed.');return data}finally{clearTimeout(timer)}}
function rowsOf(rows,limit=22){return rows.slice(0,limit).map(row=>row.map(v=>String(v??'Not available')))}
async function run(tool){
 const area=$('result');if(!area)return;
 const original=$('chartSymbol')?.value;
 try{
  if(tool==='dcf'){
   const m=discountedCashFlow(Object.fromEntries(['revenue','growth','margin','tax','reinvest','wacc','terminal','shares','netDebt'].map(x=>[x,val(x)])));
   const cur=val('dcfcurrency');valuesResult('Five-year DCF · '+cur,[['Implied value / share',cur+' '+money(m.perShare)],['Equity value',money(m.equity)+' million'],['Terminal share of enterprise value',m.terminalShare+'%']],
    ['Illustrative only; source: user assumptions. Terminal value sensitivity can be substantial. No issuer filings or current quote were retrieved.'],
    [...m.years.map(y=>['Year '+y.year,'Revenue '+money(y.revenue)+'m','FCF '+money(y.freeCashFlow)+'m','PV '+money(y.presentValue)+'m']),...m.sensitivity.map(x=>['WACC '+x.rate+'%',x.value==null?'Invalid growth/discount spread':'Value/share '+cur+' '+money(x.value)])]);return;
  }
  if(tool==='portfolio'){
   let rows=parseRows(val('holdings'));
   if(rows[0][0].toLowerCase()==='ticker'||rows[0][0].toLowerCase()==='symbol')rows=rows.slice(1);
   if(rows.some(x=>x.length!==4))throw Error('Use four comma-separated fields: ticker, CAD-equivalent value, sector, currency.');
   const p=portfolioRisk(rows.map(x=>({symbol:x[0],value:x[1],sector:x[2],currency:x[3]})),val('stress'));state.portfolio=p;
   valuesResult('Portfolio exposure · CAD equivalent',[['Total entered value','$'+money(p.total)],['Largest holding',p.largest+'%'],['Concentration index (HHI)',String(p.hhi)],['Scenario P/L', '$'+money(p.stressLoss)]],
   p.notes,[...p.top.map(x=>[x.symbol,money(x.value)+' CAD',x.weight+'%']),...p.sectors.map(x=>['Sector · '+x.name,x.weight+'%']),...p.currencies.map(x=>['Currency · '+x.name,x.weight+'%'])]);return;
  }
  if(tool==='earnings'){
   const rows=parseRows(val('quarters'));
   if(rows.some(x=>x.length!==3))throw Error('Use: quarter, consensus EPS, actual EPS (one row per quarter).');
   const r=earningsSurprises(rows.map(x=>({quarter:x[0],expected:x[1],actual:x[2]})));
   valuesResult('EPS research · '+(val('issuer')||'user-entered company'),[['Quarters',String(r.quarters.length)],['Beats',String(r.beats)],['Misses',String(r.misses)],['Average surprise',signed(r.averageSurprise)]],
   [r.source,'The reported EPS and consensus are unverified user inputs. Market reactions, segment revenues and future guidance must be checked in filings.'],r.quarters.map(x=>[x.quarter,x.result,x.surprisePct==null?'No % (zero estimate)':signed(x.surprisePct)]));return;
  }
  if(tool==='blueprint'){
   const x=allocationReview(Object.fromEntries(['equity','bonds','cash','alternatives'].map(k=>[k,val(k)])));
   valuesResult('Illustrative asset allocation',[['Total allocation',x.total+'%'],['Weights balance?',x.valid?'Yes':'No · adjust to 100%']],x.notes,x.items.map(x=>[x.key[0].toUpperCase()+x.key.slice(1),x.value+'%']));return;
  }
  if(tool==='dividend'){
   const x=dividendReview(Object.fromEntries(['price','annual','eps','fcf','oldDividend'].map(k=>[k,val(k)])));
   valuesResult('Dividend coverage',[['Indicative yield',x.yieldPct+'%'],['Earnings payout',x.payoutPct==null?'Not meaningful':x.payoutPct+'%'],['FCF payout',x.fcfPayoutPct==null?'Not meaningful':x.fcfPayoutPct+'%'],['Five-year annualized dividend change',x.fiveYearGrowthPct==null?'Unavailable':signed(x.fiveYearGrowthPct)]],
   [...x.flags,x.source,'The figures have not been independently verified; dividends can be reduced or eliminated.']);return;
  }
  if(tool==='edge'){
   const x=competitiveRubric(Object.fromEntries(['pricing','cost','switching','distribution','innovation'].map(k=>[k,val(k)])),val('evidence'));
   valuesResult('Competitive-position checklist · '+(val('edgeName')||'Unspecified business'),[['User rubric score',x.score+'/100'],['Evidence confidence',x.confidence]],
   [x.source,'This self-rated score must never be interpreted as verified market share, investment alpha or a probability of success.',x.evidenceNote?'Your supporting note: '+x.evidenceNote:'Add published financial and industry sources before drawing conclusions.'],x.criteria.map(x=>[x.name,x.score+'/5']));return;
  }
  if(tool==='patterns'){
   const rows=parseRows(val('dailyPrices'),50);
   let records=rows.filter(x=>x[0].toLowerCase()!=='date');
   if(records.some(x=>x.length<2))throw Error('Format each line as YYYY-MM-DD,closing price.');
   const x=monthlySeasonality(records.map(y=>({date:y[0],close:y[1]})));
   valuesResult('Monthly seasonality · '+(val('patternSymbol')||'user-supplied series'),[['Date range',x.from+' to '+x.to],['Monthly return observations',String(x.observations)]],x.cautions,x.results.map(y=>[new Date(2024,y.month-1,1).toLocaleString('en-CA',{month:'short'}),y.count+' observations',y.averagePct==null?'No estimate':signed(y.averagePct),y.evidence]));return;
  }
  if(tool==='macro'){
   const m=macroSensitivity({rateBps:val('rateBps'),inflationPp:val('inflationPp'),growthPp:val('growthPp'),usdCadPct:val('usdCadPct')},state.portfolio);
   valuesResult('Macro sensitivity · hypothetical shocks',[['Rate shock',m.rateBps+' bps'],['Inflation change',m.inflationPp+' pp'],['Growth change',m.growthPp+' pp'],['USD/CAD change',signed(m.usdCadPct)],['Currency-only portfolio P/L',m.fxOnly==null?'Add portfolio first':'CAD '+money(m.fxOnly)]], [...m.notes,'No current economic release or future forecast was fetched. Consult the official source links above.']);return;
  }
  if(tool==='screener'){
   const button=root.querySelector('[data-run="screener"]');button.disabled=true;button.textContent='Checking six verified symbols…';area.replaceChildren(statement('Requesting dated market evidence from Rangeform’s existing scanner.'));
   try{
    const d=await getJSON('/api/market-discovery?'+new URLSearchParams({universe:val('universe')}));
    valuesResult('Curated opportunity screen',[['Symbols checked',d.scanned+' / '+d.universe_size],['Conditional watches',String(d.actionable||0)],['Last checked',d.checked_at?new Date(d.checked_at).toLocaleString('en-CA'):'Unavailable']],
    ['A six-symbol sample, not a market-wide stock screener. Fundamental valuation and debt metrics are unavailable. Last-bar freshness, broker quotes and orders are separate.',...(d.errors||[]).slice(0,2).map(x=>'Provider limitation: '+(x.reason||'Incomplete data'))],
    (d.items||[]).map(x=>[x.symbol,String(x.quality_score??'—')+'/100',x.status||'Unavailable',x.reason||'No confirmation']));
   }finally{button.disabled=false;button.textContent='Scan verified sample ↗'}return;
  }
  if(tool==='chart'){
   const symbol=val('chartSymbol').toUpperCase();
   if(!cleanSymbol(symbol))throw Error('Enter a valid ticker like NVDA or SHOP.');
   const button=root.querySelector('[data-run="chart"]');button.disabled=true;button.textContent='Loading completed bars…';area.replaceChildren(statement('Checking authorized daily history and technical indicators.'));
   try{
    const d=await getJSON('/api/analyze?'+new URLSearchParams({source:'twelvedata',symbol,interval:'1day'}));
    if(!Array.isArray(d.bar_history)||!Number.isFinite(Number(d.last))||!Number.isFinite(Date.parse(d.last_bar_utc)))throw Error('Unverified or incomplete price history.');
    const b=d.bar_history.map(x=>Number(x.close));
    const listed=v=>typeof v==='number'&&Number.isFinite(v)?money(v):'Unavailable';
    const relation=typeof d.indicators?.sma20==='number'&&Number.isFinite(d.indicators.sma20)?(Number(d.last)>d.indicators.sma20?'Above':'At or below'):'Unavailable relative to';
    const ma200=b.length>=200?b.slice(-200).reduce((a,x)=>a+x,0)/200:null;
    const lookback=period=>b.length>=period+1?100*(b.at(-1)/b.at(-1-period)-1):null;
    valuesResult('Verified chart study · '+symbol,[['Last historical close',money(Number(d.last))+' '+(d.currency||'')],['Last completed bar',new Date(d.last_bar_utc).toLocaleString('en-CA')],['Indicator alignment',(d.score??'—')+'/100'],['RSI 14',String(d.indicators?.rsi14??'Unavailable')]],
    ['All prices are historical completed bars, not an executable broker quote. The indicator score is not a success probability.',
     'Trend: '+relation+' SMA20, based on available bars.',
     'One-month close-to-close: '+(lookback(21)==null?'Unavailable':signed(lookback(21)))+'. Six-month: '+(lookback(126)==null?'Unavailable':signed(lookback(126)))+'. One-year: '+(lookback(252)==null?'Unavailable':signed(lookback(252)))+'.',
     'Patterns: '+(d.patterns?.length?d.patterns.map(p=>p.name+' ('+p.type+')').join(', '):'None meeting the programmed criteria.')],
    [['Support (20 bars)',listed(d.indicators?.support20)],['Resistance (20 bars)',listed(d.indicators?.resistance20)],['SMA20',listed(d.indicators?.sma20)],['SMA50',listed(d.indicators?.sma50)],['SMA200',ma200==null?'Need 200 bars':money(ma200)],['Relative volume',String(d.indicators?.rel_volume??'Unavailable')+'×']]);
   }finally{button.disabled=false;button.textContent='Analyze real chart history ↗'}return;
  }
 }catch(e){error(String(e?.message||'Research calculation unavailable.').slice(0,350))}
}
function bootstrap(){
 if(!root||!nav)return;
 root.addEventListener('change',async event=>{
  const target=event.target;if(target?.id!=='rs-priceFile')return;
  const file=target.files?.[0];if(!file)return;
  if(file.size>500000){error('File exceeds the 500 KB local import limit.');return}
  try{const csv=await file.text();if(!csv.includes(','))throw Error('CSV must contain date,close rows.');
   $('dailyPrices').value=csv;const output=$('result');
   if(output)output.replaceChildren(statement('CSV loaded locally. Select Measure monthly patterns to analyze it.'));
  }catch(e){error('Could not read CSV: '+e.message)}
 });
 nav.addEventListener('click',e=>{
  const button=e.target.closest('[data-studio]');if(!button)return;present(button.dataset.studio);
  if(window.innerWidth<900)root.scrollIntoView({behavior:'smooth',block:'start'});
 });
 root.addEventListener('click',event=>{
  const exportButton=event.target.closest('[data-research-action]');
  if(exportButton){
   if(!state.lastBrief)return;
   if(exportButton.dataset.researchAction==='copy'){
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(state.lastBrief).then(()=>{exportButton.textContent='Copied ✓'}).catch(()=>{exportButton.textContent='Copy unavailable here'});
    else exportButton.textContent='Clipboard access unavailable';
   }
   if(exportButton.dataset.researchAction==='draft'){
    const prompt='Explain and critically review this research brief. Distinguish verified historical bars from entered assumptions. List missing data, risks, alternative scenarios and what would invalidate the conclusion. Do not invent numbers or guarantee trades.\\n\\n'+state.lastBrief;
    const assistant=document.getElementById('assistantQuestion');
    if(!assistant){error('Research AI editor is not loaded. Use Copy research brief instead.');return}
    assistant.value=prompt;
    const navAI=document.querySelector('.nav-link[data-page="overview"][data-focus="assistantTitle"]');
    if(navAI)navAI.click();
    else window.location.hash='overview';
    assistant.focus({preventScroll:true});
   }
   return;
  }
  const button=event.target.closest('[data-run]');if(button&&!state.loading){state.loading=true;Promise.resolve(run(button.dataset.run)).finally(()=>{state.loading=false})}
 });
 present('screener');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap);else bootstrap();
