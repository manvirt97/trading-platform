# Rangeform V9 — implementation and deployment

The V9 experience is accessible at `/v9.html`. The existing research terminal remains accessible with `/research.html?classic=1`.

## Architectural decision

The existing deployed project runs on Cloudflare Pages with plain HTML/CSS/JavaScript, Pages Functions, D1 (for private accounts), optional Workers AI, and an optional server-side Twelve Data market feed. To **preserve working features and avoid a risky build-system switch in a single deploy**, V9 ships as a new vanilla browser view using the existing validated APIs. This is a staged compatibility implementation, *not* yet the requested React/TypeScript/Vite/Tailwind conversion. That migration remains a later, separately tested phase.

Browser responsibilities: rendering, navigation, theme, personal watchlist (localStorage), category UI, educational risk examples and historical-chart drawing. Browser code never includes market-data API keys and cannot place real orders.

Server responsibilities: provider secrets, OHLCV retrieval, bar validation, technical-analysis calculations, provider-status reporting, news aggregation, existing authenticated accounts and AI research.

### File map

- `public/v9.html` — redesigned dashboard, Trade Decision Desk, watchlist scanner and News.
- `public/static/v9.css` — V9 visual system, light/dark and mobile.
- `public/static/v9.js` — app navigation, server API requests, historical chart rendering, clear errors and client-only watchlist.
- `functions/api/analyze.js` + `functions/_shared/core.js` — existing deterministic OHLCV analysis (SMA, RSI, ATR, support/resistance, momentum and relative volume).
- `functions/api/news.js` — public RSS headlines with category-specific filtering.
- `functions/api/status.js` and `functions/api/provider-health.js` — provider config and manual response-health checks.
- `public/research.html?classic=1` — all legacy capabilities remain available.

## Current phase delivery

1. **Interface — implemented:** visibly different Overview, Trade Decision Desk, watchlist scanner and News screens; readable card layout and responsive breakpoints; light/dark appearance; no A/A+ header control. No fabricated quotes, charts or trade recommendations.
2. **Data access — reuse existing infrastructure:** Twelve Data OHLCV through server-side Cloudflare secret `TWELVEDATA_API_KEY` and `LIVE_DATA_ENABLED=on`. Check plan entitlements and legal redistribution rights before activation. V9 does not claim an active subscription or streaming feed. Public news works independently via `/api/news`.
3. **Quant engine — partly existing:** deterministic SMA/RSI/ATR/range/momentum, transparent 0–100 indicator alignment. Additional indicators, robust multi-timeframe scoring, spread and liquidity controls, and unit tests remain future work.
4. **Scanner — initial watchlist scan:** on-demand analysis for up to six locally saved symbols (not a universe-wide or real-time market scanner). It does not silently spend provider quota in the background. No rank is displayed until real data is retrieved.
5. **AI explanations — future phase:** existing Cloudflare Workers AI is in the classic research workspace. Claude integration requires its own secure server-side endpoint, paid Anthropic account/API key, response validation and usage controls; not implemented in V9.
6. **Paper trading, alerts and performance — future phase:** no live orders, no claim of virtual broker execution. Existing risk/journal tools remain reachable via Classic.

## Data-provider tradeoffs and indicative costs (USD)

- Twelve Data Basic: free tier for individual/internal *non-display* use; **do not assume this permits a public or multi-user market-data product**. Credit limits, exchange coverage and exact entitlements vary. Official plans: https://twelvedata.com/pricing
- Twelve Data Grow: advertised around **$79/month on monthly billing** (prices/terms subject to change). Individual plans do not automatically grant external redistribution. Commercial licensing may be separately negotiated.
- Cloudflare Pages: free-tier static site available within its limits; Pages Functions consume Workers allowances. Workers paid plans start around **$5 USD/month** plus applicable usage. https://developers.cloudflare.com/workers/platform/pricing/
- AI: no Claude subscription is included. Claude API usage and appropriate security/rate limits are separately billed.
- Massive (formerly Polygon), Alpaca, TMX licensed feeds, and others: assess separately by market, exchange entitlement, permitted public display, delay and redistribution. This starter does not connect them.

V9 deliberately uses a backend provider abstraction: the interface only consumes a stable JSON analysis contract, so the data vendor can be replaced on the server without rebuilding the UI.

