/* Cloudflare D1 single-owner autonomous PAPER ledger. Never place or cancel a real exchange order. */
import {initialBot,advanceBot} from './auto-bot.js';
import {publicMarket} from './auto-bot-feed.js';
import {assumedFill} from '../../public/static/algo-math.mjs';
const SQL='CREATE TABLE IF NOT EXISTS rangeform_auto_bot (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL)';
export async function initialize(db){
 if(!db)throw Error('Cloudflare D1 DB binding is missing');
 await db.prepare(SQL).run();
 await db.prepare('INSERT OR IGNORE INTO rangeform_auto_bot(id,revision,payload) VALUES(1,0,?)').bind(JSON.stringify(initialBot())).run();
}
export async function snapshot(db){
 await initialize(db);
 const row=await db.prepare('SELECT revision,payload FROM rangeform_auto_bot WHERE id=1').first();
 if(!row)throw Error('Bot state was not initialized');
 const state=JSON.parse(row.payload);
 if(state.mode!=='PAPER_ONLY')throw Error('Live execution is not supported');
 return {revision:row.revision,state};
}
async function write(db,current,state){
 const result=await db.prepare('UPDATE rangeform_auto_bot SET revision=revision+1,payload=? WHERE id=1 AND revision=?').bind(JSON.stringify(state),current.revision).run();
 if(Number(result?.meta?.changes)!==1)throw Error('Concurrent update. Reload before retrying.');
 return {revision:current.revision+1,state};
}
export function serviceReady(env){
 return Boolean(env?.DB&&env.BOT_OWNER_UID&&env.BOT_SERVICE_ENABLED==='on');
}
export async function controlBot(env,action,{capital}={}){
 if(!serviceReady(env))throw Error('Background bot is not configured');
 if(!['start','pause','reset','flatten'].includes(action))throw Error('Unknown control');
 const current=await snapshot(env.DB),state=structuredClone(current.state);
 if(action==='start'){
  if(state.halted)throw Error('Safety halt is active. Pause, inspect results, and reset only after reviewing risks.');
  if(!state.enabled){state.enabled=true;state.haltReason='';state.lastError=null}
 }else if(action==='pause'){
  state.enabled=false;
 }else if(action==='reset'){
  if(state.enabled||state.position)throw Error('Pause and close the paper position before resetting.');
  if(!Number.isFinite(Number(capital))||capital<100||capital>1000000)throw Error('Choose initial paper capital between $100 and $1,000,000');
  Object.assign(state,initialBot(),{capital:Number(capital),cash:Number(capital)});
 }else if(action==='flatten'){
  // Owner-directed PAPER flatten uses a fresh public exchange bid and cost assumptions.
  // This is an assumed fill, not an order, and fails closed without sufficient top depth.
  if(!state.position)throw Error('No paper position to close');
  const now=Date.now(),market=await publicMarket('XBTUSD',now);
  const pos=state.position,bid=market.book.best_bid;
  if(!(market.book.bids[0][1]>=pos.qty))throw Error('Insufficient market depth; hypothetical exit not recorded');
  const fill=assumedFill('sell',bid,pos.qty,40,10);
  const pnl=fill.total-pos.cost;
  state.cash+=fill.total;state.realizedPnl+=pnl;
  const day=new Date(now).toISOString().slice(0,10);
  if(state.day!==day){state.day=day;state.dayPnl=0;state.entriesToday=0;state.lossStreak=0}
  state.dayPnl+=pnl;state.position=null;state.enabled=false;
  const activity={at:new Date(now).toISOString(),action:'PAPER_SELL',pair:'XBTUSD',qty:pos.qty,price:fill.execution,fee:fill.fee,pnl,reason:'OWNER_FLATTEN'};
  state.events=[activity,...state.events].slice(0,120);

 }
 state.updatedAt=new Date().toISOString();
 return write(env.DB,current,state);
}
export async function runPaperTick(env,{now=Date.now(),fetchImpl=fetch}={}){
 if(!serviceReady(env))return {status:'NOT_CONFIGURED',executed:false};
 const current=await snapshot(env.DB);
 if(!current.state.enabled||current.state.halted)return {status:'PAUSED',executed:false,state:current.state};
 let next;
 try{
  const market=await publicMarket('XBTUSD',now,fetchImpl);
  next=advanceBot(current.state,market,now);
 }catch(e){
  const state=structuredClone(current.state);
  state.lastTickAt=new Date(now).toISOString();state.lastError=String(e.message).slice(0,180);state.lastSignal='NO_DATA';
  next={state,trade:null,reason:state.lastError};
 }
 next.state.updatedAt=new Date(now).toISOString();
 try{
  const saved=await write(env.DB,current,next.state);
  return {status:next.trade?'PAPER_EVENT':next.state.lastError?'FEED_UNAVAILABLE':'OK',executed:false,reason:next.reason,trade:next.trade||null,revision:saved.revision};
 }catch(e){
  if(String(e.message).includes('Concurrent update'))return {status:'CONCURRENT_TICK_SKIPPED',executed:false};
  throw e;
 }
}
