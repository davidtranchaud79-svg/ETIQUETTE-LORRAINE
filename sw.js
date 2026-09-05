const CACHE='etiquette-lorraine-v5';
const ASSETS=['./','./index.html','./manifest.webmanifest','./styles.css','./app.js','./pdf40x30.js','./freeze-module.js'];

self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',e=>e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

async function textFromNetworkOrCache(request,fallbackUrl){
  try{
    const r=await fetch(request);
    if(r.ok){
      const clone=r.clone();
      caches.open(CACHE).then(c=>c.put(request,clone));
      return await r.text();
    }
  }catch(_){ }
  const cached=await caches.match(request) || await caches.match(fallbackUrl);
  if(!cached) throw new Error('Ressource indisponible');
  return await cached.text();
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);

  // Charge app.js puis ajoute le module Congélation 3 mois dans le même script.
  // Cela permet de mettre à jour l'application installée sans casser le reste.
  if(url.pathname.endsWith('/app.js')){
    e.respondWith((async()=>{
      try{
        const [app,freeze]=await Promise.all([
          textFromNetworkOrCache(e.request,'./app.js'),
          textFromNetworkOrCache(new Request(new URL('./freeze-module.js',e.request.url)),'./freeze-module.js')
        ]);
        return new Response(app+'\n\n'+freeze,{
          headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache'}
        });
      }catch(_){
        return caches.match('./app.js');
      }
    })());
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(resp=>{
        const clone=resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return resp;
      })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});
