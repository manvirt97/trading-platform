/* Real browser geometry regression for the clipped Rangeform iPhone header.
   Inspect rendered boxes on News, Day Trading and Trade Signals—not only CSS strings.
   Runs in the existing mobile-visual GitHub workflow. */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.RANGEFORM_VISUAL_BASE||'http://127.0.0.1:8999';
mkdirSync('artifacts/mobile',{recursive:true});
const browser=await chromium.launch({headless:true});
const routes=['news','daydesk','signals'];
try{
 for(const width of [320,375,390,430]){
  const ctx=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  await ctx.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
  const page=await ctx.newPage();
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  for(const route of routes){
   await page.goto(base+'/v9.html#'+route,{waitUntil:'domcontentloaded'});
   await page.locator('.page.visible').waitFor({timeout:8000});
   const g=await page.evaluate(()=>{
    const el=id=>document.querySelector(id);
    const rect=id=>{
     const a=el(id);
     if(!a)return null;
     const r=a.getBoundingClientRect();
     const st=getComputedStyle(a);
     return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,
      display:st.display,visible:st.visibility!=='hidden'&&st.display!=='none'};
    };
    return {
     viewport:document.documentElement.clientWidth,
     scroll:document.documentElement.scrollWidth,
     topbar:rect('.content-shell>.topbar'),
     menu:rect('#mobileMenu'),
     brand:rect('.mobile-header-brand'),
     brandText:rect('.mobile-header-brand strong'),
     actions:rect('.top-right'),
     status:rect('#providerBadge'),
     theme:rect('#themeToggle'),
     search:rect('.topbar .top-search'),
     input:rect('#globalSearch'),
     grid:getComputedStyle(el('.content-shell>.topbar')).gridTemplateAreas,
     brandFull:el('.mobile-header-brand strong')?.scrollWidth<=el('.mobile-header-brand strong')?.clientWidth+1,
     text:el('.mobile-header-brand strong')?.textContent
    };
   });
   const info=JSON.stringify({route,width,...g});
   assert.equal(g.viewport,width,info);
   assert.equal(g.topbar.display,'grid','desktop flex override leaked into iPhone header '+info);
   assert.match(g.grid,/search search search/,'search not on second row '+info);
   for(const key of ['menu','brand','brandText','actions','status','theme','search','input']){
    const b=g[key];assert.ok(b?.visible,'Missing '+key+' '+info);
    assert.ok(b.left>=-1&&b.right<=width+1,'Horizontally clipped '+key+' '+info);
   }
   assert.ok(g.brandFull,'Rangeform name truncated '+info);
   assert.equal(g.text,'Rangeform');
   assert.ok(g.brand.left>=g.menu.right-1,'Brand overlaps menu '+info);
   assert.ok(g.actions.left>=g.brand.right-1,'Status/theme overlaps brand '+info);
   assert.ok(g.theme.left>=g.status.right-1,'Theme overlaps feed status '+info);
   assert.ok(g.search.top>=Math.max(g.menu.bottom,g.brand.bottom,g.actions.bottom)+5,
    'Search occupies first row or overlaps controls '+info);
   assert.ok(g.search.width>=width-32,'Search not full width '+info);
   assert.ok(g.scroll<=width+2,'Whole page horizontally overflows '+info);
   await page.screenshot({path:'artifacts/mobile/header-'+route+'-'+width+'.png'});
  }
  await ctx.close();
 }
 console.log('PASS: installed-iPhone header two-row geometry, full brand and search, 320/375/390/430px on News, Day Desk and Trade Signals');
}finally{await browser.close()}
