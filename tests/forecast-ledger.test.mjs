import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('forecast ledger is linked and never claims verified investment performance',()=>{
 const home=fs.readFileSync('public/v9.html','utf8'),page=fs.readFileSync('public/forecast-ledger.html','utf8'),code=fs.readFileSync('public/static/forecast-ledger.js','utf8');
 assert.match(home,/\/forecast-ledger\.html/);assert.match(page,/not independently verified/i);assert.match(code,/localStorage/);assert.match(code,/unverified|NOT VERIFIED/);assert.doesNotMatch(code,/fetch\(/);
});