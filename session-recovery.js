// Prevent mobile browsers from waiting forever on session validation.
(function(){
  const nativeFetch=window.fetch.bind(window);
  const timedRoutes=['/api/access','/api/user-data','/api/payment'];
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!timedRoutes.some(route=>url.includes(route))||init?.signal)return nativeFetch(input,init);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),9000);
    return nativeFetch(input,{...(init||{}),signal:controller.signal}).finally(()=>clearTimeout(timer));
  };
})();

/* ChatGPT-style e-mail verification gate */
(function(){
  const EMAIL_KEY='ontop-email-verified';
  const SESSION_KEY='ontop-session';
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const $=(root,selector)=>root.querySelector(selector);
  function alreadyVerified(){return Boolean(localStorage.getItem(SESSION_KEY)||localStorage.getItem(EMAIL_KEY));}
  function mount(attempt){
    if(alreadyVerified()||document.querySelector('#email-auth-overlay'))return;
    if(!document.querySelector('#app')){if(attempt<20)setTimeout(()=>mount(attempt+1),300);return;}
    const overlay=document.createElement('div');
    overlay.id='email-auth-overlay';
    overlay.innerHTML='<section id="email-auth-card" role="dialog" aria-modal="true" aria-labelledby="email-auth-title"><div class="email-brand">ONTOP CENTRAL PLUS</div><h1 id="email-auth-title">Entre com seu e-mail</h1><p id="email-auth-copy">Como no ChatGPT, enviaremos um código único para confirmar seu acesso. Você poderá usar a prévia gratuita depois da confirmação.</p><form id="email-request-form"><label for="email-auth-input">Seu e-mail</label><input id="email-auth-input" type="email" autocomplete="email" inputmode="email" placeholder="voce@exemplo.com" required><button type="submit">Enviar código</button></form><form id="email-verify-form" hidden><label for="email-code-input">Código recebido</label><input id="email-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required><button type="submit">Confirmar e entrar</button><button type="button" class="email-back" id="email-back">Usar outro e-mail</button></form><div class="email-message" id="email-auth-message" role="status"></div><p class="email-hint">O código expira em 10 minutos. Confira também a pasta de spam.</p></section>';
    document.body.appendChild(overlay);
    const requestForm=$('#email-request-form'),verifyForm=$('#email-verify-form'),emailInput=$('#email-auth-input'),codeInput=$('#email-code-input'),message=$('#email-auth-message'),copy=$('#email-auth-copy'),back=$('#email-back');
    let email='';
    async function call(action,payload){
      const response=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||'Não foi possível concluir agora.');
      return body;
    }
    requestForm.onsubmit=async event=>{
      event.preventDefault();
      email=emailInput.value.trim().toLowerCase();
      if(!emailPattern.test(email)){message.textContent='Digite um e-mail válido.';return;}
      const button=requestForm.querySelector('button');button.disabled=true;message.textContent='Enviando o código...';
      try{await call('email-request',{email});requestForm.hidden=true;verifyForm.hidden=false;back.style.display='block';copy.textContent='Enviamos um código de seis números para '+email+'.';message.textContent='Confira sua caixa de entrada e a pasta de spam.';codeInput.focus();}
      catch(error){message.textContent=error.message;}
      finally{button.disabled=false;}
    };
    verifyForm.onsubmit=async event=>{
      event.preventDefault();
      const code=codeInput.value.replace(/\D/g,'');
      if(code.length!==6){message.textContent='Digite os seis números recebidos.';return;}
      const button=verifyForm.querySelector('button[type="submit"]');button.disabled=true;message.textContent='Confirmando...';
      try{
        const body=await call('email-verify',{email,code});
        localStorage.setItem(EMAIL_KEY,email);
        if(body.session){localStorage.setItem(SESSION_KEY,body.session);location.reload();return;}
        overlay.remove();
        message.textContent='';
        window.dispatchEvent(new CustomEvent('ontop-email-verified'));
      }catch(error){message.textContent=error.message;}
      finally{button.disabled=false;}
    };
    back.onclick=()=>{verifyForm.hidden=true;requestForm.hidden=false;back.style.display='none';codeInput.value='';message.textContent='';copy.textContent='Como no ChatGPT, enviaremos um código único para confirmar seu acesso. Você poderá usar a prévia gratuita depois da confirmação.';emailInput.focus();};
    emailInput.focus();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>mount(0),500));else setTimeout(()=>mount(0),500);
})();
