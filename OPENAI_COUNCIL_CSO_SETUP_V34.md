# Rangeform v34 — OpenAI Council and CSO Security Agent

This release adds genuine server-side OpenAI Responses API calls on demand:
- **Focused:** 4 distinct specialist calls + 1 CSO AI call + 1 Supervisor call.
- **Full:** 11 distinct specialist calls + 1 CSO AI call + 1 Supervisor call.
- The existing deterministic 22-check room remains authoritative; all model calls are research-only.
- The CSO has a deterministic server posture gate, a read-only AI reviewer and a separate scheduled GitHub Actions source-policy watch.
- **No OpenAI call is triggered by opening the page.** The signed-in owner must explicitly confirm API usage for each run.
- **No paper or live brokerage order tools exist in the new endpoint.**

## Deploy in safe order

1. Merge only when Quality checks, CSO security watch and Mobile visual layout GitHub Actions are green. The existing PWA release marker must be monotonic.
2. The newly deployed page may show **API setup required**. That is intentional; nothing is charged while disabled.
3. In OpenAI Platform, create a **restricted project API key** with Responses API access and set a conservative usage budget. ChatGPT Plus access does **not** include OpenAI API credits.
4. In Cloudflare Dashboard, open the **existing Rangeform Pages project** → Settings → Variables and Secrets. Add `OPENAI_API_KEY` as an encrypted **Secret**. Do not paste the key in GitHub, frontend source, chat, `wrangler.toml`, URLs or screenshots.
5. Confirm `BOT_OWNER_UID` is the Firebase UID of your intended owner account, stored as an encrypted Secret. The council and CSO endpoints are owner-only; this secret is not returned to browsers.
6. Apply the metadata-only audit migration to the existing **rangeform-users** D1 database. One CLI option from the repository root, using a Cloudflare account authorized to manage that D1 database:

   ```sh
   npx wrangler d1 execute rangeform-users --remote --file=migrations/0002_openai_council_audit.sql
   ```

   Or run the migration SQL using the D1 dashboard SQL console after verifying the correct database. Do **not** apply this to EquityClimb's database.

7. Only after audit storage and the secret are ready, set `OPENAI_AGENTS_ENABLED=on` in Rangeform's **production** Pages environment and redeploy if required. Leave off in preview unless intentionally testing paid calls.
8. Sign in via Rangeform Account. Visit `/agent-team.html`, press **Check CSO security**. Expect **Research checks ready** and **API connected** before choosing a focused, owner-confirmed investigation.
9. Confirm that a model result is labeled research-only; the final execution decision stays `NO_ORDER`, even for a bullish watch.
10. Review GitHub Actions → **CSO security watch**. The weekly source-policy check is useful but is **not** a substitute for full vulnerability scanning, access review, production observability or penetration testing.

## Operational boundaries

- A market-data outage, closed market or stale bar is never upgraded into a current signal by an AI.
- OpenAI model output is strictly structured and rendered with textContent, not HTML; no tool calling or external order placement is exposed.
- The owner is throttled to three focused requests and one full request per UTC day. These are request-count guards **not** a substitute for an OpenAI Project financial spending limit.
- Source inputs are price indicators, bar summaries, safety checks and a few published headlines. Neither API keys nor saved account notes are sent to OpenAI.
- Only metadata (UID, symbol, investigation type, status, token counts) is written to D1 audit records; prompts, generated reports and bearer tokens are not saved.
- AI calls use `store:false`. The OpenAI API provider still has its own policies for operational retention and abuse monitoring; review them separately.
- CSO checks the connected runtime environment and repository policy, but cannot inspect cloud secrets, GitHub security alerts, active infra logs, devices or broker accounts. The AI CSO must never claim otherwise.
- If the CSO model fails, deterministic security gates still apply.
- This does **not** activate the separate crypto paper bot, any scheduled stock trading workflow or real-money trading.

## Rollback

Disable `OPENAI_AGENTS_ENABLED` in Cloudflare; paid OpenAI calls stop without affecting Rangeform's existing technical research and paper bot. To hide the new UI completely, revert the v34 merge in GitHub using the normal reviewed process. Keep the D1 audit table for traceability unless separately approved for removal.
