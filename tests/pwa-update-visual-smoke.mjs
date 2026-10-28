import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.RANGEFORM_VISUAL_BASE||'http://127.0.0.1:8999';
const browser=await chromium.launch({headless:true});
const payload={version:'25',build:'rangeform-v25-test-release'};
try {
 // Test 1: existing installed app automatically refreshes without prompting
 // when the user has no unsaved changes. Route/hash and browser storage stay.
 const installed=await browser.newContext({viewport:{width:390,height:820},isMobile:true,hasTouch:true});
 await installed.addInitScript(()=>{
  Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
  localStorage.setItem('rangeform_test_note','preserve me');
 });
 const page=await installed.newPage();
 let reads=0;
 await page.route('**/release.json*',async route=>{
  reads++;
  await route.fulfill({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(payload)});
 });
 await page.goto(base+'/account.html#ownerSetupHeading',{waitUntil:'domcontentloaded'});
 await page.waitForURL(url=>url.searchParams.get('rf_release')===payload.build,{timeout:10000});
 assert.equal(new URL(page.url()).hash,'#ownerSetupHeading','Keep original screen');
 assert.equal(await page.evaluate(()=>localStorage.getItem('rangeform_test_note')),'preserve me');
 assert.ok(reads>=1,'Installed app should check deployed release');

 // Test 2: when a form is being edited, no surprise reload occurs.
 const edit=await browser.newContext({viewport:{width:390,height:820},isMobile:true,hasTouch:true});
 await edit.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
 const draft=await edit.newPage();
 let live=false;
 await draft.route('**/release.json*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(live?payload:{version:'24',build:'rangeform-v24-auto-refresh'})}));
 await draft.goto(base+'/account.html',{waitUntil:'domcontentloaded'});
 await draft.locator('#historyNote').fill('Keep this unsaved note');
 live=true;
 await draft.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await draft.locator('#rangeform-update-banner').waitFor({timeout:10000});
 assert.equal(new URL(draft.url()).searchParams.has('rf_release'),false,'Do not automatically leave unsaved changes');
 assert.equal(await draft.locator('#historyNote').inputValue(),'Keep this unsaved note');
 await draft.getByRole('button',{name:'Update Rangeform'}).click();
 await draft.waitForURL(url=>url.searchParams.get('rf_release')===payload.build,{timeout:10000});
 await edit.close();

 // Test 3: ordinary Safari tabs are not interrupted by Home Screen policy.
 const normal=await browser.newContext({viewport:{width:390,height:820},isMobile:true,hasTouch:true});
 const tab=await normal.newPage();
 await tab.route('**/release.json*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)}));
 await tab.goto(base+'/account.html',{waitUntil:'domcontentloaded'});
 await tab.waitForTimeout(350);
 assert.equal(await tab.locator('#rangeform-update-banner').count(),0);
 assert.equal(new URL(tab.url()).searchParams.has('rf_release'),false);
 await normal.close();await installed.close();
 console.log('PASS: Home Screen auto update, unsaved-draft protection, URL/hash and storage preservation');
} finally {await browser.close()}
