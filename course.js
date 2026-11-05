// The former paid OnTop experience remains available for previously issued access codes.
const legacyParams=['payment','payment_id','collection_id','google_session','google_email','google_error'];
if(legacyParams.some(key=>new URLSearchParams(location.search).has(key)))location.replace('/ontop-legacy.html'+location.search+location.hash);

const lessons=[
 {title:'Escolha uma história que pede continuação',tag:'Fundação',body:[
  'Comece com um conflito simples de entender em poucos segundos: alguém descobre uma mentira, recebe uma notícia inesperada ou precisa tomar uma decisão. Escreva em uma frase quem quer o quê e o que o impede.',
  'Planeje o destino da história antes de gerar imagens. Você não precisa mostrar esse destino no primeiro vídeo, mas precisa saber qual pergunta cada parte vai responder e qual pergunta vai deixar aberta.'
 ],points:['Uma pessoa protagonista e um desejo claro.','Um obstáculo que aparece já no começo.','Uma revelação guardada para a parte seguinte.'],task:'Escreva três ideias em uma frase cada. Escolha a que você conseguiria explicar a alguém sem contexto em dez segundos.'},
 {title:'Abra com um gancho nos primeiros segundos',tag:'Roteiro',body:[
  'Comece no acontecimento, sem vinheta ou explicação longa. A imagem e a primeira fala devem se completar: uma mostra a situação, a outra aumenta a pergunta. Se você iniciar com uma discussão, deixe claro quem está sendo confrontado e por quê.',
  'Teste a abertura sem o resto do vídeo. Se a cena inicial já entregar toda a resposta, guarde parte da informação. Se ela não disser nada, dê ao público um detalhe concreto que valha a pena descobrir.'
 ],points:['Ação compreensível sem introdução.','Uma fala curta com emoção e intenção.','Uma pergunta implícita que puxa a próxima cena.'],task:'Escreva duas aberturas para a mesma história e leia em voz alta. Fique com a que cria a pergunta mais forte sem confundir.'},
 {title:'Divida a história em cenas que avançam',tag:'Roteiro',body:[
  'Antes de escrever diálogos, faça uma lista de cenas. Para cada uma, anote apenas a novidade: decisão, pista, reação, mudança de lugar ou revelação. Se duas cenas entregam a mesma coisa, una as duas ou corte uma.',
  'Para uma cena de seis a dez segundos, mantenha poucos personagens falando e leia o texto com cronômetro. Deixe tempo para olhar, respirar e reagir. Um silêncio curto com expressão pode valer mais que uma frase explicativa.'
 ],points:['Uma informação nova por cena.','A fala cabe no tempo da imagem.','O final da parte muda o que o público espera.'],task:'Faça um mapa de nove cenas com uma linha para cada uma: imagem, fala, novidade e pergunta seguinte.'},
 {title:'Crie uma ficha fixa de personagens',tag:'Imagem',body:[
  'Registre idade aparente adulta, rosto, cabelo, roupa, acessórios, postura, voz e modo de falar. Quando um personagem reaparece, repita os elementos importantes da ficha em vez de confiar que a ferramenta vai lembrar.',
  'Crie primeiro imagens de referência com câmera média e rostos legíveis. Use as mesmas referências nas gerações seguintes. Confira mãos, objetos, roupas e posição de cada pessoa antes de transformar uma imagem em vídeo.'
 ],points:['Ficha visual e vocal para cada personagem.','Referência consistente de roupa e cenário.','Checagem de mãos e continuidade antes de animar.'],task:'Faça uma ficha de dois personagens da sua história e escolha uma imagem-base clara de cada um.'},
 {title:'Escreva prompts de imagem sem ambiguidade',tag:'Imagem',body:[
  'Descreva o que existe no quadro naquele instante: quem está à esquerda, quem está à direita, distância da câmera, expressão, iluminação e objetos. Uma referência para vídeo deve mostrar o momento anterior à ação principal quando você quer que a IA anime esse movimento.',
  'Peça um único momento visual. Tentar colocar acontecimentos de vários segundos em uma imagem estática costuma gerar confusão. Revise se o enquadramento deixa espaço para o movimento planejado.'
 ],points:['Um quadro, uma ação prestes a acontecer.','Câmera e posição dos personagens definidas.','Sem objetos ou pessoas extras no fundo.'],task:'Escreva a imagem da primeira cena como uma fotografia congelada um segundo antes da ação.'},
 {title:'Transforme a imagem em vídeo no Flow',tag:'Vídeo',body:[
  'Use a imagem de referência e peça movimento pequeno e observável: olhar, virar o corpo, avançar um passo, levantar a mão. Declare quem fala, como fala e quem fica em silêncio. Defina a duração e o enquadramento para aquela cena.',
  'Gere, assista inteira e corrija o problema específico. Se a voz muda, reforce o perfil vocal. Se o rosto troca, reduza cortes e movimento de câmera. Se sobra tempo vazio, ajuste a fala ou acrescente uma reação, sem acelerar até ficar artificial.'
 ],points:['Uma voz principal por vez.','Movimentos realizáveis no enquadramento.','Revisão do vídeo antes de seguir para a próxima cena.'],task:'Gere uma única cena, anote três defeitos concretos e reescreva somente o necessário para corrigir o maior.'},
 {title:'Monte com ritmo e som coerentes',tag:'Edição',body:[
  'Organize os arquivos na ordem do roteiro e nomeie cada cena. Ajuste os cortes para que uma fala não seja interrompida. Mantenha o volume das vozes consistente e use música apenas quando não disputar atenção com o diálogo.',
  'Assista primeiro sem olhar para a tela: você entende quem está falando? Depois assista sem som: as ações fazem sentido? Essas duas revisões ajudam a encontrar buracos de continuidade que passam despercebidos na edição.'
 ],points:['Fal falas completas e sem repetição.','Voz em destaque e música controlada.','Último quadro aponta para a próxima parte.'],task:'Veja seu vídeo duas vezes, uma sem som e outra só ouvindo. Corrija pelo menos uma quebra encontrada.'},
 {title:'Publique com título que cria pergunta',tag:'Publicação',body:[
  'Um bom título nomeia o conflito sem contar a solução. A descrição situa a história em uma frase e indica a parte correta. Capa e primeiro quadro devem prometer a mesma situação que o vídeo realmente entrega.',
  'Confira formato, legendas, volume e início do arquivo antes de postar. Acompanhe as regras atuais da plataforma e deixe claro quando o vídeo é gerado com IA, se a plataforma exigir sinalização.'
 ],points:['Título sem spoiler.','Primeiros segundos fortes mesmo sem legenda.','Revisão das regras e da publicação final.'],task:'Escreva três títulos para seu vídeo; descarte os que entregam a reviravolta.'},
 {title:'Leia a retenção e os comentários',tag:'Análise',body:[
  'Não decida se um vídeo funcionou apenas pela primeira hora. Observe onde as pessoas deixam de assistir e qual cena vem antes dessa queda. Leia comentários como perguntas do público: eles entenderam o conflito? Querem saber o que vem depois?',
  'Compare vídeos parecidos, mudando uma coisa por vez — abertura, duração ou ritmo. Guarde o que aprendeu para a próxima história. Evite copiar uma cena sem entender por que ela prendeu atenção.'
 ],points:['Identifique o ponto da maior queda.','Separe perguntas reais de reações genéricas.','Planeje um teste claro no vídeo seguinte.'],task:'Anote o segundo de maior queda e escreva uma hipótese simples para melhorar esse trecho.'},
 {title:'Prepare sua conta para monetização',tag:'Crescimento',body:[
  'Monetização é uma etapa de elegibilidade e revisão, não um botão no editor. Veja no aplicativo os requisitos atuais de idade, região, seguidores, visualizações, duração, originalidade e situação da conta antes de se inscrever.',
  'Guarde roteiro, prompts, imagens e arquivos de projeto para documentar seu processo. Use elementos que você criou ou tem direito de usar. Se uma plataforma recusar um vídeo ou uma conta, leia o motivo exibido, corrija o problema e use os canais oficiais de recurso quando houver.'
 ],points:['Critérios atuais verificados no próprio aplicativo.','Arquivos de produção guardados e organizados.','Nenhum resultado financeiro tratado como garantido.'],task:'Faça uma pasta com roteiro, imagens de referência, prompts e versão final do seu próximo vídeo.'}
];
// Correct a typo in one checklist before display.
lessons[6].points[0]='Falas completas e sem repetição.';

