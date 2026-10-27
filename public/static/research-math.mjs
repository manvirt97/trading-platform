// Rangeform Research Studio calculations (v13)
// Pure functions: no APIs, random prices, recommendations or browser dependencies.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const r=(n,d=2)=>finite(n)?Number(n.toFixed(d)):null;
const as=x=>x===''||x==null?NaN:Number(x);
const requireFinite=(v,name,min=-Infinity,max=Infinity)=>{
 const n=as(v);
 if(!finite(n)||n<min||n>max)throw Error(name+' must be between '+min+' and '+max+'.');
 return n;
};
export function discountedCashFlow(input){
 const revenue=requireFinite(input.revenue,'Base revenue (millions)',.001,1e9);
 const growth=requireFinite(input.growth,'Revenue growth %',-50,100)/100;
 const margin=requireFinite(input.margin,'Operating margin %',-100,100)/100;
 const tax=requireFinite(input.tax,'Tax rate %',0,60)/100;
 const reinvest=requireFinite(input.reinvest,'Reinvestment as % of revenue',0,100)/100;
 const wacc=requireFinite(input.wacc,'Discount rate %',1,50)/100;
 const terminal=requireFinite(input.terminal,'Terminal growth %',-5,10)/100;
 const shares=requireFinite(input.shares,'Diluted shares (millions)',.001,1e9);
 const netDebt=requireFinite(input.netDebt,'Net debt (millions)',-1e9,1e9);
 if(wacc-terminal<.01)throw Error('Discount rate must exceed terminal growth by at least 1 percentage point.');
 let sales=revenue,discounted=0;
 const years=[];
 for(let year=1;year<=5;year++){
  sales*=1+growth;
  const nopat=sales*margin*(1-tax);
  const fcf=nopat-sales*reinvest;
  const pv=fcf/Math.pow(1+wacc,year);
  discounted+=pv;
  years.push({year,revenue:r(sales),freeCashFlow:r(fcf),presentValue:r(pv)});
 }
 const fcf5=years.at(-1).freeCashFlow;
 const terminalValue=(fcf5*(1+terminal))/(wacc-terminal);
 const pvTerminal=terminalValue/Math.pow(1+wacc,5);
 const enterprise=discounted+pvTerminal;
 const equity=enterprise-netDebt;
 const perShare=equity/shares;
 const sensitivity=[];
 for(let x=-1;x<=1;x++){
  const rate=wacc+x*.01;
  if(rate-terminal<.01){sensitivity.push({rate:r(rate*100,1),value:null});continue;}
  const pvYears=years.reduce((sum,y)=>sum+(y.freeCashFlow||0)/Math.pow(1+rate,y.year),0);
  const term=fcf5*(1+terminal)/(rate-terminal)/Math.pow(1+rate,5);
  sensitivity.push({rate:r(rate*100,1),value:r((pvYears+term-netDebt)/shares)});
 }
 return {years,enterprise:r(enterprise),equity:r(equity),perShare:r(perShare),pvTerminal:r(pvTerminal),terminalShare:enterprise? r(100*pvTerminal/enterprise):null,sensitivity,units:'millions except per-share',source:'user assumptions, not sourced issuer guidance'};
}
export function portfolioRisk(rows,stressPct=-20){
 if(!Array.isArray(rows)||!rows.length||rows.length>30)throw Error('Provide 1–30 positions.');
 const valid=rows.map((x,i)=>{
  const symbol=String(x.symbol||'').trim().toUpperCase();
  if(!/^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol))throw Error('Row '+(i+1)+': enter a valid symbol.');
  const value=requireFinite(x.value,'Value of '+symbol,0.01,1e12);
  const sector=String(x.sector||'Unclassified').trim().slice(0,50)||'Unclassified';
  const currency=String(x.currency||'CAD').toUpperCase();
  if(!['CAD','USD','OTHER'].includes(currency))throw Error(symbol+': currency must be CAD, USD or OTHER.');
  return {symbol,value,sector,currency};
 });
 const stress=requireFinite(stressPct,'Uniform stress scenario %',-95,0);
 const total=valid.reduce((a,b)=>a+b.value,0);
 const mapBy=key=>{
  const totals=new Map();
  for(const p of valid)totals.set(p[key],(totals.get(p[key])||0)+p.value);
  return [...totals.entries()].map(([name,value])=>({name,value:r(value),weight:r(value/total*100,1)})).sort((a,b)=>b.value-a.value);
 };
 const concentration=valid.reduce((sum,x)=>sum+Math.pow(x.value/total,2),0);
 return {total:r(total),count:valid.length,top:[...valid].sort((a,b)=>b.value-a.value).slice(0,5).map(x=>({...x,weight:r(x.value/total*100,1)})),sectors:mapBy('sector'),currencies:mapBy('currency'),hhi:r(concentration*10000,0),largest:r(100*Math.max(...valid.map(x=>x.value))/total,1),stressPct:stress,stressLoss:r(total*stress/100),notes:['Input values must already be converted to one base currency (CAD recommended).','Uniform shock is hypothetical, not a recession forecast.','Pairwise return correlations and liquidity cannot be established without synchronized historical quotes.']};
}
export function earningsSurprises(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>8)throw Error('Enter 1–8 quarters.');
 const quarters=rows.map((row,i)=>{
  const q=String(row.quarter||'Q'+(i+1)).slice(0,24);
  const expected=requireFinite(row.expected,'Consensus EPS',-1e6,1e6);
  const actual=requireFinite(row.actual,'Actual EPS',-1e6,1e6);
  const pct=expected===0?null:r((actual-expected)/Math.abs(expected)*100,1);
  return {quarter:q,expected:r(expected),actual:r(actual),surprisePct:pct,result:actual>expected?'Beat':actual<expected?'Miss':'In line'};
 });
 return {quarters,beats:quarters.filter(x=>x.result==='Beat').length,misses:quarters.filter(x=>x.result==='Miss').length,averageSurprise:r(quarters.filter(x=>x.surprisePct!=null).reduce((a,b)=>a+b.surprisePct,0)/Math.max(1,quarters.filter(x=>x.surprisePct!=null).length),1),source:'user-provided EPS figures; dates/consensus are not independently verified'};
}
export function allocationReview(v){
 const items=['equity','bonds','cash','alternatives'].map(key=>({key,value:requireFinite(v[key],key+' allocation',0,100)}));
 const total=items.reduce((sum,x)=>sum+x.value,0);
 return {items,total:r(total,1),valid:Math.abs(total-100)<.01,notes:['An allocation framework is educational, not a personal investment recommendation.','Actual suitability depends on goals, timeline, taxes, emergency reserves and risk capacity.','Rebalancing can trigger trading fees or taxable gains.']};
}
export function dividendReview(v){
 const price=requireFinite(v.price,'Reference share price',.001,1e9);
 const annual=requireFinite(v.annual,'Annual dividend per share',0,1e8);
 const eps=requireFinite(v.eps,'Annual earnings per share',-1e9,1e9);
 const fcf=requireFinite(v.fcf,'Free cash flow per share',-1e9,1e9);
 const old=requireFinite(v.oldDividend,'Annual dividend per share five years ago',0,1e8);
 const yieldPct=100*annual/price;
 const payout=eps>0?100*annual/eps:null;
 const fcfPayout=fcf>0?100*annual/fcf:null;
 const growth=old>0?100*(Math.pow(annual/old,1/5)-1):null;
 return {yieldPct:r(yieldPct),payoutPct:r(payout),fcfPayoutPct:r(fcfPayout),fiveYearGrowthPct:r(growth),flags:[...(payout==null?['Earnings are non-positive: traditional earnings payout ratio is not meaningful.']:payout>100?['Dividend exceeds trailing annual earnings per share.']:[]),...(fcfPayout==null?['FCF per share is non-positive: cash coverage is not established.']:fcfPayout>100?['Annual dividend exceeds entered free cash flow per share.']:[])],source:'user-entered price, dividend, EPS and cash flow; not verified issuer data'};
}
export function competitiveRubric(scores,notes=''){
 const names=['pricing','cost','switching','distribution','innovation'];
 const values=names.map(name=>({name,score:requireFinite(scores[name],name+' rating',1,5)}));
 const avg=values.reduce((sum,x)=>sum+x.score,0)/values.length;
 return {criteria:values,score:r(avg*20,0),evidenceNote:String(notes||'').trim().slice(0,500),source:'subjective self-assessment only; no independent market-share or moat verification',confidence:String(notes||'').trim().length<30?'LOW · no documented support supplied':'UNVERIFIED · review cited issuer and industry sources'};
}
export function monthlySeasonality(points){
 if(!Array.isArray(points)||points.length<50)throw Error('Provide at least 50 dated historical closing prices.');
 const sorted=points.map((p,i)=>{
  const t=Date.parse(String(p.date||''));
  const close=requireFinite(p.close,'Closing price at row '+(i+1),.00001,1e12);
  if(!Number.isFinite(t)||!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date)))throw Error('Use YYYY-MM-DD dates.');
  return {date:p.date,t,close};
 }).sort((a,b)=>a.t-b.t);
 for(let i=1;i<sorted.length;i++)if(sorted[i].t===sorted[i-1].t)throw Error('Duplicate price date found.');
 const monthEnds=new Map();
 for(const p of sorted)monthEnds.set(p.date.slice(0,7),p);
 const ends=[...monthEnds.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 if(ends.length<13)throw Error('At least 13 distinct month-end observations are needed.');
 const months=Array.from({length:12},(_,i)=>({month:i+1,returns:[]}));
 let observations=0;
 for(let i=1;i<ends.length;i++){
  const [previousMonth,prev]=ends[i-1],[currentMonth,curr]=ends[i];
  const diff=(Number(currentMonth.slice(0,4))-Number(previousMonth.slice(0,4)))*12+(Number(currentMonth.slice(5,7))-Number(previousMonth.slice(5,7)));
  if(diff!==1)continue;
  const ret=(curr.close/prev.close-1)*100;
  months[Number(currentMonth.slice(5,7))-1].returns.push(ret);observations++;
 }
 return {observations,from:sorted[0].date,to:sorted.at(-1).date,results:months.map(({month,returns})=>{
   const n=returns.length,average=n?returns.reduce((a,b)=>a+b,0)/n:null;
   return {month,count:n,averagePct:average==null?null:r(average),positiveSharePct:n?r(100*returns.filter(x=>x>0).length/n,0):null,evidence:n<3?'Insufficient':n<6?'Preliminary':n<10?'Limited':'Moderate'};
 }),cautions:['Monthly averages can be driven by outliers; they are not predictions.','Issuer, rates, and earnings-event studies require separate dated event and benchmark datasets.','Survivorship bias, selection bias and structural market changes can invalidate patterns.']};
}
export function macroSensitivity(inputs,portfolio){
 const rate=requireFinite(inputs.rateBps,'Rate change, basis points',-1000,1000);
 const inflation=requireFinite(inputs.inflationPp,'Inflation change, percentage points',-20,20);
 const growth=requireFinite(inputs.growthPp,'GDP growth change, percentage points',-20,20);
 const usdCad=requireFinite(inputs.usdCadPct,'USD/CAD change %',-50,100);
 const pctUsd=portfolio?.currencies?.find(x=>x.name==='USD')?.weight||0;
 const fxOnly=portfolio?r(portfolio.total*(pctUsd/100)*(usdCad/100)):null;
 return {rateBps:rate,inflationPp:inflation,growthPp:growth,usdCadPct:usdCad,fxOnly,affectedUsdWeight:portfolio?r(pctUsd):null,notes:[
   rate>0?'Higher policy rates may pressure interest-sensitive valuations and borrowing costs; actual effects vary.':rate<0?'Lower policy rates may support financing and valuations, depending on why rates fell.':'No policy rate change assumed.',
   inflation>0?'Higher inflation may pressure margins unless firms can pass through costs.':inflation<0?'Lower inflation may ease input pressures, but could coincide with weaker demand.':'No inflation change assumed.',
   growth<0?'Weaker activity may challenge cyclical revenues and credit quality.':growth>0?'Stronger growth may help cyclical demand while potentially changing rates.':'No growth change assumed.',
   'USD/CAD shock is applied only to the USD-denominated share of a user-entered CAD-valued portfolio; underlying security prices are held constant.'
 ],source:'user-entered hypothetical macro shocks; not current data or a forecast'};
}
