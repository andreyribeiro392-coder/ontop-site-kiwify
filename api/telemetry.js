import crypto from 'node:crypto';
import {cors,json} from './_security.js';

function noContent(res){res.status(204).end();}
function makeEnvelope(dsn,payload){
 const parsed=new URL(dsn);const key=decodeURIComponent(parsed.username);const project=parsed.pathname.split('/').filter(Boolean).pop();
 if(!key||!project)return null;
 const eventId=crypto.randomUUID().replaceAll('-','');
 const event={event_id:eventId,platform:'javascript',level:['fatal','error','warning','info'].includes(payload.level)?payload.level:'error',message:String(payload.message||'Erro sem mensagem').slice(0,500),exception:payload.stack?{values:[{type:String(payload.name||'Error').slice(0,80),value:String(payload.message||'').slice(0,500),stacktrace:{frames:[{filename:String(payload.filename||'').slice(0,300),lineno:Number(payload.lineno)||0,colno:Number(payload.colno)||0}]}}]}:undefined,tags:{route:String(payload.route||'').slice(0,120)},extra:{source:'ontop-central-plus',userAgent:String(payload.userAgent||'').slice(0,300)}};
 const body=JSON.stringify(event);const header=JSON.stringify({event_id:eventId,sentry_version:'7',sent_at:new Date().toISOString()});const item=JSON.stringify({type:'event',length:Buffer.byteLength(body)});
 return {url:`${parsed.protocol}//${parsed.host}/api/${project}/envelope/?sentry_version=7&sentry_key=${encodeURIComponent(key)}&sentry_client=ontop-central-plus/1.0`,body:`${header}\n${item}\n${body}`};
}
export default async function handler(req,res){
 cors(req,res);
 if(req.method==='OPTIONS')return noContent(res);
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
 const payload=typeof req.body==='object'&&req.body?req.body:{};
 if(JSON.stringify(payload).length>20000)return json(res,413,{error:'Evento muito grande.'});
 const dsn=process.env.SENTRY_DSN||process.env.NEXT_PUBLIC_SENTRY_DSN;
 if(!dsn)return noContent(res);
 try{
  const envelope=makeEnvelope(dsn,payload);if(!envelope)return noContent(res);
  const response=await fetch(envelope.url,{method:'POST',headers:{'Content-Type':'application/x-sentry-envelope'},body:envelope.body,signal:AbortSignal.timeout(8000)});
  if(!response.ok)console.error('SENTRY',response.status);
 }catch(error){console.error('SENTRY',error.message||'');}
 return noContent(res);
}
