import nodeCrypto from 'node:crypto';
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.STORAGE_KV_REST_API_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN;

async function command(...args){
  if(!REST_URL||!REST_TOKEN)throw new Error('STORAGE_NOT_CONFIGURED');
  const response=await fetch(`${REST_URL}/pipeline`,{method:'POST',headers:{Authorization:`Bearer ${REST_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify([args])});
  if(!response.ok)throw new Error(`STORAGE_${response.status}`);
  const body=await response.json();if(body[0]?.error)throw new Error(body[0].error);return body[0]?.result;
}
export async function getJson(key){const raw=await command('GET',key);return raw?JSON.parse(raw):null;}
export async function setJson(key,value){return command('SET',key,JSON.stringify(value));}
export async function del(key){return command('DEL',key);}
export async function sadd(key,value){return command('SADD',key,value);}
export async function smembers(key){return (await command('SMEMBERS',key))||[];}
export async function incr(key){return command('INCR',key);}
export async function incrWithExpiry(key,seconds){const value=await command('INCR',key);if(Number(value)===1)await command('EXPIRE',key,Math.max(60,Number(seconds)||86400));return Number(value);}
export async function consumeQuotaIfAvailable(key,seconds,limit){const script="local current=tonumber(redis.call('GET',KEYS[1]) or '0'); if current>=tonumber(ARGV[1]) then return -1 end; local next=redis.call('INCR',KEYS[1]); if next==1 then redis.call('EXPIRE',KEYS[1],tonumber(ARGV[2])) end; return next";return Number(await command('EVAL',script,1,key,Number(limit)||1,Math.max(60,Number(seconds)||86400)));}
export async function setIfAbsent(key,seconds){return Boolean(await command('SET',key,'1','NX','EX',Math.max(10,Number(seconds)||60)));}
const tokenHash=value=>nodeCrypto.createHash('sha256').update(String(value)).digest('hex');
export async function createSession(code,device){const token=`OTS_${nodeCrypto.randomBytes(32).toString('base64url')}`;const expiresAt=new Date(Date.now()+30*86400000).toISOString();await setJson(`session:${tokenHash(token)}`,{code,device,expiresAt});return {token,expiresAt};}
export async function resolveSession(token){if(!String(token||'').startsWith('OTS_'))return null;const session=await getJson(`session:${tokenHash(token)}`);if(!session||Date.parse(session.expiresAt)<Date.now())return null;const access=await getJson(`access:${session.code}`);return access?{...session,access}:null;}
export function configured(){return Boolean(REST_URL&&REST_TOKEN);}
export function normalizeCode(value=''){return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');}
export function makeCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=crypto.getRandomValues(new Uint8Array(12));let value='';for(const b of bytes)value+=alphabet[b%alphabet.length];return `OTP-${value.slice(0,4)}-${value.slice(4,8)}-${value.slice(8,12)}`;}
export async function createAccess({email='',name='',orderId='',source='admin',expiresAt=null}){let code=makeCode();while(await getJson(`access:${code}`))code=makeCode();const access={code,email:String(email).toLowerCase(),name,orderId,source,status:'active',createdAt:new Date().toISOString(),activatedAt:null,lastAccessAt:null,expiresAt,devices:[],maxDevices:1};await setJson(`access:${code}`,access);await sadd('access:index',code);if(orderId)await setJson(`order:${orderId}`,{code});return access;}
export async function updateAccess(code,patch){const current=await getJson(`access:${code}`);if(!current)return null;const next={...current,...patch,updatedAt:new Date().toISOString()};await setJson(`access:${code}`,next);return next;}
export function publicAccess(a){return {code:a.code,name:a.name,status:a.status,createdAt:a.createdAt,activatedAt:a.activatedAt,lastAccessAt:a.lastAccessAt,expiresAt:a.expiresAt,maxDevices:a.maxDevices,deviceCount:a.devices?.length||0};}
