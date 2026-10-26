import {riskPlan} from '../_shared/core.js';import {wrap} from '../_shared/http.js';
export async function onRequestPost({request}){return wrap(async()=>riskPlan(await request.json()))}
