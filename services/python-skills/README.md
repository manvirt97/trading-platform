# Rangeform original Python skills: hostable read-only API

This directory provides a **hostable container backend**, not a deployed service. It wraps the **11 original Python tools** already tracked in \`local-toolkit/research\`. Cloudflare Pages JS functions do not run these CPython scripts.

## Security constraints
- No order execution: only \`trader-broker ticket.py show\` is reachable. \`approve\`, \`result\`, \`fill\`, \`flatten\`, margin, shorting and real brokerage connectors are **not** exposed.
- Requests need the server-set \`SKILLS_SERVICE_TOKEN\` via \`Authorization: Bearer ...\`. Cloudflare should authenticate Firebase owner UID before forwarding.
- Strictly allowlisted command names and symbol/numeric fields. No arbitrary shell, file uploads, scripts, paths, arguments, URLs or execution.
- Stateless temporary workspaces: a multi-step check is computed in one request. **No user portfolio or broker session is persisted.**
- Two concurrent tool chains maximum; timeouts and output-size caps. Network sources (Yahoo/Nasdaq/SEC) can fail, rate-limit or lag. Results are never labeled verified streaming quotes.
- Server must be deployed behind HTTPS and protected by provider-level traffic controls; do not publish an unauthenticated API.
- SEC tools require a genuine \`SEC_USER_AGENT\` (owner name + contact email, securely configured in service environment).
- Only publicly documented use; confirm data licensing/terms for hosting/distributing any third-party data.

## Deployable Docker image
From the repository root:

\`\`\`sh
docker build -f services/python-skills/Dockerfile -t rangeform-python-skills .
docker run --rm -p 127.0.0.1:8080:8080 -e SKILLS_SERVICE_TOKEN=<your-private-server-secret> -e SEC_USER_AGENT="<owner-name> <owner-email>" rangeform-python-skills
\`\`\`

Local POST \`/run\` requires a bearer token. Example payloads:
\`\`\`json
{"skill":"scanner","symbol":"AAPL"}
{"skill":"news","symbol":"AAPL"}
{"skill":"entry","symbol":"AAPL"}
{"skill":"exit","symbol":"AAPL","entry":100,"stop":99,"target":102}
{"skill":"timemachine","symbol":"AAPL","entry":100,"stop":99,"target":102,"date":"2026-10-26","entry_time":"10:15 AM"}
{"skill":"budget","symbol":"AAPL","entry":100,"stop":99,"target":102,"budget":5000}
{"skill":"risk","symbol":"AAPL","entry":100,"stop":99,"target":102,"budget":5000}
{"skill":"broker","symbol":"AAPL","entry":100,"stop":99,"target":102,"budget":5000}
{"skill":"alerts","symbol":"AAPL"}
{"skill":"analyst","symbol":"AAPL"}
{"skill":"pelosi"}
\`\`\`

Exit codes, blocked trades, no-price conditions, market holidays, SEC failures, unsupported or unofficial feeds and missing credentials return explicit errors. The long-only plan is entirely hypothetical.

## Still required before claiming hosted/operational
1. Create a dedicated container hosting service supporting Python, persistent uptime, HTTPS and outbound TLS, and deploy this image. **No provider host or account is selected in this repository.**
2. Supply \`SKILLS_SERVICE_TOKEN\` and \`SEC_USER_AGENT\` privately in that provider, with network egress and quota safeguards.
3. Enable the owner-only Cloudflare proxy (see \`functions/api/python-skills.js\`) using private Cloudflare variables \`PY_SKILLS_ENABLED=on\`, \`PY_SKILLS_ORIGIN=https://your-service.example\`, \`PY_SKILLS_TOKEN\` (must equal backend token) and \`PY_SKILLS_OWNER_UID\` (Firebase UID).
4. Redeploy Pages after secrets; verify owner authentication, 403 for other accounts, 401 signed out, no execution, and one successful market research command.
5. Verify live data subscriptions and consent separately. Existing Rangeform paper cron Worker is **a different service** with a separate activation gate.

These are research scripts from an MIT-licensed third-party repository, not a trading strategy with demonstrated positive performance. Any actual hosting must review the upstream code, vulnerabilities, resource costs, provider terms, SEC attribution and retention.
