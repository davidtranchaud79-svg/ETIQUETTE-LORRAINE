// Tableau de bord local, accès rapide aux DLC et vues mensuelles.
(function(){
'use strict';
const by=id=>document.getElementById(id);
const month=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const today=()=>{const d=new Date();return month()+'-'+String(d.getDate()).padStart(2,'0')};
function init(){
 const box=by('elDashboard'),history=document.querySelector('[data-view="history"]'),lossMount=by('elLossesMount');
 if(!box||!history||!lossMount)return;
 box.innerHTML='<div class="card settings-card"><label class="field-label" for="elDashMonth">Mois à consulter</label><input id="elDashMonth" class="input" type="month"/><div class="el-dash-grid" id="elDashStats"></div><p class="muted-line">Impressions = envois enregistrés, sans confirmation de sortie physique. Les PDF sont comptabilisés séparément.</p></div><div id="elDashLossDetails"></div><div id="elDashDlc"></div><div class="button-row el-dash-links"><button class="secondary-btn" id="elDashHistory">Voir l’historique</button><button class="secondary-btn" id="elDashLosses">Voir les pertes</button></div>';
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
  const mass=losses.reduce((n,r)=>n+(r.unit==='kg'?Number(r.qty)||0:r.unit==='g'?(Number(r.qty)||0)/1000:0),0);
  const volume=losses.reduce((n,r)=>n+(r.unit==='L'?Number(r.qty)||0:r.unit==='mL'?(Number(r.qty)||0)/1000:0),0);
  const pieces=losses.filter(r=>r.unit==='pièce').reduce((n,r)=>n+(Number(r.qty)||0),0);
  const portions=losses.filter(r=>r.unit==='portion').reduce((n,r)=>n+(Number(r.qty)||0),0);
  const todayLoss=losses.filter(r=>r.date===today());
  const stats=[
   ['Étiquettes envoyées',count(bt),'Bluetooth'],
   ['PDF générés',count(pdf),'Sans confirmation d’impression'],
   ['DLC aujourd’hui',due.length,'Lots à contrôler'],
   ['DLC dépassées',overdue.length,'Lots à traiter'],
   ['Pertes du mois',losses.length,'Enregistrements'],
   ['Pertes aujourd’hui',todayLoss.length,'Saisies du jour'],
   ['Masse perdue',Math.round(mass*1000)/1000+' kg','kg et g regroupés'],
   ['Volume perdu',Math.round(volume*1000)/1000+' L','L et mL regroupés'],
   ['Pièces perdues',pieces,'Pièces uniquement'],
   ['Portions perdues',portions,'Portions uniquement'],
   ['Lots suivis',records.filter(r=>r.dlc?.slice(0,7)===m).length,'DLC du mois']
  ];
  by('elDashStats').innerHTML=stats.map(([title,value,note])=>'<div class="el-dash-stat"><span>'+title+'</span><strong>'+value+'</strong><small>'+note+'</small></div>').join('');
  const group=(key)=>{const out=new Map();for(const r of losses){const name=String(r[key]||'Non renseigné');out.set(name,(out.get(name)||0)+1)}return [...out].sort((a,b)=>b[1]-a[1]).slice(0,6)};
  const esc=v=>String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const list=(title,items)=>'<div class="card settings-card"><h3>'+title+'</h3>'+(items.length?items.map(([name,n])=>'<div class="el-dash-rank"><span>'+esc(name)+'</span><strong>'+n+' saisie(s)</strong></div>').join(''):'<p>Aucune perte enregistrée sur ce mois.</p>')+'</div>';
  const recent=losses.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,8);
  by('elDashLossDetails').innerHTML='<div class="card settings-card"><h3>Dernières pertes saisies</h3><p class="muted-line">Mise à jour automatique sur cette tablette</p>'+(recent.length?recent.map(x=>'<div class="el-dash-rank"><span>'+esc(x.product)+'<small>'+esc(x.date)+' · '+esc(x.reason)+'</small></span><strong>'+esc(x.qty)+' '+esc(x.unit)+'</strong></div>').join(''):'<p>Aucune perte ce mois.</p>')+'</div>'+list('Produits les plus jetés',group('product'))+list('Motifs des pertes',group('reason'));
  window.ELDlcReminders?.render?.();
 }
 by('elDashMonth').addEventListener('change',refresh);
 window.addEventListener('el:losses-changed',refresh);
 window.addEventListener('focus',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
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