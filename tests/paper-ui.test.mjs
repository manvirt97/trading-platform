import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const f=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('paper practice is an explicitly separate simulated feature',()=>{
 const html=f('public/v9.html'),js=f('public/static/v9-paper.js');
 for(const id of ['paperOpen','paperClose','paperKill','paperStats','paperJournal','paperExport','paperStatus']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/PAPER PRACTICE/);
 assert.match(html,/No broker orders/i);
 assert.match(js,/localStorage\.getItem/);
 assert.match(js,/agent_room\?\.verdict!=='BUY_WATCH'/);
 assert.match(js,/state\.paused/);
 assert.match(js,/consecutive paper losses/);
 assert.match(js,/daily paper loss/i);
 assert.match(js,/completed.bar/i);
 assert.match(js,/costPerSide=\.0005/);
 assert.doesNotMatch(js,/\/api\/order|\/api\/trade\b|fetch\(/);
});
test('practice journal derives references from the already verified server analysis',()=>{
 const script=f('public/static/v9.js'),paper=f('public/static/v9-paper.js');
 assert.match(script,/new CustomEvent\('rangeform:agent-report'/);
 assert.match(paper,/addEventListener\('rangeform:agent-report'/);
 assert.match(paper,/Date\.parse\(bar\)<=Date\.parse\(t\.barTime\)/);
 assert.match(paper,/Number\(x\.analysis\.last\)/);
 assert.match(paper,/Math\.floor\(Math\.min/);
 assert.match(paper,/Blob\(/);
});
