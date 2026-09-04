import crypto from 'node:crypto';
import {getJson,setJson,setIfAbsent,del,smembers,createSession,updateAccess,publicAccess,configured} from '../lib/_store.js';
import {json,cors,deviceId,hash,safeEqual} from '../lib/_security.js';
import {sendLoginCodeEmail} from '../lib/_email.js';

const normalizeEmail=value=>String(value||'').trim().toLowerCase();
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
const cleanCode=value=>String(value||'').replace(/\D/g,'').slice(0,6);
const otpKey=email=>`email:otp:${hash(email)}`;
const emailKey=email=>`email:index:${hash(email)}`;

async function findAccess(email){
  const indexed=await getJson(emailKey(email));
  if(indexed?.code){
    const access=await getJson('access:'+indexed.code);
    if(access?.email===email)return access;
  }
  const codes=await smembers('access:index');
  for(const code of Array.isArray(codes)?codes.slice(0,200):[]){
    const access=await getJson('access:'+code);
    if(access?.email===email){
      await setJson(emailKey(email),{code:access.code});
      return access;
    }
  }
  return null;
}

export default async function handler(req,res){
  cors(req,res);
  if(req.method==='OPTIONS')return json(res,204,{});
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
  if(!configured())return json(res,503,{error:'O armazenamento ainda não está configurado.'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const action=String(body.action||'');
  const email=normalizeEmail(body.email);
  if(!validEmail(email))return json(res,400,{error:'Digite um e-mail válido.'});
  try{
    if(action==='request'){
      if(!await setIfAbsent('email:otp:rate:'+hash(email),60))return json(res,429,{error:'Aguarde um minuto antes de pedir outro código.'});
      const code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
      await setJson(otpKey(email),{codeHash:hash(code),attempts:0,expiresAt:Date.now()+10*60*1000});
      const delivery=await sendLoginCodeEmail({email,code});
      if(!delivery.sent){await del(otpKey(email));return json(res,503,{error:'O envio de e-mail ainda não está configurado.'});}
      return json(res,200,{ok:true,message:'Código enviado. Verifique sua caixa de entrada e a pasta de spam.'});
    }
    if(action==='verify'){
      const code=cleanCode(body.code);
      if(code.length!==6)return json(res,400,{error:'Digite o código de seis números.'});
      const record=await getJson(otpKey(email));
      if(!record||Number(record.expiresAt)<Date.now())return json(res,401,{error:'Código expirado. Solicite um novo código.'});
      if(Number(record.attempts||0)>=5){await del(otpKey(email));return json(res,429,{error:'Muitas tentativas. Solicite um novo código.'});}
      if(!safeEqual(String(record.codeHash),hash(code))){
        await setJson(otpKey(email),{...record,attempts:Number(record.attempts||0)+1});
        return json(res,401,{error:'Código incorreto.'});
      }
      await del(otpKey(email));
      const access=await findAccess(email);
      if(access?.status==='active'&&(!access.expiresAt||Date.parse(access.expiresAt)>Date.now())){
        const device=deviceId(req);
        const next=await updateAccess(access.code,{devices:[device],lastAccessAt:new Date().toISOString()});
        const session=await createSession(next.code,device);
        return json(res,200,{ok:true,preview:false,email,session:session.token,sessionExpiresAt:session.expiresAt,access:publicAccess(next)});
      }
      return json(res,200,{ok:true,preview:true,email});
    }
    return json(res,400,{error:'Ação inválida.'});
  }catch(error){
    console.error('[email-auth]',error);
    return json(res,500,{error:'Não foi possível concluir a verificação agora.'});
  }
}
