import test from 'node:test';
import assert from 'node:assert/strict';
import {getData} from '../functions/_shared/http.js';
import {onRequestGet as status} from '../functions/api/status.js';
const request=new Request('https://example.com/api/analyze?source=twelvedata&symbol=TSLA&interval=5min');
test('live provider cannot be accessed without a key',async()=>{await assert.rejects(getData(request,{}),/not connected/)});
test('a key alone does not open provider market-data endpoint to public visitors',async()=>{await assert.rejects(getData(request,{TWELVEDATA_API_KEY:'test'}),/locked/)});
test('status reports configured but locked',async()=>{let r=await status({env:{TWELVEDATA_API_KEY:'secret'}}),j=await r.json();assert.equal(j.twelvedata_configured,true);assert.equal(j.twelvedata_enabled,false);assert.ok(!JSON.stringify(j).includes('secret'))});