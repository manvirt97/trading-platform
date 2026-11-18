import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.RANGEFORM_VISUAL_BASE||'http://127.0.0.1:8999';
const routes=['/v9.html#overview','/algo.html','/bot.html','/agent-team.html',
  '/account.html','/forecast-ledger.html','/strategy-builder.html'];
mkdirSync('artifacts/mobile',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for(const width of [320,390,1280]){
  const context=await browser.newContext({
   viewport:{width,height:860},deviceScaleFactor:2,
   isMobile:width<600,hasTouch:width<600
  });
  await context.addInitScript(()=>{
   if(window.innerWidth<600)
    Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
  });
  for(const route of routes){
   const page=await context.newPage();
   // Avoid external paid integrations and provider requests in a visual-only CI test.
   await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+route,{waitUntil:'domcontentloaded'});
   await page.locator('#rfSuiteBar').waitFor({timeout:8000});
   // The same context intentionally preserves the previous page's theme.
   // Establish a light baseline before comparing it to a dark-mode toggle.
   await page.evaluate(()=>window.RangeformTheme?.apply('light'));
   assert.equal(await page.locator('html').getAttribute('data-rf-theme'),'light');
   const state=await page.evaluate(()=>{
    const bar=document.getElementById('rfSuiteBar');
    const styles=getComputedStyle(bar);
    return {
     page:location.pathname,viewport:document.documentElement.clientWidth,
     scroll:document.documentElement.scrollWidth,
     navCount:bar.querySelectorAll('.rf-suite-link').length,
     title:document.getElementById('rfSuiteTitle').textContent,
     surface:styles.backgroundColor,navHeight:bar.getBoundingClientRect().height,
     mainLeft:bar.getBoundingClientRect().left,
     visible:bar.getBoundingClientRect().width>0
    };
   });
   assert.ok(state.visible,JSON.stringify(state));
   assert.equal(state.navCount,9,JSON.stringify(state));
   assert.ok(state.title.length>2,JSON.stringify(state));
   assert.equal(await page.locator('body').getAttribute('data-rf-ui'),'v38');
   assert.ok(state.scroll<=width+3,'Horizontal overflow '+JSON.stringify({width,route,...state}));
   assert.ok(state.navHeight<115,'Nav too tall '+JSON.stringify({width,route,...state}));
   const active=await page.locator('.rf-suite-link[aria-current="page"]').count();
   assert.equal(active,1,'Need one active route for '+route);
   if(route.startsWith('/strategy-builder')){
    assert.equal(await page.locator('.rf-kpi').count(),6);
    assert.equal(await page.locator('.rf-compare').count(),3);
    assert.equal(await page.locator('#rfTotal').textContent(),'—');
   }
   if(route.startsWith('/agent-team'))assert.equal(await page.locator('#teamForm').count(),1);
   // Verify theme toggle consistency without deleting saved preferences.
   await page.evaluate(()=>window.RangeformTheme?.apply('dark'));
   assert.equal(await page.locator('html').getAttribute('data-rf-theme'),'dark');
   const dark=await page.locator('#rfSuiteBar').evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.notEqual(dark,state.surface,'Dark mode should change suite background');
   if(width===390) {
    const shot=route.split('/').at(-1).replace('.html','').split('#')[0];
    await page.screenshot({path:'artifacts/mobile/unified-v38-'+shot+'.png',fullPage:true});
   }
   const relevant=errors.filter(s=>/rangeform-premium-v38|Cannot read properties of null/i.test(s));
   assert.deepEqual(relevant,[],'Common shell JavaScript broke '+route+': '+relevant.join('; '));
   await page.close();
  }
  await context.close();
 }
 console.log('PASS: seven Rangeform workspaces share one v38 premium nav/layout, dark theme and no overflow at 320/390/1280');
}finally{await browser.close()}
