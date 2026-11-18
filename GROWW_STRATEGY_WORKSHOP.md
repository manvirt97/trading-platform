# Rangeform Strategy Workshop — Groww Research Integration

## What is implemented
- Rangeform / Algorithmic Desk / Strategy Builder with a centered Backtest | Live switch, mobile UI and dark-mode support.
- Deterministic 9/21 EMA parser and long-only underlying OHLC backtester with realistic assumptions and cost inputs.
- Candlestick trade-by-trade audit, EMA traces, entry/exit markers, P&L and filters.
- Live mode: READ-ONLY Kraken BTC/USD and ETH/USD market observer. It drops the latest unfinished candle and refreshes while visible.
- Owner-only POST /api/groww-research: GET-only Groww upstream historical expiries, contracts, candles; no order placement.

## Required Cloudflare Pages configuration
1. Set GROWW_RESEARCH_ENABLED=on only after checking Groww history entitlement and contract terms.
2. Save GROWW_ACCESS_TOKEN as an encrypted secret. Never put broker tokens in code, logs, web pages, tickets or chat messages. Rotate credentials according to Groww guidance.
3. Set BOT_OWNER_UID to the verified Firebase owner UID, securely stored.
4. Ensure existing DB D1 binding and ai_allowance quota table are operational.
5. Ensure Firebase authentication and FIREBASE_PROJECT_ID work for the same owner.
6. Review exchange display licensing before serving quotes/options history to other users.

The connector enforces owner auth, fixed endpoint allowlists and a 60-call/day owner quota. It rejects arbitrary URLs and writes no broker orders. The UI currently shows only provider configuration status; it does NOT allow a public user to enter an access token or pull private Groww account data.

Official historical API documentation: https://groww.in/trade-api/docs/curl/backtesting

## Work remaining for full video parity
- Live authenticated Groww session, contract selection and entitlement tests.
- Historical NIFTY spot and options one-minute bars with licensed storage and precise IST 09:15 session resampling.
- Dynamic ATM, ITM5 buying and ATM selling modes with lot sizing, expiry/strike handling and all India fees/taxes.
- Cost and missing-candle audit for each options strategy, full mode comparison and option-premium trade charts.
- Genuine persistent server paper strategy engine, idempotent state, reconciliation, alerts, circuit breakers and forward testing.
- Broker order execution remains DISABLED pending approved credentials, authorized market, independent CSO checks, full integration tests and explicit owner consent.

## Verify
Use npm test, npm run syntax, npm run security-gate and the iPhone browser workflow.
Backtest and live observation share one deterministic EMA decision core. Neither promises profitability or automatic trades.
