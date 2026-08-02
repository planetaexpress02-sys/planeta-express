/* Planeta Express — Service Worker (rede primeiro)
   Sempre busca a versão mais nova quando há internet; usa o cache só offline.
   Isso evita ficar "preso" numa versão antiga. */
const CACHE = 'planeta-express-v6-18';

self.addEventListener('install', function(e){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function(resp){
      var copy = resp.clone();
      caches.open(CACHE).then(function(c){ try{ c.put(e.request, copy); }catch(_){} });
      return resp;
    }).catch(function(){
      return caches.match(e.request).then(function(hit){ return hit || caches.match('./index.html'); });
    })
  );
});
