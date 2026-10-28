import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Algorithmic Desk and Autonomous Bot use the same responsive mobile header', () => {
  const css = read('public/static/workspace-unified-v17.css');
  const mobile = css.slice(css.indexOf('/* V18: compact two-row mobile header'));
  assert.ok(mobile.startsWith('/* V18:'), 'mobile header override must be present');
  assert.ok(mobile.includes('@media(max-width:760px)'), 'narrow-viewport breakpoint');
  assert.ok(mobile.includes('grid-template-areas:"back theme" "status status"'), 'separate rows for navigation and long feed/bot status');
  assert.ok(mobile.includes('.topbar>.actions{display:contents}'), 'status and theme button must be separate grid items');
  assert.ok(mobile.includes('.topbar .actions>.chip{grid-area:status'), 'dynamic provider/bot status must occupy full second row');
  assert.ok(mobile.includes('white-space:normal;overflow-wrap:anywhere'), 'long status text must wrap, not overlap');
  assert.ok(mobile.includes('min-width:44px;width:44px;height:44px'), 'appearance toggle must be touch-sized');
  assert.ok(mobile.includes('env(safe-area-inset-top)'), 'iOS standalone safe area must be respected');
  assert.ok(mobile.includes('env(safe-area-inset-bottom)'), 'mobile bottom safe area must be respected');
  assert.ok(mobile.includes('.rail-links{max-width:100%;min-height:44px'), 'mobile tabs must remain scrollable');
  for (const file of ['public/algo.html', 'public/bot.html']) {
    const html = read(file);
    assert.match(html, /name="viewport"[^>]+viewport-fit=cover/);
    assert.match(html, /workspace-unified-v17\.css/);
    assert.match(html, /<header class="topbar">/);
    assert.match(html, /<div class="actions">/);
    assert.match(html, /id="theme"/);
    assert.match(html, /class="rail-links"/);
  }
  assert.match(read('public/algo.html'), /id="feedPill"/);
  assert.match(read('public/bot.html'), /id="botBadge"/);
});
