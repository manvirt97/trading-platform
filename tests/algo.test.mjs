import test from 'node:test';
import assert from 'node:assert/strict';
import {bookMetrics,contractPair,assumedFill,paperGuard} from '../public/static/algo-math.mjs';
const book={best_bid:9990,best_ask:10000,bids:[[9990,2],[9980,3]],asks:[[10000,2],[10010,3]]};
test('live-book economics use bid to exit, ask to enter, fees and slippage',()=>{
 const r=bookMetrics(book,40,10,100);
 assert.equal(r.bid,9990);assert.equal(r.ask,10000);
 assert.equal(r.depthSufficient,true);assert.ok(r.estimatedRoundTrip<0);
 assert.ok(r.estimatedSale<100);assert.ok(r.estimatedBuy>100);
 assert.equal(r.imbalance,.5);
});
test('no synthetic or invalid crossed quotes accepted',()=>{
 assert.throws(()=>bookMetrics({best_bid:100,best_ask:99},40,10,100),/Invalid/);
 assert.throws(()=>bookMetrics(null,40,10,100),/Invalid/);
 assert.throws(()=>bookMetrics(book,999,0,100),/Invalid/);
 assert.throws(()=>bookMetrics(book,40,0,0),/Invalid/);
});
test('identical binary outcome matched pair math nets both-side fees',()=>{
 const x=contractPair({yes:.47,no:.46,yesFee:1,noFee:1,quantity:100});
 assert.equal(Number(x.cost.toFixed(2)),95);assert.equal(x.payout,100);assert.equal(Number(x.edge.toFixed(2)),5);
 assert.equal(x.positive,true);
 const y=contractPair({yes:.52,no:.51,yesFee:1,noFee:1,quantity:1});
 assert.equal(y.positive,false);
});
test('contract calculator refuses malformed quotes and zero quantity',()=>{
 assert.throws(()=>contractPair({yes:1,no:.1}),/Enter/);
 assert.throws(()=>contractPair({yes:.4,no:.4,quantity:0}),/Enter/);
});
test('paper fill applies slippage and fees in the adverse direction',()=>{
 const b=assumedFill('buy',100,1,40,10),s=assumedFill('sell',100,1,40,10);
 assert.ok(b.total>100);assert.ok(s.total<100);assert.ok(b.total>s.total);
 assert.throws(()=>assumedFill('sell',-1,1),/Invalid/);
});
test('paper safety guard enforces pause, daily loss, exposure, size and cash',()=>{
 const base={capital:10000,cash:10000,notional:100,lossToday:0,openCount:0,paused:false};
 assert.equal(paperGuard(base),null);
 assert.match(paperGuard({...base,paused:true}),/pause/);
 assert.match(paperGuard({...base,openCount:1}),/Close/);
 assert.match(paperGuard({...base,notional:600}),/5%/);
 assert.match(paperGuard({...base,cash:50}),/Insufficient/);
 assert.match(paperGuard({...base,lossToday:-200}),/Daily loss/);
});
