import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.RANGEFORM_VISUAL_BASE||'http://127.0.0.1:8999';
mkdirSync('artifacts/mobile',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,375,390,1280]){
  const mobile=width<600;
  const context=await browser.newContext({viewport:{width,height:820},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.goto(base+'/v9.html#overview',{waitUntil:'domcontentloaded'});
  await page.locator('[data-section="overview"].visible').waitFor({timeout:8000});
  const launches=page.locator('.overview-launch');
  assert.equal(await launches.count(),4);
  assert.equal(await page.locator('[data-section="overview"] .assistant-card').count(),0);
  const intro=await page.locator('[data-section="overview"]').boundingBox();
  assert.ok(intro?.height<(mobile?2100:1550),
    'Overview still too long/fragmented: '+JSON.stringify({width,height:intro?.height}));
  assert.ok(await page.locator('#overviewScan').isVisible());
  await page.locator('#overviewScan').click();
  assert.equal(new URL(page.url()).hash,'#scanner');
  assert.equal(await page.locator('body').getAttribute('data-view'),'scanner');
  assert.equal(await page.locator('#workspaceLocation').innerText(),'Opportunity scanner');
  assert.equal(await page.locator('.scanner-mode-tabs button[aria-selected="true"]').count(),1);
  assert.equal(await page.locator('#scannerTabWatchlist').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#scannerWatchlist').isVisible(),true);
  assert.equal(await page.locator('#scannerSample').isVisible(),false);
  const pos=await page.evaluate(()=>({scroll:window.scrollY,top:document.querySelector('.scanner-page.visible').getBoundingClientRect().top,wide:document.documentElement.scrollWidth}));
  assert.ok(pos.scroll<=1,'Scanner opens far down page '+JSON.stringify({width,...pos}));
  assert.ok(pos.top>=0&&pos.top<500,'Scanner page not on top '+JSON.stringify({width,...pos}));
  assert.ok(pos.wide<=width+2,'Overflow '+JSON.stringify({width,...pos}));
  await page.locator('#scannerTabSample').click();
  assert.equal(await page.locator('#scannerTabSample').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#scannerSample').isVisible(),true);
  assert.equal(await page.locator('#scannerWatchlist').isVisible(),false);
  await page.locator('#scannerTabWatchlist').click();
  assert.equal(await page.locator('#scannerWatchlist').isVisible(),true);
  await page.screenshot({path:'artifacts/mobile/scanner-v31-'+width+'.png'});
  await page.locator('#workspaceOverview').click();
  assert.equal(new URL(page.url()).hash,'#overview');
  assert.equal(await page.locator('[data-section="overview"].visible').count(),1);
  await page.evaluate(()=>document.querySelector('.nav-link[data-page="ai"]').click());
  assert.equal(new URL(page.url()).hash,'#ai');
  assert.equal(await page.locator('.ai-page.visible .assistant-card').count(),1);
  await page.goBack({waitUntil:'domcontentloaded'});
  await page.locator('[data-section="overview"].visible').waitFor();
  assert.equal(await page.locator('#workspaceLocation').innerText(),'Overview');
  await context.close();
 }
 console.log('PASS: compact Overview, immediate Scanner, watchlist/sample tabs, dedicated AI and browser Back at 320/375/390/1280 widths');
}finally{await browser.close()}
