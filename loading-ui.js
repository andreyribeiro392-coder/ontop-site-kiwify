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
  function syncPreviewLabels(){
    if(!window.OnTopPreview)return;
    const quota=document.querySelector('#ai-remaining');if(quota)quota.textContent='5';const metric=document.querySelector('.command-strip>div:nth-child(4)');if(metric){const value=metric.querySelector('strong'),label=metric.querySelector('span');if(value)value.textContent='5';if(label)label.textContent='respostas na prévia';}
    document.querySelectorAll('p,small,span,strong,h3,h4').forEach(el=>{
      if(el.children.length)return;
      const text=el.textContent||'';
      const next=text.replace(/limite de 20 por dia/gi,'limite de 5 na prévia')
        .replace(/consome 1 das 20 perguntas diárias/gi,'consome 1 das 5 respostas da prévia')
        .replace(/Limite: 20 respostas por dia/gi,'Limite: 5 respostas na prévia');
      if(next!==text)el.textContent=next;
    });
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#pdf-generate');
    if(button&&!button.disabled){watch(button);button.classList.add('is-loading');}
  },true);
  new MutationObserver(()=>{watch(document.querySelector('#pdf-generate'));syncPreviewLabels()}).observe(document.documentElement,{subtree:true,childList:true});
  syncPreviewLabels();
})();
