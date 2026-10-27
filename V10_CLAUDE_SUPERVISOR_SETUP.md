# Rangeform V10 — supervised 11-Claude-agent integration and feed infrastructure

October 26, 2026. Implementation branch: `feature/claude-supervisor-tv-bridge-v10`.

## Implemented architecture

```
TradingView Pine alerts  ────► secured inbound webhook ─────┐
Twelve Data OHLCV (primary) ──► authorized market-data layer ├──► deterministic candle / ORB indicators ─► 22-rule safety room
Licensed Finnhub OHLCV fallback ─► (only if explicitly enabled) ┘                                     │
Publisher RSS headlines ─────────────────────────────────────────────────────────────────────────────┤
Additional 5-minute, 15-minute, daily verified bars ────────────────────────────────────────────────┤
                                                                                                    ▼
                              ON-DEMAND AUTHENTICATED CLAUDE COUNCIL: 10 individual specialists
                                                                                                    ▼
                           11th Claude supervisor explanation + fixed deterministic safety verdict
                                                                                                    ▼
                             BUY WATCH / WAIT / BEARISH WATCH (never an executable order)
                                                                                                    ▼
                    Paper-practice journal first, browser-local and manually recorded reference fills
```

### Ten distinct Claude specialist requests

Market Regime; Technical Trend; Momentum; Pattern; Volume; Support & Resistance; Multi-Timeframe; News & Catalysts; Sentiment; Risk & Execution. **Eleventh:** Claude supervisor explains their agreements and limitations, respecting deterministic Rangeform hard vetoes and preserving the underlying pattern verdict. The existing **22-rule** specialist engine remains authoritative over new buys/sells. Model outputs never directly set true prices, execution status, timestamps or trade outcomes.

When configured, each **explicitly requested** investigation makes up to 10 separate Claude Haiku requests and 1 Claude Sonnet supervisor request via HTTPS from Cloudflare; no Anthropic key is sent to the browser. Defaults can be changed *only* to supported, audited models in `functions/api/claude-desk.js`. This consumes paid Anthropic API tokens. Current backend allowance: 2 requests per authenticated UID per UTC day, 16 platform-wide per UTC day, using existing D1 `ai_allowance` counters. The user must opt in for each investigation; no background Claude bill.

Outputs include source time, last completed bar, quoted publisher headlines, per-specialist responses (including failures), the separate deterministic supervisor verdict and vetoes. Missing 1-minute/1-hour data, calendars, order book, social data, breadth and validated sentiment are labelled unavailable. The numbers are *not* probability of profit. No brokerage API integration exists.

### Source/data limitations

- **TradingView:** Official widgets can embed charts; no general public price-data/indicator extraction API. **Webhooks are supported** for inbound Pine Script alerts. Receiving a webhook is not a verified exchange quote. Official docs: https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/ and https://www.tradingview.com/widget-docs/faq/data/.
- **Twelve Data:** Existing server-side OHLCV provider. Real-time/delayed entitlements and public display rights depend on the subscription. The app does **not** verify that your account has commercial redistribution rights.
- **Backup:** Uses authorized Finnhub stock candles if and only if `FINNHUB_API_KEY`, `FINNHUB_FALLBACK_ENABLED=on` and `LIVE_DATA_ENABLED=on` are present. It accepts only complete, validated historical OHLCV. Configuring Finnhub is **not equivalent to guaranteeing exchange-real-time redundancy**, matching symbol conventions or contractual licensing.
- **Yahoo Finance:** Not implemented as a scraped/undocumented API fallback. A reliable public trading product needs an explicitly permitted/contracted source.
- **Scheduled scanning:** Separate optional Cloudflare Worker scans six curated US symbols every 30 minutes **during normal weekday 10:00–16:00 Eastern** and saves to shared KV. It does not scan the whole exchange, obey a fully validated holiday calendar, deliver push notifications or fire broker orders. It makes **no Claude calls** to keep running costs bounded.
- **US equities only:** Time-window and opening-range logic assumes US equities. Canadian symbols/exchanges, options, crypto and other sessions require market-specific design and licensed access.

## REQUIRED: Cloudflare Pages setup

Cloudflare Workers & Pages → `rangeform` → Settings → Variables and Secrets (Production), set:

| Name | Where | Required for |
|---|---|---|
| `ANTHROPIC_API_KEY` | encrypted server secret | Claude API, paid and permissioned |
| `CLAUDE_AGENTS_ENABLED` = `on` | environment variable | explicit permission to call 11-agent council |
| `TWELVEDATA_API_KEY` | encrypted server secret | primary historical candles |
| `LIVE_DATA_ENABLED` = `on` | environment variable | only after confirming entitlement, site protection and display rights |
| `FINNHUB_API_KEY` | optional encrypted server secret | independent backup OHLCV |
| `FINNHUB_FALLBACK_ENABLED` = `on` | optional environment variable | opt-in after confirming Finnhub subscription rights |
| `TRADINGVIEW_WEBHOOK_TOKEN` | encrypted server secret; ≥32 random characters | TradingView webhook-only receiver authentication |
| `TV_OWNER_UID` | server variable | owner-only read of webhook inbox |
| `TV_EVENTS` | Cloudflare KV namespace binding | store deduplicated inbound webhook events |
| `SCANNER_SNAPSHOTS` | optional Cloudflare KV namespace binding, shared with Worker | owner-authenticated scheduled scan snapshots |
| `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_APP_ID` | Firebase web config | Google sign-in |
| `DB` | D1 database binding | authenticated Claude allowance; ensure `ai_allowance` exists |

