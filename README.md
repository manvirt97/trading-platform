# Rangeform Research — GitHub / Cloudflare Pages edition (v3.1)

**START HERE:** `START-HERE-GITHUB.md` (non-technical deployment walkthrough).

A Cloudflare-ready conversion of the trading research interface. Frontend in `public/`; Pages Functions in `functions/api/`; original Python prototype kept in `local-toolkit/` for reference and optional local use. No Python or npm build is required on Cloudflare.

## Capabilities
- Explainable OHLCV technical alignment score **not a calibrated probability**
- Historical chart annotations and named price patterns
- Synthetic example data for safe preview (not real historical quotes)
- Intraday interval selection when provider entitlement permits
- In-sample historical strategy test with simplified trading frictions
- Long-only risk sizing; browser-local hypothetical journal and CSV import
- Optional server-side Twelve Data and Finnhub integrations (secrets not included)
- No execution, no automated trading, no streaming feed, no profitable-trade guarantees

## Deploy
Create separate GitHub repo and connect a Cloudflare Pages project with `public` output and no build command. Pages Functions are discovered automatically from `functions/`. `wrangler.toml` is a template; change its `name` if another Pages project already owns it.

## Tests (optional)
Requires Node.js >=20. Run `npm test` and `npm run syntax`. For a local no-provider preview, run `node scripts/local-preview.mjs` then open `http://127.0.0.1:8787`. This local server is for development only, not internet-facing production.

## Privacy / performance / security
- The client stores journals and imports in localStorage in its browser profile. Do not use it for sensitive material and back up regularly.
- Market source and bar timestamp are shown; browser-initiated refresh isn't real-time streaming.
- API routes are public if the Pages URL is public. Do not enable paid API keys until authenticated access, quota controls, licensing, and rate limits are ready.
- The demo defaults to clearly labeled synthetic prices and never places trades.
- No promises about predictive edge; this research model has not been validated out of sample.
- Original copyright is retained in `LICENSE` in accordance with MIT terms. See `ATTRIBUTION.md`.
