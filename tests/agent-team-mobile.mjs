/* Agent Team mobile regression: no horizontal overflow or hidden heading.
 * UI fixture is synthetic for layout only; it is NOT a market prediction. */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.RANGEFORM_VISUAL_BASE||'http://127.0.0.1:8999';
mkdirSync('artifacts/mobile',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const width of [320,375,390,430]){
    const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    await ctx.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
    const page=await ctx.newPage();
    await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.goto(base+'/agent-team.html',{waitUntil:'domcontentloaded'});
    const initial=await page.evaluate(()=>{
      const r=sel=>{const el=document.querySelector(sel),v=el?.getBoundingClientRect();return v?{top:v.top,bottom:v.bottom,left:v.left,right:v.right,width:v.width,height:v.height}:null};
      return {scrollWidth:document.documentElement.scrollWidth,header:r('.topbar'),hero:r('.agent-hero h1'),form:r('#teamForm'),grid:r('#agentGrid'),text:document.getElementById('teamMessage')?.textContent};
    });
    const detail=JSON.stringify({width,...initial});
    assert.ok(initial.header&&initial.hero&&initial.form&&initial.grid,'Agent Team incomplete '+detail);
    assert.ok(initial.hero.top>=initial.header.bottom-1,'Hero overlaps app header '+detail);
    assert.ok(initial.form.left>=-1&&initial.form.right<=width+1,'Form clipped '+detail);
    assert.ok(initial.scrollWidth<=width+2,'Page overflows horizontally '+detail);
    assert.match(initial.text,/No data has been requested yet/);
    assert.equal(await page.locator('#runOpenAICouncil').isDisabled(),true,'Paid AI disabled before owner verification '+width);
    assert.equal(await page.locator('#csoTitle').isVisible(),true,'CSO security panel missing '+width);
    assert.equal(await page.locator('#councilMode').isVisible(),true,'Council mode selection missing '+width);
    await page.screenshot({path:'artifacts/mobile/agent-team-v33-'+width+'.png',fullPage:true});
    await page.locator('#rfMobileMenu').click();
    const expanded=await page.locator('#rfMobileMenu').getAttribute('aria-expanded');
    assert.equal(expanded,'true','Sidebar must open '+width);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#rfMobileMenu').getAttribute('aria-expanded'),'false','Esc closes menu '+width);
    await ctx.close();
  }
  console.log('PASS: Agent Team page at all iPhone widths, no overflow/overlap, reversible mobile navigation');
}finally{await browser.close()}
