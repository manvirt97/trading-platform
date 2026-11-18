import test from 'node:test';
import assert from 'node:assert/strict';
import {runNiftyOptionBacktest,DEFAULT_OPTION_COSTS} from '../functions/_shared/nifty-options.js';
import {onRequestGet,onRequestPost} from '../functions/api/nifty-options-backtest.js';
import {readFileSync} from 'node:fs';
const start=Date.parse('2026-10-05T09:15:00+05:30');
function fixtures({days=4,withOptions=true}={}){
 const spot=[],options=[];const expiry='2026-10-09';
 const strikes=Array.from({length:19},(_,i)=>24550+i*50);
 for(let d=0;d<days;d++){
  const base=start+d*86400000;let prev=25000;
  for(let m=0;m<375;m++){
   const timestamp=new Date(base+m*60000).toISOString();
   const close=25000+55*Math.sin(m/12)+8*Math.cos(m/4)+d*3;
   const open=prev;prev=close;
   spot.push({timestamp,open,high:Math.max(open,close)+3,low:Math.min(open,close)-3,close,volume:1000+m});
   if(withOptions)for(const strike of strikes)for(const type of ['CE','PE']){
    const intrinsic=type==='CE'?Math.max(0,close-strike):Math.max(0,strike-close);
    const last=40+intrinsic*.55+Math.sin(m/7)*2+d*.1,first=Math.max(1,last-.4);
    options.push({timestamp,symbol:'NSE-NIFTY-09Oct26-'+strike+'-'+type,expiry,strike,option_type:type,
     open:first,high:last+1,low:first-.6,close:last,volume:500});
   }
  }
 }
 return {spot_bars:spot,option_bars:options,timeframe:5,entry_from:'09:30',cutoff:'14:30',lot_size:65,lots:1};
}
test('NIFTY 5, 15 and 30-minute bars use actual minute history; no invented option premiums',()=>{
 const input=fixtures();
 for(const tf of [5,15,30]){
  const res=runNiftyOptionBacktest({...input,timeframe:tf});
  assert.equal(res.broker_orders,false);
  assert.equal(res.range.minute_bars,input.spot_bars.length);
  assert.equal(res.range.option_minute_bars,input.option_bars.length);
  assert.ok(res.range.resampled_bars>=23);
  assert.deepEqual(Object.keys(res.comparisons),['itm5_buy','atm_buy','atm_sell']);
  for(const s of Object.values(res.comparisons)){
   assert.ok(s.trades>=0);
   assert.ok(s.trades_detail.every(t=>t.entry_effective>0&&t.exit_effective>0));
   assert.ok(s.trades_detail.every(t=>t.spot_chart.length>0));
  }
 }
});
test('all three option modes use distinct strike/side conventions and recognized STT fees',()=>{
 const res=runNiftyOptionBacktest(fixtures());
 const buy=res.comparisons.itm5_buy.trades_detail,atm=res.comparisons.atm_buy.trades_detail,sell=res.comparisons.atm_sell.trades_detail;
 assert.ok(buy.length>0&&atm.length>0&&sell.length>0,'fixture must produce completed trades in all modes');
 assert.ok(buy.every(t=>t.side==='BUY'));
 assert.ok(sell.every(t=>t.side==='SELL'));
 assert.ok(sell.every(t=>t.costs.stt>0));
 assert.ok(buy.every(t=>t.costs.brokerage===40));
 assert.ok(buy.every(t=>t.friction>0));
 assert.ok(buy.some(t=>t.strike!==atm[0].strike));
 assert.equal(DEFAULT_OPTION_COSTS.stt_after_2026_pct,.15);
});
test('missing exact premium or corrupted option prices cannot become fabricated trades',()=>{
 const input=fixtures({days:3});
 const bad=structuredClone(input);
 bad.option_bars[0].high=0;
 assert.throws(()=>runNiftyOptionBacktest(bad),/invalid OHLCV/);
 const missing=runNiftyOptionBacktest({...input,option_bars:input.option_bars.filter(x=>x.strike===24550)});
 assert.ok(Object.values(missing.missing_quote_or_exit_counts).some(v=>v>0));
 assert.ok(Object.values(missing.comparisons).every(x=>x.trades===0));
});
test('invalid timeframes and arbitrary session settings rejected',()=>{
 const input=fixtures({days:2,withOptions:false});
 input.option_bars=[{timestamp:'2026-10-05T09:15:00+05:30',symbol:'NSE-NIFTY-09Oct26-25000-CE',expiry:'2026-10-09',strike:25000,option_type:'CE',open:50,high:51,low:49,close:50,volume:5}];
 assert.throws(()=>runNiftyOptionBacktest({...input,timeframe:25}),/Timeframe/);
 assert.throws(()=>runNiftyOptionBacktest({...input,entry_from:'09:15'}),/Entry start/);
 assert.throws(()=>runNiftyOptionBacktest({...input,cutoff:'16:00'}),/cutoff/);
 assert.throws(()=>runNiftyOptionBacktest({...input,lots:0}),/Lots/);
});
test('options historical endpoint has an explicit data contract and never executes broker orders',async()=>{
 const get=await onRequestGet(),payload=await get.json();
 assert.equal(payload.broker_orders,false);assert.deepEqual(payload.timeframes,[5,15,30]);
 const post=await onRequestPost({request:new Request('https://rangeform.example/api/nifty-options-backtest',{method:'POST',headers:{'content-type':'application/json'},body:'{"spot_bars":[],"option_bars":[]}'})});
 assert.equal(post.status,400);assert.equal((await post.json()).broker_orders,false);
});
test('premium dashboard has real-data status, three modes, the center switch and no broker orders',()=>{
 const html=readFileSync(new URL('../public/strategy-builder.html',import.meta.url),'utf8');
 const source=readFileSync(new URL('../public/static/strategy-premium-v37.js',import.meta.url),'utf8');
 for(const token of ['rfMode','rfSpotFile','rfOptionFile','rfCostRows','rfSpotChart','rfTradeList','sbLiveTab','sbBacktestTab'])assert.match(html,new RegExp(token));
 assert.match(source,/NIFTY_OPTIONS_RESEARCH_ONLY/);
 assert.doesNotMatch(source,/placeOrder\s*\(|\/api\/orders|private\/AddOrder/);
});
