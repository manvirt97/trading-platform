import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.RANGEFORM_VISUAL_BASE||'http://127.0.0.1:8999';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:820},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
  localStorage.setItem('rangeform_test_note','do not delete');
 });
 const page=await context.newPage();
 let probeCount=0;
 await page.route('**/release.json*',async route=>{
  probeCount++;
  await route.fulfill({status:200,contentType:'application/json',
   headers:{'Cache-Control':'no-store'},
   body:JSON.stringify({version:'24',build:'rangeform-v24-test-release'})});
 });
 await page.goto(base+'/account.html#ownerSetupHeading',{waitUntil:'domcontentloaded'});
 await page.locator('#rangeform-update-banner').waitFor({timeout:10000});
 assert.match(await page.locator('#rangeform-update-banner').innerText(),/newer Rangeform/);
 assert.ok(probeCount>=1,'Home Screen app must fetch deployed release');
 await page.getByRole('button',{name:'Update Rangeform'}).click();
 await page.waitForURL(url=>url.searchParams.get('rf_release')==='rangeform-v24-test-release',{timeout:10000});
 assert.equal(new URL(page.url()).hash,'#ownerSetupHeading','original screen must be preserved');
 assert.equal(await page.evaluate(()=>localStorage.getItem('rangeform_test_note')),'do not delete');
 // No update notice in a normal Safari/desktop tab.
 const ordinary=await browser.newContext({viewport:{width:390,height:820},isMobile:true,hasTouch:true});
 const tab=await ordinary.newPage();
 await tab.route('**/release.json*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({version:'24',build:'rangeform-v24-test-release'})}));
 await tab.goto(base+'/account.html',{waitUntil:'domcontentloaded'});
 await tab.waitForTimeout(400);
 assert.equal(await tab.locator('#rangeform-update-banner').count(),0);
 await ordinary.close();
 await context.close();
 console.log('PASS: installed-app update prompt, version fetch, preserved route and storage; no ordinary-browser interruption');
}finally{await browser.close()}
