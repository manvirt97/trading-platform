# Rangeform Premium Workspace Design System — V38

The user-provided 9/21 EMA NIFTY options screenshot is the visual direction for every active Rangeform page. This is a visual language, not permission to fabricate market statistics, broker trades or AI readiness.

## One shared layout and navigation

Every active page includes, as its **final** stylesheet, `/static/rangeform-premium-v38.css?v=38` and also loads `/static/rangeform-premium-v38.js?v=38`.

Pages: `v9.html` (Overview, Scanner, Day Desk, Signals, News, Studio, AI, Planner, Journal, Settings), `strategy-builder.html`, `algo.html`, `bot.html`, `agent-team.html`, `account.html`, `forecast-ledger.html`.

The shared script inserts a simple, accessible quick-navigation ribbon directly after the existing top header (nine destinations, one active `aria-current="page"`). It does not modify page routing, market data, AI agents, bots, forms, authentication, service workers or broker execution. On iPhone the ribbon scrolls horizontally and centers the selected destination within its own row; it never scrolls the page.

Existing desktop sidebar navigation is retained and remains the standard app entry. Original page-specific utilities (symbol search, provider badge, theme controls) are preserved. Ledger now joins the same PWA/theme and toolbar, without changing its browser-local forecast entries. No duplicated mobile menus.

## Visual tokens

Light: canvas `#eef1f9`, rail `#f9faff`, surface `#ffffff`, soft `#f5f7fd`, primary `#3155ca`, border `#d9e0ef`, ink `#1b2438`.

Dark: canvas `#101620`, rail `#141c29`, surface `#1b2534`, soft `#202d40`, primary `#8da9ff`, border `#34445d`, ink `#eaf0f9`.

Cards: 13px radius, subtle shadow. Compact 10px uppercase finance metadata; 12–13px supporting text; primary metric numbers 18–27px. Inputs, segment controls, tabs, filter rows, trading tables, equity panels and status badges follow the same surfaces, borders and spacing.

## Must preserve

- Trading: broker execution disabled; NIFTY performance only from actual licensed historical option contract candles; no invented or interpolated options P&L.
- Existing 11-role Claude research team, OpenAI Council, independent CSO, deterministic research checks, paper bot, and all other established pages.
- PWA identity `/`, app start `/v9.html#overview`, existing browser-local data, Auth, D1 database and provider credentials.
- iPhone safe-area protections, accessible mobile drawers and native page controls.
- Theme preference shared across the legacy V9 and modern workspaces.

## New page rule

1. Keep content and tools semantically appropriate; do not clone irrelevant metrics or filters just to match the screenshot.
2. Use shared `rangeform-premium-v38.css` as the **last stylesheet** and add `data-rf-ui="v38"` to body.
3. Include the shared `rangeform-premium-v38.js` and current `pwa-update-v38.js`, manifest v38.
4. Scope exceptions inside the shared stylesheet rather than creating divergent new design languages.
5. Validate with `npm test`, `npm run syntax`, `npm run security-gate` and `node tests/premium-workspace-browser-v38.mjs` on Playwright-enabled CI.

## What the screenshot demonstrates

Compact top controls, a six-metric performance row, three strategy option mode cards, scrollable trades, per-trade provenance, market candle chart and cost audit. Those features belong in Strategy Lab. Other pages should share the design language and chrome without implying they all have NIFTY options price history or a live broker.
