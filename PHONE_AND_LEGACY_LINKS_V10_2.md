# Rangeform V10.2 — old links, phone icon and mixed interface repair

## Why it happened
Before V10.2, the Cloudflare Pages project held three generations of entry screens: the new app at `/v9.html`, the older Market Desk at `/market.html`, and older Research at `/research.html` (which redirected to V10 unless an explicit `?classic=1` was passed). The installed PWA manifest still launched `/research`. V10 sidebar items for risk, journal, research AI and settings linked directly to the classic screen. This produced cross-page jumps into the old layout.

## What has changed
- `public/_redirects`: both `/market` and `/market.html`, including trailing slash form, now send users to `/v9.html#overview` (temporary HTTP 302 while existing users migrate).
- `public/manifest.webmanifest`: start URL `/v9.html#overview`; shortcuts for Overview, Opportunities, Signals and Account. PWA app `id` remains `/` to avoid changing identity.
- `public/v9.html`: phone manifest and Apple install metadata, modern buttons for Research AI (Evidence Assistant), Risk planner, Paper journal and Data status; only explicit **Open classic workspace** link goes to classic Research.
- `public/static/v9.js`: selected page with optional section focus, support for older `#copilot`, `#risk`, `#journal`, `#settings`, `#radar` deep links, and no multiple active sidebar tabs.
- `public/account.html` + `account-v11.css`: account remains functional with Firebase/D1, but visually matches V10 and offers home / opportunities / signals navigation.
- `public/market-classic.html`: retains the old TradingView widget page if intentionally needed.
- `public/_headers`: browser revalidation of HTML and the install manifest.
- `/api/status`: V10.2 deployment marker.

## Essential deployment check
Cloudflare Pages → correct project → Deployments → Production must reflect the GitHub merge commit and branch `main`. Your browser should show `"app_version":"V10.2"` at:

`https://YOUR_PRODUCTION_DOMAIN/api/status`

The installed phone app and the working Cloudflare deployment must use the **same host/origin**. A different `*.pages.dev` hostname can represent a different project or an immutable preview deployment. GitHub changes to `manvirt97/trading-platform` cannot update an unrelated Cloudflare project or browser bookmark on a different origin.

Compare the complete URLs, including hostname, of (a) your working Cloudflare link and (b) your old phone link. If they are different, fix the Pages project/GitHub Production branch/custom-domain mapping first, or use one production domain consistently.

## iPhone Home Screen refresh
1. First open the correct **production** site in Safari: `https://YOUR_PRODUCTION_DOMAIN/v9.html#overview`.
2. Confirm the sidebar shows **V10.2 · MARKET INTELLIGENCE** and `/api/status` has `V10.2`.
3. For an older icon that still launches a DIFFERENT domain, remove only that obsolete Home Screen shortcut. **Do not delete app/browser site data blindly**: guest-only local saved watchlists, notes and paper journal may be lost, and data from a different origin does not automatically migrate.
4. In Safari at the correct site, tap Share → Add to Home Screen → Add (or Open as Web App if offered). Open the new icon.
5. If you merely use a Safari bookmark, edit or recreate it to use the production V10 site. The manifest helps installed web apps; it cannot rewrite every old bookmark.

## Android Chrome
Open the correct production V10 URL, then Chrome's menu → Add to Home screen or Install app. Replace an old shortcut only after verifying whether local-only data needs to be backed up.

## What is deliberately not altered
No market-data keys, Claude credentials, alerts, accounts, or backend trading logic are changed. The account/profile utility is preserved with the same form IDs and scripts. The classic research terminal remains accessible only through an explicitly labelled link. There is still no real broker execution.
