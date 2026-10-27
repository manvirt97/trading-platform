# Rangeform V16 — Get actual market quote checks working (owner-only)

**Purpose.** Complete the next practical connection step for the existing Day Trading Desk: an owner-only, one-click latest bid/ask check from a separately permissioned Alpaca data account. This is **not** continuous streaming, verified US NBBO when using IEX, automatic orders, market-wide scanning or a resale licence.

No API credentials should ever be committed to GitHub, pasted into Rangeform's public browser UI or shared in ChatGPT. This implementation is restricted by a **verified Firebase ID token** and an exact owner UID.

## Step 1 — Verify your website is deployed

1. Open https://dash.cloudflare.com/ → **Workers & Pages** → choose the Pages project that serves `rangeform.pages.dev`. It may be called `rangeform`.
2. Choose **Deployments**. Check that the latest **Production** deployment matches GitHub `main` commit from PR #22.
3. If it is old/failed, open its deployment logs and fix the Pages Git integration; do not confuse a successful GitHub test with a deployed Cloudflare website.
4. Navigate to https://rangeform.pages.dev/v9.html#settings. You should see **Make the Day Trading Desk operational**, and a new quote block on https://rangeform.pages.dev/v9.html#daydesk.
5. The lightweight https://rangeform.pages.dev/api/status returns `owner_quote_checks_configured: false` until you deliberately complete the secrets below. No secrets are returned.

Cloudflare documentation: https://developers.cloudflare.com/pages/configuration/git-integration/

## Step 2 — Ensure the historical candles are working FIRST

1. In Cloudflare Pages → your project → **Settings → Variables and Secrets**, confirm:
   - **Encrypted secret:** `TWELVEDATA_API_KEY` (existing Twelve Data key)
   - **Text setting:** `LIVE_DATA_ENABLED=on` (only after entitlement/redistribution approval)
   - **Optional text setting:** `PROVIDER_MAX_CALLS_PER_MINUTE=5` or lower under a Basic plan. This is a per-isolate guard, not a global limiter.
2. Redeploy after changes.
3. Visit https://rangeform.pages.dev/api/feed-state (this endpoint checks cached state without spending Twelve Data credits).
4. In Day Trading Desk, choose NVDA at **5 min** and press **Check intraday setup**. If the feed is rate-limited, do not hammer Refresh. A 429 reflects actual provider credits, not a bad trading signal.
5. If you need more API credits, consult https://twelvedata.com/pricing. Even Twelve Data WebSocket quotes **do not include OHLCV or bid/ask**; a price-only stream is not an executable bid/ask feed.

## Step 3 — Choose real-time permissions before spending money

**For private learning/testing only:** Alpaca's IEX market-data feed can be an entry point when your account is eligible. It reports one exchange, **not** the consolidated US market. Confirm account eligibility as a Canada-based developer directly with Alpaca; do not infer brokerage eligibility from this repository.

**For professional/commercial/public display:** Ask Alpaca about the correct subscription, consolidated SIP market data, exchange professional/nonprofessional classification and display/redistribution rights. A personal API subscription is **not** automatically a licence to serve quotes to every Rangeform user.

Alpaca product docs:
- https://docs.alpaca.markets/us/docs/about-market-data-api
- https://docs.alpaca.markets/us/reference/stocklatestquotesingle-1

**Do not pay for a real-time feed until the provider has confirmed data rights and account eligibility for your intended use.**

## Step 4 — Get private Alpaca market-data credentials

1. If eligible, use https://app.alpaca.markets/ and set up an approved market-data account.
2. Create your API Key ID and API Secret Key in the relevant account/project, following current Alpaca dashboard instructions. Note that some products use separate market-data or broker credentials.
3. Do NOT put the keys into a TradingView alert, GitHub issue, repository code, Firebase config, browser storage, URL, or ChatGPT message.
4. If the credentials were ever posted publicly, rotate them immediately in Alpaca.

## Step 5 — Add exact Cloudflare variables

In your **production Pages project** open Settings → Variables and Secrets → Add. Use the following exact names:

