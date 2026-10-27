// Suivi DLC local : alerte uniquement le jour de la date limite.
// Un envoi accepté par l'imprimante n'est pas une confirmation physique de sortie.
(function(){
  'use strict';
  const KEY='el.dlcReminders.v1';
  const LIMIT=3000;
  let records=[];
  const byId=id=>document.getElementById(id);
  const today=()=>{
    const d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  };
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):String(s||'');
  function load(){
    try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');records=Array.isArray(x)?x:[]}
    catch(_){records=[]}
  }
  function save(){
    localStorage.setItem(KEY,JSON.stringify(records.slice(0,LIMIT)));
  }
  function due(){return records.filter(r=>r.status==='active'&&r.dlc===today())}
  function overdue(){return records.filter(r=>r.status==='active'&&r.dlc<today())}
  function card(){
    if(byId('elDlcReminderCard'))return;
    const history= document.querySelector('[data-view="history"]');
    if(!history)return;
    const c=document.createElement('div');
    c.id='elDlcReminderCard';
    c.className='card settings-card';
    c.innerHTML='<h3>Suivi des DLC imprimées</h3><p>Rappel uniquement le jour de la DLC. Les produits dépassés restent signalés jusqu’à clôture.</p>'+
      '<p id="elDlcReminderSummary" role="status" aria-live="polite"></p>'+
      '<div id="elDlcReminderList" class="stack"></div>';
    const heading=history.querySelector('.section-heading');
    if(heading)heading.insertAdjacentElement('afterend',c);
    else history.prepend(c);
    c.addEventListener('click',async e=>{
      const b=e.target.closest('button[data-dlc-id]');
      if(!b)return;
      const r=records.find(x=>x.id===b.dataset.dlcId);
      if(!r||r.status!=='active')return;
      if(b.dataset.action==='discarded'){
        const raw=prompt('Quantité réellement jetée (en unité physique, pas en nombre d’étiquettes) :','1');
        if(raw===null)return;
        const qty=Number(raw.replace(',','.'));
        if(!Number.isFinite(qty)||qty<=0)return alert('Quantité invalide');
        const unit=prompt('Unité (kg, g, pièce, L, mL, portion) :','pièce');
        if(unit===null)return;
        const allowed=['kg','g','pièce','L','mL','portion'];
        if(!allowed.includes(unit.trim()))return alert('Unité non reconnue');
        if(!window.ELTracking?.addLoss?.({source:'DLC',sourceId:r.id,date:today(),product:r.product,qty,unit:unit.trim(),reason:'DLC dépassée',lot:r.lot||'',initials:(document.getElementById('initials')?.value||r.initials||'').trim().toUpperCase(),comment:'Clôture du suivi DLC '+r.dlc}))return alert('Perte déjà enregistrée ou module indisponible');
      }
      r.status=b.dataset.action==='used'?'used':'discarded';
      r.closedAt=new Date().toISOString();
      save();render();window.ELTracking?.refresh?.();
    });
  }
  function render(){
    card();
    const summary=byId('elDlcReminderSummary'),list=byId('elDlcReminderList');
    if(!summary||!list)return;
    const d=due(),o=overdue();
    summary.textContent=d.length+' lot(s) à DLC aujourd’hui · '+o.length+' lot(s) dépassé(s).';
    const active=[...o,...d].sort((a,b)=>a.dlc.localeCompare(b.dlc)||a.product.localeCompare(b.product));
    list.innerHTML=active.length?active.map(r=>
      '<div class="history-item"><div class="item-main"><div class="item-title">'+escapeHtml(r.product)+' · '+(r.dlc<today()?'DLC DÉPASSÉE':'DLC AUJOURD’HUI')+'</div>'+
      '<div class="item-meta">DLC : '+formatDate(r.dlc)+' · Lot : '+escapeHtml(r.lot||'—')+' · '+r.qty+' étiquette(s) · '+escapeHtml(r.initials||'—')+'</div></div>'+
      '<div class="item-actions"><button class="mini-btn" data-dlc-id="'+escapeHtml(r.id)+'" data-action="used">Utilisé</button>'+
      '<button class="mini-btn danger" data-dlc-id="'+escapeHtml(r.id)+'" data-action="discarded">Jeté</button></div></div>'
    ).join(''):'<p>Aucune DLC à contrôler aujourd’hui.</p>';
    // Rappel visible dans l'application, pas une notification système Android.
    const nav=document.querySelector('.nav-btn[data-target="history"]');
    if(nav)nav.setAttribute('aria-label','Historique, '+d.length+' DLC aujourd’hui');
  }
  async function track(items,transport){
    const valid=(items||[]).filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.dlc||'')&&x.type!=='Allergènes'&&x.type!=='Produit sec');
    if(!valid.length)return;
    for(const x of valid)records.unshift({
      id:(crypto.randomUUID?.()||Date.now()+'-'+Math.random()),
      createdAt:new Date().toISOString(),product:String(x.product||'Produit'),productId:x.productId||'',
      type:x.type||'',dlc:x.dlc,lot:x.lot||'',initials:x.initials||'',
      qty:Math.max(1,Number(x.qty)||1),transport:transport||'Bluetooth',status:'active'
    });
    records=records.slice(0,LIMIT);save();render();
  }
  function init(){
    load();render();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
    window.addEventListener('focus',render);
    window.addEventListener('pageshow',render);
  }
  window.ELDlcReminders={init,track,render,getDue:()=>due().slice(),getRecords:()=>records.slice()};
})();
