# Rangeform — activate production and autonomous PAPER bot

**No real-money orders are implemented or authorized in this workflow.** Do not copy a Cloudflare token, a Google credential or a brokerage key into GitHub source, issues, chats, or workflow inputs.

## Current deployment architecture
- GitHub `main` -> Cloudflare **Pages** project `rangeform` (Git-integrated).
- `wrangler.toml`: Pages `DB` D1 binding to the **existing** `rangeform-users` database. `BOT_SERVICE_ENABLED=on` authorizes the owner-only paper controls **only if** the exact Firebase `BOT_OWNER_UID` secret also exists and the D1 binding resolves. No real-money orders are possible.
- `wrangler.bot.toml`: **separate** scheduled Worker `rangeform-autonomous-paper-bot`, default **off**. Cron `* * * * *` UTC is not proof of background execution until its heartbeat is recorded.

## One-time owner authorization — GitHub encrypted secrets
1. In GitHub, open `manvirt97/trading-platform` -> **Settings -> Secrets and variables -> Actions -> New repository secret** (or configure the equivalent `production-paper` environment secrets).
2. Create exactly these **encrypted secret names**, with values copied directly from your own authorized accounts:
   - `CLOUDFLARE_API_TOKEN`: a scoped Cloudflare **account API token** (not your Global API Key). For the first creation of `rangeform-autonomous-paper-bot`, Cloudflare requires **Workers Admin at the Workers product scope**; Pages secret updates need **Pages Write**. After the Worker exists, you can restrict ongoing deploy permissions to **Workers Editor for that Worker** where supported. Set the correct Cloudflare account scope and never share the token in chat.
   - `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID. Do not confuse with GitHub account ID.
   - `BOT_OWNER_UID`: the Firebase UID displayed after Google sign-in at `https://rangeform.pages.dev/account.html` in **Your owner ID for Cloudflare**. This is an identifier, NOT your password.
3. No brokerage/exchange API keys are needed or accepted. Keep Cloudflare permissions narrow and revoke tokens if compromised.

## Deploy without local Terminal
1. Go to GitHub -> **Actions** -> **Deploy autonomous PAPER Worker** -> **Run workflow**. Choose `main`, operation `prepare_disabled`, leave confirmation empty. Run.
   - This deploys the Worker **disabled**, adds the owner UID as encrypted secrets to both Worker and Pages, and reports the result. It does **not** enable unattended automation.
2. In Cloudflare -> **Workers & Pages -> rangeform -> Deployments**, redeploy the newest `main` commit so Pages sees the new secret. Verify the Pages project's D1 Binding `DB` -> `rangeform-users`. Do not create a duplicate DB.
3. Re-run GitHub **Verify production release** or open its automatic result. `/api/auto-bot` should return **401 signed-out** once Pages config is ready, not 503 `NOT_CONFIGURED`. A signed-out 401 only proves the auth gate is ready, not that cron is running.
4. Go back to **Deploy autonomous PAPER Worker**, choose operation `activate_paper_worker`, type exactly `ENABLE PAPER ONLY` and run. The workflow refuses activation until Pages returns 401 and the secret prerequisites are present. It modifies the Worker config only in the isolated GitHub runner; the repository's default Worker flag stays `off`.
5. Open `https://rangeform.pages.dev/bot.html` signed in as the configured Firebase owner. Click **Enable paper strategy**. A manually run verification tick is not evidence of a scheduler.
6. Confirm the bot's **CRON AUTONOMY -> RECENT WORKER TICK** timestamp advances independently with the browser closed. In Cloudflare, inspect Worker **Triggers** and **Invocations / Logs** for successful scheduled runs. If it does not advance, pause the paper strategy and inspect Worker secrets, `DB`, cron trigger and logs.

## Release gates
- **Quality checks:** source/behaviour tests, syntax and installed-app release-marker safety.
- **Mobile visual layout:** browser-emulated phone layouts and install/update behaviour; not proof of a physical iPhone.
- **Verify production release:** deployed release.json build, canonical pages, public API reachability, and signed-out bot configuration status. It cannot see private Cloudflare deployment SHA, Worker invocations, authenticated bot account data or real trades.
- **Real-money trading:** a distinct future approval and regulated-broker integration project. No live broker credentials or execution path exist.

## If a workflow fails
- `Missing encrypted GitHub Actions secret`: configure the named secret securely in GitHub, then rerun.
- `Cloudflare API 403`: your scoped token needs the specified account/resource permissions; do not replace it with a public token.
- `Pages HTTP 503`: the owner secret or D1 binding/Pages flag is not live; redeploy Pages and verify settings.
- `Worker deployed but CRON NOT VERIFIED`: activating Worker alone cannot start the strategy. Check authenticated owner status, enable paper strategy, and inspect scheduled logs and fresh heartbeat.

**Important:** The Cloudflare account controls and GitHub encrypted secrets belong to you. This repository cannot secretly sign in to your accounts. Never paste private tokens into a public chat.
