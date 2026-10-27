# Rangeform V15 · Day Trading Desk

## What shipped

New **Day Trading Desk** in the main sidebar and at `/v9.html#daydesk`. Rangeform's existing **Research Studio**, technical signal page, six-ticker sample scanner, publisher news, paper journal, account and Settings remain intact.

### Workflow

1. Choose one stock and a completed `1min`, `5min` or `15min` interval.
2. Press **Check intraday setup**. It sends **one explicit request** to `/api/day-desk`, which uses existing server-side licensed Twelve Data history and cache.
3. If valid, view the latest **historical** close and completed-bar date, candle plot, opening-range high/low, session VWAP proxy and relative volume. Chart labels are explicit about the data not being a streaming/broker price.
4. The deterministic engine checks opening-range breaks and session-VWAP reclaims/rejections, with minimum volume confirmation, freshness and US session gates. **Conditional watch** does not mean buy or sell now.
5. Only when a current eligible completed bar confirms a setup, review the *research reference* entry, invalidation and 2R scenario. Use **Use historical levels in risk planner** only if desired.
6. Enter hypothetical account and trade details. The calculator enforces the smaller of a per-trade risk cap and remaining daily drawdown capacity, applies stated estimated fees and slippage, and respects max position allocation. Values stay in memory in this browser tab, **not sent to an API**.

### What the model does and doesn't do

- Intraday market gate is Mon–Fri 9:30 a.m.–4:00 p.m. America/New_York; the holiday calendar is not independently checked. Session-aligned fresh bars are mandatory.
- Session VWAP is approximated as **typical price (H+L+C)/3 × candle volume**; it is not tick-by-tick VWAP and should not be treated as the consolidated tape.
- Opening range is completed candles from **9:30–10:00 a.m. ET**. Expected candle count must be complete for that morning.
- Volume confirmation uses last candle vs average of previous 20 completed bars (threshold 1.20×), not a statistically calibrated abnormal-volume model.
- Signal status is `NO_DATA`, `WAIT_STALE`, `WAIT` or `CONDITIONAL_WATCH`. There is no order-ready signal status.
- Execution gate always remains **not verified** because this product currently lacks licensed NBBO/tradeable bid-ask, market depth, spread/slippage estimates from a broker, short locates and any broker execution integration.
- Stops may gap/slip. The 2R level is an arithmetic scenario, **not** an expected target or profitability claim.
- Neither the initial page view nor symbol quick select spends a market-data credit. The explicit check uses the existing provider quota caching/cooldown and displays failures honestly.
- The plan does not implicitly create alerts, sync broker accounts, or buy/sell orders.

## Data/provider needs for a fully operational live day-trading product

**Phase 1 (this release)**: Chart-centred UI, clean trade-state model, verified historical-bar evidence, conditional watch, user-controlled analysis, honest UI copy, local risk math, tests.

**Phase 2**: Server-managed **licensed streaming** trade/quote feed, exchange permissions and real-time timestamp and quote-age monitoring. A basic REST key is not equivalent to streaming/consolidated quotes.

**Phase 3**: Multi-symbol streaming scanners for liquid/unusual-volume names (not a fixed six-ticker sample), trading calendar and economic/news events, consolidated quote spread gates and cross-venue refresh.

**Phase 4**: Replay/backtest with complete bid/ask historical data, out-of-sample performance, commissions and realistic slippage; persistent paper trading with fill models and immutable journals.

**Phase 5**: Authenticated server-triggered alerts and controlled delivery; any real brokerage integration requires separate user consent, API permissions, testing, audits and financial/regulatory review.

Until these phases have been completed and verified **do not advertise Rangeform as a live execution platform or guaranteed profit tool**. The current Day Trading Desk is an intraday research assistant.

## QA and operations

- GitHub CI: `npm test` and `npm run syntax`.
- Mobile viewport 320/390/430 px: check header safe area, scroll, chart, risk fields, sticky navigation, input focus and light/dark.
- Desktop: 1280, 1440, 1920 px: chart legibility, trade levels, side panels.
- Test edge cases: no provider key, 429 quota, missing history, stale bar, weekend, incomplete opening range, no volume, short, VWAP reclaim, daily risk fully used.
- Verify the production Cloudflare Pages commit SHA matches GitHub main. Static tests cannot prove that Cloudflare has deployed.
- Confirm your Twelve Data plan's real-time exchange licence and API/WebSocket entitlements separately before describing quotes as live. The page never contains the private API key.
