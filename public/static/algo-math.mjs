/* Rangeform Algorithmic Desk: deterministic cost calculations, no broker connectivity. */
export const PAIRS = Object.freeze({ XBTUSD:"BTC / USD", ETHUSD:"ETH / USD" });
export const finite = value => Number.isFinite(Number(value)) ? Number(value) : NaN;
export const inRange = (v,min,max) => Number.isFinite(v) && v>=min && v<=max;
export function bookMetrics(book,feeBps=40,slipBps=10,notional=100){
 const bid=finite(book?.best_bid),ask=finite(book?.best_ask),f=finite(feeBps),s=finite(slipBps),n=finite(notional);
 if(!inRange(bid,0.000001,1e10)||!inRange(ask,0.000001,1e10)||bid>=ask||!inRange(f,0,250)||!inRange(s,0,250)||!inRange(n,1,100000))throw Error('Invalid book or execution assumptions.');
 const qty=n/ask;
 const buy=ask*(1+s/10000)*(1+f/10000),sell=bid*(1-s/10000)*(1-f/10000);
 const bids=Array.isArray(book.bids)?book.bids:[],asks=Array.isArray(book.asks)?book.asks:[];
 const bidQty=bids.reduce((a,x)=>a+Math.max(0,finite(x[1])||0),0),askQty=asks.reduce((a,x)=>a+Math.max(0,finite(x[1])||0),0);
 const topBidQty=finite(bids[0]?.[1]),topAskQty=finite(asks[0]?.[1]);
 return {bid,ask,mid:(bid+ask)/2,spreadBps:(ask-bid)/((ask+bid)/2)*10000,imbalance:bidQty+askQty>0?bidQty/(bidQty+askQty):null,qty,estimatedBuy:buy*qty,estimatedSale:sell*qty,estimatedRoundTrip:sell*qty-buy*qty,buyUnit:buy,sellUnit:sell,depthSufficient:topAskQty>=qty&&topBidQty>=qty,feeBps:f,slipBps:s};
}
export function contractPair({yes,no,yesFee=1,noFee=1,quantity=1}){
 const y=finite(yes),n=finite(no),fy=finite(yesFee),fn=finite(noFee),q=finite(quantity);
 if(!inRange(y,0.01,0.99)||!inRange(n,0.01,0.99)||!inRange(fy,0,25)||!inRange(fn,0,25)||!Number.isInteger(q)||q<1||q>100000)throw Error('Enter prices 1–99¢, fees 0–25¢, quantity 1–100,000.');
 const cost=q*(y+n+(fy+fn)/100),payout=q;
 return {cost,payout,edge:payout-cost,edgePerPair:1-y-n-(fy+fn)/100,positive:payout>cost};
}
export function assumedFill(side,price,qty,feeBps=40,slipBps=10){
 const p=finite(price),q=finite(qty),f=finite(feeBps),s=finite(slipBps);
 if(!['buy','sell'].includes(side)||!inRange(p,0.000001,1e10)||!inRange(q,0.00000001,1e8)||!inRange(f,0,250)||!inRange(s,0,250))throw Error('Invalid fill assumptions.');
 const execution=p*(side==='buy'?1+s/10000:1-s/10000);
 const gross=execution*q,fee=gross*f/10000;
 return {execution,fee,gross,total:side==='buy'?gross+fee:gross-fee};
}
export function paperGuard({paused=false,capital,cash,exposure=0,notional,lossToday=0,openCount=0}){
 const c=finite(capital),available=finite(cash),size=finite(notional),loss=finite(lossToday);
 if(paused)return 'Emergency pause is active.';
 if(!inRange(c,100,1e9)||!inRange(available,0,1e9)||!inRange(size,1,1e8))return 'Set valid paper capital and order size.';
 if(openCount>=1)return 'Close the existing paper position first.';
 if(loss<=-c*0.02)return 'Daily loss limit of 2% reached.';
 if(size>c*0.05)return 'Order exceeds 5% of initial paper capital.';
 if(size>available)return 'Insufficient paper cash.';
 if(exposure>c*0.05)return 'Exposure limit reached.';
 return null;
}
