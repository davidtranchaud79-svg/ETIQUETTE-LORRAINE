// Tableau de bord local, accès rapide aux DLC et vues mensuelles.
(function(){
'use strict';
const by=id=>document.getElementById(id);
const month=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const today=()=>{const d=new Date();return month()+'-'+String(d.getDate()).padStart(2,'0')};
function init(){
 const box=by('elDashboard'),history=document.querySelector('[data-view="history"]'),lossMount=by('elLossesMount');
 if(!box||!history||!lossMount)return;
 box.innerHTML='<div class="card settings-card"><label class="field-label" for="elDashMonth">Mois à consulter</label><input id="elDashMonth" class="input" type="month"/><div class="el-dash-grid" id="elDashStats"></div><p class="muted-line">Impressions = envois enregistrés, sans confirmation de sortie physique. Les PDF sont comptabilisés séparément.</p></div><div id="elDashDlc"></div><div class="button-row el-dash-links"><button class="secondary-btn" id="elDashHistory">Voir l’historique</button><button class="secondary-btn" id="elDashLosses">Voir les pertes</button></div>';
 by('elDashMonth').value=month();
 const tracking=by('elTracking'),reminders=by('elDlcReminderCard');
 if(reminders)by('elDashDlc').appendChild(reminders);
 const original=tracking?.parentElement;
 function go(target){document.querySelector('.nav-btn[data-target="'+target+'"]')?.click()}
 by('elDashHistory').addEventListener('click',()=>go('history'));
 by('elDashLosses').addEventListener('click',()=>go('losses'));
 function switchTracking(target){
  if(!tracking)return;
  if(target==='losses'){
   lossMount.appendChild(tracking);
   tracking.querySelector('[data-tab="losses"]')?.click();
  }else if(target==='history'){
   if(original)original.insertBefore(tracking,original.querySelector('.history-tools')||original.querySelector('#historyList'));
   tracking.querySelector('[data-tab="history"]')?.click();
  }
 }
 function refresh(){
  const m=by('elDashMonth').value||month();
  const hs=(typeof state!=='undefined'?state.history:[]).filter(h=>h.createdAt?.slice(0,7)===m);
  const bt=hs.filter(h=>/Bluetooth/i.test(h.kind||''));
  const pdf=hs.filter(h=>!/Bluetooth/i.test(h.kind||''));
  const count=rows=>rows.reduce((sum,h)=>sum+(Number(h.count)||0),0);
  const records=window.ELDlcReminders?.getRecords?.()||[];
  const active=records.filter(r=>r.status==='active');
  const due=active.filter(r=>r.dlc===today());
  const overdue=active.filter(r=>r.dlc<today());
  const losses=window.ELTracking?.getLosses?.().filter(r=>r.date?.slice(0,7)===m)||[];
  const stats=[
   ['Étiquettes envoyées',count(bt),'Bluetooth'],
   ['PDF générés',count(pdf),'Sans confirmation d’impression'],
   ['DLC aujourd’hui',due.length,'Lots à contrôler'],
   ['DLC dépassées',overdue.length,'Lots à traiter'],
   ['Pertes du mois',losses.length,'Enregistrements'],
   ['Lots suivis',records.filter(r=>r.dlc?.slice(0,7)===m).length,'DLC du mois']
  ];
  by('elDashStats').innerHTML=stats.map(([title,value,note])=>'<div class="el-dash-stat"><span>'+title+'</span><strong>'+value+'</strong><small>'+note+'</small></div>').join('');
  window.ELDlcReminders?.render?.();
 }
 by('elDashMonth').addEventListener('change',refresh);
 document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.target==='history'||b.dataset.target==='losses')switchTracking(b.dataset.target);
  if(b.dataset.target==='dashboard')refresh();
 }));
 // L'écran historique présente uniquement la liste mensuelle, pas la liste globale non filtrée.
 const legacy=by('historyList');if(legacy)legacy.hidden=true;
 const help=document.querySelector('[data-view="settings"]');
 if(help&&!by('elHelpShortcut')){
  const btn=document.createElement('button');btn.id='elHelpShortcut';btn.className='secondary-btn full';btn.textContent='Ouvrir l’aide';btn.style.marginBottom='12px';
  btn.addEventListener('click',()=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view==='help'));document.querySelectorAll('.nav-btn').forEach(n=>n.classList.remove('active'))});
  help.appendChild(btn);
 }
 refresh();
 window.ELDashboard={refresh};
}
window.ELDashboardInit=init;
})();