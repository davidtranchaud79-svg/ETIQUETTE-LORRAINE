const CACHE='etiquette-lorraine-v8-offline';
const CORE=[
  './index.html',
  './manifest.webmanifest',
  './styles.css',
  './pdf40x30.js',
  './app.js',
  './freeze-module.js',
  './network-status.js'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(CORE.map(url=>cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function refreshInBackground(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response && response.ok){
      const cache=await caches.open(CACHE);
      await cache.put(request,response.clone());
    }
  }catch(_){ }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  // Démarrage de l'application : priorité à la copie locale.
  // Cela évite qu'iOS reste bloqué lorsqu'il n'y a aucun réseau.
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cached=await caches.match('./index.html',{ignoreSearch:true});
      if(cached){
        event.waitUntil(refreshInBackground(new Request('./index.html')));
        return cached;
      }
      try{
        const response=await fetch(request);
        if(response && response.ok){
          const cache=await caches.open(CACHE);
          await cache.put('./index.html',response.clone());
        }
        return response;
      }catch(_){
        return new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:-apple-system;padding:24px"><h1>Étiquette Lorraine</h1><p>Le mode hors ligne n’a pas encore été initialisé. Rouvre une fois l’application avec Internet, attends quelques secondes, puis réessaie.</p></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
      }
    })());
    return;
  }

  // Tous les fichiers nécessaires aux étiquettes sont servis depuis le cache.
  event.respondWith((async()=>{
    const cached=await caches.match(request,{ignoreSearch:true});
    if(cached){
      event.waitUntil(refreshInBackground(request));
      return cached;
    }
    try{
      const response=await fetch(request);
      if(response && response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(request,response.clone());
      }
      return response;
    }catch(_){
      return new Response('Ressource hors ligne indisponible',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING') self.skipWaiting();
});
