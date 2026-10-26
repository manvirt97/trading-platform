import {json} from '../_shared/http.js';
import {suggestSymbols,resolveSymbol} from '../_shared/symbols.js';
export function onRequestGet({request}){const u=new URL(request.url),q=(u.searchParams.get('q')||'').slice(0,90);return json({query:q,items:suggestSymbols(q),exact:resolveSymbol(q)});}
