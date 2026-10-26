# Product roadmap: research first, execution later

## Ready in cloud edition
Cloudflare Pages-compatible UI; serverless rules-based analysis, backtesting and risk calculator; fictional sample bars; optional server-side market API keys; local-in-browser journal and CSV import; responsive themes.

## Not yet built or validated
Exchange-licensed real-time tick feeds; guaranteed latency and provider timeouts; market-wide streaming event ingestion; unified multi-source verified news; quantitatively calibrated forecasts; realistic bid-ask and fill models; walk-forward out-of-sample tests; brokerage orders; persistent accounts and encrypted cross-device syncing; cloud authenticated access; API-abuse quotas; Canadian investment-advice compliance assessment; trademark clearance.

## Engineering sequence
1. Protect the site with access authentication before provisioning paid feeds.
2. License streaming data with exchanges and measure delays across network, ingestion, features, scoring and UI updates.
3. Backtest candidate models on time-split out-of-sample data, include survivorship bias, fees, fills, spread, market impact, borrow and volatility regime changes.
4. Compare to simple benchmarks, show precision/recall, calibration plots, regime-specific error bars and “no trade”/stale-data gating.
5. Add authenticated watchlists and an auditable event-driven journal.
6. Only after paper-trading and legal/security review, evaluate broker integration with kill switches, limits and explicit authorization.

This prototype does not predict stock prices or maximize returns. No result or displayed score is a success probability.
