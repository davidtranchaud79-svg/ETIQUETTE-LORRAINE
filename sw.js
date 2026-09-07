const CACHE='etiquette-lorraine-v9-platform';
const CORE=['./index.html','./manifest.webmanifest','./styles.css','./pdf40x30.js','./app.js'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(CORE);
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

async function refresh(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){
      const cache=await caches.open(CACHE);
      await cache.put(request,response.clone());
    }
    return response;
  }catch(_){return null}
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match('./index.html',{ignoreSearch:true});
      if(cached){event.waitUntil(refresh(request));return cached}
      const net=await refresh(request);
      if(net)return net;
      return new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:-apple-system;padding:24px"><h1>Étiquette Lorraine</h1><p>Le mode hors ligne n’est pas encore initialisé. Ouvre une fois l’application avec Internet, attends quelques secondes, puis réessaie.</p></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}})
    })());
    return;
  }

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached){event.waitUntil(refresh(request));return cached}
    const net=await refresh(request);
    return net||new Response('Ressource hors ligne indisponible',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})
  })());
});

self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='SKIP_WAITING'){self.skipWaiting();return}
  if(data.type==='DIAGNOSE'){
    event.waitUntil((async()=>{
      const cache=await caches.open(CACHE);
      const missing=[];
      for(const path of CORE){if(!(await cache.match(path,{ignoreSearch:true})))missing.push(path)}
      event.ports?.[0]?.postMessage({ok:missing.length===0,cache:CACHE,missing,core:CORE})
    })());
  }
});
