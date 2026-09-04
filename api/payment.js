import crypto from 'node:crypto';
import {createAccess,getJson,updateAccess,configured} from '../lib/_store.js';
import {json} from '../lib/_security.js';
import {sendAccessEmail} from '../lib/_email.js';

const MP_API='https://api.mercadopago.com';
const DEFAULT_ORIGIN='https://ontop-central-plus.vercel.app';
const clean=value=>String(value??'').trim();
const originFor=req=>{
  const configuredOrigin=clean(process.env.APP_ORIGIN).replace(/\/+$/,'');
  return /^https:\/\/[A-Za-z0-9.-]+$/.test(configuredOrigin)?configuredOrigin:DEFAULT_ORIGIN;
};
const bodyFor=req=>{
  if(req.body&&typeof req.body==='object')return req.body;
  if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{}}
  return {};
};
function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
}
async function mercado(path,options={}){
  const token=clean(process.env.MERCADOPAGO_ACCESS_TOKEN);
  if(!token)throw new Error('MERCADOPAGO_ACCESS_TOKEN_NOT_CONFIGURED');
  const response=await fetch(MP_API+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});
  const text=await response.text();
  let data={};
  try{data=text?JSON.parse(text):{}}catch{data={raw:text}};
  if(!response.ok){
    const detail=clean(data.message||data.error||data.cause?.[0]?.description||'').slice(0,180);
    throw new Error('MERCADOPAGO_'+response.status+(detail?': '+detail:''));
  }
  return data;
}
async function createPreference(req,res){
  if(!configured())return json(res,503,{error:'O armazenamento do acesso ainda não está configurado.'});
  if(!clean(process.env.MERCADOPAGO_ACCESS_TOKEN))return json(res,503,{error:'O pagamento ainda não está configurado na Vercel.'});
  const origin=originFor(req);
  const externalReference='ontop-plus-'+crypto.randomUUID();
  const preference=await mercado('/checkout/preferences',{method:'POST',body:JSON.stringify({
    items:[{id:'ontop-plus',title:'OnTop Plus',description:'Acesso digital à Central OnTop Plus',quantity:1,currency_id:'BRL',unit_price:25}],
    external_reference:externalReference,
    metadata:{plan:'plus',source:'ontop-links'},
    notification_url:origin+'/api/payment',
    back_urls:{success:origin+'/?payment=success',failure:origin+'/?payment=failure',pending:origin+'/?payment=pending'},
    auto_return:'approved',
    statement_descriptor:'ONTOP PLUS'
  })});
  const checkoutUrl=preference.init_point||preference.sandbox_init_point;
  if(!checkoutUrl)throw new Error('MERCADOPAGO_CHECKOUT_URL_MISSING');
  return json(res,200,{ok:true,id:preference.id,externalReference,init_point:checkoutUrl});
}
function notificationId(req,body){
  return clean(body.data?.id||body.id||req.query?.id||req.query?.['data.id']);
}
async function processNotification(req,res){
  const body=bodyFor(req);
  const id=notificationId(req,body);
  if(!id)return json(res,200,{ok:true,ignored:'notification_without_payment_id'});
  const payment=await mercado('/v1/payments/'+encodeURIComponent(id));
  const externalReference=clean(payment.external_reference);
  if(!externalReference.startsWith('ontop-plus-'))return json(res,200,{ok:true,ignored:'external_reference'});
  const status=clean(payment.status).toLowerCase();
  const prior=await getJson('order:'+externalReference);
  if(status==='approved'){
    if(prior){
      const existing=await getJson('access:'+prior.code);
      return json(res,200,{ok:true,duplicate:true,code:prior.code,emailSent:Boolean(existing?.delivery?.sent)});
    }
    const payer=payment.payer||{};
    const email=clean(payer.email).toLowerCase();
    const name=clean([payer.first_name,payer.last_name].filter(Boolean).join(' '));
    const access=await createAccess({email,name,orderId:externalReference,source:'mercadopago'});
    let delivery={sent:false};
    try{
      delivery=await sendAccessEmail({email,name,code:access.code,origin:originFor(req)});
      await updateAccess(access.code,{delivery,paymentId:String(id),paymentStatus:status});
    }catch(error){
      await updateAccess(access.code,{delivery:{sent:false,error:String(error.message)},paymentId:String(id),paymentStatus:status});
    }
    return json(res,200,{ok:true,code:access.code,emailSent:delivery.sent});
  }
  if(['refunded','charged_back','cancelled','canceled'].includes(status)&&prior){
    const existing=await getJson('access:'+prior.code);
    if(existing)await updateAccess(prior.code,{status:'blocked',blockedReason:'mercadopago_'+status,paymentId:String(id),paymentStatus:status});
    return json(res,200,{ok:true,revoked:true});
  }
  return json(res,200,{ok:true,ignored:'payment_status',status});
}
export default async function handler(req,res){
  cors(res);
  if(req.method==='OPTIONS')return json(res,204,{});
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido'});
  try{
    const body=bodyFor(req);
    if(body.action==='create')return await createPreference(req,res);
    if(!configured())return json(res,503,{error:'O armazenamento do acesso ainda não está configurado.'});
    return await processNotification(req,res);
  }catch(error){
    console.error('[payment]',error);
    return json(res,500,{error:'Não foi possível processar o pagamento agora.',detail:process.env.NODE_ENV==='development'?String(error.message):undefined});
  }
}
