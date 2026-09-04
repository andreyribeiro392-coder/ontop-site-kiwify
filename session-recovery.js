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

/* Google sign-in gate */
(function(){
  const SESSION_KEY='ontop-session';
  const GOOGLE_KEY='ontop-google-email';
  const $=(root,selector)=>root.querySelector(selector);
  function alreadyVerified(){return Boolean(localStorage.getItem(SESSION_KEY)||localStorage.getItem(GOOGLE_KEY));}
  function loadGoogleScript(){
    if(window.google?.accounts?.id)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-google-identity],script[src*="accounts.google.com/gsi/client"]');
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const script=document.createElement('script');
      script.src='https://accounts.google.com/gsi/client';
      script.async=true;script.defer=true;script.dataset.googleIdentity='1';
      script.onload=resolve;script.onerror=()=>reject(new Error('Não foi possível carregar o Google.'));
      document.head.appendChild(script);
    });
  }
  function mount(attempt){
    if(alreadyVerified()||document.querySelector('#email-auth-overlay'))return;
    if(!document.querySelector('#app')){if(attempt<20)setTimeout(()=>mount(attempt+1),300);return;}
    localStorage.removeItem('ontop-email-verified');
    const overlay=document.createElement('div');
    overlay.id='email-auth-overlay';
    overlay.innerHTML='<section id="email-auth-card" role="dialog" aria-modal="true" aria-labelledby="email-auth-title"><div class="email-brand">ONTOP CENTRAL PLUS</div><h1 id="email-auth-title">Entre com o Google</h1><p id="email-auth-copy">Use sua conta Google para acessar a prévia gratuita. Se o e-mail já tiver uma compra ativa, o Plano Plus será liberado automaticamente.</p><div id="google-auth-button" aria-label="Entrar com Google"><button id="google-auth-fallback" type="button">Continuar com Google</button></div><div class="email-message" id="email-auth-message" role="status"></div><p class="email-hint">Seu e-mail será usado apenas para reconhecer o acesso e salvar seu progresso.</p></section>';
    document.body.appendChild(overlay);
    const button=$('#google-auth-button'),message=$('#email-auth-message'),fallback=$('#google-auth-fallback');
    let busy=false;
    async function call(credential){
      const response=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'google-login',credential})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||'Não foi possível concluir agora.');
      return body;
    }
    async function start(){
      message.textContent='Carregando login Google...';
      try{
        const configResponse=await fetch('/api/access');
        const config=await configResponse.json().catch(()=>({}));
        if(!config.googleClientId){message.textContent='O login Google ainda não foi configurado. Adicione GOOGLE_CLIENT_ID na Vercel.';return;}
        await loadGoogleScript();
        button.innerHTML='';
        google.accounts.id.initialize({client_id:config.googleClientId,callback:async response=>{
          if(busy)return;busy=true;message.textContent='Confirmando sua conta...';
          try{
            const body=await call(response.credential);
            localStorage.setItem(GOOGLE_KEY,body.email||'');
            if(body.session){localStorage.setItem(SESSION_KEY,body.session);location.reload();return;}
            overlay.remove();
            window.dispatchEvent(new CustomEvent('ontop-email-verified'));
          }catch(error){message.textContent=error.message;busy=false;}
        }});
        google.accounts.id.renderButton(button,{theme:'filled_black',size:'large',text:'continue_with',shape:'pill',width:Math.min(360,Math.max(260,button.clientWidth||320))});
      }catch(error){message.textContent=error.message||'Não foi possível carregar o login Google.';}
    }
    if(fallback)fallback.onclick=()=>start();
    start();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>mount(0),500));else setTimeout(()=>mount(0),500);
})();
