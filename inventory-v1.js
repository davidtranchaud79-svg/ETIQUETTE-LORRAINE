// Inventaire mensuel autonome : import Excel/CSV, saisie cumulative, export Excel.
(function(){
'use strict';
const KEY='el.inventory.v1',MAX_ROWS=10000;
const $=id=>document.getElementById(id);
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentMonth=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const stamp=()=>new Date().toISOString();
const numeric=v=>{const s=String(v??'').trim().replace(/\s/g,'').replace(',','.');if(!s)return null;const n=Number(s);return Number.isFinite(n)&&n>=0?n:null};
const format=n=>Number(n||0).toLocaleString('fr-FR',{maximumFractionDigits:3});
let db={months:{}},month=currentMonth(),search='',selected=null;
function save(){localStorage.setItem(KEY,JSON.stringify(db));window.dispatchEvent(new Event('el:inventory-changed'))}
function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'{}');db=d&&typeof d==='object'&&d.months&&typeof d.months==='object'?d:{months:{}}}catch(_){db={months:{}}}}
function entries(){return db.months[month]||[]}
function cleanName(s){return String(s??'').trim().replace(/\s+/g,' ')}
function id(){return globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random()}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
function csv(rows){return '\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n')}
const headers=['Code','Produit','Catégorie','Unité','Quantité théorique','Quantité comptée','Écart','Dernière saisie'];
function exportData(){
 const rows=[headers,...entries().map(r=>[r.code||'',r.name,r.category||'',r.unit||'',r.expected??'',r.counted??0,r.expected===null?'':Number(r.counted||0)-r.expected,r.updatedAt||''])];
 if(window.ELTrackingMakeXlsx)download(window.ELTrackingMakeXlsx(rows),'Inventaire_'+month+'.xlsx');
 else download(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),'Inventaire_'+month+'.csv');
}
function template(){
 const rows=[['Code','Produit','Catégorie','Unité','Quantité théorique'],['P001','Saumon','Poisson','kg','12'],['P002','Crème','Crèmerie','L','8'],['P003','Œufs','Économat','pièce','60']];
 download(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),'Modele_Inventaire_Lorraine.csv');
}
function parseRows(rows){
 if(!rows.length)throw Error('Fichier vide');
 const header=rows[0].map(norm);
 const idx=names=>header.findIndex(h=>names.some(n=>h===n||h.startsWith(n)));
 const nameCol=idx(['produit','designation','libelle','article','nom','product']);
 const codeCol=idx(['codearticle','codeproduit','reference','ref','code','sku']);
 const catCol=idx(['categorie','famille','rayon','zone']);
 const unitCol=idx(['unite','unit','uom','conditionnement']);
 const expectedCol=idx(['quantitetheorique','stocktheorique','stockinitial','stockattendu','quantiteattendue']);
 const countedCol=idx(['quantitecomptee','quantiteinventaire','quantitereelle','stockreel','compte']);
 if(nameCol<0)throw Error('Colonne « Produit » ou « Désignation » introuvable dans la première ligne.');
 const out=[],seen=new Set();
 for(let i=1;i<rows.length;i++){
  const r=rows[i],name=cleanName(r[nameCol]);if(!name)continue;
  const code=codeCol<0?'':cleanName(r[codeCol]);
  const key=code?'code:'+norm(code):'name:'+norm(name);
  if(seen.has(key))throw Error('Produit en double à la ligne '+(i+1)+' : '+name);
  seen.add(key);
  const expected=expectedCol<0?null:numeric(r[expectedCol]);
  if(expectedCol>=0&&String(r[expectedCol]??'').trim()!==''&&expected===null)throw Error('Quantité théorique invalide ligne '+(i+1));
  const counted=countedCol<0||String(r[countedCol]??'').trim()===''?0:numeric(r[countedCol]);
  if(counted===null)throw Error('Quantité comptée invalide ligne '+(i+1));
  out.push({id:id(),code,name,category:catCol<0?'':cleanName(r[catCol]),unit:unitCol<0?'pièce':cleanName(r[unitCol])||'pièce',expected,counted,updatedAt:'',history:[]});
  if(out.length>MAX_ROWS)throw Error('Limite de '+MAX_ROWS+' produits dépassée');
 }
 if(!out.length)throw Error('Aucun produit dans le fichier');return out;
}
function matching(row,q){return !q||norm([row.name,row.code,row.category].join(' ')).includes(norm(q))}
function stats(){
 const rs=entries(),filled=rs.filter(r=>r.history?.length).length;
 $('elInvStats').textContent=rs.length+' produits · '+filled+' comptés · '+(rs.length-filled)+' à compter';
}
function renderList(){
 const rs=entries().filter(r=>matching(r,search));
 const list=$('elInvList');list.innerHTML=rs.length?rs.map(r=>{
 const done=r.history?.length>0;
 return '<button type="button" class="el-inv-product'+(selected===r.id?' selected':'')+'" data-inv-id="'+esc(r.id)+'"><span><strong>'+esc(r.name)+'</strong><small>'+esc([r.code,r.category].filter(Boolean).join(' · '))+'</small></span><span class="el-inv-count">'+format(r.counted)+' '+esc(r.unit)+'<small>'+(done?'Compté':'À compter')+'</small></span></button>';
 }).join(''):'<p>Aucun produit correspondant.</p>';
 stats();
}
function selectedRecord(){return entries().find(r=>r.id===selected)}
function renderEditor(){
 const r=selectedRecord(),editor=$('elInvEditor');
 if(!r){editor.hidden=true;return}
 editor.hidden=false;
 $('elInvProduct').textContent=r.name;
 $('elInvDetails').textContent=[r.code,r.category,'Unité : '+r.unit,'Théorique : '+(r.expected===null?'non renseignée':format(r.expected))].filter(Boolean).join(' · ');
 $('elInvCount').textContent=format(r.counted)+' '+r.unit;
 $('elInvQty').value='';
 $('elInvQty').focus();
 $('elInvHistory').textContent=(r.history||[]).slice(-5).reverse().map(h=>new Date(h.at).toLocaleString('fr-FR')+' : '+(h.mode==='add'?'+':'=')+format(h.qty)+' '+r.unit+' → '+format(h.result)).join('\n');
}
function applyCount(mode){
 const r=selectedRecord();if(!r)return;
 const qty=numeric($('elInvQty').value);
 if(qty===null)return alert('Entre une quantité positive ou zéro.');
 const old=Number(r.counted)||0;
 r.counted=mode==='add'?Math.round((old+qty)*1000)/1000:qty;
 r.updatedAt=stamp();r.history=r.history||[];
 r.history.push({at:r.updatedAt,mode,qty,result:r.counted});
 save();renderList();renderEditor();
 $('elInvStatus').textContent=r.name+' : '+format(r.counted)+' '+r.unit+' enregistrés pour '+month+'.';
}
function init(){
 const view=document.querySelector('[data-view="inventory"]');if(!view)return;
 load();$('elInvMonth').value=month;
 $('elInvMonth').addEventListener('change',e=>{month=e.target.value||currentMonth();selected=null;renderList();renderEditor();$('elInvStatus').textContent=''});
 $('elInvSearch').addEventListener('input',e=>{search=e.target.value;renderList()});
 $('elInvList').addEventListener('click',e=>{const btn=e.target.closest('[data-inv-id]');if(!btn)return;selected=btn.dataset.invId;renderList();renderEditor()});
 $('elInvAdd').addEventListener('click',()=>applyCount('add'));
 $('elInvSet').addEventListener('click',()=>applyCount('set'));
 $('elInvQty').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyCount('add')}});
 $('elInvExport').addEventListener('click',exportData);
 $('elInvTemplate').addEventListener('click',template);
 $('elInvCopy').addEventListener('click',()=>{
  const previous=Object.keys(db.months).filter(m=>m<month).sort().at(-1);
  if(!previous)return alert('Aucun inventaire précédent à recopier.');
  if(entries().length&&!confirm('Remplacer la liste du mois '+month+' par celle de '+previous+' ? Les quantités déjà saisies seront perdues.'))return;
  db.months[month]=db.months[previous].map(r=>({...r,id:id(),counted:0,updatedAt:'',history:[]}));
  selected=null;save();renderList();renderEditor();$('elInvStatus').textContent='Base de '+previous+' recopiée pour '+month+' (comptages remis à zéro).';
 });
 $('elInvImport').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   if(file.size>12*1024*1024)throw Error('Fichier trop volumineux (12 Mo maximum)');
   $('elInvStatus').textContent='Lecture du fichier Excel…';
   if(typeof window.ELExcelRows!=='function')throw Error('Lecteur Excel indisponible');
   const incoming=parseRows(await window.ELExcelRows(file));
   const existing=entries(),byCode=new Map(existing.filter(x=>x.code).map(x=>[norm(x.code),x])),byName=new Map(existing.map(x=>[norm(x.name),x]));
   const updates=incoming.map(r=>({...r,prior:r.code?byCode.get(norm(r.code))||byName.get(norm(r.name)):byName.get(norm(r.name))}));
   const countNew=updates.filter(r=>!r.prior).length;
   if(!confirm('Importer '+incoming.length+' produits dans '+month+' ?\n'+countNew+' nouveaux, '+(incoming.length-countNew)+' existants.\nLes comptages existants seront conservés.'))return;
   const result=existing.slice();
   for(const r of updates){
    const {prior,...item}=r;
    if(prior){Object.assign(prior,{name:item.name,code:item.code,category:item.category,unit:item.unit,expected:item.expected})}
    else result.push(item);
   }
   db.months[month]=result;save();renderList();renderEditor();
   $('elInvStatus').textContent=incoming.length+' produits importés : '+countNew+' ajoutés, '+(incoming.length-countNew)+' actualisés. Comptages conservés.';
  }catch(err){console.error(err);$('elInvStatus').textContent='Erreur import : '+err.message}
  finally{e.target.value=''}
 });
 document.querySelectorAll('.nav-btn[data-target="inventory"]').forEach(b=>b.addEventListener('click',()=>{renderList();renderEditor()}));
 renderList();renderEditor();
}
window.ELInventoryInit=init;
})();