import crypto from 'node:crypto';
import fs from 'node:fs';
import {json,adminAuthorized,deviceId} from '../lib/_security.js';
import {resolveSession} from '../lib/_store.js';
const offer={id:'novelsday-academy',priceInCents:3999,currency:'BRL',checkoutEnabled:false};
export function entitled(session,device,now=Date.now()){
 const access=session?.access;
 return Boolean(session && Number.isFinite(Date.parse(session.expiresAt)) && Date.parse(session.expiresAt)>now && session.device===device && access?.status==='active' && Array.isArray(access.products) && access.products.includes(offer.id) && (!access.expiresAt || (Number.isFinite(Date.parse(access.expiresAt)) && Date.parse(access.expiresAt)>now)));
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
 const action=req.query?.action||'offer';
 if(action==='offer')return json(res,200,{offer});
 if(action!=='lesson'&&action!=='session')return json(res,400,{error:'INVALID_ACTION'});
 const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token)return json(res,403,{error:'COURSE_ACCESS_REQUIRED'});
 let allowed=adminAuthorized(req);
 try{if(!allowed&&token.startsWith('OTS_'))allowed=entitled(await resolveSession(token),deviceId(req));}catch{return json(res,503,{error:'ACCESS_UNAVAILABLE'});}
 if(!allowed)return json(res,403,{error:'COURSE_ACCESS_REQUIRED'});
 if(action==='session')return json(res,200,{access:true});
 if(!/^aula-\d{2}$/.test(String(req.query.id||'')))return json(res,400,{error:'INVALID_LESSON'});
 try{
 const key=Buffer.from(process.env.NOVELS_CONTENT_KEY||'','base64');if(key.length!==32)throw Error('key');
 const vault=JSON.parse(fs.readFileSync(new URL('../lib/academy-vault.json',import.meta.url),'utf8'));
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(vault.iv,'base64'));decipher.setAuthTag(Buffer.from(vault.tag,'base64'));
 const lessons=JSON.parse(Buffer.concat([decipher.update(Buffer.from(vault.body,'base64')),decipher.final()]).toString());
 const lesson=lessons.find(l=>l.id===req.query.id);return lesson?json(res,200,{lesson}):json(res,404,{error:'LESSON_NOT_FOUND'});
 }catch{return json(res,503,{error:'CONTENT_UNAVAILABLE'});}
}
