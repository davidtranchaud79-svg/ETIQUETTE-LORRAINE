// Suivi DLC local, validation des pertes et notifications Android.
(function(){
'use strict';
const KEY='el.dlcReminders.v1', LIMIT=3000, NOTICE_PREFIX=170000000;
let records=[],noticeBusy=false;
const by=id=>document.getElementById(id);
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const offsetDate=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);const dt=new Date(y,m-1,d+n);return [dt.getFullYear(),String(dt.getMonth()+1).padStart(2,'0'),String(dt.getDate()).padStart(2,'0')].join('-')};
const dateAt=(iso,hour=8)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d,hour,0,0)};
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):String(s||'');
function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');records=Array.isArray(v)?v:[]}catch(_){records=[]}}
function save(){localStorage.setItem(KEY,JSON.stringify(records.slice(0,LIMIT)));window.dispatchEvent(new Event('el:dlc-changed'))}
const active=()=>records.filter(r=>r.status==='active');
const due=()=>active().filter(r=>r.dlc===today());
const overdue=()=>active().filter(r=>r.dlc<today());
const tomorrow=()=>active().filter(r=>r.dlc===offsetDate(today(),1));
const pending=()=>records.filter(r=>r.status==='pending_loss');
function notificationPlugin(){return window.Capacitor?.Plugins?.LocalNotifications||null}
async function permissionStatus(){const plugin=notificationPlugin();if(!plugin)return 'unavailable';try{return (await plugin.checkPermissions()).display||'prompt'}catch(_){return 'unavailable'}}
function notifyStatus(message){const target=by('elDlcNotificationStatus');if(target)target.textContent=message}
async function scheduleNotifications(){
 const plugin=notificationPlugin();if(!plugin||noticeBusy)return;
 if(await permissionStatus()!=='granted'){notifyStatus('Notifications non autorisées sur cet appareil.');return}
 noticeBusy=true;
 try{
  const existing=await plugin.getPending();const own=(existing.notifications||[]).filter(n=>n.id>=NOTICE_PREFIX&&n.id<NOTICE_PREFIX+1000000);
  if(own.length)await plugin.cancel({notifications:own.map(n=>({id:n.id}))});
  const groups=new Map(),now=new Date();
  for(const r of active()){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(r.dlc||''))continue;
   for(const [kind,iso] of [['tomorrow',offsetDate(r.dlc,-1)],['due',r.dlc]]){
    const at=dateAt(iso);if(at<=now)continue;
    const key=kind+':'+iso;if(!groups.has(key))groups.set(key,{kind,iso,items:[]});groups.get(key).items.push(r);
   }
  }
  // Android limite le nombre de notifications programmées. Priorité aux prochaines échéances.
  const selected=[...groups.values()].sort((a,b)=>a.iso.localeCompare(b.iso)||a.kind.localeCompare(b.kind)).slice(0,60);
  const notifications=selected.map((g,i)=>({id:NOTICE_PREFIX+i,title:g.kind==='tomorrow'?'Étiquette Lorraine · DLC demain':'Étiquette Lorraine · DLC aujourd’hui',body:g.items.length+' lot(s) à contrôler'+(g.items.length===1?' : '+g.items[0].product:''),schedule:{at:dateAt(g.iso)},extra:{target:'dashboard',date:g.iso}}));
  if(notifications.length)await plugin.schedule({notifications});
  notifyStatus('Notifications Android activées · '+notifications.length+' rappel(s) programmés à 8 h.');
 }catch(err){console.error('Notifications DLC',err);notifyStatus('Programmation des notifications impossible : '+(err.message||err))}
 finally{noticeBusy=false}
}
async function activateNotifications(){
 const plugin=notificationPlugin();if(!plugin){notifyStatus('Notifications système disponibles uniquement dans l’application Android installée.');return}
 try{
  const result=await plugin.requestPermissions();
  if(result.display!=='granted'){notifyStatus('Autorisation refusée. Active les notifications dans les paramètres Android.');return}
  await scheduleNotifications();
 }catch(err){notifyStatus('Impossible d’activer les notifications : '+(err.message||err))}
}
function card(){
 if(by('elDlcReminderCard'))return;
 const history=document.querySelector('[data-view="history"]');if(!history)return;
 const c=document.createElement('div');c.id='elDlcReminderCard';c.className='card settings-card';
 c.innerHTML='<h3>Contrôle des DLC</h3><p>Rappel la veille et le jour de la DLC. Les lots dépassés restent visibles jusqu’au contrôle. Une DLC ne devient jamais automatiquement une perte.</p>'+
 '<div class="button-row"><button type="button" class="secondary-btn" id="elDlcEnableNotifications">Activer les notifications Android</button></div>'+
 '<p class="muted-line" id="elDlcNotificationStatus" role="status"></p>'+
 '<p id="elDlcReminderSummary" role="status" aria-live="polite"></p><div id="elDlcReminderList" class="stack"></div>';
 const heading=history.querySelector('.section-heading');if(heading)heading.insertAdjacentElement('afterend',c);else history.prepend(c);
 by('elDlcEnableNotifications').addEventListener('click',activateNotifications);
 c.addEventListener('click',async e=>{
  const b=e.target.closest('button[data-dlc-id]');if(!b)return;
  const r=records.find(x=>x.id===b.dataset.dlcId);if(!r)return;
  const action=b.dataset.action;
  if(action==='used'&&['active','pending_loss'].includes(r.status)){
   if(!confirm('Confirmer que « '+r.product+' » a été utilisé et ne constitue pas une perte ?'))return;
   r.status='used';r.closedAt=new Date().toISOString();delete r.pendingAt;
  }else if(action==='propose'&&r.status==='active'){
   r.status='pending_loss';r.pendingAt=new Date().toISOString();
  }else if(action==='cancel'&&r.status==='pending_loss'){
   r.status='active';delete r.pendingAt;
  }else if(action==='approve'&&r.status==='pending_loss'){
   const raw=prompt('Quantité réellement jetée (pas le nombre d’étiquettes) :','1');if(raw===null)return;
   const qty=Number(raw.replace(',','.'));if(!Number.isFinite(qty)||qty<=0)return alert('Quantité invalide');
   const unit=prompt('Unité (kg, g, pièce, L, mL, portion) :','pièce');if(unit===null)return;
   if(!['kg','g','pièce','L','mL','portion'].includes(unit.trim()))return alert('Unité invalide');
   if(!confirm('Valider la perte de '+qty+' '+unit.trim()+' de « '+r.product+' » ?'))return;
   const actor=(document.getElementById('initials')?.value||r.initials||'').trim().toUpperCase();
   if(!window.ELTracking?.addLoss?.({source:'DLC',sourceId:r.id,date:today(),product:r.product,qty,unit:unit.trim(),reason:'DLC dépassée / non utilisée',lot:r.lot||'',initials:actor,comment:'Perte DLC validée (DLC '+r.dlc+')'}))return alert('Impossible d’enregistrer la perte, ou perte déjà existante.');
   r.status='discarded';r.closedAt=new Date().toISOString();r.approvedBy=actor;r.approvedAt=r.closedAt;
  }else return;
  save();render();window.ELTracking?.refresh?.();window.ELDashboard?.refresh?.();await scheduleNotifications();
 });
}
function render(){
 card();const summary=by('elDlcReminderSummary'),list=by('elDlcReminderList');if(!summary||!list)return;
 const t=tomorrow(),d=due(),o=overdue(),p=pending();
 summary.textContent=t.length+' DLC demain · '+d.length+' aujourd’hui · '+o.length+' dépassée(s) · '+p.length+' perte(s) à valider.';
 const items=[...p,...o,...d,...t].sort((a,b)=>a.dlc.localeCompare(b.dlc)||a.product.localeCompare(b.product));
 list.innerHTML=items.length?items.map(r=>{
  const label=r.status==='pending_loss'?'PERTE À VALIDER':r.dlc<today()?'DLC DÉPASSÉE':r.dlc===today()?'DLC AUJOURD’HUI':'DLC DEMAIN';
  const buttons=r.status==='pending_loss'?'<button class="mini-btn" data-dlc-id="'+escapeHtml(r.id)+'" data-action="cancel">Annuler proposition</button><button class="mini-btn" data-dlc-id="'+escapeHtml(r.id)+'" data-action="used">Utilisé</button><button class="mini-btn danger" data-dlc-id="'+escapeHtml(r.id)+'" data-action="approve">Valider la perte</button>':'<button class="mini-btn" data-dlc-id="'+escapeHtml(r.id)+'" data-action="used">Utilisé</button><button class="mini-btn danger" data-dlc-id="'+escapeHtml(r.id)+'" data-action="propose">Proposer en perte</button>';
  return '<div class="history-item"><div class="item-main"><div class="item-title">'+escapeHtml(r.product)+' · '+label+'</div><div class="item-meta">DLC : '+formatDate(r.dlc)+' · Lot : '+escapeHtml(r.lot||'—')+' · '+r.qty+' étiquette(s) · '+escapeHtml(r.initials||'—')+'</div></div><div class="item-actions">'+buttons+'</div></div>';
 }).join(''):'<p>Aucune DLC à contrôler ni perte en attente.</p>';
 const nav=document.querySelector('.nav-btn[data-target="history"]');if(nav)nav.setAttribute('aria-label','Suivi, '+(d.length+o.length+p.length)+' DLC ou pertes à contrôler');
}
async function track(items,transport){
 const valid=(items||[]).filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.dlc||'')&&x.type!=='Allergènes'&&x.type!=='Produit sec');
 if(!valid.length)return;
 for(const x of valid)records.unshift({id:(crypto.randomUUID?.()||Date.now()+'-'+Math.random()),createdAt:new Date().toISOString(),product:String(x.product||'Produit'),productId:x.productId||'',type:x.type||'',dlc:x.dlc,lot:x.lot||'',initials:x.initials||'',qty:Math.max(1,Number(x.qty)||1),transport:transport||'Bluetooth',status:'active'});
 records=records.slice(0,LIMIT);save();render();window.ELDashboard?.refresh?.();await scheduleNotifications();
}
async function init(){
 load();render();
 const plugin=notificationPlugin();
 if(plugin){
  const permission=await permissionStatus();
  notifyStatus(permission==='granted'?'Notifications autorisées : programmation en cours…':'Appuie sur « Activer les notifications Android » pour recevoir les alertes à 8 h.');
  if(permission==='granted')await scheduleNotifications();
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();scheduleNotifications()}});
 window.addEventListener('focus',()=>{render();scheduleNotifications()});
 window.addEventListener('pageshow',render);
}
window.ELDlcReminders={init,track,render,getDue:()=>due().slice(),getRecords:()=>records.slice(),scheduleNotifications};
})();
