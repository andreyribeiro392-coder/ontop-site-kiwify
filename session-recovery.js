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


/* Separate Google sign-in screen */
(function(){
  const SESSION_KEY='ontop-session';
  const GOOGLE_KEY='ontop-google-email';
  const normalizeEmail=value=>String(value||'').trim().toLowerCase();
  const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  const query=new URLSearchParams(location.search);
  const sessionFromGoogle=query.get('google_session');
  const emailFromGoogle=normalizeEmail(query.get('google_email'));
  const errorFromGoogle=query.get('google_error');
  if(sessionFromGoogle)localStorage.setItem(SESSION_KEY,sessionFromGoogle);
  if(emailFromGoogle)localStorage.setItem(GOOGLE_KEY,emailFromGoogle);
  if(sessionFromGoogle||emailFromGoogle||errorFromGoogle)history.replaceState({},'',location.pathname);
  const alreadyVerified=()=>Boolean(localStorage.getItem(SESSION_KEY)||localStorage.getItem(GOOGLE_KEY));
  function loadGoogleScript(){
    if(window.google?.accounts?.id)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let settled=false;
      const timer=setTimeout(()=>finish(new Error('O Google demorou para carregar. Toque novamente para tentar.')),8000);
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve();};
      const check=()=>window.google?.accounts?.id?finish():finish(new Error('O navegador bloqueou o login Google. Permita accounts.google.com e tente novamente.'));
      const existing=document.querySelector('script[data-google-identity],script[src*="accounts.google.com/gsi/client"]');
      if(existing){
        if(window.google?.accounts?.id)return finish();
        existing.addEventListener('load',check,{once:true});
        existing.addEventListener('error',()=>finish(new Error('Não foi possível carregar o Google.')),{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src='https://accounts.google.com/gsi/client';
      script.async=true;script.defer=true;script.dataset.googleIdentity='1';
      script.onload=check;script.onerror=()=>finish(new Error('Não foi possível carregar o Google.'));
      document.head.appendChild(script);
    });
  }
  function mount(attempt){
    if(alreadyVerified()||document.querySelector('#email-auth-overlay'))return;
    const app=document.querySelector('#app');
    if(!app){if(attempt<30)setTimeout(()=>mount(attempt+1),300);return;}
    app.classList.add('hidden');
    document.body.classList.add('google-auth-active');
    const screen=document.createElement('div');
    screen.id='email-auth-overlay';
    screen.innerHTML='<main id="email-auth-card" role="dialog" aria-modal="true" aria-labelledby="email-auth-title"><div class="email-brand">ONTOP CENTRAL PLUS</div><h1 id="email-auth-title">Crie sua conta</h1><p id="email-auth-copy">Entre com seu e-mail e use sua conta Google para acessar a Central. Se o e-mail já tiver uma compra ativa, o Plano Plus será liberado automaticamente.</p><label for="google-email-input">Seu e-mail</label><input id="google-email-input" type="email" autocomplete="email" inputmode="email" placeholder="voce@exemplo.com"><div class="auth-divider"><span>ou</span></div><div id="google-auth-button" aria-label="Criar conta com Google"><button id="google-auth-fallback" type="button">Criar conta com Google</button></div><div class="email-message" id="email-auth-message" role="status"></div><p class="email-hint">O Google confirma sua identidade com segurança. Não pediremos sua senha.</p></main>';
    document.body.appendChild(screen);
    const button=screen.querySelector('#google-auth-button');
    const fallback=screen.querySelector('#google-auth-fallback');
    const emailInput=screen.querySelector('#google-email-input');
    const message=screen.querySelector('#email-auth-message');
    if(errorFromGoogle)message.textContent=errorFromGoogle;
    let busy=false;
    let ready=false;
    async function call(credential){
      const response=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'google-login',credential})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||'Não foi possível concluir agora.');
      return body;
    }
    async function start(openPrompt=false){
      if(busy&&!openPrompt)return;
      message.textContent='Carregando login Google...';
      try{
        const configResponse=await fetch('/api/access');
        const config=await configResponse.json().catch(()=>({}));
        if(!config.googleClientId){message.textContent='O login Google ainda não foi configurado na Vercel.';return;}
        await loadGoogleScript();
        if(!ready){
          button.innerHTML='';
          window.google.accounts.id.initialize({client_id:config.googleClientId,ux_mode:'popup',callback:async response=>{
            if(busy)return;
            busy=true;message.textContent='Confirmando sua conta...';
            try{
              const body=await call(response.credential);
              const typed=normalizeEmail(emailInput.value);
              if(typed&&typed!==normalizeEmail(body.email)){message.textContent='Use o mesmo e-mail selecionado na conta Google.';busy=false;return;}
              localStorage.setItem(GOOGLE_KEY,body.email||typed);
              if(body.session){localStorage.setItem(SESSION_KEY,body.session);location.reload();return;}
              screen.remove();app.classList.remove('hidden');document.body.classList.remove('google-auth-active');window.dispatchEvent(new CustomEvent('ontop-email-verified'));
            }catch(error){message.textContent=error.message;busy=false;}
          }});
          window.google.accounts.id.renderButton(button,{theme:'filled_black',size:'large',text:'signup_with',shape:'pill',width:Math.min(360,Math.max(260,button.clientWidth||320))});
          ready=true;
        }
        if(openPrompt)window.google.accounts.id.prompt();
        message.textContent='';
      }catch(error){
        if(button&&!button.querySelector('button'))button.innerHTML='<button id="google-auth-fallback" type="button">Criar conta com Google</button>';
        const retry=button?.querySelector('#google-auth-fallback');if(retry)retry.onclick=()=>{const email=normalizeEmail(emailInput.value);window.location.href='/api/access?action=google-start'+(email?'&email='+encodeURIComponent(email):'');};
        message.textContent=error.message||'Não foi possível carregar o login Google.';
      }
    }
    if(fallback)fallback.onclick=()=>{const email=normalizeEmail(emailInput.value);window.location.href='/api/access?action=google-start'+(email?'&email='+encodeURIComponent(email):'');};
    emailInput.focus();
    start(false);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>mount(0),350));else setTimeout(()=>mount(0),350);
})();
