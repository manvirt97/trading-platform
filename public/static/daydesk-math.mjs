// Shared pure calculation for the on-page hypothetical position-sizing planner.
// No quote retrieval, brokerage access or personal-data storage.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const round=(x,p=2)=>finite(x)?Number(x.toFixed(p)):null;
export function positionPlan(input){
 const keys=['account','riskPct','entry','stop','capitalPct','fees','slippageBps','dailyLoss','usedDailyLoss'];
 const a=Object.fromEntries(keys.map(k=>[k,Number(input[k])]));
 for(const key of keys)if(input[key]===''||input[key]===null||!finite(a[key]))throw Error('Enter a valid '+key+' value.');
 if(a.account<=0||a.account>1e10)throw Error('Account value must be positive.');
 if(a.riskPct<=0||a.riskPct>5)throw Error('Risk per trade must be between 0% and 5%.');
 if(a.capitalPct<=0||a.capitalPct>100)throw Error('Maximum position allocation must be 1–100%.');
 if(a.dailyLoss<=0||a.dailyLoss>20||a.usedDailyLoss<0||a.usedDailyLoss>a.account)throw Error('Check the daily loss limit and losses used.');
 if(a.entry<=0||a.stop<=0||a.entry===a.stop)throw Error('Entry and stop must be positive and different.');
 if(a.slippageBps<0||a.slippageBps>500||a.fees<0||a.fees>1e6)throw Error('Check transaction-cost inputs.');
 const side=a.stop<a.entry?'long':'short',distance=Math.abs(a.entry-a.stop);
 const riskPerShare=distance+2*a.entry*a.slippageBps/10000;
 const grossRiskBudget=a.account*a.riskPct/100;
 const dailyRemaining=Math.max(0,a.account*a.dailyLoss/100-a.usedDailyLoss);
 const effectiveBudget=Math.min(grossRiskBudget,dailyRemaining);
 const maxSharesByCapital=Math.floor(a.account*a.capitalPct/100/a.entry);
 const maxSharesByRisk=Math.max(0,Math.floor((effectiveBudget-a.fees)/riskPerShare));
 const shares=Math.max(0,Math.min(maxSharesByCapital,maxSharesByRisk));
 const estimatedRiskWithCosts=shares>0?shares*riskPerShare+a.fees:0;
 const distance2r=Math.max(.01,a.entry+(side==='long'?1:-1)*distance*2);
 return {side,entry:a.entry,stop:a.stop,shares,notional:round(shares*a.entry),grossRiskBudget:round(grossRiskBudget),
  dailyRemaining:round(dailyRemaining),effectiveBudget:round(effectiveBudget),stopDistance:round(distance,4),
  estimatedRiskWithCosts:round(estimatedRiskWithCosts),hypothetical2R:round(distance2r,4),
  riskRewardIllustrative:'2:1 before potential target-side costs',
  readyToPlaceOrder:false,
  note:'Hypothetical share sizing only; ignores spread, short-borrow availability, liquidity shocks, margin, taxes and some broker charges. Stop orders can slip or fail to fill. Never a brokerage instruction.'};
}
