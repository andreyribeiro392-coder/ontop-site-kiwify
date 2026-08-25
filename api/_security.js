import crypto from 'node:crypto';

export function json(res,status,data){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
export function safeEqual(a='',b=''){const aa=Buffer.from(String(a));const bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
export function adminAuthorized(req){const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');return Boolean(process.env.ADMIN_SECRET)&&safeEqual(token,process.env.ADMIN_SECRET);}
export function getIp(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim().slice(0,80);}
export function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
export function deviceId(req){const supplied=String(req.headers['x-ontop-device']||'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,80);return supplied?hash(supplied).slice(0,24):hash(`${getIp(req)}|${String(req.headers['user-agent']||'').slice(0,200)}`).slice(0,24);}
export function cors(req,res){const allowed=(process.env.APP_ORIGIN||'').replace(/\/$/,'');const origin=String(req.headers.origin||'');if(allowed&&origin===allowed)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-OnTop-Device');res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE, OPTIONS');}
