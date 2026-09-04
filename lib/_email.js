const appsScriptPattern=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

export function emailConfiguration(){
  const brevoKey=Boolean(process.env.BREVO_API_KEY);
  const brevoFrom=Boolean(process.env.BREVO_SENDER_EMAIL);
  const appsScriptUrl=String(process.env.APPS_SCRIPT_URL||'').trim();
  const appsScriptSecret=Boolean(process.env.APPS_SCRIPT_SECRET);
  const resendKey=Boolean(process.env.RESEND_API_KEY);
  const resendFrom=Boolean(process.env.ACCESS_FROM_EMAIL);
  return {
    provider:brevoKey&&brevoFrom?'brevo':appsScriptUrl&&appsScriptSecret?'google-apps-script':resendKey&&resendFrom?'resend':'none',
    brevo:{keyConfigured:brevoKey,senderConfigured:brevoFrom,nameConfigured:Boolean(process.env.BREVO_SENDER_NAME)},
    appsScript:{urlConfigured:Boolean(appsScriptUrl),secretConfigured:appsScriptSecret,urlValid:appsScriptPattern.test(appsScriptUrl)},
    resend:{keyConfigured:resendKey,senderConfigured:resendFrom}
  };
}

export async function sendAccessEmail({email,name,code,origin}){
  if(!email)return {sent:false,reason:'EMAIL_MISSING'};

  if(process.env.BREVO_API_KEY&&process.env.BREVO_SENDER_EMAIL){
    const response=await fetch('https://api.brevo.com/v3/smtp/email',{
      method:'POST',
      signal:AbortSignal.timeout(20000),
      headers:{'api-key':process.env.BREVO_API_KEY,'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({
        sender:{email:String(process.env.BREVO_SENDER_EMAIL).trim(),name:String(process.env.BREVO_SENDER_NAME||'OnTop Central Plus').trim()},
        to:[{email,name:name||undefined}],
        subject:'Seu código de acesso ao OnTop Central Plus',
        htmlContent:emailHtml({name,code,origin})
      })
    });
    if(!response.ok){
      let detail='';
      try{const payload=await response.json();detail=String(payload.message||payload.code||'')}catch{}
      throw new Error(`BREVO_EMAIL_${response.status}${detail?': '+detail.slice(0,160):''}`);
    }
    return {sent:true,provider:'brevo'};
  }

  if(process.env.APPS_SCRIPT_URL&&process.env.APPS_SCRIPT_SECRET){
    const url=String(process.env.APPS_SCRIPT_URL).trim();
    if(!appsScriptPattern.test(url))throw new Error('APPS_SCRIPT_URL_INVALID');
    const response=await fetch(url,{method:'POST',redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:process.env.APPS_SCRIPT_SECRET,email,name,code,origin})});
    const text=await response.text();
    let result={};try{result=JSON.parse(text)}catch{}
    if(!response.ok)throw new Error(`APPS_SCRIPT_EMAIL_${response.status}`);
    if(result.ok!==true)throw new Error(`APPS_SCRIPT: ${String(result.erro||result.error||'Resposta inválida').slice(0,160)}`);
    return {sent:true,provider:'google-apps-script'};
  }

  if(!process.env.RESEND_API_KEY||!process.env.ACCESS_FROM_EMAIL)return {sent:false,reason:'EMAIL_NOT_CONFIGURED'};
  const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.ACCESS_FROM_EMAIL,to:[email],subject:'Seu acesso ao OnTop Central Plus',html:emailHtml({name,code,origin})})});
  if(!response.ok)throw new Error(`EMAIL_${response.status}`);
  return {sent:true,provider:'resend'};
}

function emailHtml({name,code,origin}){
  return `<div style="font-family:Arial;background:#08090c;color:#f5f6f8;padding:32px"><div style="max-width:560px;margin:auto;background:#121419;border:1px solid #513b18;border-radius:22px;padding:30px"><p style="color:#f2b84b;font-weight:800">ONTOP CENTRAL PLUS</p><h1>Seu acesso foi liberado</h1><p>Olá, ${escapeHtml(name||'membro Plus')}.</p><p>Use seu código individual:</p><div style="font-size:24px;font-weight:900;color:#f2b84b">${escapeHtml(code)}</div><p><a href="${escapeHtml(origin||'')}">Acessar Central Plus</a></p></div></div>`;
}

function escapeHtml(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;')}

export async function sendLoginCodeEmail({email,code}){
  if(!email)return {sent:false,reason:'EMAIL_MISSING'};
  const subject='Seu código de verificação do OnTop Central Plus';
  const html=`<div style="font-family:Arial;background:#08090c;color:#f5f6f8;padding:32px"><div style="max-width:560px;margin:auto;background:#121419;border:1px solid #244653;border-radius:22px;padding:30px"><p style="color:#53dfff;font-weight:800;letter-spacing:2px">ONTOP CENTRAL PLUS</p><h1>Confirme seu e-mail</h1><p>Use este código para entrar na sua Central:</p><div style="font-size:32px;letter-spacing:8px;font-weight:900;color:#53dfff;margin:22px 0">${escapeHtml(code)}</div><p>O código expira em 10 minutos. Se você não solicitou este acesso, ignore esta mensagem.</p></div></div>`;
  if(process.env.BREVO_API_KEY&&process.env.BREVO_SENDER_EMAIL){
    const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'api-key':process.env.BREVO_API_KEY,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({sender:{email:String(process.env.BREVO_SENDER_EMAIL).trim(),name:String(process.env.BREVO_SENDER_NAME||'OnTop Central Plus').trim()},to:[{email}],subject,htmlContent:html})});
    if(!response.ok)throw new Error('BREVO_LOGIN_EMAIL_'+response.status);
    return {sent:true,provider:'brevo'};
  }
  if(process.env.RESEND_API_KEY&&process.env.ACCESS_FROM_EMAIL){
    const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.ACCESS_FROM_EMAIL,to:[email],subject,html})});
    if(!response.ok)throw new Error('RESEND_LOGIN_EMAIL_'+response.status);
    return {sent:true,provider:'resend'};
  }
  return {sent:false,reason:'EMAIL_NOT_CONFIGURED'};
}
