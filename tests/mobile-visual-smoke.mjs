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
   if(isMain){
    // Regression: V26 desktop grid won specificity on phones and crushed
    // Day Trading Desk into a 150–240px column. Check actual rendered width.
    await page.evaluate(()=>{location.hash='#daydesk'});
    await page.locator('.daydesk-page.visible').waitFor({timeout:7000});
    const geometry=await page.evaluate(()=>{
     const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
     const app=rect('.app'),shell=rect('.content-shell'),main=rect('.main'),
       desk=rect('.daydesk-page.visible'),heading=rect('.daydesk-heading h1');
     return {app:app?.width,shell:shell?.width,main:main?.width,
       desk:desk?.width,heading:heading?.width,
       vw:document.documentElement.clientWidth,
       scroll:document.documentElement.scrollWidth,
       columns:getComputedStyle(document.querySelector('.app')).gridTemplateColumns};
    });
    for(const key of ['app','shell','main']){
     assert.ok(geometry[key]>=width*.93,
      'MOBILE FULL WIDTH FAIL: '+key+' '+JSON.stringify({width,...geometry}));
    }
    // The visible page is inset by 13px main padding on each side.
    assert.ok(geometry.desk>=width-32,
      'Day Trading Desk squeezed into desktop grid: '+JSON.stringify({width,...geometry}));
    assert.ok(geometry.heading>=width*.65,
      'Day Trading Desk heading squeezed: '+JSON.stringify({width,...geometry}));
    assert.ok(geometry.scroll<=width+2,'Horizontal overflow: '+JSON.stringify(geometry));
   }

   if(isAccount)await page.locator('#accountMobileMenu').click();
   if(isMain)await page.locator('#mobileMenu').click();
   if(!isAccount&&!isMain)await page.locator('#rfMobileMenu').click();
   // Wait for the 180ms drawer animation. Otherwise CI snapshots capture a
   // partially offscreen drawer and falsely appear to show a clipped menu.
   await page.waitForTimeout(260);
   const logo=isAccount?'.account-rail-brand':isMain?'.sidebar .brand':'.rail .logo';
   const navLink=isAccount?'.account-rail-link':isMain?'.sidebar .nav-link':'.rail .rail-link';
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
   {
    assert.ok(dimensions.left>=-2&&dimensions.right<=width+2,
      'Opened drawer logo clipped horizontally: '+JSON.stringify({path,width,...dimensions}));
    assert.ok(dimensions.link&&dimensions.link.left>=-2&&dimensions.link.right<=width+2,
      'Opened drawer navigation link clipped horizontally: '+JSON.stringify({path,width,...dimensions}));
    assert.ok(dimensions.link.top>=0&&dimensions.link.top<820,
      'Opened drawer navigation link not reachable in viewport: '+JSON.stringify({path,width,...dimensions}));
   }
   assert.ok(dimensions.scrollWidth<=width+2,'Unexpected horizontal page overflow '+path);
   if(!isAccount&&!isMain){
    assert.equal(await page.locator('#rfMobileMenu').getAttribute('aria-expanded'),'true');
    await page.locator('#rfNavShade').click({position:{x:width-10,y:400}});
    assert.equal(await page.locator('#rfMobileMenu').getAttribute('aria-expanded'),'false');
   }
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
