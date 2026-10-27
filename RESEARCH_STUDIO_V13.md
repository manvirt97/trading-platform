# Rangeform V13 — Research Studio & Visual System

## Release intent

Deliver one coherent **graphite-and-stone** design and ten evidence-first workflows inspired by the user-provided screenshots, while preserving Rangeform's existing chart, scanner, market-news, risk, journal, AI and account paths.

This release ships in the current Cloudflare Pages static-HTML and JavaScript architecture. It is **not** a React migration, a full institutional fundamentals data licence, or a live brokerage. It deliberately avoids claiming those capabilities.

## Location & navigation

- Main site: `/v9.html`, existing Overview/Trade signals/Opportunity scanner/News/Settings unchanged.
- New: **Research Studio** sidebar → `/v9.html#studio`.
- Ten disciplines: stock screen, DCF, portfolio risk, earnings, portfolio blueprint, chart breakdown, dividend research, competitive edge, historical pattern finder, macro impact.
- All display clearly labelled `Source` information and warnings about unavailable data.
- Browser-local calculations never call an AI API or a broker.
- Results offer **Copy research brief** and **Draft question for Research AI**. Draft only populates the existing model input; it does **not** submit it. Never send confidential data unless explicitly authorized.

## Feature/data truth table

| Discipline | Functional now | Requires licensing, official data or future work |
|---|---|---|
| Stock screener | Requests existing curated six-stock technical sample and scores from verified completed bars when enabled | Market-wide universe; sector P/E; five-year financial statements; issuer debt; end-to-end fundamentals and data-display rights |
| DCF valuation | User-supplied base revenues/shares, growth, margins, taxes, reinvestment; five-year PV, terminal EV, net debt and WACC sensitivity | Issuer financial statements, CAPM WACC from verified inputs, forward consensus, fair-value triangulation, current share price |
| Portfolio risk | CAD-equivalent entered positions; largest exposure, sector/FX composition, HHI and uniform stress | Broker account sync, price correlation, liquidity/volume, FX conversions and tax lots |
| Earnings | User-entered dated EPS estimates and actuals; surprises, beat/miss | Verified consensus/earnings dates, segment trends, guidance, event-study stock returns |
| Portfolio blueprint | Allocation input and 100%-sum validation | Suitability analysis, taxes, verified strategic returns, personalized financial advice |
| Chart breakdown | Authorized completed-bar SMA, RSI, volume, 20-bar support/resistance, available 1m/6m/1y history and price patterns | Missing 200/252-bar history, news-event correlation, broker quote, trade execution |
| Dividend research | User-supplied price/dividend/EPS/FCF; yield and coverage; five-year growth | Issuer dividends paid, 5-year uninterrupted streaks, live ratios, ex-dates and payout forecasts |
| Competitive edge | Evidence-labelled self-scored pricing, cost, switching, brand/distribution and innovation rubric | Verified market shares, competitor financial metrics, external source citations |
| Pattern finder | Browser-local multi-year dated CSV close series; average month-of-year returns and sample-strength labels | API licensed extended history, earnings-rate event calendar and out-of-sample backtests |
| Macro impact | User-assumed rates, CPI, GDP and USD/CAD shocks; qualitative channels; mechanical USD exposure if portfolio entered | Today's verified official macro prints, release timestamps, economic consensus, statistically calibrated sensitivity |

**Do not substitute fabricated “demo” data for missing data.** Every tool explicitly reports insufficiency or depends on user-entered inputs. Server-side private API keys remain in Cloudflare secrets, not page JavaScript.

## Known operating behaviour

- `/api/status` config indicates a secret and feature flag, **not** live exchange entitlement or quote timeliness.
- Existing `/api/analyze` returns a limited history and 0–100 *indicator alignment*, not forecast accuracy.
- `/api/market-discovery` is cached, capped at six chosen symbols and not a market-wide screener.
- News RSS is publisher-linked and may be delayed or unavailable. Do not generate directional claims from titles alone.
- Competitive and portfolio tool user inputs are not verified issuer or broker data.
- DCF output is assumption-sensitive, particularly terminal value and WACC.
- Imported historical date/close rows are analyzed locally; no upload or automatic storage.
- Manual portfolio holdings exist only in JavaScript session memory; model submissions are opt-in.
- The existing Research AI may require authenticated Cloudflare Workers AI, D1, and account configuration.

## Design rules

- Charcoal sidebar and muted bronze accents; no neon.
- Consistent Manrope typography, quieter card borders and white space.
- Visual CSS layer `public/static/v13-premium.css` after previous v9/v11/v12 styles.
- Functional 320px+ layout; stacked mobile fields; horizontally scrollable tool navigator.
- Phone safe-area handling inherited from v11; version badge hidden at common mobile widths.
- Dark mode supported through `body[data-theme="dark"]` tokens.
- Preserve visible source, timestamps and data-reliability notices.

## Regression and launch

```sh
npm test
npm run syntax
```

Run on Chrome/Edge desktop and iPhone Home Screen Safari. Verify:
- #studio deep link opens the new page, nav selects correctly and each of ten tools appears.
- DCF missing data is rejected; a complete model returns 5 annual rows and WACC sensitivity.
- HHI, dividend coverage and EPS surprises match reference cases.
- The scanner/chart tools report provider errors if disabled rather than fake data.
- CSV seasonal patterns reject missing dates and insufficient month history.
- News/category filters, account, paper journal and Research AI still work.
- Mobile status bar, sidebar, Settings, news action buttons and dark mode.
- Cloudflare production commit actually matches the merged GitHub SHA before claiming release success.

## What is **not** completed despite broad UI/research integration

External stock fundamentals, verified economic data ingestion, market-wide licensed screening, broker account synchronization, calibrated backtesting on issuer events, always-on server alert delivery, React/TypeScript migration and direct OpenAI/Microsoft 365 Copilot runtime billing are **not** implied by this release. These require separate provider licences, operations and validation. Work Microsoft Copilot licences must not be repurposed without employer approval.

Further development should prioritize credible data/licences, complete model input sources, performance and security audits, and live deployment testing—not additional speculative buy/sell claims.
