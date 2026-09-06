// Indicateur réseau / mode hors ligne pour Étiquette Lorraine.
(function(){
  const STYLE_ID='network-status-style';

  function installStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .status-strip.connection-online{background:#edf5f0;border-color:#c4ddcc;color:#486452}
      .status-strip.connection-online .dot{background:#2d6c48;box-shadow:0 0 0 3px rgba(45,108,72,.12)}
      .status-strip.connection-offline{background:#fff4df;border-color:#e9c989;color:#76551b}
      .status-strip.connection-offline .dot{background:#d58a12;box-shadow:0 0 0 3px rgba(213,138,18,.14)}
      .status-strip.connection-preparing{background:#f0eeea;border-color:#d8d5cf;color:#6b6b72}
      .status-strip.connection-preparing .dot{background:#8b8b92}
    `;
    document.head.appendChild(style);
  }

  function strip(){return document.querySelector('.status-strip')}

  function setStatus(mode,detail){
    const el=strip();
    if(!el) return;
    el.classList.remove('connection-online','connection-offline','connection-preparing');
    el.classList.add('connection-'+mode);
    const strong=el.querySelector('strong');
    const span=el.querySelector('span:last-child');
    if(strong) strong.textContent=mode==='offline'?'Mode hors ligne':mode==='online'?'En ligne':'Préparation hors ligne';
    if(span) span.textContent=detail;
    el.setAttribute('aria-label',(strong?.textContent||'')+' — '+detail);
  }

  function updateConnection(){
    if(navigator.onLine){
      setStatus('online','Application prête, fonctionnement hors ligne disponible');
    }else{
      setStatus('offline','Produits, calculs et PDF restent disponibles localement');
    }
  }

  async function verifyOfflineReady(){
    installStyle();
    if(!('serviceWorker' in navigator)){
      setStatus(navigator.onLine?'online':'offline',navigator.onLine?'En ligne · mode hors ligne non pris en charge':'Connexion absente');
      return;
    }
    if(navigator.onLine) setStatus('preparing','Vérification du cache local…');
    try{
      await navigator.serviceWorker.ready;
      updateConnection();
    }catch(_){
      updateConnection();
    }
  }

  window.addEventListener('online',updateConnection);
  window.addEventListener('offline',updateConnection);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) updateConnection()});

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',verifyOfflineReady,{once:true});
  else verifyOfflineReady();
})();
