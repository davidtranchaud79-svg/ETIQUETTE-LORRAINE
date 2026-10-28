(async function(){
  const ASSET_VERSION='5.6.0';
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src+(src.includes('?')?'&':'?')+'v='+ASSET_VERSION;s.onload=resolve;s.onerror=()=>reject(new Error('Chargement impossible : '+src));document.head.appendChild(s)})}
  try{
    await load('./core-v4.js');
    await load('./print-v4.js');
    await load('./data-v4.js');
    await load('./settings-v4.js');
    await load('./platform-v4.js');
    await load('./printer-v4.js');
    await load('./direct-print-v5.js');
    await load('./dlc-reminders-v1.js');
    await load('./tracking-v1.js');
    await load('./dashboard-v1.js');
    await load('./bulk-products-v1.js');
    await load('./inventory-v1.js');
    await init();
    window.ELDlcReminders?.init?.();
    window.ELTrackingInit?.();
    window.ELDashboardInit?.();
    window.ELBulkProductsInit?.();
    window.ELInventoryInit?.();
    if(typeof initPrinterModule==='function')await initPrinterModule();
    if(typeof initDirectPrint==='function')await initDirectPrint();
    setTimeout(()=>window.ELPrinter?.render?.(),0);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>window.ELPrinter?.render?.(),{once:true});
  }catch(e){
    console.error(e);
    const t=document.getElementById('toast');
    if(t){t.textContent='Erreur de chargement de l’application';t.classList.add('show')}
  }
})();
