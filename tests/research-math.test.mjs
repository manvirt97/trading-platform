import test from 'node:test';
import assert from 'node:assert/strict';
import {discountedCashFlow,portfolioRisk,earningsSurprises,allocationReview,dividendReview,competitiveRubric,monthlySeasonality,macroSensitivity} from '../public/static/research-math.mjs';

test('DCF is a transparent five-year user-assumption model and rejects unstable terminal spreads',()=>{
 const v={revenue:1000,growth:5,margin:20,tax:25,reinvest:5,wacc:10,terminal:2,shares:100,netDebt:50};
 const d=discountedCashFlow(v);
 assert.equal(d.years.length,5);
 assert.ok(d.perShare>0);
 assert.ok(d.terminalShare>0&&d.terminalShare<100);
 assert.equal(d.sensitivity.length,3);
 assert.ok(d.sensitivity[0].value>d.sensitivity[2].value,'Higher WACC reduces theoretical DCF value');
 assert.match(d.source,/user assumptions/i);
 assert.throws(()=>discountedCashFlow({...v,wacc:2.2,terminal:2}),/exceed/);
 assert.throws(()=>discountedCashFlow({...v,shares:0}),/Diluted shares/);
});
test('Portfolio risk uses already CAD-converted holdings, concentration and explicit uniform stress',()=>{
 const p=portfolioRisk([{symbol:'AAPL',value:7500,sector:'Technology',currency:'USD'},{symbol:'XEG',value:2500,sector:'Energy',currency:'CAD'}],-20);
 assert.equal(p.total,10000);
 assert.equal(p.hhi,6250);
 assert.equal(p.stressLoss,-2000);
 assert.equal(p.top[0].weight,75);
 assert.equal(p.currencies.find(x=>x.name==='USD').weight,75);
 assert.match(p.notes.join(' '),/converted/);
 assert.throws(()=>portfolioRisk([{symbol:'BAD',value:-1}]),/Value of/);
});
test('Historical earnings surprise handles negative estimates and does not invent calendars',()=>{
 const x=earningsSurprises([{quarter:'Q1',expected:-.2,actual:-.1},{quarter:'Q2',expected:.5,actual:.45}]);
 assert.equal(x.beats,1);
 assert.equal(x.misses,1);
 assert.equal(x.quarters[0].surprisePct,50);
 assert.equal(x.quarters[1].surprisePct,-10);
 assert.match(x.source,/user-provided/);
});
test('Blueprint enforces 100 percent without supplying a personalized target',()=>{
 assert.equal(allocationReview({equity:60,bonds:30,cash:10,alternatives:0}).valid,true);
 assert.equal(allocationReview({equity:90,bonds:30,cash:0,alternatives:0}).valid,false);
 assert.throws(()=>allocationReview({equity:110,bonds:0,cash:0,alternatives:0}),/equity/);
});
test('Dividend analysis exposes non-positive earnings coverage and self-reported data',()=>{
 const d=dividendReview({price:50,annual:2,eps:4,fcf:3,oldDividend:1.5});
 assert.equal(d.yieldPct,4);
 assert.equal(d.payoutPct,50);
 assert.ok(d.fiveYearGrowthPct>0);
 const noCoverage=dividendReview({price:50,annual:2,eps:-1,fcf:0,oldDividend:1});
 assert.equal(noCoverage.payoutPct,null);
 assert.equal(noCoverage.fcfPayoutPct,null);
 assert.ok(noCoverage.flags.length>=2);
});
test('Moat rubric never treats subjective scores as verified market share',()=>{
 const d=competitiveRubric({pricing:5,cost:4,switching:3,distribution:4,innovation:5});
 assert.equal(d.score,84);
 assert.match(d.source,/subjective self-assessment/);
 assert.match(d.confidence,/LOW/);
});
test('Monthly historical pattern finder reports sample size and refuses one-month extrapolation',()=>{
 const bars=[];
 for(let year=2020;year<=2025;year++)for(let month=1;month<=12;month++){
  bars.push({date:year+'-'+String(month).padStart(2,'0')+'-20',close:100+(year-2020)*9+month});
 }
 const x=monthlySeasonality(bars);
 assert.equal(x.results.length,12);
 assert.equal(x.results[0].count,5);
 assert.equal(x.results[1].count,6);
 assert.equal(x.results[0].evidence,'Preliminary');
 assert.ok(x.observations>=70);
 assert.throws(()=>monthlySeasonality(bars.slice(0,12)),/50/);
});
test('Macro sensitivity isolates mechanical USD translation and does not invent GDP stock returns',()=>{
 const p=portfolioRisk([{symbol:'USD',value:5000,sector:'Equity',currency:'USD'},{symbol:'CAD',value:5000,sector:'Equity',currency:'CAD'}]);
 const m=macroSensitivity({rateBps:25,inflationPp:1,growthPp:-1,usdCadPct:5},p);
 assert.equal(m.fxOnly,250);
 assert.equal(m.affectedUsdWeight,50);
 assert.match(m.source,/hypothetical/);
 assert.equal(m.notes.length,4);
 assert.equal(macroSensitivity({rateBps:0,inflationPp:0,growthPp:0,usdCadPct:0},null).fxOnly,null);
});
