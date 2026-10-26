// Verify Firebase ID JWTs using Google's public signing keys. No trust in client-supplied UID.
const JWK='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const base64url=x=>{const s=x.replace(/-/g,'+').replace(/_/g,'/');return atob(s.padEnd(Math.ceil(s.length/4)*4,'='))};
function bytes(v){return Uint8Array.from(base64url(v),c=>c.charCodeAt(0))}
function parse(part){return JSON.parse(new TextDecoder().decode(bytes(part)))}
let keysCache=null,keysUntil=0;
export async function userId(request,env){
 const project=env.FIREBASE_PROJECT_ID,auth=request.headers.get('Authorization')||'';
 if(!project||!/^Bearer [A-Za-z0-9_\-\.]+$/.test(auth))throw new Error('Sign in required');
 const token=auth.slice(7);if(token.length>7000)throw new Error('Invalid token');
 const parts=token.split('.');if(parts.length!==3)throw new Error('Invalid token');
 let h,p;try{h=parse(parts[0]);p=parse(parts[1])}catch{throw new Error('Invalid token')}
 const now=Math.floor(Date.now()/1000);
 if(h.alg!=='RS256'||!h.kid||p.aud!==project||p.iss!=='https://securetoken.google.com/'+project||typeof p.sub!=='string'||!p.sub||p.sub.length>128||typeof p.exp!=='number'||p.exp<=now||typeof p.iat!=='number'||p.iat>now+60||typeof p.auth_time!=='number'||p.auth_time>now+60)throw new Error('Invalid or expired login');
 if(!keysCache||keysUntil<Date.now()){const r=await fetch(JWK,{cf:{cacheTtl:3600,cacheEverything:true},signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('Authentication temporarily unavailable');keysCache=await r.json();keysUntil=Date.now()+3600000}
 const jwk=keysCache.keys?.find(k=>k.kid===h.kid&&k.kty==='RSA'&&k.alg==='RS256');
 if(!jwk){keysCache=null;throw new Error('Authentication key unavailable; retry')}
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
 if(!valid)throw new Error('Invalid login signature');
 return p.sub
}
export function authError(e){return Response.json({error:e.message==='Sign in required'?'Sign in to save your private workspace':'Login could not be verified'}, {status:401,headers:{'cache-control':'no-store'}})}
