# Rangeform Algorithmic Desk — version 1

**Access:** `/algo.html` from the Rangeform sidebar. The feature is an independent research and paper-execution module inside the existing Cloudflare Pages app; no new API keys or vendor installations are required to view public spot order books.

## What works

1. `/api/algo-book?pair=XBTUSD` and `?pair=ETHUSD` proxy Kraken public Spot REST market-depth snapshots. They return source, fetch timestamp, top 20 bid/ask levels and flags indicating that brokerage orders are disabled. An upstream error produces HTTP 503, never synthetic substitute prices. An unknown pair produces HTTP 400.
2. Algorithmic Desk shows live, explicitly timestamped snapshots, top depth, spread in basis points, depth imbalance, and an **immediate hypothetical round-trip estimate** using editable per-side fees and slippage. Initial assumption 40 bps fees and 10 bps slippage per side is a placeholder; enter your exact exchange fee tier and realistic adverse slippage before drawing conclusions.
3. Paper buy/sell records a hypothetical marketable position into the browser-local ledger at the displayed best ask/bid with the cost assumptions. It is **not exchange-executed, backtested or verified fill data**. A single position can be open at a time, and all book data must be fresh (under 20 seconds) before a paper buy/sell.
4. Daily realized losses from sell transactions of 2% of initial capital stop new paper entries; a user-activated kill switch blocks buy and sell; notional per opening is capped at 5% of initial capital; a position and cost-aware liquidation mark is shown only when the active market has fresh quotes. CSV export is supported.
5. Prediction-market tab provides a manual calculator for matching YES and NO prices of **the exact same authorized contract event** including separately entered fees and quantities. There is **no connected IBKR or Wealthsimple event-contract data feed** and no automatic execution.

## How to run

- Deploy the feature branch via normal Cloudflare Pages preview or merge after reviewing CI.
- Open the preview at `/algo.html`, choose BTC/USD or ETH/USD. If Kraken is unavailable, the interface must display an error with disabled paper actions; do not bypass this safety check.
- In **Trade economics**, replace default fee and slippage assumptions with account-specific fees. Paper trading uses USD notional, not CAD; conversion, spreads, taxes and account-specific restrictions are not modeled.
- Use **Paper buy at ask**, then **Paper sell at bid** to close. The journal is stored only in your current browser using `rf_algo_paper_v1`; use CSV export before clearing storage.
- For event-pair research, use Canadian-eligible broker quotes verified externally, enter YES/NO ask prices in cents and fees in cents per contract, then independently confirm equivalent settlement and the ability to fill both sides.

## Critical limits

- The backend makes only **public, read-only Kraken API calls**. It cannot access accounts, take custody, place orders, or connect an exchange API key. All P&L is hypothetical and can be optimistic because top-of-book size and resting-order priority can change rapidly.
- This is a market-data snapshot refresher (12-second polling while visible), **not** a low-latency, high-frequency trading engine. Exchange maker rebates, market impact, taxes, financing and opportunity persistence are not modeled.
- Prediction contract opportunities must be entered manually; an apparent paired edge is never a verified arbitrage or guaranteed profit. Canadian product availability and automation permissions require confirmation with broker/compliance.
- For launch to many visitors, add centralized polling, per-client throttling, logs, monitoring and Kraken API permission/rate-limit review. Do not connect private order placement on public Pages without owner authentication, secret vault, dedicated execution infrastructure and comprehensive compliance review.

## Verification

`npm test` and `npm run syntax` run CI. Tests cover contract-pair payoff arithmetic, adverse fee/slippage calculations, risk guards, API error/allowlist behavior and a main navigation link. Tests don't replace production integration testing: check Cloudflare Pages preview and live Kraken replies from the intended deployment geography before declaring operational readiness.

Official references:
- https://support.kraken.com/ca/articles/360000919986-public-endpoint-examples-you-can-try-them-directly-in-a-web-browser-
- https://support.kraken.com/ca/articles/360001373983-does-kraken-allow-trading-bots-
- https://www.interactivebrokers.ca/en/trading/products-event-contracts.php
