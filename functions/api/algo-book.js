/* Read-only Kraken order book proxy. Zero authentication and zero order submission. */
const allowed={XBTUSD:'XBTUSD',ETHUSD:'ETHUSD'};
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0','x-content-type-options':'nosniff'}});
function levels(rows,descending){
 if(!Array.isArray(rows)||rows.length<1)throw Error('Missing market depth.');
 const out=rows.slice(0,20).map(r=>[Number(r[0]),Number(r[1])]);
 if(out.some(([p,q])=>!Number.isFinite(p)||p<=0||!Number.isFinite(q)||q<0))throw Error('Invalid market depth.');
 for(let i=1;i<out.length;i++)if(descending?out[i][0]>out[i-1][0]:out[i][0]<out[i-1][0])throw Error('Unsorted market depth.');
 return out;
}
export async function onRequestGet({request}){
 const u=new URL(request.url),pair=u.searchParams.get('pair')||'XBTUSD';
 if(!Object.hasOwn(allowed,pair))return respond({error:'Supported pairs: XBTUSD and ETHUSD.',code:'INVALID_PAIR'},400);
 let response;
 try{
  response=await fetch('https://api.kraken.com/0/public/Depth?pair='+allowed[pair]+'&count=20',{headers:{accept:'application/json'},signal:AbortSignal.timeout(7000),cf:{cacheTtl:0,cacheEverything:false}});
  if(!response.ok)throw Error('Kraken HTTP '+response.status);
  const raw=await response.json();
  if(!Array.isArray(raw.error)||raw.error.length||!raw.result||typeof raw.result!=='object')throw Error('Kraken unavailable or returned an error.');
  const key=Object.keys(raw.result)[0],entry=raw.result[key];
  const bids=levels(entry?.bids,true),asks=levels(entry?.asks,false);
  if(bids[0][0]>=asks[0][0])throw Error('Crossed or stale order book.');
  return respond({source:'Kraken Spot REST /Depth',mode:'PUBLIC_MARKET_SNAPSHOT',pair,observed_at:new Date().toISOString(),best_bid:bids[0][0],best_ask:asks[0][0],bids,asks,broker_orders:false});
 }catch(e){
  return respond({error:'Kraken live order-book data is unavailable. No prices or trades have been substituted.',code:'EXCHANGE_UNAVAILABLE',detail:String(e?.message||'Unknown upstream error').slice(0,120),broker_orders:false},503);
 }
}
