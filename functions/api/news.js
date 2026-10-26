// Multi-source best-effort market headlines. No credentials, AI fabrication or cached fixed headlines.
import {json} from '../_shared/http.js';
import {resolveSymbol,suggestSymbols} from '../_shared/symbols.js';
import {TOPICS,normalizeTopic,relevantToTopic,relevantToQuery} from '../_shared/news-topics.js';
const RSS=[
 {id:'cnbc',name:'CNBC Markets',url:'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069'},
 {id:'mw',name:'MarketWatch',url:'https://feeds.content.dowjones.io/public/rss/mw_topstories'},
 {id:'cnbc-top',name:'CNBC Business',url:'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114'},
 {id:'google',name:'Google News',url:null}
];
const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/&(amp|quot|apos|lt|gt|nbsp);/gi,(_,e)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[e.toLowerCase()]||' ')).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,350);
const field=(s,k)=>{let m=String(s).match(new RegExp('<'+k+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+k+'>','i'));return m?decode(m[1]):''};
const isAllowed=u=>{try{let x=new URL(u);return x.protocol==='https:'&&!x.username&&!x.password&&x.hostname.length<120?x.href:null}catch{return null}};
function parseRSS(body,source) {
 const matches=[...body.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,45);
 return matches.map(x=>{
  const xml=x[1], title=field(xml,'title'),url=isAllowed(field(xml,'link')||field(xml,'guid'));
  const rawTime=field(xml,'pubDate')||field(xml,'date')||field(xml,'dc:date'),ms=Date.parse(rawTime);
  if(!title||!url||!Number.isFinite(ms)||ms>Date.now()+20*60000||Date.now()-ms>7*86400000)return null;
  return {title,url,source:field(xml,'source')||source,date:new Date(ms).toISOString(),topic:'MARKETS'};
 }).filter(Boolean)
}
function googleUrl(q,region){const gl=region==='CA'?'CA':'US';return 'https://news.google.com/rss/search?'+new URLSearchParams({q,hl:'en',gl,ceid:gl+':en'})}
function yahooUrl(symbol){return 'https://feeds.finance.yahoo.com/rss/2.0/headline?'+new URLSearchParams({s:symbol,region:'US',lang:'en-US'})}
async function readRSS(url,name){
 const res=await fetch(url,{headers:{Accept:'application/rss+xml,application/xml,text/xml'},cf:{cacheEverything:true,cacheTtl:420},signal:AbortSignal.timeout(7500)});
 if(!res.ok)throw Error(name+' HTTP '+res.status);
 const body=await res.text();if(body.length>800000)throw Error(name+' response too large');
 let rows=parseRSS(body,name);if(!rows.length)throw Error(name+' returned no recent dated items');return rows
}
export async function onRequestGet({request}){
 const u=new URL(request.url);
 const raw=String(u.searchParams.get('q')||u.searchParams.get('symbol')||'').trim().slice(0,80);
 const region=u.searchParams.get('region')==='CA'?'CA':'US';
 const category=normalizeTopic(u.searchParams.get('category'));
 const known=resolveSymbol(raw);
 const typed=/^[A-Z][A-Z0-9.-]{0,9}$/.test(raw.toUpperCase())&&raw.length<=6?raw.toUpperCase():null;
 const symbol=known?.symbol||typed||null;
 const base=TOPICS[category].query;
 const clean=raw.replace(/[^A-Za-z0-9 .&-]/g,'').slice(0,48);
 const q=clean?('('+clean+' OR '+(symbol||clean)+') '+(category==='all'?'stock market':TOPICS[category].label)+' when:5d'):base;
 const sources=RSS.map(src=>({...src,url:src.url||googleUrl(q,region)}));
 if(symbol)sources.push({id:'yahoo',name:'Yahoo Finance',url:yahooUrl(symbol)});
 const outcomes=await Promise.allSettled(sources.map(src=>readRSS(src.url,src.name)));
 const availability=outcomes.every(x=>x.status==='rejected')?'unavailable':outcomes.some(x=>x.status==='rejected')?'partial':'available';
 const data=outcomes.flatMap((outcome,i)=>outcome.status==='fulfilled'?outcome.value.map(item=>({...item,feed:sources[i].name})):[]);
 const searchName=known?.name||raw;
 // A category is a real filter. Do NOT fall back to broad unrelated headlines.
 const matches=data.filter(item=>relevantToTopic(item.title,category)&&relevantToQuery(item.title,searchName));
 const unique=[...new Map(matches.map(item=>[item.url,item])).values()]
  .sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,32)
  .map(item=>({...item,topic:TOPICS[category].label.toUpperCase()}));
 const errors=outcomes.map((o,i)=>o.status==='rejected'?sources[i].name+': '+String(o.reason?.message||'connection unavailable').slice(0,95):null).filter(Boolean);
 const noMatchMessage=availability==='unavailable'
  ?'Every configured public headline source is unavailable. No stories were invented.'
  :data.length&&!unique.length?'No matching '+TOPICS[category].label.toLowerCase()+' headlines were found in reachable feeds. The category is strictly filtered; select another category or broaden the search.'
  :'No recent matching headlines returned. Try another category or a broader search.';
 return json({
  query:raw,category,category_label:TOPICS[category].label,region,symbol,recognized:known||null,
  suggestions:raw?suggestSymbols(raw,4):[],
  items:unique,availability,provider:TOPICS[category].label+' · published coverage',
  sources_ok:outcomes.filter(x=>x.status==='fulfilled').length,sources_total:sources.length,
  as_of:new Date().toISOString(),errors,source_names:sources.filter((_,i)=>outcomes[i].status==='fulfilled').map(x=>x.name),
  note:unique.length?'Original dated headlines matching '+TOPICS[category].label+'. Not a live alert or comprehensive wire. Check publisher timestamps.':noMatchMessage
 },availability==='unavailable'?503:200)
}
