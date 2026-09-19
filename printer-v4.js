// Profil imprimante pour Étiquette Lorraine V4 — CLABEL / PDF
(function(){
  const PROFILES={
    clabel:{label:'CLABEL',app:'Clabel',models:'CT327D et modèles récents',button:'Créer le PDF pour Clabel'},
    clabel321d:{label:'CLABEL CT321D',app:'Clabel trade',models:'CT321D',button:'Créer le PDF pour Clabel trade'},
    clabel327d:{label:'CLABEL CT327D',app:'Clabel',models:'CT327D',button:'Créer le PDF pour Clabel'},
    printmaster:{label:'Phomemo / Print Master',app:'Print Master',models:'Phomemo',button:'Envoyer vers Print Master'},
    generic:{label:'PDF / autre imprimante',app:'application d’impression',models:'Imprimante PDF compatible',button:'Partager le PDF'}
  };

  function currentProfile(){
    const key=state.settings?.printer?.profile||'clabel';
    return PROFILES[key]||PROFILES.clabel;
  }

  function ensurePrinterSettings(){
    state.settings.printer={profile:'clabel',...(state.settings.printer||{})};
  }

  function addStyles(){
    if(document.getElementById('printer-profile-style'))return;
    const s=document.createElement('style');
    s.id='printer-profile-style';
    s.textContent=`
      .printer-chip{display:inline-flex;align-items:center;gap:6px;margin:0 auto 10px;padding:6px 10px;border-radius:999px;background:#eef4f7;border:1px solid #bfd1dc;color:#315f78;font-size:11px;font-weight:800}
      .printer-profile-card .printer-note{margin-top:9px;padding:9px 10px;border-radius:12px;background:#f6f3ef;border:1px solid var(--line);font-size:11px;line-height:1.45;color:var(--muted)}
      .printer-profile-card .button-row{margin-top:10px}
    `;
    document.head.appendChild(s);
  }

  function ensure60x30Preset(){
    const sel=document.getElementById('formatPreset');
    if(!sel||sel.querySelector('option[value="60x30"]'))return;
    const opt=document.createElement('option');
    opt.value='60x30';opt.textContent='60 × 30 mm (CLABEL)';
    const custom=sel.querySelector('option[value="custom"]');
    sel.insertBefore(opt,custom);
  }

  function installSettingsCard(){
    if(document.getElementById('printerProfileCard'))return;
    const format=document.getElementById('formatPreset')?.closest('.settings-card');
    if(!format)return;
    const card=document.createElement('div');
    card.id='printerProfileCard';
    card.className='card settings-card printer-profile-card';
    card.innerHTML=`
      <h3>Imprimante / application</h3>
      <p>Choisis le flux d’impression utilisé sur cet appareil.</p>
      <label class="field-label" for="printerProfile">Profil</label>
      <select id="printerProfile" class="input">
        <option value="clabel">CLABEL — application Clabel</option>
        <option value="clabel321d">CLABEL CT321D — Clabel trade</option>
        <option value="clabel327d">CLABEL CT327D — Clabel</option>
        <option value="printmaster">Phomemo — Print Master</option>
        <option value="generic">Autre — PDF générique</option>
      </select>
      <div id="printerProfileInfo" class="printer-note"></div>
      <div class="button-row">
        <button id="savePrinterProfileBtn" class="primary-btn">Enregistrer le profil</button>
        <button id="applyClabel60Btn" class="secondary-btn">Passer en 60 × 30 mm</button>
      </div>`;
    format.insertAdjacentElement('afterend',card);
    document.getElementById('savePrinterProfileBtn').addEventListener('click',savePrinterProfile);
    document.getElementById('applyClabel60Btn').addEventListener('click',applyClabel60);
    document.getElementById('printerProfile').addEventListener('change',previewProfileSelection);
  }

  function previewProfileSelection(){
    const key=document.getElementById('printerProfile')?.value||'clabel';
    const p=PROFILES[key]||PROFILES.clabel;
    const info=document.getElementById('printerProfileInfo');
    if(info)info.innerHTML=`<strong>${p.label}</strong> · ${p.models}<br>Le PDF est généré localement puis ouvert/importé dans <strong>${p.app}</strong>. Aucun lien direct propriétaire n’est imposé.`;
  }

  async function savePrinterProfile(){
    ensurePrinterSettings();
    const before={...state.settings.printer};
    state.settings.printer.profile=document.getElementById('printerProfile')?.value||'clabel';
    try{
      await persistKV('settings',state.settings);
      await audit('Changer profil imprimante','Impression',before,state.settings.printer);
      await markChanged('settings','Profil imprimante');
    }catch(_){}
    renderPrinterUI();
    toast('Profil imprimante enregistré');
  }

  async function applyClabel60(){
    const preset=document.getElementById('formatPreset');
    const w=document.getElementById('labelWidth'),h=document.getElementById('labelHeight');
    if(preset)preset.value='60x30';
    if(w)w.value=60;
    if(h)h.value=30;
    if(typeof saveFormatSettings==='function')await saveFormatSettings();
  }

  function ensureClabelGuide(){
    if(document.getElementById('clabelGuideDialog'))return;
    const d=document.createElement('dialog');
    d.id='clabelGuideDialog';
    d.className='modal small-modal';
    d.innerHTML=`
      <div class="modal-card">
        <div class="modal-head"><h2>PDF prêt pour CLABEL</h2><button type="button" id="closeClabelGuide" class="close-btn" aria-label="Fermer">×</button></div>
        <p class="modal-copy" id="clabelGuideText"></p>
        <ol class="clabel-guide-list" style="padding-left:20px;line-height:1.5;font-size:13px">
          <li>Dans la feuille de partage, choisis <strong>Enregistrer dans Fichiers</strong> si CLABEL n’apparaît pas.</li>
          <li>Ouvre <strong id="clabelGuideApp">Clabel</strong>.</li>
          <li>Va dans <strong>PDF Printing / Impression PDF</strong>.</li>
          <li>Importe le PDF que tu viens d’enregistrer.</li>
          <li>Vérifie le format <strong id="clabelGuideFormat">60 × 30 mm</strong> puis imprime à 100 %.</li>
        </ol>
        <div class="modal-actions"><button type="button" id="okClabelGuide" class="primary-btn">Compris</button></div>
      </div>`;
    document.body.appendChild(d);
    const close=()=>{document.activeElement?.blur();requestAnimationFrame(()=>d.open&&d.close())};
    d.querySelector('#closeClabelGuide').addEventListener('click',close);
    d.querySelector('#okClabelGuide').addEventListener('click',close);
  }

  function showClabelGuide(){
    ensureClabelGuide();
    const d=document.getElementById('clabelGuideDialog');
    const p=currentProfile(),fmt=pdfFormat();
    const app=d.querySelector('#clabelGuideApp'),f=d.querySelector('#clabelGuideFormat'),txt=d.querySelector('#clabelGuideText');
    if(app)app.textContent=p.app;
    if(f)f.textContent=`${fmt.widthMm} × ${fmt.heightMm} mm`;
    if(txt)txt.innerHTML=`iOS/Android ne permet pas à Étiquette Lorraine d’écrire directement dans <strong>${p.app}</strong>. Le PDF est créé par Étiquette Lorraine, puis importé dans l’application CLABEL.`;
    if(!d.open)d.showModal();
  }

  function renderPrinterUI(){
    ensurePrinterSettings();
    const key=state.settings.printer.profile||'clabel';
    const p=PROFILES[key]||PROFILES.clabel;
    const select=document.getElementById('printerProfile');
    if(select)select.value=key;
    previewProfileSelection();

    const printBtn=document.getElementById('printNowBtn');
    const batchBtn=document.getElementById('printBatchBtn');
    if(printBtn)printBtn.textContent=p.button;
    if(batchBtn)batchBtn.textContent=key.startsWith('clabel')?'Créer le lot PDF pour '+p.app:key==='printmaster'?'Envoyer le lot vers Print Master':'Partager le lot PDF';

    let chip=document.getElementById('printerChip');
    if(!chip){
      chip=document.createElement('div');chip.id='printerChip';chip.className='printer-chip';
      document.getElementById('formatChip')?.insertAdjacentElement('afterend',chip);
    }
    if(chip)chip.textContent='Imprimante : '+p.label;
    const micro=document.querySelector('[data-view="print"] .microcopy.center');
    if(micro&&key.startsWith('clabel'))micro.innerHTML=`Le PDF est créé localement. <strong>CLABEL ne reçoit pas automatiquement le fichier</strong> : enregistre-le dans Fichiers puis importe-le dans <strong>${p.app} → PDF Printing</strong>.`;

    const helpView=document.querySelector('[data-view="help"]');
    const sub=helpView?.querySelector('.section-heading p');
    if(sub)sub.textContent='Utilisation avec '+p.app+'.';
    const ol=helpView?.querySelector('.steps-card ol');
    if(ol){
      const fmt=(state.settings.labelFormat?.widthMm||40)+' × '+(state.settings.labelFormat?.heightMm||30)+' mm';
      if(key.startsWith('clabel')){
        ol.innerHTML=`
          <li>Prépare l’étiquette dans <strong>Étiquette Lorraine</strong>.</li>
          <li>Touche <strong>${p.button}</strong>.</li>
          <li>Si <strong>${p.app}</strong> apparaît dans le partage, sélectionne-le. Sinon, enregistre le PDF puis importe-le dans <strong>${p.app}</strong>.</li>
          <li>Dans ${p.app}, utilise la fonction <strong>PDF / impression PDF</strong>.</li>
          <li>Choisis le format physique <strong>${fmt}</strong>, vérifie l’orientation et imprime à 100 %.</li>`;
      }else if(key==='printmaster'){
        ol.innerHTML=`
          <li>Prépare l’étiquette.</li><li>Touche <strong>Envoyer vers Print Master</strong>.</li>
          <li>Enregistre/partage le PDF vers Print Master.</li><li>Ouvre <strong>Impression PDF</strong>.</li>
          <li>Vérifie le format <strong>${fmt}</strong> avant impression.</li>`;
      }else{
        ol.innerHTML=`
          <li>Prépare l’étiquette.</li><li>Touche <strong>Partager le PDF</strong>.</li>
          <li>Ouvre le PDF dans l’application de ton imprimante.</li><li>Choisis le format <strong>${fmt}</strong>.</li>
          <li>Imprime à l’échelle 100 %.</li>`;
      }
    }
  }

  // Ajout du format 60x30 dans le moteur de presets existant.
  if(typeof presetFromSize==='function'){
    const oldPresetFromSize=presetFromSize;
    presetFromSize=function(w,h){if(Number(w)===60&&Number(h)===30)return'60x30';return oldPresetFromSize(w,h)};
  }

  // Texte de partage adapté à l’imprimante choisie.
  if(typeof shareOrSave==='function'){
    shareOrSave=async function(blob,name,share=true){
      const f=new File([blob],name,{type:'application/pdf'}),fmt=pdfFormat(),p=currentProfile();
      if(share&&navigator.canShare?.({files:[f]})){
        try{
          await navigator.share({files:[f],title:`Étiquette ${fmt.widthMm}×${fmt.heightMm}`,text:`PDF prêt pour ${p.app}`});
          if((state.settings?.printer?.profile||'').startsWith('clabel'))setTimeout(showClabelGuide,120);
          return true;
        }catch(e){if(e.name==='AbortError')return false}
      }
      download(blob,name);
      if((state.settings?.printer?.profile||'').startsWith('clabel'))setTimeout(showClabelGuide,120);
      toast('PDF enregistré — importe-le dans '+p.app);return true;
    };
  }

  window.initPrinterModule=async function(){
    addStyles();ensure60x30Preset();ensurePrinterSettings();installSettingsCard();ensureClabelGuide();
    try{await persistKV('settings',state.settings)}catch(_){}
    if(typeof renderSettings==='function')renderSettings();
    renderPrinterUI();
  };

  window.ELPrinter={profiles:PROFILES,currentProfile,render:renderPrinterUI};
})();