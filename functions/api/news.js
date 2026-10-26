// Public news discovery. A news article is not a real-time quote or verified catalyst.
import {json} from '../_shared/http.js';
import {resolveSymbol,suggestSymbols} from '../_shared/symbols.js';
const html=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(amp|quot|apos|lt|gt|#39|#x27|nbsp);/gi,(all,v)=>({'amp':'&','quot':'"','apos':"'",'lt':'<','gt':'>','#39':"'",'#x27':"'",'nbsp':' '}[v.toLowerCase()]||all)).replace(/<[^>]*>/g,'').trim().slice(0,320);
const field=(txt,key)=>{let m=txt.match(new RegExp('<'+key+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+key+'>','i'));return m?html(m[1]):''};
const safeUrl=url=>{try{let u=new URL(url);return u.protocol==='https:'&&['news.google.com','www.google.com'].includes(u.hostname)?u.href:null}catch{return null}};
function parse(xml,topic){
 return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,25).map(m=>{
  let title=field(m[1],'title'),url=safeUrl(field(m[1],'link')),published=Date.parse(field(m[1],'pubDate'));
  if(!url||!title||!Number.isFinite(published)||published>Date.now()+15*60000||Date.now()-published>7*86400000)return null;
  let source=field(m[1],'source')||'Google News source';
  return {title,url,source,date:new Date(published).toISOString(),topic};
 }).filter(Boolean);
}
async function googleNews(q,region,topic='Market'){
 const gl=region==='CA'?'CA':'US',ceid=gl+':en';
 const u='https://news.google.com/rss/search?'+new URLSearchParams({q,hl:'en',gl,ceid});
 const resp=await fetch(u,{headers:{Accept:'application/rss+xml, application/xml'},cf:{cacheEverything:true,cacheTtl:600},signal:AbortSignal.timeout(6500)});
 if(!resp.ok)throw Error('Public news feed HTTP '+resp.status);
 const data=await resp.text();if(data.length>550000)throw Error('News feed too large');
 return parse(data,topic);
}
async function finnhubNews(sym,key){
 const to=new Date(),from=new Date(Date.now()-5*86400000),q=new URLSearchParams({symbol:sym,from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10),token:key});
 const r=await fetch('https://finnhub.io/api/v1/company-news?'+q,{cf:{cacheEverything:true,cacheTtl:600},signal:AbortSignal.timeout(6000)});
 if(!r.ok)throw Error('Finnhub HTTP '+r.status);
 let rows=await r.json();if(!Array.isArray(rows))throw Error('Finnhub returned no list');
 return rows.slice(0,30).filter(x=>{try{return x.headline&&new URL(x.url).protocol==='https:'}catch{return false}}).map(x=>({title:String(x.headline).slice(0,300),url:x.url,source:x.source||'Finnhub',date:new Date(Number(x.datetime)*1000).toISOString(),topic:'Company'}));
}
export async function onRequestGet({request,env}){
 const u=new URL(request.url),raw=(u.searchParams.get('q')||u.searchParams.get('symbol')||'').trim().slice(0,80),region=u.searchParams.get('region')==='CA'?'CA':'US';
 const typedSymbol=/^[A-Z][A-Z0-9.-]{0,9}$/.test(raw.toUpperCase())&&raw.length<=6 ?raw.toUpperCase():null;
 let known=resolveSymbol(raw),symbol=known?.symbol||typedSymbol;
 const query=raw||'stock market';
 const isCompany=Boolean(symbol||known);
 const defaultTopics=[
  {q:'(stock market OR S&P 500 OR Nasdaq) (earnings OR rates OR shares) when:3d',label:'Markets'},
  {q:'(Federal Reserve OR Bank of Canada OR inflation OR oil) (stocks OR markets) when:3d',label:'Macro'},
  {q:'(Nvidia OR Apple OR Microsoft OR Tesla OR Shopify OR Canadian stocks) when:3d',label:'Companies'}
 ];
 const topics=raw?[{q:known?'"'+known.name.replace(/\s*\/.*/, '').replace(/"/g,'')+'" stock" when:5d':query+' (stocks OR shares OR earnings OR markets) when:5d',label:known?.name||'Search'}]:defaultTopics;
 const pending=topics.map(t=>googleNews(t.q,region,t.label));
 if(symbol&&env.FINNHUB_API_KEY)pending.push(finnhubNews(symbol,env.FINNHUB_API_KEY));
 const settled=await Promise.allSettled(pending);
 const items=settled.filter(x=>x.status==='fulfilled').flatMap(x=>x.value);
 const unique=[...new Map(items.map(x=>[x.url,x])).values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,28);
 const unavailable=settled.every(x=>x.status==='rejected');
 return json({query,region,symbol:symbol||null,recognized:known||null,suggestions:raw?suggestSymbols(raw,4):[],items:unique,provider:unavailable?'News feeds unavailable':'Google News RSS'+(symbol&&env.FINNHUB_API_KEY?' + optional Finnhub':''),availability:unavailable?'unavailable':settled.some(x=>x.status==='rejected')?'partial':'available',as_of:new Date().toISOString(),note:unique.length?'Recent public stories, not an exhaustive or instant feed. Follow the original source for time and accuracy.':'No verified recent stories returned from these sources; that does not mean no news exists.'},unavailable?503:200);
}
