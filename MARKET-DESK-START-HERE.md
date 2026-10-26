# Market Desk — simple setup (TradingView edition)

## Open the new homepage
Open your Cloudflare Pages website (example: https://trading-platform-b56.pages.dev/). The app now starts on **Market Desk**, not the historical research demo. GitHub updates trigger Cloudflare Pages deployments automatically when Git is connected.

**There is no API key to enter, no Twelve Data credits to buy, and no new ZIP to upload.** Embedded TradingView widgets supply their own market data, subject to symbol availability and exchange delays. Use a current broker quote for execution; these widgets are not designed for second-by-second day trading.

## How to use it
1. Click a quick symbol (AAPL, NVDA, TSLA, MSFT, SPY or SHOP.TO) or type an exchange and symbol.
2. Choose 1m / 5m / 15m / 1h / 1D. Timeframes change the chart and technical rating, **not** exchange data latency.
3. Read the TradingView indicator rating as an opinion based on technical indicators. **Buy** and **Sell** are not predictions or automated trade instructions.
4. Check market movers and recent stories, then use the risk calculator to estimate a hypothetical long position.
5. Click **Advanced research** to open the old quantitative backtests, data imports, and trading journal at `/research.html`. Those tools may use synthetic demonstration bars and remain separate from TradingView charts.

## What does NOT work automatically?
- Training a model on widget data. TradingView does not offer a raw-data/indicators API for widgets.
- Automatically placing orders at a brokerage.
- A reliable win probability or guarantee of return.
- Real-time consolidated equities prices. TradingView's embedded stock widgets generally show **delayed** data. See https://www.tradingview.com/widget-docs/faq/data/

## If the widgets are blank
- Hard reload your site (Mac: Command + Shift + R).
- Verify the newest Cloudflare **Pages** production deployment succeeded.
- Disable browser content blockers for your website if they are blocking TradingView widgets.
- Test chart access directly on https://www.tradingview.com/ and check https://www.tradingview.com/widget-docs/markets/north-america/ for supported exchanges.
- Share a screenshot of the blank component and Chrome's Console error if it persists.

## Repo layout
- `public/index.html`: beginner Market Desk and TradingView widgets.
- `public/static/market.css`, `market.js`: interface, ticker interactions, appearance, risk example.
- `public/research.html`: previous quantitative research app; no features intentionally removed.
- `public/_headers`: external widget Content Security Policy allowlist.
- `functions/`: existing analytical APIs; no broker execution.

Protect any future personal accounts or API keys. This app is educational research, not investment advice or a trading service.