Never place Anthropic, Finnhub, Twelve Data or webhook-receiver secrets into the V9 frontend, GitHub, or TradingView screenshots. Firebase web config fields are public client app identifiers and not private API secrets.

**AI setup:** Set up Firebase Authentication Google sign-in, authorize `rangeform.pages.dev` and the actual custom domain; apply the `ai_allowance` D1 migration; enable the Claude keys in Cloudflare. The **Claude council panel** appears even when not configured, clearly labelled *Not configured*. Use Google sign-in from Overview / Evidence Assistant, then Trade signals → analyze a symbol → **Investigate with 11 Claude agents**. It will never run without explicit user action and a real authenticated token.

## REQUIRED: TradingView inbound alert setup

- Create a dedicated, unguessable **receiver-specific** token (e.g. `openssl rand -hex 32`). This is **not** a broker password, login secret, or exchange API credential. Keep it restricted to the webhook bridge. It is included in the TradingView alert body as a verification token, so secure the TradingView alert and account access, restrict logs, and rotate if exposed.
- Bind `TV_EVENTS` Cloudflare KV to Pages and set `TRADINGVIEW_WEBHOOK_TOKEN` in Pages secrets (not frontend). Set `TV_OWNER_UID` to your Firebase UID for private reading.
- Create an alert from a suitable Pine Script or TradingView chart. TradingView requires an eligible account with 2FA, HTTPS port 443, and a receiver response within ~3 seconds.
- Webhook URL: `https://rangeform.pages.dev/api/tv-alert`
- Example **template only**; replace the placeholder with the dedicated webhook token and replace the event id with a unique identifier per alert:

```json
{
  "auth":"REPLACE_WITH_DEDICATED_WEBHOOK_TOKEN_ONLY",
  "id":"{{ticker}}-{{interval}}-{{timenow}}-ENTRY",
  "symbol":"{{ticker}}",
  "action":"BUY_WATCH",
  "time":"{{timenow}}",
  "interval":"{{interval}}"
}
```

Valid actions: `BUY_WATCH`, `SELL_WATCH`, `BUY`, `SELL`, or `WAIT`, but none triggers an actual broker order. Receiver rejects unknown sender IPs, missing/short tokens, bad symbols, events older than 5 minutes and duplicate IDs. Current TradingView published sender IPs are allowlisted. Verify real webhook delivery and logs before trusting it. TradingView webhook notifications may occasionally fail and are not intended as guaranteed automated trade execution.

The owner-only `GET /api/tv-alerts` requires your valid Firebase bearer token and `TV_OWNER_UID`.

## REQUIRED: optional scheduled scanner

This is **not deployed by the Pages project automatically**.

1. Create Cloudflare KV namespace `SCANNER_SNAPSHOTS`; use the exact same namespace ID in both the separate Worker and the Pages project bindings.
2. Edit `wrangler.scanner.toml`: uncomment `[[kv_namespaces]]` and supply its actual namespace ID; set `LIVE_DATA_ENABLED=on` only after approval of provider terms.
3. Add your authorized market-data keys as **Worker** secrets too; Pages bindings are not shared with a separate Worker automatically.
4. Deploy explicitly with `npx wrangler deploy --config wrangler.scanner.toml` using your authorized Cloudflare account.
5. Observe Worker logs / KV; after the first eligible weekday scan, authenticated `GET /api/scheduled-opportunities` will return the last snapshot.

The Cron trigger is `*/30 * * * *` UTC; the Worker checks actual America/New_York regular-session local time so DST changes are handled, but it does not yet integrate an exchange holiday calendar. This schedule may require **~6 provider OHLCV requests every 30 minutes in session**; check rate limits and commercial terms.

## How to confirm your deployment (important)

The GitHub merge does **not** prove Cloudflare deployed. Open `https://rangeform.pages.dev/v9.html`. A successful **V10** deployment shows:

- Header: **V10 · CLAUDE COUNCIL** (desktop).
- Sidebar: **Opportunity scanner**, which now contains the automatic discovery table; on Overview click **Explore opportunities**.
- Trade signals: prominent **SUPERVISOR · WAIT / BUY WATCH / BEARISH WATCH**, followed by **Claude research council**, **TradingView & scheduled scans** and **The Agent Room**.
- Data quality: if no verified OHLCV connection, the trading decision stays **WAIT**; if no Claude key, council remains **Not configured**. Do not fake success to paper over missing infrastructure.

## Out of scope and later requirements

A true continuously streaming whole-market scanner, 1-minute / 1-hour multiple timeframe normalization, validated market calendars, earnings filing integration, credible quantitative market sentiment, paid Level II / options liquidity feeds, real broker quotes, user-configurable alert subscriptions, push notification delivery, mobile background processing, cross-exchange live verification, and real broker execution are **not built or licensed**. For a production consumer app, protect data endpoints and establish redistribution rights, throttle per-user/provider usage, and evaluate performance with **out-of-sample walk-forward backtests** and realistic commissions, spread and slippage.

An indicator agreement score is never a 76% probability of profitability; only appropriately validated out-of-sample statistics could support such a claim, with caveats.
