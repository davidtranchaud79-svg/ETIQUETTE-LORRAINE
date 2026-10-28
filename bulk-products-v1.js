// Import Excel et gestion massive des produits, sans connexion.
(function(){
'use strict';
const $=id=>document.getElementById(id);
const columns=['Produit','Catégorie','Production (jours)','Ouverture (jours)','Décongélation (jours)','Sous vide (jours)','Allergènes','Conservation','Favori'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases=[['produit','nom','name','product'],['categorie','category'],['productionjours','joursproduction','daysproduction'],['ouverturejours','joursouverture','daysopening'],['decongelationjours','joursdecongelation','daysdefrost'],['sousvidejours','jourssousvide','daysvacuum'],['allergenes','allergens'],['conservation','stockage','storage'],['favori','favorite']];
function csvRows(src){
 const rows=[];let row=[],cell='',quote=false;
 const first=(src.split(/\r?\n/,1)[0]||'');const sep=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
 for(let i=0;i<src.length;i++){const c=src[i];if(c==='"'){if(quote&&src[i+1]==='"'){cell+='"';i++}else quote=!quote}else if(c===sep&&!quote){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&src[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
async function unzipXml(file){
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break}}
 if(eocd<0)throw Error('Fichier Excel ZIP invalide');
 const count=view.getUint16(eocd+10,true),dir=view.getUint32(eocd+16,true);let at=dir;const files={};
 for(let i=0;i<count;i++){
  if(view.getUint32(at,true)!==0x02014b50)throw Error('Structure Excel invalide');
  const method=view.getUint16(at+10,true),size=view.getUint32(at+20,true),nameLen=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),offset=view.getUint32(at+42,true);
  const name=new TextDecoder().decode(bytes.slice(at+46,at+46+nameLen));at+=46+nameLen+extra+comment;
  if(!/^(xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels))$/.test(name))continue;
  const localName=view.getUint16(offset+26,true),localExtra=view.getUint16(offset+28,true),start=offset+30+localName+localExtra;let raw=bytes.slice(start,start+size);
  if(method===8){if(typeof DecompressionStream==='undefined')throw Error('Lecture XLSX non prise en charge sur cet appareil');const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));raw=new Uint8Array(await new Response(stream).arrayBuffer())}
  else if(method!==0)throw Error('Compression Excel non prise en charge');
  files[name]=new TextDecoder().decode(raw);
 }
 return files;
}
function parseXlsxXml(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('Feuille Excel illisible');return doc}
async function excelRows(file){
 if(/\.csv$/i.test(file.name))return csvRows((await file.text()).replace(/^\uFEFF/,''));
 const files=await unzipXml(file);const sheet=files['xl/worksheets/sheet1.xml'];if(!sheet)throw Error('Première feuille Excel introuvable');
 const shared=files['xl/sharedStrings.xml']?Array.from(parseXlsxXml(files['xl/sharedStrings.xml']).getElementsByTagName('si'),si=>Array.from(si.getElementsByTagName('t'),t=>t.textContent).join('')):[];
 const doc=parseXlsxXml(sheet);return Array.from(doc.getElementsByTagName('row'),r=>{const out=[];for(const c of r.getElementsByTagName('c')){const col=(c.getAttribute('r')||'A').match(/^[A-Z]+/)?.[0]||'A';let idx=0;for(const char of col)idx=idx*26+char.charCodeAt(0)-64;idx--;const v=c.getElementsByTagName('v')[0]?.textContent||'';out[idx]=c.getAttribute('t')==='s'?shared[Number(v)]||'':c.getAttribute('t')==='inlineStr'?Array.from(c.getElementsByTagName('t'),x=>x.textContent).join(''):v}return out.map(x=>x??'')});
}
function days(v){if(String(v??'').trim()==='')return '';const n=Number(String(v).replace(',','.'));if(!Number.isInteger(n)||n<0||n>365)throw Error('Durée invalide : '+v);return n}
function mapRows(rows){
 if(!rows.length)throw Error('Fichier vide');
 const header=rows[0].map(normalize);const indexes=aliases.map(names=>header.findIndex(h=>names.includes(h)));
 if(indexes[0]<0)throw Error('Colonne Produit ou Nom manquante');
 const get=(r,i)=>indexes[i]>=0?String(r[indexes[i]]??'').trim():'';
 const out=[];const errors=[];
 rows.slice(1).forEach((r,i)=>{try{const name=get(r,0);if(!name)return;const fav=normalize(get(r,8));out.push({name,category:get(r,1),daysProduction:days(get(r,2)),daysOpening:days(get(r,3)),daysDefrost:days(get(r,4)),daysVacuum:days(get(r,5)),allergens:get(r,6),storage:get(r,7),favorite:['1','oui','yes','true','vrai','x'].includes(fav)})}catch(e){errors.push('Ligne '+(i+2)+' : '+e.message)}});
 if(errors.length)throw Error(errors.slice(0,5).join(' ; '));
 if(!out.length)throw Error('Aucun produit valide');return out;
}
function template(){
 const rows=[columns,['Saumon','Poisson','2','1','1','','Poisson','Chambre froide','oui'],['Crème pâtissière','Pâtisserie','2','1','','','Lait; Œuf','Chambre froide','non']];
 const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 download(new Blob([csv],{type:'text/csv;charset=utf-8'}),'Modele_Import_Etiquette_Lorraine.csv');
}
function init(){
 const view=document.querySelector('[data-view="products"]');if(!view)return;
 const panel=document.createElement('div');panel.className='card settings-card';panel.innerHTML='<h3>Gestion massive des étiquettes / produits</h3><p>Importer une liste de produits depuis Excel (.xlsx) ou CSV. Les doublons de même nom sont mis à jour. Les étiquettes ne sont pas imprimées automatiquement.</p><div class="button-row"><button type="button" id="elBulkTemplate" class="secondary-btn">Télécharger le modèle Excel (CSV)</button><label class="secondary-btn file-btn">Importer Excel / CSV<input type="file" id="elBulkImport" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label></div><p id="elBulkStatus" class="muted-line" aria-live="polite"></p><hr><h3>Suppression massive</h3><p>Sélectionne les produits à supprimer. La suppression ne modifie pas les anciens historiques d’impression.</p><div class="button-row"><button type="button" class="secondary-btn" id="elBulkSelectAll">Tout sélectionner (liste filtrée)</button><button type="button" class="secondary-btn" id="elBulkClear">Désélectionner</button><button type="button" class="secondary-btn danger" id="elBulkDelete">Supprimer la sélection</button></div><p id="elBulkCount" class="muted-line"></p><div id="elBulkList" class="el-bulk-list"></div>';
 view.querySelector('#productsList')?.insertAdjacentElement('afterend',panel);
 const selected=new Set();const list=$('elBulkList'),status=$('elBulkStatus');
 const filtered=()=>activeProducts().filter(p=>{const q=$('productFilter').value.trim().toLowerCase();return !q||p.name.toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q)});
 function render(){const ps=filtered();list.innerHTML=ps.map(p=>'<label class="el-bulk-option"><input type="checkbox" data-bulk-id="'+esc(p.id)+'" '+(selected.has(p.id)?'checked':'')+'><span>'+esc(p.name)+'</span><small>'+esc(p.category||'')+'</small></label>').join('');$('elBulkCount').textContent=selected.size+' produit(s) sélectionné(s) sur '+ps.length+' affiché(s)'}
 list.addEventListener('change',e=>{const id=e.target.dataset.bulkId;if(!id)return;if(e.target.checked)selected.add(id);else selected.delete(id);render()});
 $('productFilter').addEventListener('input',render);
 $('elBulkTemplate').addEventListener('click',template);
 $('elBulkSelectAll').addEventListener('click',()=>{filtered().forEach(p=>selected.add(p.id));render()});
 $('elBulkClear').addEventListener('click',()=>{selected.clear();render()});
 $('elBulkDelete').addEventListener('click',()=>requestAdmin(async()=>{const targets=state.products.filter(p=>selected.has(p.id)&&!p.deleted);if(!targets.length)return alert('Aucun produit sélectionné');if(!confirm('Supprimer '+targets.length+' produit(s) ? Les historiques resteront conservés.'))return;const stamp=nowISO();targets.forEach(p=>{p.deleted=true;p.updatedAt=stamp});await persistKV('products',state.products);await audit('Suppression massive produits',targets.length+' produits',null,{ids:targets.map(p=>p.id)});await markChanged('products','Suppression massive');if(state.selected&&selected.has(state.selected.id)){state.selected=null;$('productSearch').value=''}selected.clear();renderProducts();renderQuick();updatePreview();render();status.textContent=targets.length+' produit(s) supprimé(s)'}));
 $('elBulkImport').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;status.textContent='Lecture du fichier…';try{if(file.size>8*1024*1024)throw Error('Fichier trop volumineux (8 Mo maximum)');const rows=mapRows(await excelRows(file));await new Promise((resolve,reject)=>requestAdmin(async()=>{try{const existing=new Map(activeProducts().map(p=>[normalize(p.name),p]));const incoming=new Map();rows.forEach(p=>incoming.set(normalize(p.name),p));const updates=[...incoming.values()];const newCount=updates.filter(p=>!existing.has(normalize(p.name))).length;if(!confirm('Importer '+updates.length+' produit(s) : '+newCount+' création(s), '+(updates.length-newCount)+' mise(s) à jour ?')){resolve();return}for(const item of updates){const old=existing.get(normalize(item.name));if(old)Object.assign(old,item,{updatedAt:nowISO(),deleted:false});else state.products.push({id:uid(),...item,updatedAt:nowISO(),deleted:false})}state.products.sort((a,b)=>a.name.localeCompare(b.name,'fr'));await persistKV('products',state.products);await audit('Import massif Excel',file.name,null,{created:newCount,updated:updates.length-newCount});await markChanged('products','Import Excel massif');renderProducts();renderQuick();updatePreview();render();status.textContent=updates.length+' produit(s) traités : '+newCount+' créés, '+(updates.length-newCount)+' mis à jour';resolve()}catch(err){reject(err)}}));}catch(err){status.textContent='Erreur : '+err.message;console.error(err)}finally{e.target.value=''}});
 render();
}
window.ELExcelRows=excelRows;
window.ELBulkProductsInit=init;
})();
