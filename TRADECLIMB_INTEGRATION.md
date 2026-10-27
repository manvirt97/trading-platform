# TradeClimb v2 → Rangeform integration audit (October 2026)

This audit is grounded in the supplied `tradeclimb-v2.zip` files: `public/engine.js`, `public/app.js`, `public/index.html`, `functions/api/{chart,news,ai,tv-webhook,alerts,health}.js`, `lib/market.js`, `pine/TradeClimb_Signals.pine`, and `README.md`.

## Main finding: what “22 agents” means
TradeClimb's README describes 20 rule specialists, a supervisor and an optional AI Head Trader — **not 22 parallel language models**. Most specialists are deterministic indicator and risk checks. Rangeform now implements a separately validated 22-check rule supervisor, computed on the server from its own market analysis rather than trusting client-uploaded agent votes.

## Included in Rangeform
- **Safety and vote supervisor** (PR #8): 22 named checks, signed technical votes, minimum evidence requirements, explicit unavailable statuses and vetoes for stale/incomplete data, market session, insufficient candle participation, missing volatility and unacceptable payoff. No probability-of-profit claims.
- **Explainable Agent Room UI** (PR #8): filter specialists, see vote/abstain/blocked, overall direction, consensus and veto reasons. A veto can reject a raw opening-range watch; it cannot create a signal where the pattern engine found none.
- **Automatic symbol discovery** (earlier PR #7): two server-bounded six-symbol curated US sample universes, on-demand/provider-gated, edge-cached, refreshing only while the browser is open and visible. Not a whole-market scan or background process.
- **Price, candlestick and volume analysis**: existing server Twelve Data OHLCV with quote-age labels, opening-range pattern, volume support, SMA, RSI, momentum, candles and historical volume-concentration proxy. The proxy is **not Level II/order-book depth**.
- **AI explanation**: existing Firebase-authenticated Cloudflare Workers AI, quotas and D1 binding; fallback deterministic evidence assistant. AI does not generate trade levels independently.
- **Paper practice** (PR #9): simulation-only journal, browser-local kill/pause, 2% daily simulated realized-loss cap, three consecutive simulated losses, max three open simulated positions, CSV, assumed transaction costs. Opens only on a server-confirmed BUY WATCH. No broker integration or actual fills.

## Deliberately not copied without further controls
- **Yahoo/Yahoo backup unofficial quote fetching:** TradeClimb `lib/market.js` attempts these plus Coinbase and Twelve Data. Rangeform retains its existing licensed-feed gate. Public redistribution, exchange real-time entitlements and Yahoo reliability are unresolved.
- **TradeClimb `/api/ai` endpoint:** this trusts arbitrary unauthenticated client-supplied findings and lacks per-account usage controls. Rangeform keeps authenticated AI that re-fetches validated candles from the server when requested.
- **TradingView webhook and alert storage:** TradeClimb uses a shared secret and KV global alert list. Before deployment to a multi-user Rangeform app, add owner scoping, secure credentials, replay protection, rate limits, storage/access controls, and account setup.
- **In-sample “Backtest Edge” veto:** TradeClimb backtest uses recent same-series signals and simplified fills. Rangeform marks out-of-sample strategy validity as *unavailable* until a proper walk-forward validation and cost model are implemented.
- **Real order-book heatmap or option gamma positioning:** a standard OHLCV price feed cannot supply resting order depth, executed volume at price, option open interest or dealer gamma reliably.
- **True 24/7 scanning and push notifications:** Cloudflare Pages + browser polling do not keep scanning with the browser closed. Requires a scheduled backend/queue, per-user subscription, rate/cost controls, and authorized market feeds.
- **Broker trading, guarantees and auto-execution:** not integrated.

## What to test after Cloudflare deploys
1. Check the specific Cloudflare production commit; a GitHub merge alone does **not** demonstrate live deployment.
2. Open `/v9.html`, go to Trade Signals. Confirm “The Agent Room” and the new practice panel are visible.
3. With `TWELVEDATA_API_KEY` absent or `LIVE_DATA_ENABLED` off, expect a *no data* outcome. No fabricated trade setups or paper entries should appear.
4. With a licensed authorized market-data plan, examine `/api/opportunity?symbol=NVDA&interval=5min&news=1`: confirm `agent_room.specialist_count===22`, UTC bar freshness, and unavailable quote/earnings/spread checks.
5. After an actual BUY WATCH with zero vetoes, test a paper long, verify the local kill switch blocks opening and that a new closed candle is needed to manually record a paper exit.
6. Confirm AI Google sign-in, D1 tables and Workers AI binding before claiming a generative AI response works.
7. Use browser sizes 390px, 768px, 1366px and wide desktop; run GitHub CI.

## Important interpretation
An “agent” in this release is a deterministic analytical rule, not a model acting autonomously. An agent vote is an interpretation of market data, not a security or earnings guarantee. Paper trades use completed-bar reference prices, not actual transactions. These features support research and learning; they do not guarantee profits.
