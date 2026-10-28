// Étiquette Lorraine V5 — impression directe native CLABEL/TSPL.
// La PWA reste inchangée : ce module n'active l'impression directe que lorsqu'un bridge natif Capacitor est présent.
(function(){
  const DPI=203;
  const DOTS_PER_MM=DPI/25.4;
  const SPP_UUID='00001101-0000-1000-8000-00805F9B34FB';

  let registeredNativePlugin=null;
  function nativePlugin(){
    const cap=window.Capacitor;
    if(!cap)return null;
    if(cap.Plugins&&cap.Plugins.ClabelPrinter)return cap.Plugins.ClabelPrinter;
    if(registeredNativePlugin)return registeredNativePlugin;
    try{
      if(typeof cap.registerPlugin==='function'){
        registeredNativePlugin=cap.registerPlugin('ClabelPrinter');
        return registeredNativePlugin;
      }
    }catch(_){}
    return null;
  }
  function nativeAvailable(){try{return !!nativePlugin() && !!(window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())}catch(_){return false}}
  function nativePlatform(){try{return window.Capacitor&&window.Capacitor.getPlatform?window.Capacitor.getPlatform():'web'}catch(_){return'web'}}
  function mmDots(mm){return Math.max(1,Math.round(Number(mm)*DOTS_PER_MM))}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
  function ascii(s){return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')}

  function wrapCanvas(ctx,text,maxWidth,maxLines){
    maxLines=maxLines||2;
    const words=String(text||'').trim().split(/\s+/).filter(Boolean);
    if(!words.length)return [''];
    const lines=[];let line='';
    for(const word of words){
      const t=line?line+' '+word:word;
      if(!line||ctx.measureText(t).width<=maxWidth)line=t;
      else{lines.push(line);line=word;if(lines.length===maxLines-1)break}
    }
    if(line&&lines.length<maxLines)lines.push(line);
    return lines.slice(0,maxLines);
  }

  // Rendu thermique CLABEL : fond papier blanc, encre noire uniquement.
  // Modèle validé : produit / dates / lot-température-initiales, sans logo ni pictogramme.
  // Mise en page native calibrée pour les rouleaux 50 × 30 mm à 203 DPI.
  // Les zones sont fixes : titre 0-40 %, dates 43-70 %, traçabilité 75-100 %.
  function drawLabel(label,fmt){
    const width=mmDots(fmt.widthMm),height=mmDots(fmt.heightMm);
    const c=document.createElement('canvas');c.width=width;c.height=height;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineCap='butt';
    const m=Math.max(8,Math.round(width*0.025));
    const right=width-m,usable=width-2*m;
    const fit=function(value,maxWidth,start,min,weight){
      let size=start;
      while(size>min){ctx.font=weight+' '+size+'px Arial, sans-serif';if(ctx.measureText(value).width<=maxWidth)break;size--}
      return size;
    };
    const shorten=function(value,maxWidth,size,weight){
      ctx.font=weight+' '+size+'px Arial, sans-serif';
      if(ctx.measureText(value).width<=maxWidth)return value;
      let out=value;
      while(out.length>1&&ctx.measureText(out+'…').width>maxWidth)out=out.slice(0,-1);
      return out.trimEnd()+'…';
    };
    ctx.lineWidth=1.5;ctx.strokeRect(2,2,width-4,height-4);

    const product=String(label.product||'PRODUIT').toUpperCase().trim();
    const titleMax=Math.round(height*0.39),titleStart=m+5;
    let titleSize=clamp(Math.round(height*0.145),22,34),lines=[];
    for(;titleSize>=19;titleSize--){
      ctx.font='900 '+titleSize+'px Arial, sans-serif';
      lines=wrapCanvas(ctx,product,usable,2);
      if(lines.length===1&&ctx.measureText(product).width>usable)continue;
      if(lines.every(x=>ctx.measureText(x).width<=usable)&&lines.length*(titleSize+3)<=titleMax-titleStart)break;
    }
    titleSize=Math.max(19,titleSize);
    // Ne jamais perdre les derniers mots du nom du produit.
    const words=product.split(/\s+/),result=[];let line='';
    ctx.font='900 '+titleSize+'px Arial, sans-serif';
    for(const word of words){
      const test=line?line+' '+word:word;
      if(line&&ctx.measureText(test).width>usable){result.push(line);line=word}else line=test;
    }
    if(line)result.push(line);
    if(result.length>2)result.splice(1,result.length-1,result.slice(1).join(' '));
    result.slice(0,2).forEach((raw,i)=>{
      const value=shorten(raw,usable,titleSize,'900');
      ctx.font='900 '+titleSize+'px Arial, sans-serif';
      ctx.fillText(value,m,titleStart+titleSize+i*(titleSize+3));
    });
    const divider=Math.round(height*0.42);
    ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m,divider);ctx.lineTo(right,divider);ctx.stroke();

    const top=divider+Math.round(height*0.035);
    const col2=Math.round(width*0.53),gap=12;
    const labelSize=clamp(Math.round(height*0.058),10,14);
    const dateStart=clamp(Math.round(height*0.118),19,27);
    const leftDate=ascii(label.date||'--/--/----');
    const expiry=ascii(label.detail||label.dlc||'--/--/----');
    const baseline=top+labelSize+dateStart+6;
    ctx.font='700 '+labelSize+'px Arial, sans-serif';
    if(label.singleDate){
      const title=ascii(label.dateLabel||'OUVERT LE');
      ctx.fillText(title,(width-ctx.measureText(title).width)/2,top+labelSize);
      const ds=fit(leftDate,usable,dateStart+3,15,'900');
      ctx.font='900 '+ds+'px Arial, sans-serif';
      ctx.fillText(leftDate,(width-ctx.measureText(leftDate).width)/2,baseline);
    }else{
      const leftW=col2-m-gap,rightW=right-col2;
      ctx.fillText(shorten(ascii(label.dateLabel||'PROD. LE'),leftW,labelSize,'700'),m,top+labelSize);
      ctx.fillText(shorten(ascii(label.expiryLabel||'DLC'),rightW,labelSize,'700'),col2,top+labelSize);
      const ds=fit(leftDate,leftW,dateStart,16,'900');
      const es=fit(expiry,rightW,dateStart,16,'900');
      ctx.font='900 '+ds+'px Arial, sans-serif';ctx.fillText(shorten(leftDate,leftW,ds,'900'),m,baseline);
      ctx.font='900 '+es+'px Arial, sans-serif';ctx.fillText(shorten(expiry,rightW,es,'900'),col2,baseline);
      ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(col2-7,top);ctx.lineTo(col2-7,Math.round(height*0.71));ctx.stroke();
    }

    const footerTop=Math.round(height*0.76),footerBottom=height-m-3;
    ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(m,footerTop);ctx.lineTo(right,footerTop);ctx.stroke();
    const sep1=Math.round(width*0.35),sep2=Math.round(width*0.73);
    ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sep1,footerTop+3);ctx.lineTo(sep1,footerBottom+2);ctx.moveTo(sep2,footerTop+3);ctx.lineTo(sep2,footerBottom+2);ctx.stroke();
    const small=clamp(Math.round(height*0.05),10,13);
    const strong=clamp(Math.round(height*0.071),13,18);
    ctx.font='700 '+small+'px Arial, sans-serif';ctx.fillText('LOT',m,footerTop+small+4);
    const lot=ascii(label.lot||'-'),lotW=sep1-m-7;
    const lotSize=fit(lot,lotW,strong,10,'900');
    ctx.font='900 '+lotSize+'px Arial, sans-serif';
    ctx.fillText(shorten(lot,lotW,lotSize,'900'),m,footerBottom);
    const storage=ascii(label.storage||'-'),storageW=sep2-sep1-12;
    const storageSize=fit(storage,storageW,strong,10,'700');
    ctx.font='700 '+storageSize+'px Arial, sans-serif';
    const st=shorten(storage,storageW,storageSize,'700');
    ctx.fillText(st,sep1+6+(storageW-ctx.measureText(st).width)/2,footerBottom);
    const initials=ascii(label.initials||'-').toUpperCase(),initialsW=right-sep2-8;
    const initialsSize=fit(initials,initialsW,strong,10,'900');
    ctx.font='900 '+initialsSize+'px Arial, sans-serif';
    const it=shorten(initials,initialsW,initialsSize,'900');
    ctx.fillText(it,sep2+4+(initialsW-ctx.measureText(it).width)/2,footerBottom);
    return c;
  }

  // CT321D : le firmware de ce modèle utilise la polarité raster inverse
  // du TSPL standard. 1 = papier blanc, 0 = point noir.
  // On part donc d'un buffer blanc (0xFF) et on efface uniquement les bits noirs.
  function canvasMonoBytes(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const img=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const widthBytes=Math.ceil(canvas.width/8),out=new Uint8Array(widthBytes*canvas.height);
    out.fill(0xFF);
    for(let y=0;y<canvas.height;y++){
      for(let x=0;x<canvas.width;x++){
        const i=(y*canvas.width+x)*4;
        const lum=0.299*img[i]+0.587*img[i+1]+0.114*img[i+2];
        if(img[i+3]>20&&lum<150){
          out[y*widthBytes+(x>>3)]&=~(0x80>>(x&7));
        }
      }
    }
    return {bytes:out,widthBytes:widthBytes,height:canvas.height};
  }

  function utf8Bytes(text){return new TextEncoder().encode(text)}
  function concatBytes(parts){
    const size=parts.reduce(function(n,p){return n+p.length},0),out=new Uint8Array(size);let off=0;
    parts.forEach(function(p){out.set(p,off);off+=p.length});return out;
  }
  function bytesToBase64(bytes){
    let bin='';const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
    return btoa(bin);
  }
  function tsplJob(labels,fmt){
    const jobs=[];
    // Regroupe les copies identiques consecutives. Le CT321D peut ignorer
    // les jobs TSPL concaténés trop rapidement ; PRINT 1,N demande N copies
    // directement au firmware de l'imprimante.
    for(let i=0;i<labels.length;){
      const label=labels[i],key=JSON.stringify(label);
      let copies=1;
      while(i+copies<labels.length && JSON.stringify(labels[i+copies])===key)copies++;
      const canvas=drawLabel(label,fmt),mono=canvasMonoBytes(canvas);
      const head=utf8Bytes('SIZE '+fmt.widthMm+' mm,'+fmt.heightMm+' mm\r\nGAP 2 mm,0 mm\r\nDENSITY 8\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,0,'+mono.widthBytes+','+mono.height+',0,');
      const tail=utf8Bytes('\r\nPRINT 1,'+copies+'\r\n');
      jobs.push(concatBytes([head,mono.bytes,tail]));
      i+=copies;
    }
    return concatBytes(jobs);
  }

  async function pluginCall(method,args){
    const p=nativePlugin();args=args||{};
    if(!p||typeof p[method]!=='function')throw new Error('Bridge natif indisponible');
    return await p[method](args);
  }
  async function listPrinters(){
    const result=await pluginCall('listPrinters',{nameHints:['CT','CLABEL','CLabel','Clabel']});
    return result&&result.devices||[];
  }
  async function connectPrinter(address,transport){return await pluginCall('connect',{address:address,transport:transport||'auto',sppUuid:SPP_UUID})}
  async function disconnectPrinter(){try{return await pluginCall('disconnect',{})}catch(_){return null}}
  async function printLabelsDirect(labels){
    if(!nativeAvailable())throw new Error('Impression directe disponible uniquement dans la version native');
    const fmt=pdfFormat(),job=tsplJob(labels,fmt);
    return await pluginCall('write',{base64:bytesToBase64(job),protocol:'tspl',widthMm:fmt.widthMm,heightMm:fmt.heightMm});
  }

  function installUI(){
    if(document.getElementById('nativePrintCard'))return;
    const printerCard=document.getElementById('printerProfileCard');if(!printerCard)return;
    const card=document.createElement('div');card.id='nativePrintCard';card.className='card settings-card';
    if(nativeAvailable()){
      const platform=nativePlatform(),platformLabel=platform==='ios'?'iPhone / iPad':platform==='android'?'Android':'Natif';
      card.innerHTML='<div class="card-title-row"><div><h3>Impression directe Bluetooth</h3><p>'+platformLabel+' · connexion CLABEL directe, sans passer par l’application Clabel.</p></div><span id="nativePrintBadge" class="platform-badge">'+platformLabel+'</span></div>'+
        '<label class="field-label" for="nativePrinterSelect">Imprimante</label><select id="nativePrinterSelect" class="input"><option value="">Rechercher une imprimante…</option></select>'+
        '<div class="button-row" style="margin-top:10px"><button id="scanNativePrinters" class="secondary-btn">Rechercher</button><button id="connectNativePrinter" class="primary-btn">Connecter</button><button id="testNativePrinter" class="secondary-btn">Test 50 × 30</button><button id="diagNativePrinter" class="secondary-btn">Diagnostic</button><button id="disconnectNativePrinter" class="secondary-btn">Déconnecter</button></div>'+
        '<small id="nativePrintStatus" class="muted-line">Aucune imprimante connectée.</small><pre id="nativePrintDiag" style="display:none;white-space:pre-wrap;word-break:break-word;margin-top:10px;font-size:10px;line-height:1.35;max-height:180px;overflow:auto"></pre>';
    }else{
      card.innerHTML='<h3>Impression directe Bluetooth</h3><p>Le module d’impression directe n’est pas détecté.</p>'+
        '<div class="printer-note">Sur Android, ouvre l’application installée (et non le site Web). Si ce message apparaît dans l’application Android, utilise le diagnostic ci-dessous.</div>'+
        '<button id="bridgeDiagnosticButton" class="secondary-btn" type="button" style="margin-top:10px">Diagnostic Android</button>'+
        '<pre id="bridgeDiagnosticResult" style="white-space:pre-wrap;word-break:break-word;font-size:12px;margin-top:10px"></pre>';
    }
    printerCard.insertAdjacentElement('afterend',card);
    if(!nativeAvailable()){
      card.querySelector('#bridgeDiagnosticButton').addEventListener('click',function(){
        const cap=window.Capacitor;
        const info={
          capacitorPresent:!!cap,
          platform:typeof cap?.getPlatform==='function'?cap.getPlatform():'unknown',
          nativePlatform:typeof cap?.isNativePlatform==='function'?cap.isNativePlatform():'unavailable',
          registerPluginAvailable:typeof cap?.registerPlugin==='function',
          clabelPluginPresent:!!cap?.Plugins?.ClabelPrinter,
          nativeAvailable:nativeAvailable()
        };
        card.querySelector('#bridgeDiagnosticResult').textContent=JSON.stringify(info,null,2);
      });
    }
    if(nativeAvailable()){
      card.querySelector('#scanNativePrinters').addEventListener('click',scanUI);
      card.querySelector('#connectNativePrinter').addEventListener('click',connectUI);
      card.querySelector('#testNativePrinter').addEventListener('click',testUI);
      card.querySelector('#diagNativePrinter').addEventListener('click',diagnosticsUI);
      card.querySelector('#disconnectNativePrinter').addEventListener('click',disconnectUI);
      restoreNativeSelection();
      addDirectPrintButton();
      addDirectBatchButton();
    }
  }

  function addDirectPrintButton(){
    if(document.getElementById('directNativePrintBtn'))return;
    const pdfBtn=document.getElementById('printNowBtn');if(!pdfBtn)return;
    const b=document.createElement('button');b.id='directNativePrintBtn';b.className='primary-btn full big-action';b.style.marginBottom='8px';
    b.textContent='Imprimer directement en Bluetooth';b.disabled=true;b.addEventListener('click',printCurrentDirect);
    pdfBtn.insertAdjacentElement('beforebegin',b);pdfBtn.textContent='Créer le PDF de secours';
  }

  function addDirectBatchButton(){
    if(document.getElementById('directNativeBatchBtn'))return;
    const pdfBtn=document.getElementById('printBatchBtn');if(!pdfBtn)return;
    const b=document.createElement('button');
    b.id='directNativeBatchBtn';b.type='button';b.className='primary-btn full big-action';
    b.style.marginBottom='8px';b.textContent='Imprimer le lot directement en Bluetooth';
    b.disabled=true;
    b.addEventListener('click',printBatchDirect);
    pdfBtn.insertAdjacentElement('beforebegin',b);
    const update=()=>{if(!b.dataset.busy)b.disabled=!printerConnected||!state.batch?.length};
    const list=document.getElementById('batchList');
    if(list)new MutationObserver(update).observe(list,{childList:true,subtree:true});
    update();
  }
  let printerConnected=false;
  function updateDirectButtons(connected){
    printerConnected=connected;
    const single=document.getElementById('directNativePrintBtn');
    if(single&&!single.dataset.busy)single.disabled=!connected;
    const batch=document.getElementById('directNativeBatchBtn');
    if(batch&&!batch.dataset.busy)batch.disabled=!connected||!state.batch?.length;
  }
  async function printBatchDirect(){
    if(!state.batch?.length)return toast('Ajoute des produits au lot avant de lancer l’impression');
    if(!printerConnected)return toast('Connecte d’abord l’imprimante CLABEL dans les réglages');
    const btn=document.getElementById('directNativeBatchBtn');
    const items=state.batch.map(x=>({...x}));
    const labels=expanded(items);
    try{
      if(btn){btn.dataset.busy='1';btn.disabled=true;btn.textContent='Impression du lot en cours…'}
      await printLabelsDirect(labels);
      await recordHistory(items,labels.length,'Lot Bluetooth direct');
      await window.ELDlcReminders?.track?.(items,'Bluetooth');
      toast(labels.length+' étiquette(s) du lot envoyée(s) en Bluetooth');
    }catch(e){
      console.error('Impression lot Bluetooth',e);
      toast('Échec du lot Bluetooth : '+(e.message||'vérifie la connexion'));
    }finally{
      if(btn){delete btn.dataset.busy;btn.textContent='Imprimer le lot directement en Bluetooth'}
      updateDirectButtons(printerConnected);
    }
  }

  async function restoreNativeSelection(){
    const saved=localStorage.getItem('el.nativePrinterAddress');if(!saved)return;
    try{populateDevices(document.getElementById('nativePrinterSelect'),await listPrinters(),saved)}catch(_){}
  }
  function populateDevices(sel,devices,selected){
    if(!sel)return;selected=selected||'';
    sel.innerHTML='<option value="">Choisir…</option>'+devices.map(function(d){
      const obj={address:d.address||d.id,name:d.name||'CLABEL',transport:d.transport||'auto'};
      const value=encodeURIComponent(JSON.stringify(obj)),chosen=obj.address===selected?' selected':'';
      return '<option value="'+value+'"'+chosen+'>'+esc(obj.name)+' · '+esc(obj.transport)+'</option>';
    }).join('');
  }
  async function scanUI(){
    const status=document.getElementById('nativePrintStatus');if(status)status.textContent='Recherche…';
    try{
      const devices=await listPrinters();populateDevices(document.getElementById('nativePrinterSelect'),devices,localStorage.getItem('el.nativePrinterAddress')||'');
      const p=nativePlatform();
      if(status)status.textContent=devices.length?devices.length+' appareil(s) Bluetooth trouvé(s).':(p==='ios'?'Aucun appareil détecté. Vérifie que la CLABEL est allumée et proche de l’iPhone.':'Aucune CLABEL trouvée. Sur Android, jumelle-la d’abord dans les réglages Bluetooth.');
    }catch(e){if(status)status.textContent='Recherche impossible : '+e.message}
  }
  async function connectUI(){
    const sel=document.getElementById('nativePrinterSelect'),status=document.getElementById('nativePrintStatus');
    if(!sel||!sel.value)return toast('Choisis une imprimante');
    const d=JSON.parse(decodeURIComponent(sel.value));if(status)status.textContent='Connexion à '+d.name+'…';
    try{
      await connectPrinter(d.address,d.transport);localStorage.setItem('el.nativePrinterAddress',d.address);localStorage.setItem('el.nativePrinterName',d.name||'CLABEL');
      if(status)status.textContent='Connectée : '+(d.name||d.address);
      updateDirectButtons(true);toast('Imprimante CLABEL connectée');
    }catch(e){if(status)status.textContent='Connexion impossible : '+e.message;toast('Connexion imprimante impossible')}
  }
  async function testUI(){
    const status=document.getElementById('nativePrintStatus');
    try{
      if(status)status.textContent='Test 50 × 30 en cours…';
      const sample={product:'TEST CLABEL',type:'PRODUCTION',date:'19/09/2026',dlc:'20/09/2026',detail:'',lot:'TEST',initials:'DT',storage:'+0/+3 °C',dateLabel:'PROD. LE',expiryLabel:'DLC'};
      const fmt={widthMm:50,heightMm:30},job=tsplJob([sample],fmt);
      const result=await pluginCall('write',{base64:bytesToBase64(job),protocol:'tspl',widthMm:50,heightMm:30});
      if(status)status.textContent='Test envoyé à l’imprimante.';
      toast('Test 50 × 30 envoyé');
      return result;
    }catch(e){
      if(status)status.textContent='Test impossible : '+e.message;
      toast('Test Bluetooth impossible');
    }
  }

  async function diagnosticsUI(){
    const box=document.getElementById('nativePrintDiag'),status=document.getElementById('nativePrintStatus');
    try{
      const d=await pluginCall('diagnostics',{});
      const text=JSON.stringify(d,null,2);
      if(box){box.style.display='block';box.textContent=text}
      if(status)status.textContent=d&&d.connected?'Diagnostic Bluetooth prêt.':'Diagnostic : aucune imprimante connectée.';
      try{await navigator.clipboard?.writeText?.(text)}catch(_){}
      toast('Diagnostic Bluetooth affiché');
    }catch(e){
      if(status)status.textContent='Diagnostic impossible : '+e.message;
    }
  }

  async function disconnectUI(){
    await disconnectPrinter();const status=document.getElementById('nativePrintStatus');if(status)status.textContent='Imprimante déconnectée.';
    updateDirectButtons(false);
  }
  async function printCurrentDirect(){
    const x=currentItem();if(x.error)return toast(x.error);
    const labels=expanded([x]),btn=document.getElementById('directNativePrintBtn');
    try{
      if(btn){btn.disabled=true;btn.textContent='Impression…'}await printLabelsDirect(labels);await recordHistory([x],labels.length,'Bluetooth direct');await window.ELDlcReminders?.track?.([x],'Bluetooth');
      toast(labels.length+' étiquette'+(labels.length>1?'s':'')+' envoyée'+(labels.length>1?'s':''));
    }catch(e){console.error(e);toast('Impression directe impossible — utilise le PDF de secours')}
    finally{if(btn){btn.disabled=false;btn.textContent='Imprimer directement en Bluetooth'}}
  }

  window.initDirectPrint=async function(){installUI()};
  window.ELDirectPrint={nativeAvailable:nativeAvailable,nativePlatform:nativePlatform,listPrinters:listPrinters,connectPrinter:connectPrinter,disconnectPrinter:disconnectPrinter,printLabelsDirect:printLabelsDirect,tsplJob:tsplJob,diagnostics:function(){return pluginCall('diagnostics',{})}};
})();