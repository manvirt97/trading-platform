import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('public/v9.html'),src=read('public/static/v9.js');
class Element {
 constructor(tag='div',id='',dataset={}){
  this.tagName=tag.toUpperCase();this.id=id;this.dataset={...dataset};
  this.hidden=false;this.value='';this.children=[];this.textContent='';this.style={};this.attributes={};this.handlers={};
  this.lastElementChild={};this.parentElement={clientWidth:500,clientHeight:350};this.className='';
  const values=new Set();this.classes=values;
  this.classList={add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),
   toggle:(v,on)=>{if(on===undefined?!values.has(v):on)values.add(v);else values.delete(v)}};
 }
 addEventListener(name,cb){this.handlers[name]=cb}
 removeEventListener(name){delete this.handlers[name]}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes]}
 setAttribute(k,v){this.attributes[k]=v}
 removeAttribute(k){delete this.attributes[k]}
 after(){}
 focus(){}
 closest(){return this}
 scrollIntoView(){}
 click(){if(this.onclick)return this.onclick({target:this,preventDefault(){}});return this.handlers.click?.({target:this,preventDefault(){}})}
}
test('V10 app boots and main navigation plus news filters respond in a browser-like DOM',async()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const elements=new Map();
 const byId=id=>{assert.ok(ids.has(id),'Reference to missing HTML #'+id);if(!elements.has(id))elements.set(id,new Element('div',id));return elements.get(id)};
 const pageNodes=['overview','signals','scanner','news'].map(section=>new Element('section','',{section}));
 const navNodes=[
  new Element('button','',{page:'overview'}),new Element('button','',{page:'signals'}),
  new Element('button','',{page:'scanner'}),new Element('button','',{page:'news'})
 ];
 const categoryNodes=['all','earnings','energy'].map(category=>new Element('button','',{category}));
 const agentFilterNodes=['all','Safety','unavailable'].map(agentFilter=>new Element('button','',{agentFilter}));
 const dataPageNodes=[...navNodes,new Element('button','',{page:'scanner'}),new Element('button','',{page:'signals'})];
 const body=new Element('body');
 const selectors={
  '[data-section]':pageNodes,'.nav-link[data-page]':navNodes,'[data-page]':dataPageNodes,
  '[data-category]':categoryNodes,'[data-agent-filter]':agentFilterNodes
 };
 const document={
  body,
  getElementById:byId,
  querySelectorAll:sel=>selectors[sel]||[],
  querySelector:sel=>sel==='.discovery-card'?new Element('article'):null,
  createElement:tag=>new Element(tag),
  addEventListener(name,cb){if(name==='DOMContentLoaded')this.ready=cb}
 };
 const listeners={};const location={hash:'#overview'};const fetches=[];
 const sandbox={
  document,location,history:{pushState(_s,_t,fragment){location.hash=fragment},replaceState(_s,_t,fragment){location.hash=fragment}},
  window:{addEventListener(name,cb){listeners[name]=cb},scrollTo(){}},
  localStorage:{getItem(){return null},setItem(){}},
  fetch:async path=>{fetches.push(String(path));return {ok:true,status:200,json:async()=>String(path).includes('/api/status')?{twelvedata_enabled:false,finnhub_fallback_enabled:false}:{items:[],as_of:'2026-10-26T10:00:00Z',sources_ok:1,sources_total:1,availability:'available'}}},
  CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}},
  URLSearchParams,AbortController,Date,Intl,console,Math,Number,String,Array,Map,Set,Error,
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
  requestAnimationFrame:callback=>callback()
 };
 sandbox.window.dispatchEvent=event=>listeners[event.type]?.(event);
 vm.runInNewContext(src,sandbox,{filename:'v9.js'});
 assert.equal(typeof document.ready,'function');
 document.ready();
 assert.equal(body.dataset.view,'overview','Initial page rendered');
 assert.ok(pageNodes[0].classList.contains('visible'));
 navNodes[1].click();
 assert.equal(body.dataset.view,'signals','Trade signals navigation');
 assert.ok(pageNodes[1].classList.contains('visible'));
 navNodes[3].click();
 assert.equal(body.dataset.view,'news','News navigation');
 assert.ok(pageNodes[3].classList.contains('visible'));
 categoryNodes[1].click();
 assert.ok(categoryNodes[1].classList.contains('selected'),'News filter selected');
 assert.equal(categoryNodes[0].classList.contains('selected'),false);
 dataPageNodes[4].click();
 assert.equal(body.dataset.view,'scanner','Opportunity scanner action');
 location.hash='#risk';listeners.hashchange();
 assert.equal(body.dataset.view,'signals','Old hash opens current risk section');
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(fetches.some(x=>x.includes('/api/status')));
});
test('Single-element selector is never treated like a NodeList',()=>{
 assert.doesNotMatch(src,/(?<!\$)\$\(\s*['"][^'"]+['"]\s*\)\.forEach\(/);
 for(const selector of ['[data-section]','.nav-link[data-page]','[data-page]','[data-category]']){
  assert.ok(src.includes("$$('"+selector+"').forEach"),'Expected plural selector for '+selector);
 }
});
