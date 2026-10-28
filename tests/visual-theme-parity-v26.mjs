import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.RANGEFORM_VISUAL_BASE||'http://127.0.0.1:8999';
const pages=[
 {path:'/v9.html#daydesk',nav:'.sidebar',search:'#globalSearch',switch:'#themeToggle'},
 {path:'/algo.html',nav:'.rail',search:'#rfDeskSymbol',switch:'#theme'},
 {path:'/bot.html',nav:'.rail',search:'#rfDeskSymbol',switch:'#theme'},
 {path:'/account.html',nav:'.account-rail',search:'#accountGlobalSearch',switch:'#themeToggle'}
];
mkdirSync('artifacts/theme',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:860}});
 await context.addInitScript(()=>{
  if(!localStorage.getItem('rf_v9_theme'))localStorage.setItem('rf_v9_theme','light');
  if(!localStorage.getItem('rangeform_theme'))localStorage.setItem('rangeform_theme','light');
 });
 const page=await context.newPage();
 await page.route('**/*',route=>{
  if(route.request().url().startsWith(base))return route.continue();
  return route.abort();
 });
 const samples=[];
 for(const item of pages){
  await page.goto(base+item.path,{waitUntil:'domcontentloaded'});
  await page.locator(item.nav).waitFor({state:'visible',timeout:10000});
  assert.equal(await page.locator(item.search).count(),1,'search missing on '+item.path);
  const x=await page.evaluate(nav=>{
   const get=e=>getComputedStyle(e);
   const body=get(document.body);
   const rail=get(document.querySelector(nav));
   const main=document.querySelector('main .card,main .tile,main .account-owner-setup');
   const card=main?get(main):null;
   return {theme:document.body.dataset.theme,bg:body.backgroundColor,nav:rail.backgroundColor,
    card:card?.backgroundColor||'',font:body.fontFamily,
    line:body.getPropertyValue('--line').trim(),
    accent:body.getPropertyValue('--rf-highlight').trim()};
  },item.nav);
  samples.push({path:item.path,...x});
  await page.screenshot({path:'artifacts/theme/'+item.path.replace(/[^a-z0-9]+/gi,'-')+'-light.png',fullPage:false});
 }
 for(const s of samples){
  assert.equal(s.theme,'light',JSON.stringify(s));
  assert.equal(s.bg,'rgb(243, 244, 242)',JSON.stringify(s));
  assert.equal(s.nav,'rgb(247, 247, 244)',JSON.stringify(s));
  assert.equal(s.card,'rgb(255, 255, 255)',JSON.stringify(s));
  assert.equal(s.accent,'#9c7a3c',JSON.stringify(s));
  assert.match(s.font,/Inter|Segoe UI/);
 }
 // Use real UI toggle in the Day Trading Desk; dark mode must survive navigation.
 await page.goto(base+'/v9.html#daydesk',{waitUntil:'domcontentloaded'});
 await page.locator('#themeToggle').click();
 assert.equal(await page.evaluate(()=>document.body.dataset.theme),'dark');
 for(const item of pages){
  await page.goto(base+item.path,{waitUntil:'domcontentloaded'});
  const x=await page.evaluate(nav=>{
   const body=getComputedStyle(document.body),rail=getComputedStyle(document.querySelector(nav));
   const card=document.querySelector('main .card,main .tile,main .account-owner-setup');
   return {theme:document.body.dataset.theme,bg:body.backgroundColor,nav:rail.backgroundColor,
    card:card?getComputedStyle(card).backgroundColor:'',accent:body.getPropertyValue('--rf-highlight').trim()};
  },item.nav);
  assert.deepEqual(x,{
   theme:'dark',bg:'rgb(14, 17, 22)',nav:'rgb(18, 23, 30)',card:'rgb(21, 26, 33)',accent:'#c9ab6c'
  },'dark palette mismatch '+item.path);
  await page.screenshot({path:'artifacts/theme/'+item.path.replace(/[^a-z0-9]+/gi,'-')+'-dark.png',fullPage:false});
 }
 console.log('PASS: matching light and dark palettes, sidebar, cards, typography and theme persistence across four pages');
 await context.close();
}finally{await browser.close()}
