// Auditable editorial topic rules. Headlines can overlap categories when genuinely relevant.
export const TOPICS={
 all:{label:'All markets',query:'(stock market OR stocks OR Wall Street OR TSX OR earnings OR inflation) when:3d',terms:null},
 earnings:{label:'Earnings',query:'(earnings OR quarterly results OR profit forecast OR revenue guidance) stocks when:5d',terms:/\b(earnings?|quarterly|quarter|revenue|profit|profits|eps|guidance|results|outlook|forecast|beat|miss|dividend|financial report)\b/i},
 rates:{label:'Fed & rates',query:'(Federal Reserve OR Jerome Powell OR inflation OR interest rates OR bond yields OR central bank) stocks when:5d',terms:/\b(fed|federal reserve|powell|central bank|interest rates?|inflation|cpi|pce|treasury|bond yields?|monetary policy|rate cut|rate hike|boc|bank of canada)\b/i},
 energy:{label:'Energy',query:'(oil OR crude OR WTI OR OPEC OR natural gas OR LNG OR oil sands OR energy shares) when:5d',terms:/\b(oil|crude|wti|brent|opec|natural gas|lng|pipeline|refinery|refining|energy|petroleum|gasoline|oil sands|cenovus|suncor)\b/i},
 canada:{label:'Canada',query:'(TSX OR Canadian stocks OR Bank of Canada OR Canadian economy OR Canadian energy) when:5d',terms:/\b(canada|canadian|tsx|toronto stocks?|bank of canada|boc|loonie|s&p\/tsx|oil sands|ontario|alberta|montreal|vancouver|cenovus|suncor|shopify|royal bank of canada)\b/i},
 technology:{label:'Technology',query:'(Nvidia OR AMD OR Apple OR AI chips OR semiconductors OR tech stocks OR Microsoft) when:5d',terms:/\b(ai|artificial intelligence|nvidia|amd|semiconductor|chip|chips|technology|tech|apple|microsoft|alphabet|google|tesla|cloud|software|data center|data centre)\b/i}
};
export function normalizeTopic(value){const key=String(value||'').trim().toLowerCase();return Object.hasOwn(TOPICS,key)?key:'all'}
export function relevantToTopic(title,topic){const key=normalizeTopic(topic);return !TOPICS[key].terms||TOPICS[key].terms.test(String(title||''))}
export function relevantToQuery(title,query){const term=String(query||'').trim().toLowerCase();if(!term)return true;const stripped=term.replace(/[^a-z0-9]+/g,' ').replace(/\b(what|when|where|does|is|are|the|a|an|about|news|latest|share|shares|stock|stocks|price|company|this|tell|me|inc|corp|corporation|ltd)\b/g,' ').trim();const words=stripped.split(/\s+/).filter(x=>x.length>2);if(!words.length)return true;const lower=String(title||'').toLowerCase();return words.some(word=>lower.includes(word))}

/**
 * A single primary desk for each headline. Broad keyword overlap previously
 * made the filtered categories look identical (e.g. Nvidia earnings appeared
 * under both Earnings and Technology). The full feed remains available in All.
 * This is transparent editorial classification, not AI-generated content.
 */
const CATEGORY_WEIGHTS={
 earnings:[/\b(earnings?|quarterly|eps|guidance|dividend)\b/i,/\b(revenue|profits?|results|outlook|forecast|beat|miss)\b/i],
 rates:[/\b(federal reserve|fed|powell|interest rates?|rate cuts?|rate hikes?|bank of canada|central bank|monetary policy)\b/i,/\b(inflation|cpi|pce|treasury|bond yields?|boc)\b/i],
 energy:[/\b(opec|wti|brent|crude|oil sands|natural gas|lng|refiner(?:y|ies)|refining|pipeline)\b/i,/\b(oil|energy|petroleum|gasoline|cenovus|suncor)\b/i],
 canada:[/\b(tsx|s&p\/tsx|canad(?:a|ian)|bank of canada|loonie)\b/i,/\b(alberta|ontario|toronto|montreal|vancouver|shopify|rbc)\b/i],
 technology:[/\b(nvidia|amd|semiconductor|artificial intelligence|microsoft|alphabet|apple|tesla)\b/i,/\b(ai|chips?|technology|tech|software|cloud|data cent(?:er|re))\b/i]
};
export function primaryTopic(title){
 const text=String(title||'');
 let best='all',high=0;
 // Ordering resolves genuine ties consistently, rather than duplicating cards.
 for(const key of ['rates','earnings','energy','canada','technology']){
  if(!relevantToTopic(text,key))continue;
  const [strong,context]=CATEGORY_WEIGHTS[key];
  const score=1+(strong.test(text)?4:0)+(context.test(text)?2:0);
  if(score>high){best=key;high=score}
 }
 return best;
}

/** Avoid unrelated crime and political general-news stories in a market terminal. */
export function marketRelevant(title){
 const value=String(title||'');
 return /\b(stock(?:s)?|shares?|equity|equities|market(?:s)?|wall street|nasdaq|dow jones|s&p|tsx|trading|invest(?:or|ment|ing)?|earnings?|quarterly|revenue|profit|margin|forecast|guidance|dividend|bond|yield|treasury|fed|federal reserve|inflation|interest rates?|economy|economic|gdp|jobs?|employment|tariffs?|trade deal|oil|crude|opec|natural gas|lng|energy|refin(?:ery|ing)|bank(?:s|ing)?|currency|dollar|cad|usd|merger|acquisition|ipo|crypto|bitcoin|semiconductor|nvidia|tesla|apple|microsoft|financial|retail sales|consumer spending|supply chain|commodit(?:y|ies)|gold|copper)\b/i.test(value);
}