| Variable name | Type | Value | Notes |
| --- | --- | --- | --- |
| `ALPACA_DATA_KEY_ID` | **Encrypted** | Your private Alpaca Key ID | Never in browser |
| `ALPACA_DATA_SECRET_KEY` | **Encrypted** | Your private Alpaca Secret | Never in browser |
| `TRADING_QUOTE_OWNER_UID` | Text or encrypted | Your private Firebase Authentication UID | Must be the exact Google account authorized to read quotes |
| `REALTIME_QUOTE_CHECKS_ENABLED` | Text | `on` | Explicit opt-in |
| `ALPACA_DATA_FEED` | Text | `iex` | Use `sip` only after you have SIP entitlement |

**How to find the correct UID:** Go to https://console.firebase.google.com/ → select your `rangeform-7e8d2` project if it is yours → Build → Authentication → Users → copy the **User UID** of your authorized Google sign-in. This is NOT the email address, Firebase app ID or project ID.

Existing Firebase Authentication fields and D1 bindings must be working for sign-in. A UID is an identifier, not a password, but should be treated as private access configuration.

**Cloudflare deployments must refresh** to pick up new secrets. Redeploy Production after the last setting is saved. Official documentation: https://developers.cloudflare.com/pages/functions/bindings/#secrets

## Step 6 — Verify the real quote path, without spending Twelve Data credits

1. Sign in with your Google account from **Overview → Research AI**.
2. Open https://rangeform.pages.dev/v9.html#daydesk
3. Choose `AAPL` and press **Check latest bid/ask snapshot**. This is a *separate* endpoint from the Twelve Data historical-candle request; it never creates orders.
4. A successful response shows **Bid / Ask / Spread / Spread bps / Quote age / Feed coverage**.
5. The page must say **IEX single venue** unless you have configured entitled SIP. Check date/time: a last quote from the previous trading day may legitimately be stale during closed hours.
6. Errors are actionable:
   - `QUOTE_NOT_CONFIGURED`: missing private variables, owner UID or enable flag; ensure a fresh Production deployment.
   - HTTP 401: Firebase sign-in not available; sign in via Research AI and check authorized domain.
   - `OWNER_ONLY`: Google/Firebase UID does not match `TRADING_QUOTE_OWNER_UID`; use the authorized account.
   - `QUOTE_CREDENTIALS`: credentials invalid; check Alpaca account and secret names.
   - `QUOTE_ENTITLEMENT`: feed isn't available on plan; verify IEX vs SIP rights.
   - `QUOTE_RATE_LIMIT`: throttle; wait instead of repeatedly polling.
   - `QUOTE_INVALID_RESPONSE`: provider returned missing/crossed bid/ask or bad timestamps.
7. Test during **regular US trading hours** on a normal nonholiday day. An overnight snapshot, even if structurally valid, is not a current trading price.

## What is now coded versus what is not

**In GitHub V16:** Private server-side Alpaca latest-quote proxy, Firebase authorization + exact owner UID gate, explicitly on-demand requests, stale quote/spread checks, simple 15-second per-owner/symbol/isolate anti-repeat cache, no credentials leaked to the browser, test suite, setup guide.

**NOT YET LIVE VERIFIED:** Account access, paid SIP subscription/permissions, quote availability in Production, Cloudflare deployment, exchange approvals.

**NOT IMPLEMENTED:** Continuous streaming WebSocket distributor, exchange-wide scanner, order management, real fills, overnight alert server, out-of-sample P&L validation. Those require a separate licensed quote+bar streaming architecture and server-side account-level coordination (potentially a Durable Object on Cloudflare). Do not create a browser WebSocket with an API key.

## Acceptance criteria

- [ ] Cloudflare shows the new `main` commit successfully deployed to Production
- [ ] GET `/api/status` reports `owner_quote_checks_configured:true`; status alone isn't verified market data
- [ ] Authorized owner Google login works
- [ ] Owner quote check returns dated, noncrossed bid/ask and a recognized feed label
- [ ] Another logged-in account cannot view/check the owner market-data feed
- [ ] During open hours, quote age and selected exchange coverage are suitable for research
- [ ] Provider-limit and closed-market cases show clear messages
- [ ] The Twelve Data historical-candle path still works under the existing API credit budget
- [ ] Full GitHub CI tests and syntax pass, and phone/tablet/desktop page layout is visually verified

If any check fails, **keep execution disabled** and use Rangeform for research/paper planning rather than day trading.
