// Curated, transparent symbol directory for company-name search. Not an exchange master list.
const catalog=[
['AAPL','Apple','NASDAQ','iphone mac'],['NVDA','NVIDIA','NASDAQ','nvidia graphics gpu'],['MSFT','Microsoft','NASDAQ','windows azure'],['GOOGL','Alphabet / Google','NASDAQ','google youtube'],['AMZN','Amazon','NASDAQ','aws'],['META','Meta Platforms','NASDAQ','facebook instagram'],['TSLA','Tesla','NASDAQ','elon'],['AMD','Advanced Micro Devices','NASDAQ','amd chips'],['INTC','Intel','NASDAQ','chips'],['AVGO','Broadcom','NASDAQ','semiconductors'],['PLTR','Palantir','NASDAQ','data ai'],['CRM','Salesforce','NYSE','crm'],['ORCL','Oracle','NYSE','cloud database'],['ADBE','Adobe','NASDAQ','creative'],['NFLX','Netflix','NASDAQ','streaming'],['UBER','Uber','NYSE','ride sharing'],['COIN','Coinbase','NASDAQ','crypto exchange'],['HOOD','Robinhood','NASDAQ','broker'],['SOFI','SoFi Technologies','NASDAQ','sofi finance'],['PYPL','PayPal','NASDAQ','payments'],['SQ','Block','NYSE','square cash app'],['SHOP','Shopify','TSX','shop ecommerce canadian'],['SPOT','Spotify','NYSE','music'],['DIS','Walt Disney','NYSE','disney'],['NKE','Nike','NYSE','shoes'],['COST','Costco','NASDAQ','warehouse'],['WMT','Walmart','NYSE','retail'],['HD','Home Depot','NYSE','home improvement'],['MCD','McDonalds','NYSE','fast food'],['SBUX','Starbucks','NASDAQ','coffee'],['JPM','JPMorgan Chase','NYSE','jp morgan bank'],['BAC','Bank of America','NYSE','banking'],['GS','Goldman Sachs','NYSE','investment bank'],['V','Visa','NYSE','payments'],['MA','Mastercard','NYSE','payments'],['BRK.B','Berkshire Hathaway B','NYSE','buffett berkshire'],['XOM','Exxon Mobil','NYSE','exxon oil'],['CVX','Chevron','NYSE','oil'],['OXY','Occidental Petroleum','NYSE','occidental'],['COP','ConocoPhillips','NYSE','conoco'],['SLB','SLB / Schlumberger','NYSE','oilfield services'],['CAT','Caterpillar','NYSE','industrial'],['BA','Boeing','NYSE','aerospace'],['GE','GE Aerospace','NYSE','aviation'],['LMT','Lockheed Martin','NYSE','defense'],['SPY','S&P 500 ETF / SPDR','AMEX','s and p 500 index etf'],['QQQ','Nasdaq 100 ETF / Invesco','NASDAQ','nasdaq etf'],['IWM','Russell 2000 ETF','AMEX','small cap etf'],['DIA','Dow Jones ETF','AMEX','dow'],['VTI','Vanguard Total Market ETF','AMEX','vanguard total'],['GLD','SPDR Gold ETF','AMEX','gold'],['SLV','iShares Silver ETF','AMEX','silver'],['USO','United States Oil Fund','AMEX','crude oil etf'],
['RY','Royal Bank of Canada','TSX','rbc bank'],['TD','TD Bank','TSX','toronto dominion'],['BNS','Bank of Nova Scotia','TSX','scotiabank'],['BMO','Bank of Montreal','TSX','bmo'],['CM','CIBC','TSX','canadian imperial bank'],['ENB','Enbridge','TSX','pipelines'],['TRP','TC Energy','TSX','transcanada pipeline'],['CNQ','Canadian Natural Resources','TSX','cnrl canadian natural oil'],['SU','Suncor Energy','TSX','suncor oil sands'],['CVE','Cenovus Energy','TSX','cenovus oil sands'],['IMO','Imperial Oil','TSX','esso imperial'],['TOU','Tourmaline Oil','TSX','natural gas'],['ARX','ARC Resources','TSX','arc natural gas'],['MEG','MEG Energy','TSX','oil sands'],['ATH','Athabasca Oil','TSX','athabasca oil'],['CP','Canadian Pacific Kansas City','TSX','cp rail cpkc'],['CNR','Canadian National Railway','TSX','cn rail'],['BCE','BCE / Bell Canada','TSX','bell telecom'],['T','TELUS','TSX','telus telecom'],['ABX','Barrick Mining','TSX','barrick gold'],['AEM','Agnico Eagle Mines','TSX','agnico gold'],['WPM','Wheaton Precious Metals','TSX','wheaton'],['ATD','Alimentation Couche-Tard','TSX','couche tard circle k'],['L','Loblaw','TSX','loblaws grocery'],['DOL','Dollarama','TSX','dollarama'],['POW','Power Corporation of Canada','TSX','power corporation'],['MFC','Manulife Financial','TSX','manulife'],['SLF','Sun Life Financial','TSX','sun life']
].map(([symbol,name,exchange,aliases])=>({symbol,name,exchange,aliases:aliases.split(' '),keywords:aliases}));
const cleaned=q=>String(q??'').toLowerCase().replace(/[^a-z0-9. -]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
const noise=/\b(stock|stocks|shares|share|ticker|symbol|price|chart|news|earnings|company|companies|the|today|what|why|is|are|about|for|of|on|how|doing|performance|show|me|tell|latest|analysis)\b/g;
function score(item,text){
 const q=cleaned(text).replace(noise,' ').replace(/\s+/g,' ').trim(), s=item.symbol.toLowerCase(),n=item.name.toLowerCase(),all=item.keywords;
 if(!q)return 0;
 if(q===s||q===n)return 100;
 if(q.length>=3&&(n.startsWith(q)||all.split(' ').some(w=>w===q)))return 80;
 if(q.length>=4&&(n.includes(q)||all.includes(q)))return 58;
 if(q.length>=3&&s.startsWith(q))return 48;
 if(q.length>=3&&q.split(' ').some(word=>word.length>=4&&(n.includes(word)||all.includes(word))))return 28;
 return 0;
}
export function suggestSymbols(text,limit=7){
 const q=cleaned(text);if(!q)return catalog.slice(0,limit).map(({symbol,name,exchange})=>({symbol,name,exchange}));
 return catalog.map(x=>({item:x,rank:score(x,q)})).filter(x=>x.rank>0).sort((a,b)=>b.rank-a.rank||a.item.name.localeCompare(b.item.name)).slice(0,limit).map(({item})=>({symbol:item.symbol,name:item.name,exchange:item.exchange}));
}
export function resolveSymbol(text){
 const q=cleaned(text);if(!q)return null;
 const exact=catalog.find(x=>x.symbol.toLowerCase()===q||x.name.toLowerCase()===q||x.keywords.split(' ').includes(q));
 if(exact)return {symbol:exact.symbol,name:exact.name,exchange:exact.exchange};
 const top=suggestSymbols(text,2);
 // Don't silently reinterpret ambiguous free-form questions as stock symbols.
 return top.length===1?top[0]:null;
}
export const fullSymbols=catalog.map(({symbol,name,exchange})=>({symbol,name,exchange}));
