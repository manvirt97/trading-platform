/* Rangeform v38 unified workspace navigation and visual-only identity.
 * Never reads account credentials, market data, orders or trading state.
 * Preserves all existing page controls and mobile drawer handlers.
 */
(() => {
 'use strict';
 const links = Object.freeze([
  {label:'Overview',short:'Overview',href:'/v9.html#overview',icon:'▦',id:'overview'},
  {label:'Scanner',short:'Scanner',href:'/v9.html#scanner',icon:'◎',id:'scanner'},
  {label:'Day Desk',short:'Day Desk',href:'/v9.html#daydesk',icon:'▥',id:'daydesk'},
  {label:'Strategy Lab',short:'Strategy',href:'/strategy-builder.html',icon:'⌁',id:'strategy-builder'},
  {label:'Algorithmic',short:'Algo',href:'/algo.html',icon:'◇',id:'algo'},
  {label:'Paper Bot',short:'Paper',href:'/bot.html',icon:'⟳',id:'bot'},
  {label:'Agent Team',short:'Agents',href:'/agent-team.html',icon:'✳',id:'agent-team'},
  {label:'Forecast Ledger',short:'Ledger',href:'/forecast-ledger.html',icon:'◷',id:'forecast-ledger'},
  {label:'Account',short:'Account',href:'/account.html',icon:'☰',id:'account'}
 ]);
 const v9Sections = Object.freeze({
  overview:'Overview',scanner:'Opportunity Scanner',daydesk:'Day Trading Desk',
  signals:'Trade Signals',news:'News & Catalysts',studio:'Research Studio',
  ai:'Research AI',risk:'Risk Planner',journal:'Paper Journal',settings:'Settings'
 });
 const pageLabels = Object.freeze({
  'strategy-builder':'9/21 EMA Strategy Lab',algo:'Algorithmic Desk',
  bot:'Autonomous Paper Bot','agent-team':'Agent Command Centre',
  'forecast-ledger':'Forecast Ledger',account:'Account & Security'
 });
 const page = (location.pathname.match(/([^/]+?)(?:\.html)?\/?$/)?.[1] || 'v9').replace(/\.html$/,'');
 const section = () => (location.hash.slice(1).split(/[/?]/)[0] || 'overview');
 const current = () => page === 'v9' || page === 'index' ?
   (['overview','scanner','daydesk'].includes(section())?section():'overview') : page;
 const heading = () => page === 'v9' || page === 'index' ?
   (v9Sections[section()] || 'Overview') : (pageLabels[page] || 'Research Workspace');
 function makeAnchor(item) {
  const a = document.createElement('a');
  a.className = 'rf-suite-link';
  a.href = item.href;
  a.dataset.rfSuiteTarget = item.id;
  const ico = document.createElement('span');
  ico.className = 'rf-suite-symbol';ico.setAttribute('aria-hidden','true');ico.textContent = item.icon;
  const name = document.createElement('span');
  name.textContent = item.short;a.title = item.label;
  a.append(ico,name);
  return a;
 }
 function syncNav(nav,title) {
  const selected = current();title.textContent=heading();
  nav.querySelectorAll('.rf-suite-link').forEach(a => {
   if (a.dataset.rfSuiteTarget === selected) a.setAttribute('aria-current','page');
   else a.removeAttribute('aria-current');
  });
 }
 function addMissingRailLinks(){
  // Make the SAME core destinations discoverable from all existing rail variants.
  // Do not replace or rewire existing navigation controls.
  const rail=document.querySelector('.rail .rail-links, .account-rail .account-rail-links');
  if(!rail)return;
  const template=rail.querySelector('.rail-link, .account-rail-link');
  if(!template)return;
  for(const item of links.filter(x=>['strategy-builder','agent-team','forecast-ledger'].includes(x.id))){
   if(rail.querySelector('a[href="'+item.href+'"]'))continue;
   const anchor=document.createElement('a');
   anchor.href=item.href;
   anchor.className=template.classList.contains('account-rail-link')?'account-rail-link':'rail-link';
   if(current()===item.id){anchor.classList.add('current');anchor.setAttribute('aria-current','page')}
   const mark=document.createElement('span');
   mark.className=template.classList.contains('account-rail-link')?'account-nav-ico':'nav-symbol';
   mark.setAttribute('aria-hidden','true');mark.textContent=item.icon;
   const name=document.createElement('span');name.textContent=item.label;
   anchor.append(mark,name);
   rail.append(anchor);
  }
 }
 function init(){
  if(document.getElementById('rfSuiteBar'))return;
  const header=document.querySelector('.content-shell > header.topbar, .workspace > header.topbar, .account-workspace > header.account-topbar, header.sb-header, header.top');
  if(!header)return;
  document.body.dataset.rfUi='v38';
  const bar=document.createElement('nav');
  bar.className='rf-suite-bar';bar.id='rfSuiteBar';bar.setAttribute('aria-label','Rangeform workspace quick navigation');
  const context=document.createElement('div');context.className='rf-suite-context';
  const eyebrow=document.createElement('small');
  eyebrow.textContent='RANGEFORM  /  PROFESSIONAL WORKSPACE';
  const title=document.createElement('strong');title.id='rfSuiteTitle';
  context.append(eyebrow,title);
  const nav=document.createElement('div');nav.className='rf-suite-links';nav.id='rfSuiteLinks';
  for(const item of links)nav.append(makeAnchor(item));
  bar.append(context,nav);
  header.insertAdjacentElement('afterend',bar);
  syncNav(nav,title);addMissingRailLinks();
  window.addEventListener('hashchange',()=>syncNav(nav,title));
  window.addEventListener('popstate',()=>syncNav(nav,title));
  // Forecast Ledger is the only active page without a built-in theme toggle.
  if(page==='forecast-ledger' && window.RangeformTheme) {
   const button=document.createElement('button');
   button.type='button';button.className='rf-suite-theme';
   button.setAttribute('aria-label','Toggle light or dark theme');button.textContent='◐';
   button.addEventListener('click',()=>{
    const next=window.RangeformTheme.read()==='dark'?'light':'dark';
    window.RangeformTheme.apply(next);
   });
   context.append(button);
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
