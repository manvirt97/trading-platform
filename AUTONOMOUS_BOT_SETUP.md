# Rangeform V2 — Autonomous Paper Trading Bot

This is an **autonomous paper-trading system**, not a funded brokerage bot. No private Kraken API keys, signed requests, AddOrder requests, withdrawals, wallet operations, leveraged trading, or live-money order execution are implemented. It uses real public exchange quotes to record **hypothetical** entries/exits.

## What is built

- `/bot.html`: owner-only control panel showing status, signal, portfolio cash, trades, cost estimates, and CSV export.
- `/api/auto-bot`: Firebase ID-token-verified GET status and POST actions (`start`, `pause`, `run_once`, `reset`, `flatten`). Requests require a configured `BOT_OWNER_UID` and the existing D1 database binding. Cross-origin POST is rejected.
- `functions/_shared/auto-bot.js`: deterministic, auditable 9/21 EMA crossover on completed 5-minute BTC/USD candles. No AI pricing assumptions or future bars.
- `functions/_shared/auto-bot-feed.js`: public Kraken depth and OHLC only. Last (unfinished) candle is discarded. Invalid, stale, crossed, or incomplete feeds block simulated decisions.
- `worker/autonomous-paper-bot.js`: separate Cloudflare cron Worker at `* * * * *` UTC, 1 tick per minute when enabled and with a valid D1 binding.
- `rangeform_auto_bot` D1 row: revision-based compare-and-swap. A concurrent scheduled and manual tick cannot both update the same state revision.
- The engine starts PAUSED and `wrangler.bot.toml` ships `BOT_SERVICE_ENABLED = "off"`.

## IMPORTANT: background operation is NOT automatically activated

Cloudflare Pages can deploy the UI and API automatically from GitHub, but the scheduled Cron Worker requires **its own deployment**. Neither the UI nor a successfully deployed Pages site proves that unattended ticks are running. The Worker is not deployed merely by merging the PR.

### Setup for a Calgary/Alberta owner

1. Sign in using Google at `https://rangeform.pages.dev/account.html`, then open `https://rangeform.pages.dev/bot.html` to see the Firebase owner UID. It is an identifier, **not** a password.
2. Open Cloudflare Dashboard → Workers & Pages → **rangeform** (Pages project) → Settings → Variables and Secrets. Add a **secret** `BOT_OWNER_UID` with your exact Firebase UID. Add environment variable `BOT_SERVICE_ENABLED` with value `on`. Confirm existing D1 binding `DB` still points to `rangeform-users`. Redeploy Pages with the updated configuration. Do not add exchange trading API keys.
3. In a local terminal with the repository checked out, install current Wrangler or use `npx wrangler` after authenticating to your Cloudflare account.
4. In `wrangler.bot.toml`, change **only** the Worker `BOT_SERVICE_ENABLED` value from `off` to `on` in your local deployment configuration. Keep the Git repository default `off` to preserve fail-closed deployments.
5. Add the owner UID as a secret to the **separate Worker** using:
   `npx wrangler secret put BOT_OWNER_UID --config wrangler.bot.toml`
   Enter the same Firebase UID value (NOT an API key/password). Cloudflare might require the Worker to exist first. If so deploy while disabled, set the secret, and redeploy with `on`.
6. Deploy this separate Worker:
   `npx wrangler deploy --config wrangler.bot.toml`
7. Open Cloudflare Workers → `rangeform-autonomous-paper-bot` → Triggers and confirm cron `* * * * *` exists. Check Invocations / Logs for successful runs. Verify the D1 binding and the Worker’s own `BOT_SERVICE_ENABLED=on` setting. Cron triggers execute in UTC and may take time to propagate.
8. Open `/bot.html` signed in as the owner, click **Enable paper strategy**, then **Run one verification tick**. The dashboard should show an ordinary verification timestamp and, only on actual strategy conditions, simulated trades. A **manual tick is not proof of background autonomy**. Wait for the **CRON AUTONOMY** panel to show **RECENT WORKER TICK**, which requires the separate Worker to record `lastCronTickAt` in D1. Close the browser and check it again: scheduled timestamps should advance. `NOT VERIFIED` means the Worker has not recorded a recent enabled tick; check Worker cron configuration, deployment secrets, Logs, D1 binding and whether the paper strategy is enabled. Even a successful scheduled tick can report `NO_DATA` when Kraken is unavailable.
9. **Pause immediately** from the same dashboard if there is any unusual behavior. Pausing halts new automated paper decisions. If a simulated position remains, use **Close hypothetical position & pause**; this requires a fresh public bid with sufficient top-of-book quantity and may refuse to close when the feed is unavailable.

