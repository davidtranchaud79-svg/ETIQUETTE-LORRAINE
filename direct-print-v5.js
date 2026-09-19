// Étiquette Lorraine V5 — impression directe native CLABEL/TSPL.
// La PWA reste inchangée : ce module n'active l'impression directe que lorsqu'un bridge natif Capacitor est présent.
(function(){
  const DPI=203;
  const DOTS_PER_MM=DPI/25.4;
  const SPP_UUID='00001101-0000-1000-8000-00805F9B34FB';

  function nativePlugin(){return window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.ClabelPrinter||null}
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

  function drawLabel(label,fmt){
    const width=mmDots(fmt.widthMm),height=mmDots(fmt.heightMm);
    const c=document.createElement('canvas');c.width=width;c.height=height;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineWidth=2;
    const m=clamp(Math.round(width*0.035),8,18);
    ctx.strokeRect(2,2,width-4,height-4);

    const product=String(label.product||'PRODUIT').toUpperCase();
    let productSize=clamp(Math.round(height*0.16),22,42);
    ctx.font='900 '+productSize+'px Arial, sans-serif';
    let lines=wrapCanvas(ctx,product,width-2*m,2);
    while(productSize>18 && lines.some(function(x){return ctx.measureText(x).width>width-2*m})){
      productSize-=1;ctx.font='900 '+productSize+'px Arial, sans-serif';lines=wrapCanvas(ctx,product,width-2*m,2);
    }
    let y=m+productSize;
    lines.forEach(function(line){ctx.fillText(line,m,y);y+=productSize+2});

    const mode=String(label.type||'PRODUCTION').toUpperCase();
    const modeSize=clamp(Math.round(height*0.065),10,18);
    ctx.font='700 '+modeSize+'px Arial, sans-serif';
    y+=2;ctx.fillText(mode,m,y);
    const dividerY=Math.min(height-Math.round(height*0.42),y+8);
    ctx.beginPath();ctx.moveTo(m,dividerY);ctx.lineTo(width-m,dividerY);ctx.stroke();

    const col2=Math.round(width*0.53),labelSize=clamp(Math.round(height*0.055),9,15),dateSize=clamp(Math.round(height*0.11),17,28);
    ctx.font='700 '+labelSize+'px Arial, sans-serif';
    ctx.fillText(ascii(label.dateLabel||'DATE'),m,dividerY+labelSize+8);
    ctx.fillText(ascii(label.expiryLabel||'DLC'),col2,dividerY+labelSize+8);
    ctx.font='900 '+dateSize+'px Arial, sans-serif';
    ctx.fillText(ascii(label.date||'--/--/----'),m,dividerY+labelSize+dateSize+12);
    const expiry=label.detail||label.dlc||'--/--/----';
    let eSize=dateSize;ctx.font='900 '+eSize+'px Arial, sans-serif';
    while(eSize>11&&ctx.measureText(ascii(expiry)).width>width-col2-m){eSize--;ctx.font='900 '+eSize+'px Arial, sans-serif'}
    ctx.fillText(ascii(expiry),col2,dividerY+labelSize+dateSize+12);

    const bottomY=height-m-10;
    ctx.font='500 '+clamp(Math.round(height*0.05),9,14)+'px Arial, sans-serif';
    ctx.fillText(ascii(label.lot?'Lot : '+label.lot:'Lot : -'),m,bottomY);
    const initials=ascii(String(label.initials||'-').toUpperCase());
    ctx.font='900 '+clamp(Math.round(height*0.06),10,16)+'px Arial, sans-serif';
    const iw=ctx.measureText(initials).width;ctx.fillText(initials,width-m-iw,bottomY);
    if(label.storage){
      ctx.font='500 '+clamp(Math.round(height*0.042),8,12)+'px Arial, sans-serif';
      ctx.fillText(ascii(label.storage),m,height-m+2);
    }
    return c;
  }

  function canvasMonoBytes(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const img=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const widthBytes=Math.ceil(canvas.width/8),out=new Uint8Array(widthBytes*canvas.height);
    for(let y=0;y<canvas.height;y++){
      for(let x=0;x<canvas.width;x++){
        const i=(y*canvas.width+x)*4;
        const lum=0.299*img[i]+0.587*img[i+1]+0.114*img[i+2];
        if(img[i+3]>20&&lum<150)out[y*widthBytes+(x>>3)]|=(0x80>>(x&7));
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
    labels.forEach(function(label){
      const canvas=drawLabel(label,fmt),mono=canvasMonoBytes(canvas);
      const head=utf8Bytes('SIZE '+fmt.widthMm+' mm,'+fmt.heightMm+' mm\r\nGAP 2 mm,0 mm\r\nDENSITY 8\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,0,'+mono.widthBytes+','+mono.height+',0,');
      const tail=utf8Bytes('\r\nPRINT 1,1\r\n');
      jobs.push(concatBytes([head,mono.bytes,tail]));
    });
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
        '<div class="button-row" style="margin-top:10px"><button id="scanNativePrinters" class="secondary-btn">Rechercher</button><button id="connectNativePrinter" class="primary-btn">Connecter</button><button id="testNativePrinter" class="secondary-btn">Test 60 × 30</button><button id="diagNativePrinter" class="secondary-btn">Diagnostic</button><button id="disconnectNativePrinter" class="secondary-btn">Déconnecter</button></div>'+
        '<small id="nativePrintStatus" class="muted-line">Aucune imprimante connectée.</small><pre id="nativePrintDiag" style="display:none;white-space:pre-wrap;word-break:break-word;margin-top:10px;font-size:10px;line-height:1.35;max-height:180px;overflow:auto"></pre>';
    }else{
      card.innerHTML='<h3>Impression directe Bluetooth</h3><p>Le module direct est prêt, mais le navigateur/PWA ne peut pas utiliser le Bluetooth classique de la CLABEL.</p>'+
        '<div class="printer-note">Pour obtenir <strong>Étiquette Lorraine → Imprimer → étiquette qui sort</strong>, il faut la version native Android/iOS. Le PDF reste disponible comme secours.</div>';
    }
    printerCard.insertAdjacentElement('afterend',card);
    if(nativeAvailable()){
      card.querySelector('#scanNativePrinters').addEventListener('click',scanUI);
      card.querySelector('#connectNativePrinter').addEventListener('click',connectUI);
      card.querySelector('#testNativePrinter').addEventListener('click',testUI);
      card.querySelector('#diagNativePrinter').addEventListener('click',diagnosticsUI);
      card.querySelector('#disconnectNativePrinter').addEventListener('click',disconnectUI);
      restoreNativeSelection();
      addDirectPrintButton();
    }
  }

  function addDirectPrintButton(){
    if(document.getElementById('directNativePrintBtn'))return;
    const pdfBtn=document.getElementById('printNowBtn');if(!pdfBtn)return;
    const b=document.createElement('button');b.id='directNativePrintBtn';b.className='primary-btn full big-action';b.style.marginBottom='8px';
    b.textContent='Imprimer directement en Bluetooth';b.disabled=true;b.addEventListener('click',printCurrentDirect);
    pdfBtn.insertAdjacentElement('beforebegin',b);pdfBtn.textContent='Créer le PDF de secours';
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
      const btn=document.getElementById('directNativePrintBtn');if(btn)btn.disabled=false;toast('Imprimante CLABEL connectée');
    }catch(e){if(status)status.textContent='Connexion impossible : '+e.message;toast('Connexion imprimante impossible')}
  }
  async function testUI(){
    const status=document.getElementById('nativePrintStatus');
    try{
      if(status)status.textContent='Test 60 × 30 en cours…';
      const sample={product:'TEST CLABEL',type:'PRODUCTION',date:'19/09/2026',dlc:'20/09/2026',detail:'',lot:'TEST',initials:'DT',storage:'+0/+3 °C',dateLabel:'PROD. LE',expiryLabel:'DLC'};
      const fmt={widthMm:60,heightMm:30},job=tsplJob([sample],fmt);
      const result=await pluginCall('write',{base64:bytesToBase64(job),protocol:'tspl',widthMm:60,heightMm:30});
      if(status)status.textContent='Test envoyé à l’imprimante.';
      toast('Test 60 × 30 envoyé');
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
    const btn=document.getElementById('directNativePrintBtn');if(btn)btn.disabled=true;
  }
  async function printCurrentDirect(){
    const x=currentItem();if(x.error)return toast(x.error);
    const labels=expanded([x]),btn=document.getElementById('directNativePrintBtn');
    try{
      if(btn){btn.disabled=true;btn.textContent='Impression…'}await printLabelsDirect(labels);await recordHistory([x],labels.length,'Bluetooth direct');
      toast(labels.length+' étiquette'+(labels.length>1?'s':'')+' envoyée'+(labels.length>1?'s':''));
    }catch(e){console.error(e);toast('Impression directe impossible — utilise le PDF de secours')}
    finally{if(btn){btn.disabled=false;btn.textContent='Imprimer directement en Bluetooth'}}
  }

  window.initDirectPrint=async function(){installUI()};
  window.ELDirectPrint={nativeAvailable:nativeAvailable,nativePlatform:nativePlatform,listPrinters:listPrinters,connectPrinter:connectPrinter,disconnectPrinter:disconnectPrinter,printLabelsDirect:printLabelsDirect,tsplJob:tsplJob,diagnostics:function(){return pluginCall('diagnostics',{})}};
})();