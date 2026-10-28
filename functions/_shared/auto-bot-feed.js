/* Kraken PUBLIC data only. No credentials, trading, account, or order endpoints. */
export async function publicMarket(pair='XBTUSD',now=Date.now(),fetchImpl=fetch){
 if(pair!=='XBTUSD')throw Error('Only XBTUSD is enabled for this strategy');
 const urls=[
  'https://api.kraken.com/0/public/Depth?pair=XBTUSD&count=10',
  'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=5'
 ];
 const responses=await Promise.all(urls.map(async url=>{
  const res=await fetchImpl(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000),cf:{cacheTtl:0,cacheEverything:false}});
  if(!res.ok)throw Error('Kraken market feed returned '+res.status);
  const json=await res.json();
  if(!Array.isArray(json.error)||json.error.length||!json.result)throw Error('Kraken market feed returned an error');
  const key=Object.keys(json.result).find(k=>k!=='last');
  if(!key)throw Error('Kraken response contains no market');
  return json.result[key];
 }));
 const [depth,raw]=responses;
 const bids=(depth?.bids||[]).slice(0,10).map(x=>[Number(x[0]),Number(x[1])]);
 const asks=(depth?.asks||[]).slice(0,10).map(x=>[Number(x[0]),Number(x[1])]);
 if(!bids.length||!asks.length||!bids.every(x=>x[0]>0&&x[1]>=0&&x.every(Number.isFinite))||!asks.every(x=>x[0]>0&&x[1]>=0&&x.every(Number.isFinite)))throw Error('Invalid market depth');
 for(let i=1;i<bids.length;i++)if(bids[i][0]>bids[i-1][0])throw Error('Unsorted bid levels');
 for(let i=1;i<asks.length;i++)if(asks[i][0]<asks[i-1][0])throw Error('Unsorted ask levels');
 if(bids[0][0]>=asks[0][0])throw Error('Crossed market');
 if(!Array.isArray(raw)||raw.length<37)throw Error('Insufficient completed candles');
 // Kraken's final OHLC entry is the current, not-yet-committed candle. Never use it for a signal.
 const bars=raw.slice(0,-1).slice(-100).map(x=>({time:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[6])}));
 if(bars.some((x,i)=>!Number.isInteger(x.time)||x.close<=0||x.high<x.low||x.low<=0||x.high<x.open||x.high<x.close||x.low>x.open||x.low>x.close||(i&&x.time<=bars[i-1].time)))throw Error('Invalid completed market candles');
 return {pair,book:{best_bid:bids[0][0],best_ask:asks[0][0],bids,asks},bars,fetchedAt:now,source:'Kraken public Spot /Depth and /OHLC',simulation:true};
}