const templates=[
 {tag:'GPT / ROTEIRO',title:'Mapa de cenas',description:'Peça uma estrutura antes de pedir diálogos completos.',prompt:'Crie uma novela vertical original sobre [conflito]. Protagonista: [ficha]. Divida em 9 cenas de [duração] segundos. Para cada cena, descreva imagem inicial, ação, uma fala que caiba no tempo e a novidade da cena. Comece no conflito e termine com uma pergunta aberta. Não repita informações nem revele a solução cedo.'},
 {tag:'IMAGEM / REFERÊNCIA',title:'Quadro antes da ação',description:'Use o instante anterior ao movimento que será gerado no vídeo.',prompt:'Imagem vertical 9:16, estilo filme realista. [Personagem A, rosto e roupa] está [posição] diante de [Personagem B, rosto e roupa]. Câmera em plano médio aberto, mostrando mãos e espaço para o movimento. Ambiente: [cenário e luz]. Momento congelado imediatamente antes de [ação]. Dois personagens apenas, sem textos e sem objetos extras.'},
 {tag:'FLOW / VÍDEO',title:'Cena com voz e continuidade',description:'Um comando de vídeo por cena, com voz e movimento definidos.',prompt:'Create a [duration]-second vertical 9:16 video from this reference image. Keep the same two adult characters, faces, clothing, room and camera side throughout. One continuous medium-wide shot. First 20%: [movement]. Middle 60%: [character] says in natural Brazilian Portuguese, with a consistent [voice profile]: “[dialogue sized for the duration]”. Final 20%: [reaction]. Only that character speaks. No repeated dialogue, no new people, no extra hands, no captions.'}
];

