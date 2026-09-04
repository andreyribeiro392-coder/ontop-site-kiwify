import {getJson,normalizeCode,updateAccess,publicAccess,configured,createSession,resolveSession,setJson,setIfAbsent,del,smembers} from '../lib/_store.js';
import {json,cors,deviceId,hash,safeEqual} from '../lib/_security.js';
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
const googleOrigin='https://ontop-central-plus.vercel.app';
const googleRedirectUri=googleOrigin+'/api/access?action=google-callback';
const googleClient=()=>String(process.env.GOOGLE_CLIENT_ID||process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID||'').trim();
function redirectTo(res,url){res.statusCode=302;res.setHeader('Cache-Control','no-store');res.setHeader('Location',url);return res.end();}
function authError(res,message){return redirectTo(res,googleOrigin+'/?google_error='+encodeURIComponent(message));}
async function googleStart(req,res,query){
 const clientId=googleClient();
 const secret=String(process.env.GOOGLE_CLIENT_SECRET||'').trim();
 if(!clientId||!secret)return authError(res,'Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel.');
 const state=hash(String(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random()));
 const email=normalizeEmail(query.get('email')||'');
 await setJson('google:oauth:'+state,{email,expiresAt:Date.now()+600000});
 const params=new URLSearchParams({client_id:clientId,redirect_uri:googleRedirectUri,response_type:'code',scope:'openid email profile',state,access_type:'online',prompt:'select_account'});
 return redirectTo(res,'https://accounts.google.com/o/oauth2/v2/auth?'+params.toString());
}
async function googleCallback(req,res,query){
 const state=String(query.get('state')||'');
 const code=String(query.get('code')||'');
 if(query.get('error'))return authError(res,'O login Google foi cancelado.');
 if(!state||!code)return authError(res,'Resposta inválida do Google.');
 const saved=await getJson('google:oauth:'+state);
 await del('google:oauth:'+state);
 if(!saved||Number(saved.expiresAt)<Date.now())return authError(res,'A sessão do Google expirou. Tente novamente.');
 const clientId=googleClient();
 const secret=String(process.env.GOOGLE_CLIENT_SECRET||'').trim();
 if(!clientId||!secret)return authError(res,'Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel.');
 try{
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:secret,redirect_uri:googleRedirectUri,grant_type:'authorization_code'})});
  if(!tokenResponse.ok)return authError(res,'O Google não autorizou este login.');
  const tokens=await tokenResponse.json();
  const idToken=String(tokens.id_token||'');
  if(!idToken)return authError(res,'O Google não retornou uma identidade válida.');
  const profileResponse=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(idToken),{signal:AbortSignal.timeout(10000)});
  if(!profileResponse.ok)return authError(res,'Não foi possível validar a conta Google.');
  const profile=await profileResponse.json();
  if(String(profile.aud||'')!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(String(profile.iss||''))||String(profile.email_verified)!=='true')return authError(res,'Não foi possível validar a conta Google.');
  const email=normalizeEmail(profile.email);
  if(!validEmail(email)||(saved.email&&saved.email!==email))return authError(res,'Use o mesmo e-mail selecionado na conta Google.');
  const access=await findAccessByEmail(email);
  if(access?.status==='active'&&(!access.expiresAt||Date.parse(access.expiresAt)>Date.now())){
   const device=deviceId(req);const next=await updateAccess(access.code,{devices:[device],lastAccessAt:new Date().toISOString()});const session=await createSession(next.code,device);
   return redirectTo(res,googleOrigin+'/?google_session='+encodeURIComponent(session.token));
  }
  return redirectTo(res,googleOrigin+'/?google_email='+encodeURIComponent(email));
 }catch(error){console.error('[google-callback]',error);return authError(res,'Não foi possível concluir o login Google agora.');}
}
export default async function handler(req,res){cors(req,res);if(req.method==='OPTIONS')return json(res,204,{});if(req.method==='GET'){const query=new URL(req.url||'/',googleOrigin).searchParams;const action=query.get('action');if(action==='google-start')return googleStart(req,res,query);if(action==='google-callback')return googleCallback(req,res,query);return json(res,200,{ok:true,service:'ontop-central-plus',configured:configured(),googleClientId:googleClient()});}if(req.method!=='POST')return json(res,405,{error:'Método não permitido'});try{if(!configured())return json(res,503,{error:'A plataforma está terminando a configuração do banco de dados.'});const body=req.body&&typeof req.body==='object'?req.body:{};if(body.action==='google-login'){const result=await googleFlow(req,res,body);if(result)return result;}const device=deviceId(req);if(req.body?.session){const current=await resolveSession(String(req.body.session));if(!current||current.device!==device)return json(res,401,{error:'Sessão expirada. Digite seu código novamente.'});const access=current.access;if(access.status!=='active'||!access.devices?.includes(device))return json(res,403,{error:'Este acesso não está ativo neste aparelho.'});return json(res,200,{ok:true,access:publicAccess(access),session:String(req.body.session)});}const code=normalizeCode(req.body?.code);if(code.length<10)return json(res,400,{error:'Digite um código válido.'});const access=await getJson(`access:${code}`);if(!access)return json(res,404,{error:'Código não encontrado.'});if(access.status!=='active')return json(res,403,{error:'Este acesso está bloqueado. Fale com o suporte.'});if(access.expiresAt&&Date.parse(access.expiresAt)<Date.now())return json(res,403,{error:'Este código expirou.'});const devices=Array.isArray(access.devices)?access.devices:[];if(!devices.includes(device)&&devices.length>=1)return json(res,403,{error:'Este código já está vinculado a outro aparelho.'});if(!devices.includes(device))devices.push(device);const now=new Date().toISOString();const updated=await updateAccess(code,{devices,maxDevices:1,lastAccessAt:now,activatedAt:access.activatedAt||now});const session=await createSession(code,device);return json(res,200,{ok:true,access:publicAccess(updated),session:session.token,sessionExpiresAt:session.expiresAt});}catch(e){console.error(e);return json(res,500,{error:'Não foi possível validar o acesso agora.'});}}
