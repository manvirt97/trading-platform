import {backtest,validateSymbol} from '../_shared/core.js';import {getData,wrap} from '../_shared/http.js';
async function handler({request,env}){return wrap(async()=>{const u=new URL(request.url),payload=request.method==='POST'?await request.json():null;const sym=validateSymbol(payload?.symbol??u.searchParams.get('symbol')??'TSLA');const {bars,meta}=await getData(request,env,payload);return {...backtest(bars,u.searchParams.get('cost_bps')??8),...meta,symbol:sym}})}
export const onRequestGet=handler;export const onRequestPost=handler;
