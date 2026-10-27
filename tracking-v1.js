// Suivi mensuel : historique, pertes et exports XLSX sans dépendance réseau.
(function(){
'use strict';
const KEY='el.losses.v1';
let losses=[];
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;'}[c]));
const iso=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const month=()=>iso().slice(0,7);
const id=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random();
function save(){localStorage.setItem(KEY,JSON.stringify(losses));window.dispatchEvent(new CustomEvent('el:losses-changed',{detail:{count:losses.length}}))}
function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');losses=Array.isArray(v)?v:[]}catch(_){losses=[]}}
function el(name,attrs={},text=''){const x=document.createElement(name);for(const [k,v] of Object.entries(attrs))x.setAttribute(k,v);x.textContent=text;return x}
function init(){
 load();const view=document.querySelector('[data-view="history"]');if(!view)return;
 const card=el('div',{class:'card settings-card',id:'elTracking'});card.innerHTML=`
 <h3>Suivi mensuel</h3><p>Impressions, DLC et pertes · données locales disponibles hors connexion.</p>
 <div class="el-tracking-tabs"><button type="button" class="secondary-btn" data-tab="history">Impressions</button><button type="button" class="secondary-btn" data-tab="dlc">DLC</button><button type="button" class="secondary-btn" data-tab="losses">Pertes</button></div>
 <label class="field-label" for="elMonth">Mois à consulter</label><input id="elMonth" class="input" type="month" />
 <div id="elTrackingSummary" class="el-tracking-summary" aria-live="polite"></div>
 <div id="elTrackingContent" class="stack"></div>
 <button type="button" id="elExportXlsx" class="primary-btn full">Exporter le mois en Excel (.xlsx)</button>
 <div id="elLossForm" hidden><h3>Enregistrer une perte</h3>
 <form id="elLossEntry"><label class="field-label" for="elLossDate">Date</label><input class="input" type="date" id="elLossDate" required />
 <label class="field-label" for="elLossProduct">Produit</label><input class="input" id="elLossProduct" list="elLossProducts" maxlength="100" required /><datalist id="elLossProducts"></datalist>
 <div class="el-tracking-grid"><div><label class="field-label" for="elLossQty">Quantité perdue</label><input class="input" id="elLossQty" type="number" min="0.001" step="any" required /></div>
 <div><label class="field-label" for="elLossUnit">Unité</label><select class="input" id="elLossUnit"><option>kg</option><option>g</option><option>pièce</option><option>L</option><option>mL</option><option>portion</option></select></div></div>
 <label class="field-label" for="elLossReason">Motif</label><select class="input" id="elLossReason"><option>DLC dépassée</option><option>Produit abîmé</option><option>Erreur de production</option><option>Retour</option><option>Autre</option></select>
 <label class="field-label" for="elLossLot">Lot (facultatif)</label><input class="input" id="elLossLot" maxlength="50" />
 <label class="field-label" for="elLossActor">Initiales</label><input class="input" id="elLossActor" maxlength="8" required />
 <label class="field-label" for="elLossComment">Commentaire (facultatif)</label><input class="input" id="elLossComment" maxlength="200" />
 <button type="submit" class="primary-btn full">Enregistrer la perte</button></form></div>`;
 const h=view.querySelector('.section-heading');if(h)h.insertAdjacentElement('afterend',card);else view.prepend(card);
 const oldTools=view.querySelector('.history-tools');if(oldTools)oldTools.hidden=true;
 $('elMonth').value=month();$('elLossDate').value=iso();$('elLossActor').value=document.getElementById('initials')?.value||'';
 let tab='history';
 const refresh=()=>render(tab);
 card.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;refresh()}));
 $('elMonth').addEventListener('change',refresh);
 $('elExportXlsx').addEventListener('click',()=>exportMonth(tab));
 $('elLossEntry').addEventListener('submit',e=>{e.preventDefault();const qty=Number($('elLossQty').value);if(!Number.isFinite(qty)||qty<=0)return alert('Quantité invalide');addLoss({date:$('elLossDate').value,product:$('elLossProduct').value.trim(),qty,unit:$('elLossUnit').value,reason:$('elLossReason').value,lot:$('elLossLot').value.trim(),initials:$('elLossActor').value.trim().toUpperCase(),comment:$('elLossComment').value.trim()});$('elLossQty').value='';$('elLossComment').value='';$('elMonth').value=$('elLossDate').value.slice(0,7);refresh()});
 card.addEventListener('click',e=>{const b=e.target.closest('[data-remove-loss]');if(!b)return;const r=losses.find(x=>x.id===b.dataset.removeLoss);if(!r||!confirm('Supprimer cette perte ?'))return;losses=losses.filter(x=>x.id!==r.id);save();refresh()});
 function render(t){
  card.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('primary-btn',b.dataset.tab===t);b.classList.toggle('secondary-btn',b.dataset.tab!==t)});
  $('elLossForm').hidden=t!=='losses';const m=$('elMonth').value||month(),box=$('elTrackingContent');box.innerHTML='';
  if(t==='history'){
   const hs=((typeof state!=='undefined'?state.history:[])).filter(x=>x.createdAt?.slice(0,7)===m);
   const rows=hs.flatMap(h=>(h.items||[]).map(x=>({...x,createdAt:h.createdAt,kind:h.kind})));
   $('elTrackingSummary').textContent=rows.length+' ligne(s) · '+rows.filter(x=>/Bluetooth/i.test(x.kind||'')).reduce((n,x)=>n+(Number(x.qty)||0),0)+' étiquette(s) envoyée(s) · '+rows.filter(x=>!/Bluetooth/i.test(x.kind||'')).reduce((n,x)=>n+(Number(x.qty)||0),0)+' PDF préparé(s)';
   rows.forEach(x=>box.appendChild(item(x.product,x.createdAt+' · '+x.type+' · DLC '+(x.dlc||'—')+' · Lot '+(x.lot||'—')+' · ×'+x.qty)));
  }else if(t==='dlc'){
   const rs=window.ELDlcReminders?.getRecords?.().filter(x=>x.dlc?.slice(0,7)===m)||[];
   $('elTrackingSummary').textContent=rs.length+' lot(s) avec DLC ce mois';
   rs.forEach(x=>box.appendChild(item(x.product,'DLC '+x.dlc+' · '+(x.status==='active'?'À contrôler':x.status==='used'?'Utilisé':'Jeté')+' · Lot '+(x.lot||'—'))));
  }else{
   const rs=losses.filter(x=>x.date?.slice(0,7)===m).sort((a,b)=>b.date.localeCompare(a.date));
   $('elTrackingSummary').textContent=rs.length+' perte(s) enregistrée(s) · quantités détaillées par unité';
   rs.forEach(x=>{const row=item(x.product,x.date+' · '+x.qty+' '+x.unit+' · '+x.reason+' · '+(x.initials||'—'));const btn=el('button',{type:'button',class:'mini-btn danger','data-remove-loss':x.id},'Supprimer');row.appendChild(btn);box.appendChild(row)});
   $('elLossProducts').innerHTML=((typeof state!=='undefined'?state.products:[])).filter(x=>!x.deleted).map(x=>'<option value="'+safe(x.name)+'"></option>').join('');
  }
  if(!box.children.length)box.appendChild(el('p',{},'Aucune donnée pour ce mois.'));
 }
 function item(title,detail){const row=el('div',{class:'history-item'}),info=el('div',{class:'item-main'});info.appendChild(el('div',{class:'item-title'},title));info.appendChild(el('div',{class:'item-meta'},detail));row.appendChild(info);return row}
 function exportMonth(t){
  const m=$('elMonth').value||month();let headers,rows,filename;
  if(t==='history'){headers=['Date opération','Produit','Type','Date départ','DLC','Lot','Initiales','Quantité','Mode'];rows=((typeof state!=='undefined'?state.history:[])).filter(h=>h.createdAt?.slice(0,7)===m).flatMap(h=>(h.items||[]).map(x=>[h.createdAt,x.product,x.type,x.date,x.dlc,x.lot,x.initials,x.qty,h.kind]));filename='Historique_'+m}
  else if(t==='dlc'){headers=['Date enregistrement','Produit','DLC','Lot','Initiales','Étiquettes','Statut','Clôture'];rows=(window.ELDlcReminders?.getRecords?.()||[]).filter(x=>x.dlc?.slice(0,7)===m).map(x=>[x.createdAt,x.product,x.dlc,x.lot,x.initials,x.qty,x.status,x.closedAt||'']);filename='Suivi_DLC_'+m}
  else{headers=['Date','Produit','Quantité','Unité','Motif','Lot','Initiales','Commentaire','Source'];rows=losses.filter(x=>x.date?.slice(0,7)===m).map(x=>[x.date,x.product,x.qty,x.unit,x.reason,x.lot,x.initials,x.comment,x.source||'Manuelle']);filename='Pertes_'+m}
  const blob=makeXlsx([headers,...rows]);const a=el('a');a.href=URL.createObjectURL(blob);a.download=filename+'.xlsx';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
 }
 render(tab);
 window.ELTracking={refresh,addLoss,getLosses:()=>losses.slice()};
 window.dispatchEvent(new Event('el:losses-changed'));
}
function addLoss(data){if(data.sourceId&&losses.some(x=>x.sourceId===data.sourceId))return false;losses.unshift({id:id(),createdAt:new Date().toISOString(),...data});save();window.ELTracking?.refresh?.();return true}
// Minimal Excel OOXML workbook, stored ZIP entries, fully offline.
function makeXlsx(rows){
 const utf=s=>new TextEncoder().encode(s);
 const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>{const addr=col(j)+(i+1);return typeof v==='number'&&Number.isFinite(v)?'<c r="'+addr+'"><v>'+v+'</v></c>':'<c r="'+addr+'" t="inlineStr"><is><t>'+xml(v)+'</t></is></c>'}).join('')+'</row>').join('')+'</sheetData></worksheet>';
 const files=[
 ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
 ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
 ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Données" sheetId="1" r:id="rId1"/></sheets></workbook>'],
 ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
 ['xl/worksheets/sheet1.xml',sheet]];
 const crc=data=>{let c=-1;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xEDB88320:0)}return(c^(-1))>>>0};
 const u16=(v)=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
 let offset=0;const chunks=[],directory=[];
 for(const [name,content] of files){const n=utf(name),b=utf(content),sum=crc(b),local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(sum),...u32(b.length),...u32(b.length),...u16(n.length),...u16(0),...n]);chunks.push(local,b);directory.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(sum),...u32(b.length),...u32(b.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]));offset+=local.length+b.length}
 const size=directory.reduce((n,b)=>n+b.length,0);chunks.push(...directory,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(size),...u32(offset),...u16(0)]));return new Blob(chunks,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
window.ELTrackingInit=init;
})();
