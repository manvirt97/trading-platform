import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.RANGEFORM_VISUAL_BASE||'http://127.0.0.1:8999';
const browser=await chromium.launch({headless:true});
try {
 for(const width of [375,1280]){
  const context=await browser.newContext({viewport:{width,height:820},isMobile:width<600,hasTouch:width<600});
  const page=await context.newPage();
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base+'/v9.html#overview',{waitUntil:'domcontentloaded'});
  await page.locator('[data-section="overview"].visible').waitFor({timeout:8000});
  await page.locator('#overviewScan').click();
  assert.equal(new URL(page.url()).hash,'#scanner');
  assert.equal(await page.locator('body').getAttribute('data-view'),'scanner');
  assert.equal(await page.locator('.discovery-card').count(),1);
  const sizes=await page.evaluate(()=>{
   const card=document.querySelector('.discovery-card').getBoundingClientRect();
   const scanner=document.querySelector('[data-section="scanner"]').getBoundingClientRect();
   return {cardTop:card.top,scannerTop:scanner.top,scroll:window.scrollY,screen:window.innerHeight};
  });
  assert.ok(sizes.cardTop>=0&&sizes.cardTop<750,'Scanner appears far down the page: '+JSON.stringify(sizes));
  assert.ok(sizes.scroll<=1,'Scanner open failed to scroll to top: '+JSON.stringify(sizes));
  assert.equal(await page.locator('#workspaceLocation').innerText(),'Opportunity scanner');
  assert.equal(await page.locator('#workspaceOverview').isVisible(),true);
  await page.locator('#workspaceOverview').click();
  assert.equal(new URL(page.url()).hash,'#overview');
  assert.equal(await page.locator('#workspaceOverview').isVisible(),false);
  await page.goBack({waitUntil:'domcontentloaded'});
  await page.locator('[data-section="scanner"].visible').waitFor();
  assert.equal(await page.locator('#workspaceLocation').innerText(),'Opportunity scanner');
  await page.goBack({waitUntil:'domcontentloaded'});
  await page.locator('[data-section="overview"].visible').waitFor();
  assert.equal(await page.locator('#workspaceLocation').innerText(),'Overview');
  await context.close();
 }
 console.log('PASS: Overview -> scanner at top, persistent breadcrumb, browser Back at phone and desktop widths');
}finally {await browser.close()}
