/* Planeta Express — Service Worker (rede primeiro)
   Sempre busca a versão mais nova quando há internet; usa o cache só offline.
   Isso evita ficar "preso" numa versão antiga. */
const CACHE = 'planeta-express-v11-7';

self.addEventListener('install', function(e){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
  );
});

/* ⚠️ v9.7 — "rede primeiro" NÃO bastava, e o cliente sentiu: publiquei a v9.6,
   o site já servia a v9.6, e no navegador dele continuava a versão velha.

   O motivo: o GitHub Pages manda `Cache-Control: max-age=600` em TUDO,
   inclusive no index.html. Um `fetch()` comum passa pelo cache HTTP do
   navegador — então a "rede" devolvia a cópia guardada, de até 10 minutos
   atrás, e o `Ctrl+Shift+R` não alcançava os arquivos que passam por aqui.

   `cache:'no-cache'` obriga a PERGUNTAR ao servidor sempre (revalida por
   ETag). Não é o mesmo que baixar tudo de novo: se nada mudou, o servidor
   responde 304 e o navegador reusa o que tem. Fica atualizado e leve. */
function buscarFresco(req){
  try{
    return fetch(new Request(req.url, {cache:'no-cache', credentials:'same-origin'}));
  }catch(e){
    return fetch(req);          /* navegador antigo: pelo menos tenta a rede */
  }
}
/* 🔴 v11.3 — ERA ISTO QUE DEIXAVA O CELULAR COM DADOS ANTIGOS.

   O cliente mandou dois prints lado a lado: computador com 135 viagens,
   celular com 119 — **mesma versão, v11.2, os dois marcados como "site"**.
   Não era versão velha: era este service worker.

   A busca ao banco de dados (`/rest/v1/dados?select=...` do Supabase) é um
   **GET**. Este `fetch` pegava TODO GET, guardava a resposta no cache e,
   quando a rede falhava — que no celular, em rede móvel, falha o tempo
   todo —, devolvia a **resposta guardada**. O sistema recebia aquilo como
   se fosse a nuvem respondendo: `_nuvemRecebida=true`, nenhum erro,
   nenhum aviso, e a tela montada com os dados de dias atrás.

   Pior ainda: o `|| caches.match('./index.html')` devolvia a PÁGINA HTML
   como resposta de uma chamada de API, e guardava dados da empresa no
   cache do navegador.

   ⚠️ REGRA: o service worker só cuida dos ARQUIVOS DO PRÓPRIO SITE.
   Banco de dados, login, arquivos na nuvem e CDN passam DIRETO, sem
   cache e sem intermediário. Dado vivo nunca pode vir de cache. */
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;

  var url;
  try{ url = new URL(e.request.url); }catch(_){ return; }

  /* Outra origem (Supabase, CDN…): não encosta. Deixa o navegador fazer. */
  if(url.origin !== self.location.origin) return;

  /* Mesma origem, mas não é arquivo do app (ex.: uma API futura): idem. */
  if(url.pathname.indexOf('/rest/') === 0 || url.pathname.indexOf('/auth/') === 0) return;

  e.respondWith(
    buscarFresco(e.request).then(function(resp){
      /* só guarda resposta boa; erro/redirect no cache vira armadilha */
      if(resp && resp.ok && resp.type === 'basic'){
        var copy = resp.clone();
        caches.open(CACHE).then(function(c){ try{ c.put(e.request, copy); }catch(_){} });
      }
      return resp;
    }).catch(function(){
      return caches.match(e.request).then(function(hit){
        if(hit) return hit;
        /* só faz sentido devolver a página para uma NAVEGAÇÃO */
        if(e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
