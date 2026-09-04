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