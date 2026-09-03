import crypto from 'node:crypto';
import {createAccess,getJson,updateAccess,configured} from '../lib/_store.js';
import {json,safeEqual} from '../lib/_security.js';
import {sendAccessEmail} from '../lib/_email.js';

function cleanSecret(value){
  return String(value||'').trim().replace(/^(['"])(.*)\1$/,'$2').trim();
}

function requestBodyText(req){
  if(typeof req.rawBody==='string')return req.rawBody;
  if(Buffer.isBuffer(req.rawBody))return req.rawBody.toString('utf8');
  if(typeof req.body==='string')return req.body;
  return JSON.stringify(req.body||{});
}

function signedPayloads(req){
  const body=req.body;
  const values=[requestBodyText(req)];
  if(body&&typeof body==='object'){
    if(body.order)values.push(JSON.stringify(body.order));
    const withoutSignature={...body};
    delete withoutSignature.signature;
    delete withoutSignature.token;
    delete withoutSignature.webhook_token;
    values.push(JSON.stringify(withoutSignature));
  }
  return [...new Set(values.filter(Boolean))];
}

function signatureValid(req){
  const secrets=[process.env.KIWIFY_WEBHOOK_SECRET,process.env.KIWIFY_WEBHOOK_TOKEN]
    .map(cleanSecret).filter((value,index,all)=>value&&all.indexOf(value)===index);
  if(!secrets.length)return false;
  const body=req.body||{};
  const headers=req.headers||{};
  const candidates=[
    headers['x-kiwify-signature'],
    headers['x-webhook-signature'],
    headers['signature'],
    headers['x-kiwify-token'],
    headers['x-webhook-token'],
    req.query?.signature,
    req.query?.token,
    body.signature,
    body.token,
    body.webhook_token
  ].map(cleanSecret).filter(Boolean);
  const payloads=signedPayloads(req);
  for(const secret of secrets){
    const digests=[];
    for(const payload of payloads){
      digests.push(
        crypto.createHmac('sha1',secret).update(payload).digest('hex'),
        crypto.createHmac('sha256',secret).update(payload).digest('hex')
      );
    }
    for(const received of candidates){
      const normalized=received.replace(/^Bearer\\s+/i,'');
      if(safeEqual(normalized,secret))return true;
      const bare=normalized.replace(/^sha(?:1|256)=/i,'');
      if(digests.some(digest=>safeEqual(bare,digest)))return true;
    }
  }
  return false;
}
function val(o,paths){
  for(const p of paths){
    let x=o;
    for(const k of p.split('.'))x=x?.[k];
    if(x!==undefined&&x!==null&&x!=='')return x;
  }
  return '';
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido'});
  if(!configured())return json(res,503,{error:'Storage pending'});
  if(!signatureValid(req)){
    console.warn('[webhook-kiwify] assinatura inválida',Object.keys(req.headers||{}).filter(k=>/kiwify|webhook|signature|token/i.test(k)));
    return json(res,401,{error:'Assinatura inválida'});
  }
  try{
    const event=String(val(req.body,['event','event_type','webhook_event_type','webhook_event','type','order_status','status','order.webhook_event_type','order.order_status','order.status','order.event','data.event'])).toLowerCase();
    const product=String(val(req.body,['product.name','product.product_name','Product.product_name','product_name','order.Product.product_name','order.Product.product_name','order.product_name','order.product.name','order.Product.name','offer.product.name','data.product.name']));
    const allowed=(process.env.KIWIFY_PLUS_PRODUCT_MATCH||'ontop').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
    if(product&&!allowed.some(x=>product.toLowerCase().includes(x)))return json(res,200,{ok:true,ignored:'product'});
    const orderId=String(val(req.body,['order_id','order.id','sale_id','id','transaction_id','data.order_id','data.id','order.order_id','order.order_ref','order.id','order.transaction_id']));
    const email=String(val(req.body,['customer.email','Customer.email','buyer.email','data.customer.email','data.buyer.email','data.email','email','order.Customer.email','order.customer.email','order.buyer.email']));
    const name=String(val(req.body,['customer.name','Customer.full_name','buyer.name','data.customer.name','data.buyer.name','name','order.Customer.full_name','order.Customer.first_name','order.customer.name','order.buyer.name']));
    const paid=['paid','approved','compra_aprovada','purchase_approved','order_approved'].some(x=>event.includes(x));
    const revoked=['refunded','refund','chargeback','cancelled','canceled','reembolso'].some(x=>event.includes(x));
    if(paid){
      const prior=orderId?await getJson(`order:${orderId}`):null;
      if(prior){
        const existing=await getJson(`access:${prior.code}`);
        return json(res,200,{ok:true,code:prior.code,duplicate:true,emailSent:Boolean(existing?.delivery?.sent)});
      }
      const access=await createAccess({email,name,orderId,source:'kiwify'});
      let delivery={sent:false};
      try{
        delivery=await sendAccessEmail({email,name,code:access.code,origin:process.env.APP_ORIGIN||`https://${req.headers.host}`});
        await updateAccess(access.code,{delivery});
      }catch(error){
        await updateAccess(access.code,{delivery:{sent:false,error:String(error.message)}});
      }
      return json(res,200,{ok:true,code:access.code,emailSent:delivery.sent});
    }
    if(revoked&&orderId){
      const prior=await getJson(`order:${orderId}`);
      if(prior)await updateAccess(prior.code,{status:'blocked',blockedReason:event});
      return json(res,200,{ok:true,revoked:Boolean(prior)});
    }
    return json(res,200,{ok:true,ignored:'event'});
  }catch(e){
    console.error('[webhook-kiwify] processamento falhou',e);
    return json(res,500,{error:'Webhook processing failed'});
  }
}
