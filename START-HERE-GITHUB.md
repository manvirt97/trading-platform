# START HERE — Put Rangeform on GitHub and Cloudflare

This edition is prepared for the SAME GitHub → Cloudflare Pages process as EquityClimb.

**You DO NOT have to run Python or a Terminal on your Mac for the hosted app.**

## 1 — Publish a NEW private GitHub repository

1. Download and unzip `Rangeform_GitHub_Cloudflare_Ready.zip`.
2. Open [GitHub Desktop](https://desktop.github.com/) (free) and sign in to your existing GitHub account.
3. Choose **File → Add local repository** and select the extracted `Rangeform_Cloudflare_GitHub` folder.
4. If GitHub Desktop says this is not a Git repository, click **Create a repository here**.
5. Give it the name `trading-platform`, choose Create Repository, then click **Publish repository**.
6. **Leave “Keep this code private” checked.** Confirm Publish. This creates a *separate* repository from EquityClimb.

If you prefer doing it with the connected GitHub app in ChatGPT, create a private empty repo named `trading-platform` on github.com (do NOT initialize it with sample files), then tell ChatGPT you created it. The GitHub connection can work with the new repository once access is granted.

## 2 — Connect to Cloudflare (same idea as EquityClimb)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) and sign in.
2. Open **Workers & Pages**, create a **Pages** project, and choose to connect **GitHub**.
3. Select your NEW `trading-platform` repository. Don't select `equityclimb`.
4. Use these settings:
   - Framework preset: **None**
   - Production branch: **main**
   - Build command: **leave blank** (if required, use `echo ready`)
   - Build output directory: **public**
   - Root directory: repository root (blank or `/`)
5. Deploy. Open the `*.pages.dev` URL that Cloudflare displays when deployment finishes.

Cloudflare's product labels sometimes change, but those settings are the important part. Functions inside `functions/api/` are deployed automatically with Cloudflare Pages Git integration. **Do not deploy by dragging just the `public` folder into Cloudflare** — that can omit the API Functions.

## 3 — What works on day one

- Graphite, Noir and Porcelain appearances; custom app name in Settings
- Dashboard, synthetic sample charts, explainable rules-based signals, market radar
- In-sample strategy backtesting, risk sizing, hypothetical journal
- CSV import stored in THIS browser, without a shared database
- News tab will show "Not configured" until a provider is connected

**The synthetic demo is deliberately fictional and old. It is never a current stock quote, prediction, or profitable-trade claim.** No automatic order placing is included.

## 4 — Optional market prices & news, later

To connect **Twelve Data**, first check your plan's Canadian/US exchange entitlements and delay. Then go to Cloudflare → Pages project → **Settings → Variables and Secrets**, add encrypted secret `TWELVEDATA_API_KEY` (NOT a public variable), and redeploy.

For headline access, optionally add encrypted secret `FINNHUB_API_KEY`.

**Do not add keys to GitHub, wrangler.toml, JavaScript, issues or screenshots.** A private GitHub repo does NOT make its public Pages URL private. Before adding any paid API keys or publishing the app to users, protect the API behind Cloudflare Access, add per-user authentication and rate limits, and verify market-data redistribution rights. A public key-backed endpoint could consume quota quickly.

## 5 — Updates

When you make a change in the local folder, open GitHub Desktop, describe the change, click **Commit to main**, then **Push origin**. Cloudflare will automatically redeploy from GitHub.

## 6 — FAQ

**Will this change EquityClimb?** No. `trading-platform` is entirely separate.

**Can I access it on my phone?** Yes, via the deployed Pages URL. Your local browser journal and imported CSV data do not sync between devices.

**Can I change the app name?** Yes, Settings → Make it yours. It changes that browser's label; the repository's working name remains Rangeform.

**Why is the app not placing trades?** It's a research prototype. Live execution requires verified broker integration, security work, realistic backtesting, and legal/regulatory checks.

**What if deployment fails?** Open Cloudflare project → Deployments → View build log. Confirm repository root, build output `public`, and that `functions/api/analyze.js` exists. Copy the exact error into ChatGPT.

**Do I need to set up a database?** No. On this first cloud edition, journal and CSV storage intentionally live in your browser. Clearing browser storage can erase those notes; use the journal CSV export to back them up.

---
The source's MIT license and original author attribution remain in `LICENSE`; no personal names appear in the trading interface.
