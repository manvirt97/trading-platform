import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.RANGEFORM_VISUAL_BASE || 'http://127.0.0.1:8999';
const browser = await chromium.launch({ headless: true });
mkdirSync('artifacts/mobile', { recursive: true });
try {
  for (const width of [320, 375, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 820 }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    });
    const page = await context.newPage();
    await page.route('**/api/strategy-builder', async route => {
      const payload = route.request().postDataJSON();
      if (payload?.action === 'parse') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            spec: {
              kind: 'ema-cross-long-only', fast: 9, slow: 21, interval: '15min',
              timezone: 'America/New_York', entry_after: '09:30', square_off: '15:00',
              rules: ['Cross up on confirmed previous candle.', 'Buy the next candle open.'],
              assumptions: ['Underlying asset only, no options fills.']
            },
            ai_model_used: false, broker_orders: false
          })
        });
      } else await route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"No user-provided history"}' });
    });
    await page.goto(base + '/algo.html', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('a[href="/strategy-builder.html"]').count(), 1, 'Existing desk must expose new workflow');
    await page.goto(base + '/strategy-builder.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#sbRules strong').waitFor({ timeout: 5000 });
    const rect = await page.evaluate(() => {
      const heading = document.querySelector('h1')?.getBoundingClientRect();
      const brand = document.querySelector('.sb-brand')?.getBoundingClientRect();
      const top = document.querySelector('.sb-header')?.getBoundingClientRect();
      return {
        headingWidth: heading?.width, brandTop: brand?.top,
        headerWidth: top?.width,
        viewport: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth
      };
    });
    assert.ok(rect.headerWidth >= width * 0.95, JSON.stringify({ width, ...rect }));
    assert.ok(rect.headingWidth > width * 0.7, JSON.stringify({ width, ...rect }));
    assert.ok(rect.brandTop >= 54, 'Installed iPhone clock overlays builder brand: ' + JSON.stringify({ width, ...rect }));
    assert.ok(rect.scroll <= width + 2, 'Strategy Builder horizontal overflow: ' + JSON.stringify({ width, ...rect }));
    await page.locator('#sbSource').selectOption('twelvedata');
    assert.equal(await page.locator('#sbCsvWrap').isHidden(), true);
    await page.locator('#sbSource').selectOption('csv');
    assert.equal(await page.locator('#sbCsvWrap').isVisible(), true);
    await page.locator('#sbTheme').click();
    assert.equal(await page.locator('html').getAttribute('data-rf-theme'), 'dark');
    await page.screenshot({ path: 'artifacts/mobile/strategy-builder-dark-' + width + '.png', fullPage: true });
    await context.close();
  }
  console.log('PASS: strategy builder mobile navigation, safe-area, source switches and dark theme at 320/375/390 CSS px');
} finally { await browser.close(); }
