import {configured,consumeQuotaIfAvailable,resolveSession} from './_store.js';
import {cors,deviceId,json} from './_security.js';

const DAILY_LIMIT=30;
const clean=(value,max=100)=>String(value||'').trim().replace(/[<>]/g,'').slice(0,max);
const letters=value=>(clean(value).match(/\p{L}/gu)||[]).length;
function brazilDay(){return new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10);}
function noContent(res){res.status(204).end();}
function active(current,device){
  return current&&current.device===device&&current.access?.status==='active'&&(!current.access.expiresAt||Date.parse(current.access.expiresAt)>=Date.now())&&Array.isArray(current.access.devices)&&current.access.devices.includes(device);
}
export default async function handler(req,res){
 cors(req,res);
 if(req.method==='OPTIONS')return noContent(res);
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
 if(!process.env.PEXELS_API_KEY)return json(res,503,{error:'A busca de mídia ainda não foi configurada.'});
 if(!configured())return json(res,503,{error:'O banco de dados ainda não foi configurado.'});
 try{
  const current=await resolveSession(String(req.body?.session||''));
  if(!active(current,deviceId(req)))return json(res,401,{error:'Sessão expirada. Entre novamente com seu código.'});
  if(req.body?.mode==='status')return json(res,200,{ok:true,limit:DAILY_LIMIT});
  const query=clean(req.body?.query);
  if(letters(query)<2)return json(res,400,{error:'Digite pelo menos 2 letras para buscar.'});
  const type=req.body?.type==='video'?'video':'photo';
  const url=new URL(type==='video'?'https://api.pexels.com/videos/search':'https://api.pexels.com/v1/search');
  url.searchParams.set('query',query);url.searchParams.set('per_page','12');
  if(type==='photo')url.searchParams.set('locale','pt-BR');
  const response=await fetch(url,{method:'GET',signal:AbortSignal.timeout(15000),headers:{Authorization:process.env.PEXELS_API_KEY}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){console.error('PEXELS',response.status,body?.error||'');return json(res,response.status===429?429:502,{error:'A busca de mídia está temporariamente indisponível.'});}
  const quotaKey=`media:${brazilDay()}:${current.code}`;
  const used=await consumeQuotaIfAvailable(quotaKey,86400,DAILY_LIMIT);
  if(used<0)return json(res,429,{error:`Você atingiu o limite diário de ${DAILY_LIMIT} buscas.`,remaining:0});
  if(type==='video'){
   const videos=Array.isArray(body.videos)?body.videos.map(item=>({id:item.id,url:item.url,thumb:item.image,duration:item.duration,author:item.user?.name||''})): [];
   return json(res,200,{ok:true,type,query,videos,remaining:Math.max(0,DAILY_LIMIT-used)});
  }
  const photos=Array.isArray(body.photos)?body.photos.map(item=>({id:item.id,url:item.url,alt:item.alt||query,author:item.photographer||'',src:{small:item.src?.small,medium:item.src?.medium,large:item.src?.large}})): [];
  return json(res,200,{ok:true,type,query,photos,remaining:Math.max(0,DAILY_LIMIT-used)});
 }catch(error){console.error(error);return json(res,500,{error:'Não foi possível buscar mídia agora.'});}
}
