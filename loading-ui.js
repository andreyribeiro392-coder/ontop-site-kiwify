// Loading feedback for long-running PDF generation
(function(){
  function watch(button){
    if(!button||button.dataset.loadingUi)return;
    button.dataset.loadingUi='1';
    const observer=new MutationObserver(()=>{
      if(/Gerar PDF detalhado/i.test(button.textContent||''))button.classList.remove('is-loading');
    });
    observer.observe(button,{subtree:true,childList:true,characterData:true});
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#pdf-generate');
    if(button&&!button.disabled){watch(button);button.classList.add('is-loading');}
  },true);
  new MutationObserver(()=>watch(document.querySelector('#pdf-generate'))).observe(document.documentElement,{subtree:true,childList:true});
})();