No migration CLI command is required: the first authenticated status call initializes the isolated `rangeform_auto_bot` table in the existing D1 database with the bot disabled. Other D1 tables are not altered.

## Strategy and risk rules

- BTC/USD **spot long-only**, no leverage, shorting, prediction contracts, derivatives, or real exchange orders.
- EMA 9 crosses above EMA 21 on *completed* five-minute candles → potential paper entry, if spread and risk filters pass.
- Exit when bid is below a 1.5% stop threshold, above a 3% target, at a bearish EMA crossover, or after 180 minutes. Because the worker ticks once/minute, a real market could move far beyond thresholds before the next paper decision.
- Entry amount is 1% of starting paper capital, and only one paper position can be open.
- Max five daily paper entries, 15-minute cooldown, 22 bps spread limit, 2% daily realized-loss stop, 5% total equity drawdown halt, or three consecutive losing paper trades.
- 40 basis points per side assumed fees and 10 basis points per side assumed slippage. **These are not confirmed account fees**.
- Paper fills at the observed ask for buying and bid for selling with adverse cost assumptions, only if visible top-level size covers the modeled quantity. They are not proof the order would have been filled, and financing/FX/tax costs are not modeled.
- A safety halt disables new trading. A position might remain hypothetically open; use the owner-directed flatten control when market data is available.

## Deployment validation

- GitHub Actions must pass `npm test` and `npm run syntax`.
- In your deployed Pages site: access `/bot.html`; confirm signed-out users cannot access private state and unauthorized Firebase users receive 403. Before configuration, /api/auto-bot must return 503 with NOT_CONFIGURED.
- Confirm Kraken outages cause NO_DATA, not fabricated prices, and no paper entry.
- Confirm the separate cron Worker actually runs by checking Cloudflare Worker invocations **and** last_tick_at advancing in D1 (or on the dashboard). Successful deployment of the UI alone does not prove this.
- Do not enable unattended operation until monitoring and operation costs are understood. Use Cloudflare's per-worker limits to avoid uncontrolled public API usage.

## Future real-money bot is a **separate explicit project**

Would require a verified eligible Kraken account; confirmation of Canadian product permissions, account-specific fees, position precision and minimum order sizes; securely stored restricted trading-only credentials, **withdrawals disabled**; trade reconciliation; durable idempotency; exchange failover; slippage protections; real market testing; monitoring/alerts; owner opt-in; and a dedicated review of applicable regulatory conditions. None of those have been claimed or implemented in V2.

Sources: https://support.kraken.com/ca/articles/360001373983-does-kraken-allow-trading-bots- , https://developers.cloudflare.com/workers/configuration/cron-triggers/ , https://developers.cloudflare.com/d1/platform/limits/

## Version 17 interface and monitoring

- `/v9.html`, `/algo.html`, and `/bot.html` now share consistent sidebar destinations and light/dark appearance preferences. Mobile sidebars remain horizontally scrollable rather than disappearing.
- **PAPER TRADING · REAL ORDERS OFF** is an intentional safety statement, not an API outage. The Algorithmic Desk can simulate a manual buy or sell on fresh public Kraken depth, while the Autonomous Paper Bot can make unattended **hypothetical** decisions only after both the Pages service and separate Cron Worker are configured.
- The bot's `lastCronTickAt` is updated exclusively when the Worker calls `runPaperTick` as a scheduled task. A manually requested verification tick must never make the interface appear automatically scheduled.
- A recent Cron timestamp is evidence the scheduler attempted the paper strategy, **not** proof of successful market-data retrieval, strategy performance, real fills, or profitable results.
- Activating real-money cryptocurrency, equity, or event-contract orders is **not part of this release**. That would require an explicitly chosen licensed broker, account-level permissions, client consent, separate order/risk services, failure recovery and validation. Never add broker/withdrawal credentials to the paper bot.
