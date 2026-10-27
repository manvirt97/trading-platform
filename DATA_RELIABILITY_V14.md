# Rangeform Market Data Reliability (Twelve Data HTTP 429)

## What the screenshot means

- `Twelve Data HTTP 429` is **API-credit limit exhaustion**, not evidence that a ticker is bearish or that the Cloudflare secret is missing.
- A configured provider flag means the secret and `LIVE_DATA_ENABLED=on` exist; **it cannot prove** that an authorized quote is responding or streaming.
- The default Twelve Data Basic plan currently offers **8 API credits per minute and 800 per day**; confirm your own limits in the Twelve Data account. Paid plans differ. On Basic the daily quota resets at 00:00 UTC; minutely quota resets every minute.
- Each single-symbol `/time_series` request consumes 1 credit. Six automatic symbols, a manual chart and a health check can exhaust the Basic minute budget. Background refresh across browsers and server instances can compound it.
- **Real-time streaming and exchange-display entitlements** are separate from the ability to retrieve historical bars. Do not call the chart an executable broker quote.

Primary source: https://support.twelvedata.com/en/articles/5615854-credits

## Code shipped in this PR

1. `functions/_shared/provider-quota.js` centralizes Twelve Data time-series calls, in-flight deduplication, per-symbol/interval edge-caching with bounded TTLs, optional Cache API and a local per-isolate credit budget.
2. HTTP 429 **and** HTTP 200 with a JSON 429 payload open a temporary cooldown. Provider `Retry-After` and identifiable Basic daily limits are accounted for. The system never replaces a failed result with synthetic prices.
3. A passive `/api/feed-state` endpoint reports known cached provider health without spending another API credit. Public status exposes no API key.
4. Overview and scanner no longer automatically spend six credits on page load, return to tab or every refresh cycle. Scans are **on demand**; server-scored cached results remain available where permitted.
5. UI indicates `Historical bars checked`, `Feed not verified`, or `API quota exhausted`; the BUY/SELL monitor and watchlist scan pause after 429. Conditional watches remain based only on dated completed candles.

## Configuration and honest limits

- Keep `TWELVEDATA_API_KEY` as an encrypted Cloudflare Pages Production secret and `LIVE_DATA_ENABLED=on` only where your licence allows display to these users.
- Optional plain-text variable: `PROVIDER_MAX_CALLS_PER_MINUTE`. By default Rangeform allows five new provider calls per minute **per active isolate**, below the Basic eight-credit provider ceiling. This is only a local guard, not a global quota guarantee.
- Cache API entries are per Cloudflare data centre. With multiple visitors or simultaneous edge locations **a centralized Durable Object or Redis limiter is required** to enforce one provider-account-wide quota; this release does not pretend otherwise.
- If you want a continuously streaming scanner, obtain a suitable real-time streaming and redistribution licence from the provider. Use a licensed WebSocket feed and a centralized server for quotes and dispatch, not browser polling against a limited Basic REST key.
- The Provider Health check still makes an active request when deliberately used; use the new passive feed-status endpoint for routine diagnosis.
- If the provider reaches its daily credit cap, do not repeatedly press Refresh. The limit needs to reset or your subscribed quota must change; a code change cannot create credits.

## Acceptance checklist

- Run `npm test && npm run syntax`.
- Deploy the merged GitHub commit to Cloudflare Pages Production.
- Load the page without a scan: the quota should not be charged for a six-symbol discovery.
- With a valid historical-data key, run one symbol, observe completed-bar timestamp, source and provider response state.
- Simulate upstream HTTP 429 and JSON-level 429 and confirm browser shows cooldown without inventing analysis.
- Revisit Settings: “Provider enabled” is no longer interpreted as a live stream.
- Verify the provider dashboard's current credits and exchange rights.
- A separate integration/issue in the other screenshot is Anthropic HTTP 400 or TradingView setup (see `INTEGRATIONS_V14.md`), and is not fixed by adding API credits.
