# Market Desk v6 — What works now, and how to enable private accounts

**URL:** https://trading-platform-b56.pages.dev/ (Cloudflare may use a different production URL).
**GitHub:** https://github.com/manvirt97/trading-platform

## Works immediately — no API key
1. Open the homepage. The new **Opportunity Radar** checks selected public Google News RSS headlines covering tech, market news, Canadian stocks and energy. It refreshes on opening and every 15 minutes while the page is open. The ranking indicates *recent headline attention*, not expected returns or the best stocks to buy. Some feeds can be unavailable.
2. Select Canada or US and click **Scan again**. The app uses your device time zone for time display, not your precise GPS location. Open source links to review each headline.
3. Click **Open chart** on a company to see TradingView's embedded chart and technical ratings. Embedded quotes may be delayed; these are not trade execution signals.
4. Open **My workspace**. Without accounts enabled, it can save your watchlist, preferences, and research notes in **this browser only**. Clearing browser storage loses them.

## One-time owner setup for real cross-device profiles

**Do NOT share login tokens, brokerage passwords or private provider keys.** This is for the app owner, not ordinary users.

### A. Create a SEPARATE D1 database
1. Open https://dash.cloudflare.com/ and find **Storage & databases → D1 SQL database → Create** (navigation label can vary).
2. Name it `trading-platform-users`. Do NOT select or edit the existing EquityClimb database.
3. Copy the new database UUID. It is not an account password.
4. Open the D1 database SQL Console and execute the statements in `migrations/0001_private_workspaces.sql` (one statement at a time if needed).
5. In your `trading-platform` GitHub repository, edit `wrangler.toml` by APPENDING the following, replacing the placeholder with the actual UUID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "trading-platform-users"
database_id = "PUT_YOUR_D1_DATABASE_UUID_HERE"
```

**Important:** This repo has a `wrangler.toml` configuration file. Cloudflare treats that file as the source of truth; do not rely only on a binding added through the dashboard. Have me update `wrangler.toml` for you when you have the UUID; a D1 database UUID is not an API secret.

### B. Enable Google sign-in with Firebase
You can create a separate Firebase project for this app (best privacy separation), or use an existing Firebase Auth project if you intentionally want shared sign-in identities. **Each app keeps its own D1 records either way.**
1. Open https://console.firebase.google.com/ → select/create project → **Build → Authentication → Sign-in method** → enable Google.
2. In Firebase **Authentication → Settings → Authorized domains**, add `trading-platform-b56.pages.dev` (or the real production domain; do not include `https://`).
3. Open **Project settings → General → Your apps → Web app** and get the Firebase web config values: projectId, apiKey, authDomain, appId. The Firebase web API key is a public project identifier when correctly restricted to Firebase services; it is NOT a brokerage/market data API secret.
4. In `wrangler.toml`, APPEND the Firebase client values (replace placeholders):

```toml
[vars]
FIREBASE_PROJECT_ID = "YOUR_PROJECT_ID"
FIREBASE_API_KEY = "YOUR_FIREBASE_BROWSER_API_KEY"
FIREBASE_AUTH_DOMAIN = "YOUR_PROJECT_ID.firebaseapp.com"
FIREBASE_APP_ID = "YOUR_FIREBASE_WEB_APP_ID"
```

5. Commit the file. Cloudflare Pages auto-deploys from GitHub. Open `/account.html`, click **Sign in with Google**. Confirm saved notes appear when logged into a separate device with the same Google account. Test a different account cannot see the first person's notes. Verify **Delete my saved research data** works.

If Firebase is unconfigured or D1 is missing, account storage stays in guest/browser-only mode. It deliberately fails closed rather than silently mixing user data.

### C. Optional AI assistant (only after A and B)
1. In the Cloudflare dashboard, go to Pages project **Settings → Bindings → Add → Workers AI** and set variable name `AI`. Because `wrangler.toml` is the project's config source, you may need to append this to that file instead:
```toml
[ai]
binding = "AI"
```
2. In the existing `[vars]` section, add `AI_ENABLED = "on"` **only after** sign-in, D1, and database setup are tested. Deploy.
3. Test with a signed-in account on `/account.html`. It is limited to 10 research questions per account per day by the D1 database. AI compute has Cloudflare allowance and possible usage costs (see https://developers.cloudflare.com/workers-ai/platform/pricing/). Review charges before turning it on for the public.

AI does not have a real-time price feed and does not invent predicted trade returns or place orders.

## What's NOT included yet
- Scanning the entire internet (impossible to guarantee), every exchange, every ticker, or all breaking news.
- A validated predictive or autonomous day-trading model, personalized order recommendations, broker integration or real-time execution.
- An always-on background crawler: radar refresh is browser-driven while open, and public RSS feeds may not work forever.
- Commercial market-data licensing, public advisory compliance review, or quantitative backtests of the radar.

**For launch:** avoid marketing this as an automatic-profit trading system. If you intend to give tailored securities advice for compensation in Canada, obtain specialized legal review. See https://www.asc.ca/Registrant-and-Market-Regulation/Registrant-Toolkit/Getting-Registered

## Troubleshooting
- `/api/radar?region=CA` should return recent headlines or an explicit unavailable/error response.
- `/api/profile-config` should say `enabled: false` until D1 + Firebase are ready.
- `/api/profile` should reject missing sign-in, and it must not return anyone else's history.
- For a failed deployment, check Cloudflare Pages → Deployments and GitHub → Actions → Quality checks. Do not add secrets to public GitHub files.
