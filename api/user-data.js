import {getJson,setJson,resolveSession,configured} from './_store.js';
import {json,cors,deviceId} from './_security.js';

const clean=(value,max=10000)=>String(value||'').trim().slice(0,max);
function sanitizeChat(value){return Array.isArray(value)?value.slice(-60).map(item=>({role:item?.role==='assistant'?'assistant':'user',text:clean(item?.text),date:clean(item?.date,40)})).filter(item=>item.text):[];}
function sanitizeConversations(value){return Array.isArray(value)?value.slice(0,30).map(item=>({id:clean(item?.id,80),title:clean(item?.title,60)||'Nova conversa',chat:sanitizeChat(item?.chat),updatedAt:clean(item?.updatedAt,40)})).filter(item=>item.id):[];}
function sanitizeTasks(value){const result={};if(value&&typeof value==='object')for(const [key,done] of Object.entries(value).slice(0,200))if(/^\d{1,3}$/.test(key))result[key]=Boolean(done);return result;}
function sanitizeLearning(value){if(!value||typeof value!=='object'||Array.isArray(value))return {};return Object.fromEntries(Object.entries(value).slice(0,500).map(([key,item])=>[clean(key,120),item]));}

export default async function handler(req,res){
 cors(req,res);
 if(req.method==='OPTIONS')return json(res,204,{});
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
 if(!configured())return json(res,503,{error:'O banco de dados ainda não foi configurado.'});
 try{
  const current=await resolveSession(String(req.body?.session||''));
  if(!current||current.device!==deviceId(req)||current.access?.status!=='active')return json(res,401,{error:'Sessão inválida ou expirada.'});
  const key=`userdata:${current.code}`;
  const action=String(req.body?.action||'load');
  if(action==='load')return json(res,200,{ok:true,data:(await getJson(key))||{chat:[],tasks:{},learning:{}}});
  if(action==='save'){
   const previous=(await getJson(key))||{};
   const input=req.body?.data||{};
   const next={...previous,chat:sanitizeChat(input.chat),conversations:sanitizeConversations(input.conversations),activeChatId:clean(input.activeChatId,80),tasks:sanitizeTasks(input.tasks),learning:sanitizeLearning(input.learning),updatedAt:new Date().toISOString()};
   await setJson(key,next);
   return json(res,200,{ok:true,updatedAt:next.updatedAt});
  }
  if(action==='clear-chat'){
   const previous=(await getJson(key))||{};
   const chatId=clean(req.body?.chatId,80);
   await setJson(key,{...previous,chat:[],conversations:(previous.conversations||[]).filter(item=>item.id!==chatId),updatedAt:new Date().toISOString()});
   return json(res,200,{ok:true});
  }
  return json(res,400,{error:'Ação inválida.'});
 }catch(error){console.error(error);return json(res,500,{error:'Não foi possível sincronizar seus dados agora.'});}
}
