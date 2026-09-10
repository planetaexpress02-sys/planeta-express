/* Planeta Express — Service Worker (rede primeiro)
   Sempre busca a versão mais nova quando há internet; usa o cache só offline.
   Isso evita ficar "preso" numa versão antiga. */
const CACHE = 'planeta-express-v10-2';

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
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  e.respondWith(
    buscarFresco(e.request).then(function(resp){
      var copy = resp.clone();
      caches.open(CACHE).then(function(c){ try{ c.put(e.request, copy); }catch(_){} });
      return resp;
    }).catch(function(){
      return caches.match(e.request).then(function(hit){ return hit || caches.match('./index.html'); });
    })
  );
});
