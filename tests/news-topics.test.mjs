import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTopic,relevantToTopic,relevantToQuery,TOPICS} from '../functions/_shared/news-topics.js';
import {onRequestGet} from '../functions/api/news.js';

test('news categories have independent relevance rules, never duplicate the same broad results by fallback',()=>{
 assert.deepEqual(Object.keys(TOPICS),['all','earnings','rates','energy','canada','technology']);
 assert.equal(normalizeTopic('invalid'),'all');
 assert.ok(relevantToTopic('Apple posts quarterly earnings and higher profit','earnings'));
 assert.ok(!relevantToTopic('Apple posts quarterly earnings and higher profit','energy'));
 assert.ok(relevantToTopic('OPEC crude oil production update','energy'));
 assert.ok(!relevantToTopic('OPEC crude oil production update','rates'));
 assert.ok(relevantToTopic('Federal Reserve interest rate decision','rates'));
 assert.ok(relevantToTopic('TSX Canadian markets rebound','canada'));
 assert.ok(relevantToTopic('Nvidia AI semiconductor outlook','technology'));
 assert.ok(relevantToQuery('Apple rallies on earnings','Apple'));
 assert.ok(!relevantToQuery('Apple rallies on earnings','Microsoft'));
});

test('each selected category returns genuinely relevant headlines, without recycling all-markets stories',async()=>{
 const fixtures=[
  'Apple posts quarterly earnings and higher profit',
  'Federal Reserve interest rate decision affects bonds',
  'OPEC crude oil production update',
  'TSX Canadian markets rebound',
  'Nvidia AI semiconductor chip forecast'
 ];
 const date=new Date().toUTCString();
 const body='<?xml version="1.0"?><rss><channel>'+fixtures.map((name,i)=>
  '<item><title>'+name+'</title><link>https://news.example.com/story-'+i+'</link><pubDate>'+date+'</pubDate></item>'
 ).join('')+'</channel></rss>';
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(body,{status:200,headers:{'content-type':'application/rss+xml'}});
 try{
  const categories=['earnings','rates','energy','canada','technology'];
  const seen=[];
  for(const category of categories){
   const res=await onRequestGet({request:new Request('https://rangeform.pages.dev/api/news?category='+category+'&region=CA')});
   assert.equal(res.status,200);
   const payload=await res.json();
   assert.equal(payload.category,category);
   assert.equal(payload.items.length,1,'Expected strictly filtered '+category);
   seen.push(payload.items[0].title);
  }
  assert.equal(new Set(seen).size,5,'Different categories should not default to identical output');
  const narrow=await onRequestGet({request:new Request('https://rangeform.pages.dev/api/news?category=energy&q=Apple')});
  assert.equal((await narrow.json()).items.length,0,'Do not fill an empty category with unrelated articles');
 }finally{globalThis.fetch=original}
});
