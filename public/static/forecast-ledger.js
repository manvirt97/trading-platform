(function(){
'use strict';
const key='rangeform.forecastLedger.v1';
const form=document.getElementById('prediction'),list=document.getElementById('entries'),status=document.getElementById('status');
const allowed=new Set(['pending','higher','lower','unchanged','unresolved']);
function load(){try{const o=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(o)?o.filter(x=>x&&typeof x.id==='string'&&typeof x.symbol==='string').slice(0,100):[];}catch{return []}}
let records=load();
function persist(){try{localStorage.setItem(key,JSON.stringify(records.slice(0,100)));return true;}catch{status.textContent='Browser storage is full or disabled; this forecast was not saved.';return false;}}
function el(tag,cls,content){const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e;}
function format(ts){const d=new Date(ts);return Number.isNaN(d.valueOf())?'Date unavailable':d.toLocaleString();}
function shareText(r){return 'Rangeform Forecast Ledger (self-reported, NOT VERIFIED): '+r.symbol+' · '+(r.direction==='up'?'higher':'lower')+' · '+r.horizon+'. Recorded locally '+format(r.createdAt)+'. Thesis: '+r.thesis+'. Manual outcome: '+r.outcome+'. Record is editable by the device owner and does not represent independently audited performance. Try the research journal: '+location.origin+'/forecast-ledger.html';}
async function copyOrShare(r,button){try{const message=shareText(r);if(navigator.share)await navigator.share({title:'Rangeform forecast (unverified)',text:message});else if(navigator.clipboard){await navigator.clipboard.writeText(message);button.textContent='Copied';}else button.textContent='Select this page URL to share';}catch(e){if(e.name!=='AbortError')button.textContent='Sharing not available';}}
function render(){
 list.replaceChildren();document.getElementById('count').textContent=records.length+' saved here';
 if(!records.length){list.append(el('div','empty','No recorded predictions yet. Save your first thesis to begin an honest research journal.'));return;}
 records.forEach(r=>{
 const card=el('article','entry');const head=el('div','entry-head');head.append(el('strong','symbol',r.symbol),el('span','direction',(r.direction==='up'?'↑ Higher':'↓ Lower')+' · '+r.horizon));card.append(head,el('p','thesis',r.thesis),el('p','entry-meta','Recorded locally: '+format(r.createdAt)+' · Outcome: '+(r.outcome==='pending'?'Pending':r.outcome)+' (manual, unverified)'));
 const actions=el('div','entry-actions');
 const outcome=el('select');outcome.setAttribute('aria-label','Record a manual outcome for '+r.symbol);
 [['pending','Pending'],['higher','Observed higher'],['lower','Observed lower'],['unchanged','No clear move'],['unresolved','Could not verify']].forEach(([value,label])=>{const option=el('option','',label);option.value=value;outcome.append(option)});outcome.value=allowed.has(r.outcome)?r.outcome:'pending';
 outcome.addEventListener('change',()=>{r.outcome=outcome.value;if(persist())render()});
 const share=el('button','','Share labelled record');share.type='button';share.addEventListener('click',()=>copyOrShare(r,share));
 const remove=el('button','secondary','Delete');remove.type='button';remove.addEventListener('click',()=>{if(!confirm('Delete this locally saved forecast?'))return;records=records.filter(x=>x.id!==r.id);persist();render()});
 actions.append(outcome,share,remove);card.append(actions);list.append(card);
 });
}
form.addEventListener('submit',e=>{
 e.preventDefault();if(!form.reportValidity())return;
 const value=Object.fromEntries(new FormData(form).entries());
 const symbol=value.symbol.toUpperCase().trim(),thesis=value.thesis.trim();
 if(!/^[A-Z0-9.-]{1,12}$/.test(symbol)||thesis.length<12||thesis.length>280)return;
 const row={id:globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2),symbol,direction:value.direction==='down'?'down':'up',horizon:['1 day','1 week','1 month'].includes(value.horizon)?value.horizon:'1 week',thesis,createdAt:new Date().toISOString(),outcome:'pending'};
 records.unshift(row);records=records.slice(0,100);if(persist()){form.reset();status.textContent='Saved privately on this device; no independent verification.';}render();
});
document.getElementById('export').addEventListener('click',()=>{
 const json=JSON.stringify({disclaimer:'User-edited, self-reported, unverified predictions; not trade records',exportedAt:new Date().toISOString(),entries:records},null,2);
 const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='rangeform-forecast-ledger.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();
})();