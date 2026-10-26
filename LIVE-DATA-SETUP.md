# Connect real stock market data — simple steps

You can keep GitHub PUBLIC but do **not** make the market-data pages available to everyone through a free personal market-data license. A public GitHub repository and a private Pages website are compatible.

1. In Cloudflare, open **Workers & Pages → trading-platform → Settings**. Enable **Cloudflare Access** protection for your Pages site, with only your own email permitted. Test in a private browser window: visitors must sign in. Cloudflare's menu names can change; consult https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/ .
2. Open https://twelvedata.com/ , register a personal account and obtain your personal API key from the Twelve Data dashboard. Basic tier market coverage, credits and exchange delays are subject to change. Real-time tick streaming needs a suitable subscription; the existing app polls 5-minute completed OHLCV bars, not real-time ticks.
3. Open your Cloudflare Pages `trading-platform` project → **Settings → Variables and Secrets → Add**.
4. Add `TWELVEDATA_API_KEY` with your actual API key as **encrypted Secret**. Never add it to GitHub files, browser Settings, screenshots or this chat.
5. Add `LIVE_DATA_ENABLED` with value `on`, as an environment variable, only AFTER testing access protection.
6. Apply both to the **Production** environment. Redeploy the latest production commit (Cloudflare Deployments page: retry deployment) so the new configuration is loaded.
7. Visit the site → **Data & settings → Check provider connection**. It should report **PRIVATE DATA READY**. Visit **Signal lab**, choose **Twelve Data API** and a 5-minute interval, then analyze AAPL or TSLA.
8. If the analysis says 'coverage', 'rate limit' or 'too few completed bars', check your subscription, exchange permissions and requests per minute. If markets are closed, completed bars are stale and the app says WAIT.

If you want to offer this app to the general public, seek a business market-data/redistribution license and a legal review before enabling quotes or personalized securities advice. The frontend remains a research tool; it does not trade automatically or guarantee returns.