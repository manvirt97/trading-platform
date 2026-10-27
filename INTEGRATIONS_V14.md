# Rangeform V14 — Connection repair and unified themes

## What this release changes

This update repairs what the code can control. **It cannot configure external Cloudflare secrets, pay for Anthropic API credits, grant data rights, or deploy a separate Worker without authorized Cloudflare access.** Tests on GitHub are not a substitute for verified production API calls.

- Both themes are cohesive: light sidebar **and** light workspace, or dark sidebar **and** dark workspace. The previous permanently dark sidebar has been removed from the visual design.
- TradingView and the cron scanner are managed under **Settings → Optional market integrations**, rather than filling the Trade Signals workspace with disabled actions.
- The integration status now checks all three TradingView prerequisites: webhook token, event KV and private owner ID. Disabled buttons stay disabled until the corresponding resource is available.
- Anthropic Model access can be tested under **Settings → Claude model diagnostics** after signing in with Google. This calls the read-only Anthropic Models API and **does not invoke paid generations**.
- Claude research requests use the lean Messages API payload with default adaptive thinking. One specialist is tested before requesting the other ten. A failed request returns a sanitized, actionable error code instead of eleven identical messages.
- Secrets, bearer tokens and Firebase user identities must never be pasted into a public page or committed to GitHub.

## Anthropic: verify the real API connection

1. Open **Anthropic Console → API keys and billing**. Check that the relevant personal/business API project has active billing and permission for the desired models. A Claude.ai monthly subscription does **not** grant API credits.
2. In **Cloudflare Workers & Pages → rangeform project → Settings → Variables and Secrets**, check the **Production** environment:
   - `ANTHROPIC_API_KEY`: encrypted secret belonging to your authorized Anthropic API account
   - `CLAUDE_AGENTS_ENABLED`: text variable `on`
   - Optional `CLAUDE_SPECIALIST_MODEL=claude-haiku-5-5`
   - Optional `CLAUDE_SUPERVISOR_MODEL=claude-sonnet-5-5`
   - `DB`: D1 binding used by existing authenticated rate limits
   - Firebase authentication secrets/configuration already used by the Research AI
3. After any change, deploy a new production build. Sign in to Rangeform via **Research AI → Google sign-in**, then open **Settings → Test Claude model access**.
4. If either model is unavailable, examine the returned status/reason and correct the Anthropic permissions, model or key. If both are accessible but the eleven-agent investigation fails, the **one-call preflight** will now show the actual sanitized HTTP/provider error. Test one short investigation before repeated attempts.

**Important:** One 400 can mean a model mismatch, incompatible thinking parameter, unsupported token option or other invalid payload. It is not necessarily a billing issue. Access to the Models API does not guarantee a Messages generation succeeds.

## TradingView: make the webhook actually receive alerts

1. Create a Cloudflare KV namespace (for example, `rangeform-tv-events`).
2. In **Cloudflare Pages project → Settings → Bindings → Add → KV namespace**, bind that namespace with the exact variable name `TV_EVENTS`, in Production.
3. In **Variables and Secrets**, add `TRADINGVIEW_WEBHOOK_TOKEN` as an encrypted secret. Use **a dedicated 32+ character random token**, not a password, broker API key or Anthropic key. Rotate it if exposed.
4. Set `TV_OWNER_UID` to the exact Firebase Authentication **UID** of the authorized Google account (Firebase Console → Authentication → Users). Never share the UID publicly.
5. Redeploy Pages and confirm Settings displays **Configured · delivery unverified**.
6. In TradingView, enable two-factor authentication. Create an alert with webhook URL `https://rangeform.pages.dev/api/tv-alert`.
7. The alert **message** must be valid JSON using fields `auth`, `symbol`, `action`, `id`, `time`, `interval`. The token will be in the message, which TradingView stores/transmits; treat it as **scoped webhook authentication**, never a personal credential. Use an unpredictable ID for each event and a fresh timestamp from TradingView. The current receiver refuses events older than five minutes and only permits TradingView source IPs.
8. Trigger a test alert, verify TradingView's delivery log, and then sign in to Rangeform → Settings → View my TradingView alerts.

Example alert JSON template (**replace values inside TradingView privately; do not share the live token**):

```json
{
  "auth": "YOUR_DEDICATED_RANDOM_WEBHOOK_TOKEN",
  "symbol": "{{ticker}}",
  "action": "BUY_WATCH",
  "id": "{{ticker}}-{{interval}}-{{time}}",
  "time": "{{timenow}}",
  "interval": "{{interval}}"
}
```

The endpoint verifies source IP, token, JSON shape, event ID and recent timestamp, and only records a research watch. No broker orders are sent.

See official TradingView setup: https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/

## Scheduled scanner: requires a separate Cloudflare Worker

1. Create a second KV namespace (for example, `rangeform-scanner-snapshots`).
2. Bind it as `SCANNER_SNAPSHOTS` in **Cloudflare Pages → Settings → Bindings** and the **separate** Worker.
3. Edit `wrangler.scanner.toml` to include the real KV namespace ID, then deploy the optional Worker `rangeform-scheduled-research` from that configuration. The `*/30` Cron is present in the repository but **does not deploy itself** merely by merging GitHub code.
4. On that Worker, configure `TWELVEDATA_API_KEY` (encrypted secret) and `LIVE_DATA_ENABLED=on`, and any optional permitted backup provider.
5. Confirm Cron execution and KV snapshots in Cloudflare Workers logs during US regular market hours. Market holidays are not fully handled by the current Worker.
6. Rangeform Settings can then read **latest scheduled scan**. Binding presence alone is not proof of a successful run.

Official Cloudflare Pages binding instructions: https://developers.cloudflare.com/pages/functions/bindings/

## Required launch acceptance checks

- [ ] GitHub pull request tests/syntax checks pass
- [ ] Cloudflare deploys the **new main commit** for `rangeform.pages.dev`
- [ ] Desktop (1366 / 1536 px): navigation, search and cards do not overlap
- [ ] Mobile (320 / 390 / 430 px): iOS status-bar safe area, accessible navigation, readable text
- [ ] Light theme: light sidebar / light main / light header; dark theme: dark sidebar / dark main / dark header
- [ ] Claude Models diagnostic distinguishes missing configuration, unauthorized model, invalid model and network error without exposing a secret
- [ ] One real Claude investigation completes; if it fails, the error is actionable and no AI conclusion is invented
- [ ] TradingView buttons disabled until all bridge requirements are present
- [ ] A test TradingView alert arrives in the private viewer and stays tagged unverified until cross-checked
- [ ] Cron Worker is separately deployed; a valid KV snapshot appears in the app
- [ ] Existing news filters, real-data watch scan, journal, risk planner, DCF, portfolio and settings work

Do **not** claim all external integrations work on production until verified. This document identifies exact remaining steps rather than concealing them.
