import {getJson,normalizeCode,updateAccess,publicAccess,configured,createSession,resolveSession,setJson,setIfAbsent,del,smembers} from '../lib/_store.js';
import {json,cors,deviceId,hash,safeEqual} from '../lib/_security.js';
import {sendLoginCodeEmail} from '../lib/_email.js';
const normalizeEmail=value=>String(value||'').trim().toLowerCase();
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
const otpKey=email=>`email:otp:${hash(email)}`;
async function findAccessByEmail(email){
 const codes=await smembers('access:index');
 for(const code of Array.isArray(codes)?codes.slice(0,200):[]){
  const access=await getJson('access:'+code);
  if(access?.email===email)return access;
 }
 return null;
}
async function googleFlow(req,res,body){
 const credential=String(body.credential||'').trim();
 if(!credential)return json(res,400,{error:'Não foi possível identificar a conta Google.'});
 const clientId=String(process.env.GOOGLE_CLIENT_ID||process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID||'').trim();
 if(!clientId)return json(res,503,{error:'O login Google ainda não foi configurado na Vercel.'});
 try{
  const response=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(credential),{signal:AbortSignal.timeout(10000)});
  if(!response.ok)return json(res,401,{error:'A autenticação do Google expirou. Tente novamente.'});
  const profile=await response.json();
  const issuer=String(profile.iss||'');
  if(String(profile.aud||'')!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(issuer)||String(profile.email_verified)!=='true')return json(res,401,{error:'Não foi possível validar esta conta Google.'});
  const email=normalizeEmail(profile.email);
  if(!validEmail(email))return json(res,401,{error:'A conta Google não possui um e-mail válido.'});
  const access=await findAccessByEmail(email);
  if(access?.status==='active'&&(!access.expiresAt||Date.parse(access.expiresAt)>Date.now())){
   const device=deviceId(req);const next=await updateAccess(access.code,{devices:[device],lastAccessAt:new Date().toISOString()});const session=await createSession(next.code,device);
   return json(res,200,{ok:true,preview:false,email,session:session.token,sessionExpiresAt:session.expiresAt,access:publicAccess(next)});
  }
  return json(res,200,{ok:true,preview:true,email});
 }catch(error){console.error('[google-login]',error);return json(res,502,{error:'Não foi possível concluir o login Google agora.'});}
}
async function emailFlow(req,res,body){
 const email=normalizeEmail(body.email);
 if(!validEmail(email))return json(res,400,{error:'Digite um e-mail válido.'});
 if(body.action==='email-request'){
  if(!await setIfAbsent('email:otp:rate:'+hash(email),60))return json(res,429,{error:'Aguarde um minuto antes de pedir outro código.'});
  const bytes=new Uint32Array(1);globalThis.crypto.getRandomValues(bytes);
  const code=String(bytes[0]%1000000).padStart(6,'0');
  await setJson(otpKey(email),{codeHash:hash(code),attempts:0,expiresAt:Date.now()+600000});
  try{const delivery=await sendLoginCodeEmail({email,code});if(!delivery.sent){await del(otpKey(email));return json(res,503,{error:'O envio de e-mail ainda não está configurado.'});}return json(res,200,{ok:true,message:'Código enviado. Confira a caixa de entrada e a pasta de spam.'});}
  catch(error){await del(otpKey(email));console.error('[email-request]',error);return json(res,502,{error:'Não foi possível enviar o código agora.'});}
 }
 if(body.action==='email-verify'){
  const code=String(body.code||'').replace(/\D/g,'').slice(0,6);
  if(code.length!==6)return json(res,400,{error:'Digite o código de seis números.'});
  const record=await getJson(otpKey(email));
  if(!record||Number(record.expiresAt)<Date.now())return json(res,401,{error:'Código expirado. Solicite um novo código.'});
  if(Number(record.attempts||0)>=5){await del(otpKey(email));return json(res,429,{error:'Muitas tentativas. Solicite um novo código.'});}
  if(!safeEqual(String(record.codeHash),hash(code))){await setJson(otpKey(email),{...record,attempts:Number(record.attempts||0)+1});return json(res,401,{error:'Código incorreto.'});}
  await del(otpKey(email));
  const access=await findAccessByEmail(email);
  if(access?.status==='active'&&(!access.expiresAt||Date.parse(access.expiresAt)>Date.now())){
   const device=deviceId(req);const next=await updateAccess(access.code,{devices:[device],lastAccessAt:new Date().toISOString()});const session=await createSession(next.code,device);
   return json(res,200,{ok:true,preview:false,email,session:session.token,sessionExpiresAt:session.expiresAt,access:publicAccess(next)});
  }
  return json(res,200,{ok:true,preview:true,email});
 }
 return null;
}
export default async function handler(req,res){cors(req,res);if(req.method==='OPTIONS')return json(res,204,{});if(req.method==='GET')return json(res,200,{ok:true,service:'ontop-central-plus',configured:configured(),googleClientId:String(process.env.GOOGLE_CLIENT_ID||process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID||'').trim()});if(req.method!=='POST')return json(res,405,{error:'Método não permitido'});try{if(!configured())return json(res,503,{error:'A plataforma está terminando a configuração do banco de dados.'});const body=req.body&&typeof req.body==='object'?req.body:{};if(body.action==='google-login'){const result=await googleFlow(req,res,body);if(result)return result;}if(body.action==='email-request'||body.action==='email-verify'){const result=await emailFlow(req,res,body);if(result)return result;}const device=deviceId(req);if(req.body?.session){const current=await resolveSession(String(req.body.session));if(!current||current.device!==device)return json(res,401,{error:'Sessão expirada. Digite seu código novamente.'});const access=current.access;if(access.status!=='active'||!access.devices?.includes(device))return json(res,403,{error:'Este acesso não está ativo neste aparelho.'});return json(res,200,{ok:true,access:publicAccess(access),session:String(req.body.session)});}const code=normalizeCode(req.body?.code);if(code.length<10)return json(res,400,{error:'Digite um código válido.'});const access=await getJson(`access:${code}`);if(!access)return json(res,404,{error:'Código não encontrado.'});if(access.status!=='active')return json(res,403,{error:'Este acesso está bloqueado. Fale com o suporte.'});if(access.expiresAt&&Date.parse(access.expiresAt)<Date.now())return json(res,403,{error:'Este código expirou.'});const devices=Array.isArray(access.devices)?access.devices:[];if(!devices.includes(device)&&devices.length>=1)return json(res,403,{error:'Este código já está vinculado a outro aparelho.'});if(!devices.includes(device))devices.push(device);const now=new Date().toISOString();const updated=await updateAccess(code,{devices,maxDevices:1,lastAccessAt:now,activatedAt:access.activatedAt||now});const session=await createSession(code,device);return json(res,200,{ok:true,access:publicAccess(updated),session:session.token,sessionExpiresAt:session.expiresAt});}catch(e){console.error(e);return json(res,500,{error:'Não foi possível validar o acesso agora.'});}}