## Current API contract

`GET /api/status` returns whether Twelve Data is *configured and enabled*. This is not proof of timely quotes.

`GET /api/analyze?source=twelvedata&symbol=NVDA&interval=1day` returns `symbol`, `source`, `interval`, `last`, `last_bar_utc`, `data_quality`, `score`, `components[]`, `indicators`, and `bar_history[]`. Every bar is server-validated historical data.

`GET /api/news?category=energy&region=CA` returns dated publisher links, availability and source status.

Planned typed `TradeSignal` contract will add `assetClass`, `exchange`, `marketSession`, `sourceAgeMs`, `spreadBps`, `timeframeAlignment`, `setupScore`, `confirmation`, `invalidations`, `entryZone`, `targets`, `reasonCodes`, and `risks`. Fields requiring non-existent evidence must be `null` or unavailable, not invented.

Example research record shape (illustrative schema, **not a quote**):

```json
{
  "symbol": "NVDA",
  "source": "twelvedata",
  "dataStatus": "historical",
  "asOf": null,
  "possibleAction": "Insufficient data",
  "technicalScore": null,
  "support": null,
  "resistance": null,
  "confirmedTrade": false,
  "reason": "Waiting for validated completed bars and execution checks"
}
```

Risk sizing example (long-only, educational): `riskDollars = accountValue × riskPct / 100`; `shares = floor(min(riskDollars / (entry - stop), accountValue / entry))`. The default 0.5% is configurable up to a 1% cap in V9. Stops can slip, spreads and commissions are omitted.

## Operations and account setup

1. GitHub repository: `manvirt97/trading-platform`, production branch `main`. Cloudflare Pages serves directory `public`; no build command required for this compatibility phase.
2. In Cloudflare **Workers & Pages → Project → Settings → Variables and Secrets**, configure `TWELVEDATA_API_KEY` as an encrypted **server secret** and `LIVE_DATA_ENABLED=on` only after checking appropriate subscription rights and securing API endpoints and the website.
3. Redeploy after changing production secrets, then verify the status endpoints and last completed market bar. Never paste keys into source files, screenshots or browser-side JavaScript.
4. GitHub CI: `npm test`, `npm run syntax`. To check the UI visually, open desktop and mobile browser widths and verify the new `/v9.html` page, readable text, sidebar, conditional signals and news changes.
5. The existing V9 page requires no additional paid service for the **interface** itself. It does require real authorized feed access for quantitative price analysis.

## Acceptance checklist

- [ ] A visibly new light or dark overview loads with no misleading demo prices.
- [ ] Navigation among Overview, Trade signals, Market scanner and News works without page refresh.
- [ ] No A/A+ header control; mobile navigation opens/closes correctly.
- [ ] With provider disabled, chart and trading levels are explicitly unavailable.
- [ ] With provider enabled and licensed, the chart uses dated real OHLCV, and labels stale bars.
- [ ] Scanner runs only when requested and displays real successful symbols and clear errors.
- [ ] News category selection requests the correct category, and articles have source links and times.
- [ ] Risk examples use real historical levels and explicitly warn about execution risk.
- [ ] Legacy account, AI, risk and journal pages remain accessible through Classic.
- [ ] No production deployment is claimed until the actual Cloudflare production status is confirmed.

## Roadmap after phase 1

- **Foundation migration:** Vite + React + TypeScript + Tailwind + Zod with route compatibility and Playwright smoke tests; validate security and caching before switching builds.
- **Data:** provider-adapter types, exchange calendar, quote freshness, spreads, Canadian entitlement, caching, dynamic session handling.
- **Quant:** complete indicator library, multi-timeframe rules, spread/liquidity penalties, out-of-sample backtests.
- **Scanner:** authorized market universe, server-side concurrent fetch quotas, ranking, filtering, alerts.
- **AI:** Anthropic behind authenticated server endpoint; JSON schema validation; no AI-derived market prices or fills.
- **Trading simulation:** paper orders only, slippage and commissions, session-aware fill model, immutable journal, performance analytics and user-configurable risk locks.

Trading research is educational. Technical setups can fail, costs matter, and results cannot be guaranteed.
