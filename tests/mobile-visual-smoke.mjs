import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.RANGEFORM_VISUAL_BASE || 'http://127.0.0.1:8999';
const browser=await chromium.launch({headless:true});
mkdirSync('artifacts/mobile', {recursive:true});
try {
 for(const width of [320,375,390]){
  const context=await browser.newContext({
   viewport:{width,height:820},deviceScaleFactor:3,isMobile:true,
   hasTouch:true
  });
  await context.addInitScript(()=>{
   Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
  });
  const page=await context.newPage();
  await page.route('**/*',route=>{
   if(route.request().url().startsWith(base))return route.continue();
   return route.abort();
  });
  for(const path of ['/account.html','/algo.html','/bot.html','/v9.html']){
   await page.goto(base+path,{waitUntil:'domcontentloaded'});
   const isAccount=path==='/account.html';
   const isMain=path==='/v9.html';
   if(isAccount)await page.locator('#accountMobileMenu').click();
   if(isMain)await page.locator('#mobileMenu').click();
   // Wait for the 180ms drawer animation. Otherwise CI snapshots capture a
   // partially offscreen drawer and falsely appear to show a clipped menu.
   if(isAccount||isMain)await page.waitForTimeout(260);
   const logo=isAccount?'.account-rail-brand':isMain?'.sidebar .brand':'.rail .logo';
   const navLink=isAccount?'.account-rail-link':isMain?'.sidebar .nav-link':null;
   const dimensions=await page.evaluate(({logo,navLink})=>{
    const el=document.querySelector(logo);
    if(!el) return null;
    const r=el.getBoundingClientRect();
    const link=navLink?document.querySelector(navLink)?.getBoundingClientRect():null;
    return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,
      link:link?{left:link.left,right:link.right,top:link.top,bottom:link.bottom}:null,
      mobile:document.documentElement.classList.contains('rangeform-ios-standalone'),
      viewport:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth};
   },{logo,navLink});
   const file=path.replace(/[^a-z0-9]+/gi,'-')+'-'+width+'.png';
   await page.screenshot({path:'artifacts/mobile/'+file});
   assert.ok(dimensions, 'Missing mobile navigation logo '+path);
   assert.ok(dimensions.mobile,'Installed iPhone indicator absent '+path);
   // OS clock occupies the first ~50 CSS px. Logo must start below it.
   assert.ok(dimensions.top>=54,JSON.stringify({path,width,...dimensions}));
   assert.ok(dimensions.bottom<=820, 'Logo offscreen '+path);
   if(isAccount||isMain){
    assert.ok(dimensions.left>=-2&&dimensions.right<=width+2,
      'Opened drawer logo clipped horizontally: '+JSON.stringify({path,width,...dimensions}));
    assert.ok(dimensions.link&&dimensions.link.left>=-2&&dimensions.link.right<=width+2,
      'Opened drawer navigation link clipped horizontally: '+JSON.stringify({path,width,...dimensions}));
    assert.ok(dimensions.link.top>=0&&dimensions.link.top<820,
      'Opened drawer navigation link not reachable in viewport: '+JSON.stringify({path,width,...dimensions}));
   }
   assert.ok(dimensions.scrollWidth<=width+2,'Unexpected horizontal page overflow '+path);
   if(isAccount){
    assert.equal(await page.locator('#accountMobileMenu').getAttribute('aria-expanded'),'true');
    await page.locator('#accountNavShade').click({position:{x:width-10,y:400}});
    assert.equal(await page.locator('#accountMobileMenu').getAttribute('aria-expanded'),'false');
   }
  }
  await context.close();
 }
 console.log('PASS: installed-mobile drawer geometry and navigation on 320/375/390px emulated devices');
}finally{await browser.close()}