const $=selector=>document.querySelector(selector);
const storageKey='novelsday-course-progress-v1';
let done=new Set();
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))done=new Set(saved.filter(n=>Number.isInteger(n)&&n>=0&&n<lessons.length))}catch{}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function updateProgress(){const n=done.size;$('#progress-label').textContent=`${n} de ${lessons.length} aulas concluídas`;$('#progress-fill').style.width=`${n/lessons.length*100}%`;$('#progress-track').setAttribute('aria-valuenow',String(n))}
function renderLessons(query=''){
 const normalized=query.trim().toLocaleLowerCase('pt-BR');const container=$('#lesson-list');const matches=lessons.map((lesson,index)=>({...lesson,index})).filter(item=>!normalized||[item.title,item.tag,...item.body,...item.points].join(' ').toLocaleLowerCase('pt-BR').includes(normalized));
 container.innerHTML=matches.length?matches.map(item=>`<details class="lesson" id="aula-${item.index+1}"><summary><span class="lesson-number">${String(item.index+1).padStart(2,'0')}</span><span class="lesson-title">${escapeHtml(item.title)}</span><span class="lesson-meta">${escapeHtml(item.tag)}</span><span class="lesson-chevron" aria-hidden="true">+</span></summary><div class="lesson-body">${item.body.map(p=>`<p>${escapeHtml(p)}</p>`).join('')}<ul>${item.points.map(p=>`<li>${escapeHtml(p)}</li>`).join('')}</ul><div class="lesson-task"><strong>AGORA É SUA VEZ</strong><p>${escapeHtml(item.task)}</p></div><button type="button" class="complete-button" data-complete="${item.index}" aria-pressed="${done.has(item.index)}">${done.has(item.index)?'✓ Aula concluída':'Marcar como concluída'}</button></div></details>`).join(''):'<p class="lesson-empty">Nenhuma aula encontrada. Tente outra palavra.</p>';
 updateProgress();
}
function renderTemplates(){$('#template-list').innerHTML=templates.map((item,index)=>`<article class="template"><span class="template-tag">${escapeHtml(item.tag)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><pre>${escapeHtml(item.prompt)}</pre><button class="copy-button" data-copy="${index}" type="button">Copiar modelo ↗</button></article>`).join('')}
let toastTimer;function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
$('#lesson-list').addEventListener('click',event=>{const button=event.target.closest('[data-complete]');if(!button)return;const id=Number(button.dataset.complete);if(done.has(id))done.delete(id);else done.add(id);try{localStorage.setItem(storageKey,JSON.stringify([...done]))}catch{toast('Seu navegador não permitiu salvar o progresso.')}button.setAttribute('aria-pressed',String(done.has(id)));button.textContent=done.has(id)?'✓ Aula concluída':'Marcar como concluída';updateProgress()});
async function copyText(value){
 try{if(!navigator.clipboard?.writeText)throw Error('Clipboard API indisponível');await navigator.clipboard.writeText(value)}
 catch{const field=document.createElement('textarea');field.value=value;field.setAttribute('readonly','');field.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(field);field.select();const copied=document.execCommand('copy');field.remove();if(!copied)throw Error('Cópia bloqueada')}
}
$('#template-list').addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button)return;const item=templates[Number(button.dataset.copy)];if(!item)return;try{await copyText(item.prompt);toast('Modelo copiado. Personalize antes de usar.')}catch{toast('Não foi possível copiar automaticamente. Selecione o texto do modelo.')}});
$('#lesson-search').addEventListener('input',event=>renderLessons(event.target.value));
$('#year').textContent=new Date().getFullYear();
renderLessons();renderTemplates();
if(location.hash.startsWith('#aula-')){const lesson=$(location.hash);if(lesson){lesson.open=true;setTimeout(()=>lesson.scrollIntoView(),0)}}
const navLinks=[...document.querySelectorAll('.mobile-nav a')];function highlightNav(){const current=[...navLinks].reverse().find(a=>{const target=$(a.getAttribute('href'));return target&&target.getBoundingClientRect().top<innerHeight*.4})||navLinks[0];navLinks.forEach(a=>a===current?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'))}
addEventListener('scroll',highlightNav,{passive:true});highlightNav();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
