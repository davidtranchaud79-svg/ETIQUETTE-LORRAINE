// Compatibilité iPhone + Android pour Étiquette Lorraine V4.
(function(){
  let deferredInstallPrompt=null;
  const ua=navigator.userAgent||'';
  const isAndroid=/Android/i.test(ua);
  const isIOS=/iPhone|iPad|iPod/i.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;

  function platformName(){return isAndroid?'Android':isIOS?'iPhone / iPad':'Navigateur'}

  function makeInstallCard(){
    if(document.getElementById('platformInstallCard'))return;
    const settings=document.querySelector('[data-view="settings"]');
    if(!settings)return;
    const heading=settings.querySelector('.section-heading');
    const card=document.createElement('div');
    card.id='platformInstallCard';
    card.className='card settings-card platform-card';
    card.innerHTML=`
      <div class="card-title-row">
        <div><h3>Installation ${platformName()}</h3><p id="platformInstallText"></p></div>
        <button id="platformInstallBtn" class="primary-btn compact hidden">Installer</button>
      </div>
      <small id="platformInstallStatus" class="muted-line"></small>`;
    heading?.insertAdjacentElement('afterend',card);
    document.getElementById('platformInstallBtn')?.addEventListener('click',installApp);
    renderInstallState();
  }

  function renderInstallState(){
    const text=document.getElementById('platformInstallText');
    const status=document.getElementById('platformInstallStatus');
    const btn=document.getElementById('platformInstallBtn');
    if(!text||!status||!btn)return;
    btn.classList.add('hidden');
    if(isStandalone()){
      text.textContent='Étiquette Lorraine est installée comme application.';
      status.textContent='Mode application actif · hors ligne disponible après initialisation.';
      return;
    }
    if(isAndroid){
      text.textContent='Sur Android, l’application peut être installée depuis Chrome et fonctionne ensuite comme une vraie PWA.';
      status.textContent=deferredInstallPrompt?'Installation prête.':'Dans Chrome : menu ⋮ → Installer l’application / Ajouter à l’écran d’accueil.';
      if(deferredInstallPrompt)btn.classList.remove('hidden');
      return;
    }
    if(isIOS){
      text.textContent='Sur iPhone/iPad, installe l’application depuis Safari.';
      status.textContent='Safari → Partager → Sur l’écran d’accueil.';
      return;
    }
    text.textContent='L’application peut être utilisée dans le navigateur et installée si le navigateur prend en charge les PWA.';
    status.textContent='Utilise la fonction Installer / Ajouter à l’écran d’accueil du navigateur.';
  }

  async function installApp(){
    if(!deferredInstallPrompt)return;
    try{
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
    }catch(_){ }
    deferredInstallPrompt=null;
    renderInstallState();
  }

  function adaptSyncUI(){
    const syncEnabled=document.getElementById('syncEnabled');
    const card=syncEnabled?.closest('.settings-card');
    if(card){
      const h3=card.querySelector('h3');
      const p=card.querySelector('h3 + p');
      if(h3)h3.textContent='Synchronisation iPhone + Android';
      if(p)p.textContent='Optionnelle. Plusieurs appareils partagent la même base quand Internet revient, tout en restant autonomes hors ligne.';
    }
    const device=document.getElementById('deviceName');
    if(device){
      device.placeholder=isAndroid?'Cuisine - Android 1':isIOS?'Cuisine - iPhone 1':'Cuisine - Appareil 1';
    }
  }

  function adaptHelp(){
    const help=document.querySelector('[data-view="help"] .steps-card ol');
    if(!help)return;
    if(isAndroid){
      help.innerHTML=`
        <li>Prépare l’étiquette.</li>
        <li>Touche <strong>Envoyer vers Print Master</strong>.</li>
        <li>Dans le partage Android, choisis <strong>Print Master</strong> s’il apparaît.</li>
        <li>S’il n’apparaît pas, enregistre le PDF puis ouvre-le depuis <strong>Impression PDF</strong> dans Print Master.</li>
        <li>Vérifie que le format d’impression correspond au format choisi dans Étiquette Lorraine.</li>`;
    }else if(isIOS){
      help.innerHTML=`
        <li>Prépare l’étiquette.</li>
        <li>Touche <strong>Envoyer vers Print Master</strong>.</li>
        <li>Dans iOS, choisis <strong>Enregistrer dans…</strong> puis <strong>Print Master</strong>.</li>
        <li>Dans Print Master, ouvre <strong>Impression PDF</strong>.</li>
        <li>Vérifie que le format d’impression correspond au format choisi dans Étiquette Lorraine.</li>`;
    }
  }

  function addPlatformBadge(){
    const strip=document.getElementById('networkStrip');
    if(!strip||document.getElementById('platformBadge'))return;
    const badge=document.createElement('span');
    badge.id='platformBadge';
    badge.className='platform-badge';
    badge.textContent=platformName();
    strip.appendChild(badge);
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredInstallPrompt=e;
    renderInstallState();
  });
  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    renderInstallState();
  });

  function initPlatform(){makeInstallCard();adaptSyncUI();adaptHelp();addPlatformBadge();renderInstallState()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPlatform,{once:true});
  else initPlatform();

  window.ELPlatform={isAndroid,isIOS,isStandalone,platformName};
})();
