# DayTrader Lab integration · proposed V29 (research-only)

This PR adds an on-demand, Cloudflare-native long-only scenario replay to the EXISTING **Day Trading Desk**. It does not change production until merged/deployed and does not run a Python interpreter inside Cloudflare Workers.

## Status of the 11 MIT DayTrader utilities

The 11 complete Python utilities are already stored under local-toolkit/research/trader-*/ in this repository. They can run on a local Python machine, not directly inside Cloudflare Pages.

- Scanner: existing Rangeform watchlist/opportunity/day-desk features; full Python universe scanner only local.
- News: existing news/catalysts feeds; Python SEC news only local.
- Entry: existing day-desk qualified opening range/VWAP watches; Python watch command only local.
- Exit: existing historical stop/reference and 2R planning; Python exit CLI only local.
- Time Machine: **new** Cloudflare-adapted, 10,000-path close-return bootstrap; NOT the original Python Time Machine and NOT a true forward-looking backtest.
- Budget/risk: existing deterministic hypothetical size and drawdown controls; Python files remain local.
- Broker: hosted app creates NO orders; Python ticket utility remains local, live connector is deliberately NOT enabled.
- Alerts: no unverified always-on alerts or brokerage alerts claimed; existing optional TradingView bridge requires setup.
- Earnings analyst: existing Rangeform research context, Python SEC filings tool only local.
- Congressional disclosures: Python trader-pelosi only local; no hosted scraper or time-sensitive claims.

## Safeguards / UI

- Existing v9/nav and CSS are left unchanged except for a contained new card and separate CSS/module.
- Explicit button press. No background requests, recurring polling, orders, account secrets, synthetic prices or new dependencies.
- API validates ticker, long-only stop < entry < target, horizon 3–48 and source entitlements BEFORE any provider request.
- Uses current provider-quota cache and valid completed OHLCV, with no fabricated fallback.
- The 10,000 *simulations* resample adjacent regular-hours completed-candle log returns, and check only path CLOSES. Not predicted probabilities, backtested performance, fills, drawdown controls, or autonomously traded orders.
- Shows number of sample returns and distinct sessions, and prominently warns of fewer than 20 sessions (Twelve Data provider currently requests 300 bars).
- Existing client-side risk planner remains independent and does not authorize execution.
- No claims of always-on operation or verified streaming quotes.

## QA and release gate

Run: npm test && npm run syntax

Before merging, inspect responsive Day Trading Desk at 320, 390, 430, 1280 px; verify script loads and the manual scenario card works with an authorized provider; confirm missing entitlement returns NO_SIMULATION and quota=429; verify 10,000 counts sum and reproducibility; ensure no new orders or background invocations.

Remaining integration work: separate authenticated Python microservice/worker for advanced scanner/SEC/PTR/alerts, complete data entitlements, rate limits, tests, monitoring, owner approval and audited isolation. Never describe those Python features as operational on Cloudflare before deployment and end-to-end verification.
