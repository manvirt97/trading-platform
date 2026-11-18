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
    await page.route('**/api/strategy-live?*', async route => {
      const url = new URL(route.request().url());
      const first = Date.now() - 150 * 300000;
      const chart = Array.from({ length: 120 }, (_, i) => ({
        time: new Date(first + i * 300000).toISOString(),
        open: 100 + i * .2, high: 101 + i * .2,
        low: 99 + i * .2, close: 100.5 + i * .2,
        fast: i > 8 ? 100 + i * .2 : null, slow: i > 20 ? 99.8 + i * .2 : null
      }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        pair: url.searchParams.get('pair'), name: 'BTC / USD', interval: url.searchParams.get('interval'),
        fast: 9, slow: 21, source: 'Kraken public REST OHLC', fetched_at: new Date().toISOString(),
        last_close: 124.3, data_age_seconds: 30, bars_available: 120,
        last_completed_bar_utc: chart.at(-1).time,
        indicator: { fast_ema: 123.8, slow_ema: 123.1, signal: 'NONE', trend: 'ABOVE', signal_bar_utc: chart.at(-1).time },
        chart, monitoring: true, broker_orders: false, order_mode: 'READ_ONLY_OBSERVATION'
      }) });
    });
    await page.goto(base + '/algo.html', { waitUntil: 'domcontentloaded' });
    assert.ok(await page.locator('a[href="/strategy-builder.html"]').count() >= 1, 'Existing desk must expose new workflow');
    assert.equal(await page.locator('#rfSuiteBar a[href="/strategy-builder.html"]').count(), 1, 'Shared quick-nav must contain one Strategy Lab shortcut');
    await page.goto(base + '/strategy-builder.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#sbRules strong').waitFor({ timeout: 5000 });
    // New NIFTY premium dashboard must be the FIRST visible research workspace,
    // with empty (not fictional) metrics and screenshot-inspired layout.
    assert.equal(await page.locator('.rf-kpi').count(), 6);
    assert.equal(await page.locator('.rf-compare').count(), 3);
    assert.equal(await page.locator('#rfTotal').textContent(), '—');
    assert.equal(await page.locator('#rfNet').textContent(), '—');
    assert.equal(await page.locator('#rfAdvanced').evaluate(e => e.open), true);
    assert.equal(await page.locator('#rfMode').inputValue(), 'itm5_buy');
    await page.locator('[data-rf-tf="30"]').click();
    assert.equal(await page.locator('[data-rf-tf="30"]').getAttribute('class'), 'active');
    await page.locator('[data-rf-tf="15"]').click();

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
    const rfPremium = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cardWidth: document.querySelector('.rf-kpi').getBoundingClientRect().width,
      dataForm: document.querySelector('#rfSpotFile') !== null
    }));
    assert.ok(rfPremium.scrollWidth <= width + 2,
      'NIFTY dashboard horizontal overflow: ' + JSON.stringify({width, ...rfPremium}));
    assert.ok(rfPremium.cardWidth > 110, JSON.stringify({width, ...rfPremium}));
    assert.ok(rfPremium.dataForm);

    await page.locator('#sbLiveTab').click();
    assert.equal(await page.locator('#sbBacktestPane').isHidden(), true);
    assert.equal(await page.locator('#sbLivePane').isVisible(), true);
    await page.locator('#sbLiveState[data-connected="true"]').waitFor({ timeout: 7000 });
    assert.match(await page.locator('#sbLivePrice').textContent(), /124/);
    assert.match(await page.locator('#sbMonitorDirection').textContent(), /Bullish/);
    const liveMetrics = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
      switchWidth: document.querySelector('.sb-mode-switch').getBoundingClientRect().width
    }));
    assert.ok(liveMetrics.scroll <= width + 2,
      'Live mode horizontal overflow: ' + JSON.stringify({ width, ...liveMetrics }));
    await page.screenshot({ path: 'artifacts/mobile/strategy-live-dark-' + width + '.png', fullPage: true });
    await page.locator('#sbBacktestTab').click();
    assert.equal(await page.locator('#sbLivePane').isHidden(), true);
    assert.equal(await page.locator('#sbBacktestPane').isVisible(), true);

    await context.close();
  }
  console.log('PASS: strategy builder mobile navigation, safe-area, source switches and dark theme at 320/375/390 CSS px');
} finally { await browser.close(); }
