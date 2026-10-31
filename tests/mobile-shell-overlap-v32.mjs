/* Regression for iPhone screenshot bugs:
  1) Autonomous/Algorithmic drawer section heading over Research AI and footer over Account
  2) Account two-row topbar controls and search covering hero.
 Check actual pixel rectangles, not just matching CSS strings. */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.RANGEFORM_VISUAL_BASE||'http://127.0.0.1:8999';
mkdirSync('artifacts/mobile',{recursive:true});
const browser=await chromium.launch({headless:true});
const layouts=[
 {width:320,height:667},{width:375,height:812},{width:390,height:844},
 {width:430,height:896}
];
try{
 for(const {width,height} of layouts){
  for(const path of ['account.html','bot.html','algo.html']){
   const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:3});
   await ctx.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
   const page=await ctx.newPage();
   await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
   await page.goto(base+'/'+path,{waitUntil:'domcontentloaded'});
   const account=path==='account.html';
   if(account){
    const info=await page.evaluate(()=>{
     const rect=sel=>{
      const el=document.querySelector(sel);if(!el)return null;
      const r=el.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,
       width:r.width,height:r.height,display:getComputedStyle(el).display};
     };
     const bar=document.querySelector('.account-topbar');
     return {
      viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
      areas:getComputedStyle(bar).gridTemplateAreas,
      header:rect('.account-topbar'),menu:rect('#accountMobileMenu'),
      brand:rect('.account-mobile-header-brand'),
      brandText:rect('.account-mobile-header-brand strong'),
      search:rect('.account-top-search'),input:rect('#accountGlobalSearch'),
      toggle:rect('.account-header-actions .account-theme-toggle'),
      hero:rect('.account-workspace>.wrap>.hero'),
      heroTitle:rect('.account-workspace>.wrap>.hero h1')
     };
    });
    const e=JSON.stringify({path,width,height,...info});
    assert.equal(info.header?.display,'grid','Account mobile header is not a two-row grid '+e);
    assert.match(info.areas,/search search search/,'Account search not on own row '+e);
    for(const key of ['menu','brand','brandText','search','input','toggle','hero','heroTitle']){
     const r=info[key];
     assert.ok(r&&r.width>0&&r.height>0,'Account element missing: '+key+' '+e);
     assert.ok(r.left>=-1&&r.right<=width+1,'Account element clipped: '+key+' '+e);
    }
    assert.ok(info.brand.left>=info.menu.right-2,'Account brand overlaps menu '+e);
    assert.ok(info.toggle.left>=info.brand.right-2,'Account theme overlaps brand '+e);
    assert.ok(info.search.top>=Math.max(info.menu.bottom,info.brand.bottom,info.toggle.bottom)+6,
     'Account search overlaps logo/menu/theme '+e);
    assert.ok(info.search.width>=width-30,'Account search not full width '+e);
    assert.ok(info.hero.top>=info.header.bottom-1,
     'Account hero is underneath mobile header '+e);
    assert.ok(info.heroTitle.top>=info.header.bottom-1,
     'Account heading is covered by mobile header '+e);
    assert.ok(info.scroll<=width+2,'Account horizontal overflow '+e);
    await page.screenshot({path:'artifacts/mobile/account-header-v32-'+width+'.png'});
    await page.locator('#accountMobileMenu').click();
    await page.waitForTimeout(240);
   }else{
    await page.locator('#rfMobileMenu').click();
    await page.waitForTimeout(240);
   }
   const railSelector=account?'.account-rail':'.rail';
   const nav=await page.evaluate(({railSelector,account})=>{
    const rail=document.querySelector(railSelector);
    const get=sel=>{
     const el=rail.querySelector(sel);if(!el)return null;
     const r=el.getBoundingClientRect();
     return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};
    };
    const top=rail.getBoundingClientRect();
    const before=get(account?'.account-rail-links:first-of-type .account-rail-link:last-child':'.rail-links:first-of-type .rail-link:last-child');
    const ai=Array.from(rail.querySelectorAll('a')).find(a=>a.textContent.includes('Research AI'));
    const aiR=ai.getBoundingClientRect();
    const tools=get(account?'.account-rail-divider':'.rf-tools-label');
    const footer=account?null:get('.rail-bottom');
    const last=Array.from(rail.querySelectorAll('a')).find(a=>a.textContent.includes('Account & Sign-in'));
    const lastR=last.getBoundingClientRect();
    return {
     railTop:top.top,railBottom:top.bottom,railClientHeight:rail.clientHeight,
     railScrollHeight:rail.scrollHeight,scrollTop:rail.scrollTop,
     ai:{top:aiR.top,bottom:aiR.bottom},
     tools,footer,accountLink:{top:lastR.top,bottom:lastR.bottom},
     before
    };
   },{railSelector,account});
   const info=JSON.stringify({path,width,height,...nav});
   assert.ok(nav.railTop<=1,'Mobile drawer not fixed at left viewport '+info);
   assert.ok(nav.tools.top>=nav.ai.bottom+2,'TOOLS label overlaps Research AI '+info);
   assert.ok(nav.accountLink.top>=nav.tools.bottom+5,'Account link overlaps TOOLS heading '+info);
   if(!account){
    assert.ok(nav.footer.top>=nav.accountLink.bottom+5,
     'Bot/Algo footer paints over Account link '+info);
   }
   if(!account){
    const bottom=await page.evaluate(()=>{
     const rail=document.querySelector('.rail');
     rail.scrollTop=rail.scrollHeight;
     const last=Array.from(rail.querySelectorAll('a')).find(a=>a.textContent.includes('Account & Sign-in'));
     const foot=rail.querySelector('.rail-bottom');
     const l=last.getBoundingClientRect(),f=foot.getBoundingClientRect(),r=rail.getBoundingClientRect();
     return {scrollTop:rail.scrollTop,scrollHeight:rail.scrollHeight,
      clientHeight:rail.clientHeight,lastBottom:l.bottom,
      footerTop:f.top,footerBottom:f.bottom,drawerBottom:r.bottom};
    });
    const e=JSON.stringify({path,width,height,...bottom});
    assert.ok(bottom.footerTop>=bottom.lastBottom+5,'Drawer footer overlapping account at bottom '+e);
    assert.ok(bottom.footerBottom<=height+3,'Footer inaccessible after scrolling '+e);
    if(bottom.scrollHeight>bottom.clientHeight+1)
     assert.ok(bottom.scrollTop>0,'Overflow drawer does not scroll '+e);
    await page.screenshot({path:'artifacts/mobile/drawer-bottom-v32-'+path+'-'+width+'.png'});
   }else await page.screenshot({path:'artifacts/mobile/account-drawer-v32-'+width+'.png'});
   await ctx.close();
  }
 }
 console.log('PASS: iPhone Account header and Bot/Algo sidebar no-overlap, natural scroll at 320/375/390/430 widths');
}finally{await browser.close()}
