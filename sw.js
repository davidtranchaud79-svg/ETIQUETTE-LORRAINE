const CACHE='etiquette-lorraine-v7-network-status';
const CORE=[
  './',
  './index.html',
  './manifest.webmanifest',
  './styles.css',
  './app.js',
  './pdf40x30.js',
  './freeze-module.js',
  './network-status.js'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(CORE);
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

async function cachedText(url){
  const response=await caches.match(url,{ignoreSearch:true});
  if(!response) throw new Error('Ressource hors ligne absente : '+url);
  return response.text();
}

async function networkThenCache(request){
  const response=await fetch(request);
  if(response && response.ok){
    const cache=await caches.open(CACHE);
    cache.put(request,response.clone()).catch(()=>{});
  }
  return response;
}

async function combinedApp(request){
  let appText,freezeText,statusText;
  try{
    const [appResponse,freezeResponse,statusResponse]=await Promise.all([
      fetch(request,{cache:'no-store'}),
      fetch(new URL('./freeze-module.js',request.url),{cache:'no-store'}),
      fetch(new URL('./network-status.js',request.url),{cache:'no-store'})
    ]);
    if(!appResponse.ok || !freezeResponse.ok || !statusResponse.ok) throw new Error('Réseau indisponible');
    appText=await appResponse.text();
    freezeText=await freezeResponse.text();
    statusText=await statusResponse.text();

    const cache=await caches.open(CACHE);
    cache.put('./app.js',new Response(appText,{headers:{'Content-Type':'application/javascript; charset=utf-8'}})).catch(()=>{});
    cache.put('./freeze-module.js',new Response(freezeText,{headers:{'Content-Type':'application/javascript; charset=utf-8'}})).catch(()=>{});
    cache.put('./network-status.js',new Response(statusText,{headers:{'Content-Type':'application/javascript; charset=utf-8'}})).catch(()=>{});
  }catch(_){
    appText=await cachedText('./app.js');
    freezeText=await cachedText('./freeze-module.js');
    statusText=await cachedText('./network-status.js');
  }

  return new Response(appText+'\n\n'+freezeText+'\n\n'+statusText,{
    status:200,
    headers:{
      'Content-Type':'application/javascript; charset=utf-8',
      'Cache-Control':'no-store'
    }
  });
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  // app.js inclut automatiquement les modules Congélation et état réseau,
  // en ligne comme hors ligne.
  if(url.pathname.endsWith('/app.js')){
    event.respondWith(combinedApp(request));
    return;
  }

  // Navigation : réseau si disponible, sinon copie locale de l'application.
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await networkThenCache(request);
        return response;
      }catch(_){
        return await caches.match('./index.html') || await caches.match('./');
      }
    })());
    return;
  }

  // Ressources statiques : priorité au cache pour un démarrage immédiat sans réseau.
  event.respondWith((async()=>{
    const cached=await caches.match(request,{ignoreSearch:true});
    if(cached){
      // Mise à jour silencieuse quand Internet revient.
      event.waitUntil(networkThenCache(request).catch(()=>{}));
      return cached;
    }
    try{
      return await networkThenCache(request);
    }catch(_){
      return new Response('Hors ligne',{status:503,statusText:'Offline'});
    }
  })());
});

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING') self.skipWaiting();
});
