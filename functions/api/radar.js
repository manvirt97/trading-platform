// Headline-based discovery; NOT a price scanner, trade signal or exhaustive web crawl.
import {json} from '../_shared/http.js';
const TOPICS = {
 tech: {query:'(NVIDIA OR Apple OR Microsoft OR AMD OR Tesla OR Amazon OR Meta) (earnings OR shares OR results) when:2d', label:'Technology'},
 market: {query:'stock market earnings inflation Federal Reserve shares when:2d',label:'Macro & markets'},
 energy: {query:'oil prices energy stocks crude OPEC Canada when:2d',label:'Energy'},
 canada: {query:'Toronto TSX Canadian stocks earnings when:2d',label:'Canada'}
};
const CANDIDATES=[
 {symbol:'NVDA',name:'NVIDIA',pat:/\bNVIDIA\b|\bNVDA\b/i},
 {symbol:'AAPL',name:'Apple',pat:/\bApple\b|\bAAPL\b/i},
 {symbol:'MSFT',name:'Microsoft',pat:/\bMicrosoft\b|\bMSFT\b/i},
 {symbol:'TSLA',name:'Tesla',pat:/\bTesla\b|\bTSLA\b/i},
 {symbol:'AMD',name:'AMD',pat:/\bAMD\b|Advanced Micro Devices/i},
 {symbol:'AMZN',name:'Amazon',pat:/\bAmazon\b|\bAMZN\b/i},
 {symbol:'META',name:'Meta',pat:/\bMeta Platforms\b|\bFacebook\b|\bMETA\b/i},
 {symbol:'SHOP',name:'Shopify',pat:/\bShopify\b|\bSHOP\b/i}
];
function decode(s){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(?:amp|quot|apos|lt|gt|#39|#x27);/g,m=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&#39;':"'",'&#x27;':"'"}[m]||m)).replace(/<[^>]+>/g,'').trim().slice(0,210)}
function field(s,k){let m=s.match(new RegExp('<'+k+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+k+'>','i'));return m?decode(m[1]):''}
function parse(xml,category){return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,12).map(match=>{let block=match[1],title=field(block,'title'),link=field(block,'link'),date=Date.parse(field(block,'pubDate'));let u;try{u=new URL(link);if(u.protocol!=='https:'||!['news.google.com','www.google.com'].includes(u.hostname))return null}catch{return null}if(!title||!Number.isFinite(date)||Date.now()-date>72*3600*1000||date>Date.now()+600000)return null;return{title,url:u.href,at:new Date(date).toISOString(),category}}).filter(Boolean)}
async function feed(k,country){const topic=TOPICS[k];const gl=country==='CA'?'CA':'US',ceid=country==='CA'?'CA:en':'US:en';const u='https://news.google.com/rss/search?'+new URLSearchParams({q:topic.query,hl:'en',gl,ceid});const r=await fetch(u,{headers:{Accept:'application/rss+xml'},cf:{cacheEverything:true,cacheTtl:900},signal:AbortSignal.timeout(5500)});if(!r.ok)throw Error('Feed unavailable');let body=await r.text();if(body.length>500000)throw Error('Feed too large');return parse(body,topic.label)}
export function rank(items){const rows=[];for(const c of CANDIDATES){const matched=items.filter(x=>c.pat.test(x.title));if(!matched.length)continue;const cited=matched.slice(0,3);const categories=new Set(matched.map(x=>x.category));rows.push({symbol:c.symbol,company:c.name,mentions:matched.length,coverage:categories.size,headline_age_hours:Math.round((Date.now()-Date.parse(cited[0].at))/3600000),reason:'Appeared in '+matched.length+' recent headline(s) across '+categories.size+' tracked topic(s). This is attention, not expected return.',sources:cited})}return rows.sort((a,b)=>b.coverage-a.coverage||b.mentions-a.mentions).slice(0,5)}
export async function onRequestGet({request}){const u=new URL(request.url),country=u.searchParams.get('region')==='CA'?'CA':'US';let results=await Promise.allSettled(Object.keys(TOPICS).map(k=>feed(k,country)));let items=results.filter(x=>x.status==='fulfilled').flatMap(x=>x.value);const dedup=[...new Map(items.map(x=>[x.url,x])).values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));const allDown=results.every(x=>x.status==='rejected');return json({as_of:new Date().toISOString(),region:country,source:'Google News RSS search (selected topics)',scope:'Limited public headlines: NOT the entire internet, prices, or a model forecast',availability:allDown?'unavailable':results.some(x=>x.status==='rejected')?'partial':'available',candidates:rank(dedup),headlines:dedup.slice(0,14),note:'Attention ranking only. No claimed ability to forecast returns. Headlines may be delayed, missing or duplicated.'},allDown?503:200)}
