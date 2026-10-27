/* Canonical Rangeform app entry: one current interface for all older URLs.
 * Pages Functions middleware covers dynamic functions AND static Pages assets.
 * Keep account.html functional and never intercept API, assets, or V10 itself.
 */
const LEGACY_ENTRIES=new Set([
 '/','/index.html',
 '/research','/research/','/research.html',
 '/market','/market/','/market.html',
 '/market-classic','/market-classic/','/market-classic.html',
 '/v8','/v8/','/v8.html','/terminal','/terminal/','/terminal.html'
]);
export const isLegacyEntry=pathname=>LEGACY_ENTRIES.has(pathname);
export function onRequest(context){
 const url=new URL(context.request.url);
 if(!isLegacyEntry(url.pathname))return context.next();
 // Do not include a fragment in the Location header: browsers carry across
 // legacy #risk/#journal/#copilot fragments so the modern app can interpret them.
 // Query params (including classic=1) are intentionally discarded.
 const target=new URL('/v9.html',url.origin);
 return new Response(null,{status:302,headers:{
  Location:target.toString(),
  'Cache-Control':'no-store, no-cache, must-revalidate',
  'X-Rangeform-Routing':'V10.3-current-only',
  'X-Content-Type-Options':'nosniff'
 }});
}
