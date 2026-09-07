(function(global){
  const PT_PER_MM=72/25.4;
  const CP1252={0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
  function cpByte(code){if(code<256)return code;return CP1252[code]??63}
  function binaryEncode(str){let out='';for(const ch of String(str))out+=String.fromCharCode(cpByte(ch.codePointAt(0)));return out}
  function pdfEscape(str){return binaryEncode(str).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\r\n]+/g,' ')}
  function safe(str){return String(str??'').normalize('NFC').replace(/[\u0000-\u001F]/g,' ')}
  function text(x,y,size,font,str){return `BT /${font} ${size.toFixed(2)} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(safe(str))}) Tj ET\n`}
  function approxWidth(str,size,bold=false){let units=0;for(const ch of safe(str)){if('MW@#%'.includes(ch))units+=0.88;else if('ilI1.,:;|/'.includes(ch))units+=0.28;else if(ch===' ')units+=0.28;else units+=bold?0.58:0.53}return units*size}
  function fitSize(str,maxW,start,min,bold=true){let s=start;while(s>min&&approxWidth(str,s,bold)>maxW)s-=0.2;return Math.max(min,s)}
  function wrap(str,maxW,size,bold=true,maxLines=2){const words=safe(str).trim().split(/\s+/).filter(Boolean);if(!words.length)return[''];const lines=[];let line='';let index=0;for(;index<words.length;index++){const w=words[index],test=line?line+' '+w:w;if(!line||approxWidth(test,size,bold)<=maxW){line=test}else{lines.push(line);line=w;if(lines.length===maxLines-1){index++;break}}}if(line&&lines.length<maxLines)lines.push(line);if(index<words.length){let last=(lines[maxLines-1]||'')+' '+words.slice(index).join(' ');last=last.trim();while(last.length>1&&approxWidth(last+'…',size,bold)>maxW)last=last.slice(0,-1);lines[maxLines-1]=last.replace(/[\s,;:-]+$/,'')+'…'}return lines.slice(0,maxLines)}
  function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
  function normaliseFormat(format){const w=clamp(Number(format?.widthMm)||40,20,100),h=clamp(Number(format?.heightMm)||30,20,100);return{widthMm:w,heightMm:h,widthPt:w*PT_PER_MM,heightPt:h*PT_PER_MM}}
  function labelContent(l,fmt){
    const W=fmt.widthPt,H=fmt.heightPt;
    const sx=W/(40*PT_PER_MM),sy=H/(30*PT_PER_MM),s=clamp(Math.min(sx,sy),0.72,1.8);
    const m=3.2*s,inner=W-2*m;
    let c='0 G 0 g\n';
    c+=`${(0.7*s).toFixed(2)} w\n`;
    c+=`${(1*s).toFixed(2)} ${(1*s).toFixed(2)} ${(W-2*s).toFixed(2)} ${(H-2*s).toFixed(2)} re S\n`;

    const product=(l.product||'PRODUIT').toUpperCase();
    let pSize=13.6*s,lines;
    if(approxWidth(product,pSize,true)<=inner){lines=[product]}else{
      pSize=11.4*s;lines=wrap(product,inner,pSize,true,2);
      while(pSize>8.7*s&&lines.some(line=>approxWidth(line,pSize,true)>inner)){pSize-=0.2*s;lines=wrap(product,inner,pSize,true,2)}
    }
    let y=H-(10*s);
    for(const line of lines){c+=text(m,y,pSize,'F1',line);y-=pSize+0.45*s}

    const mode=(l.type||'PRODUCTION').toUpperCase();
    const modeY=lines.length===1?H-28.2*s:Math.max(H-35.3*s,y-0.2*s);
    const modeSize=fitSize(mode,inner,6.2*s,4.7*s,true);
    c+=text(m,modeY,modeSize,'F1',mode);

    const dividerY=H-39.2*s;
    c+=`${m.toFixed(2)} ${dividerY.toFixed(2)} ${inner.toFixed(2)} 0 l S\n`;

    if(mode==='ALLERGÈNES'){
      c+=text(m,H-46.2*s,5.5*s,'F2',l.dateLabel||'ÉTIQUETÉ LE');
      const ds=fitSize(l.date||'--/--/----',W*0.38,9.2*s,7.0*s,true);
      c+=text(m,H-56.2*s,ds,'F1',l.date||'--/--/----');
      c+=text(W*0.42,H-46.2*s,5.5*s,'F2','ALLERGÈNES');
      let detail=(l.detail||'NON RENSEIGNÉ').toUpperCase();
      let dSize=7.8*s,detailLines=wrap(detail,W*0.55-m,dSize,true,2);
      while(dSize>5.2*s&&detailLines.some(line=>approxWidth(line,dSize,true)>W*0.55-m)){dSize-=0.2*s;detailLines=wrap(detail,W*0.55-m,dSize,true,2)}
      let dy=H-55.3*s;for(const line of detailLines){c+=text(W*0.42,dy,dSize,'F1',line);dy-=dSize+0.4*s}
      const lot=l.lot?`Lot : ${l.lot}`:'Lot : —',initials=l.initials?String(l.initials).toUpperCase():'—';
      const bottomY=Math.max(8.8*s,H-69*s),lotSize=fitSize(lot,W-2*m-22*s,5.8*s,4.1*s,false);
      c+=text(m,bottomY,lotSize,'F2',lot);const iSize=fitSize(initials,21*s,6.8*s,5.0*s,true),iw=approxWidth(initials,iSize,true);c+=text(W-m-iw,bottomY,iSize,'F1',initials);
      return c;
    }

    const col2=W/2+1.5*s,halfW=W/2-m-2.2*s;
    const labSize=5.5*s;
    c+=text(m,H-46.2*s,labSize,'F2',l.dateLabel||'DATE');
    c+=text(col2,H-46.2*s,labSize,'F2',l.expiryLabel||'DLC');
    const ds1=fitSize(l.date||'--/--/----',halfW,9.4*s,7.2*s,true);
    const ds2=fitSize(l.dlc||'--/--/----',halfW,9.4*s,7.2*s,true);
    c+=text(m,H-56.2*s,ds1,'F1',l.date||'--/--/----');
    c+=text(col2,H-56.2*s,ds2,'F1',l.dlc||'--/--/----');

    const lot=l.lot?`Lot : ${l.lot}`:'Lot : —';
    const initials=l.initials?String(l.initials).toUpperCase():'—';
    const bottomY=Math.max(9.2*s,H-66.3*s);
    const lotSize=fitSize(lot,W-2*m-22*s,6*s,4.3*s,false);
    c+=text(m,bottomY,lotSize,'F2',lot);
    const iSize=fitSize(initials,21*s,7*s,5.2*s,true),iw=approxWidth(initials,iSize,true);
    c+=text(W-m-iw,bottomY,iSize,'F1',initials);

    const storage=l.storage||l.note||'';
    if(storage){const ss=fitSize(storage,inner,5.7*s,4.0*s,false);c+=text(m,Math.max(3.8*s,bottomY-8*s),ss,'F2',storage)}
    return c;
  }
  function make(labels,format){
    if(!Array.isArray(labels)||!labels.length)throw new Error('Aucune étiquette');
    const fmt=normaliseFormat(format),W=fmt.widthPt,H=fmt.heightPt;
    const objs=[],add=(n,s)=>{objs[n]=s};
    add(1,'<< /Type /Catalog /Pages 2 0 R >>');
    add(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    add(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const kids=[];
    labels.forEach((l,i)=>{const page=5+i*2,content=page+1;kids.push(`${page} 0 R`);const stream=labelContent(l,fmt);add(page,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${content} 0 R >>`);add(content,`<< /Length ${binaryEncode(stream).length} >>\nstream\n${stream}endstream`)});
    add(2,`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${labels.length} >>`);
    let pdf='%PDF-1.4\n%âãÏÓ\n';const offsets=[0];for(let n=1;n<objs.length;n++){offsets[n]=binaryEncode(pdf).length;pdf+=`${n} 0 obj\n${objs[n]}\nendobj\n`}const xref=binaryEncode(pdf).length;pdf+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;for(let n=1;n<objs.length;n++)pdf+=String(offsets[n]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;const bytes=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255;return new Blob([bytes],{type:'application/pdf'})
  }
  global.PDFLabels={make,normaliseFormat};
  global.PDF40x30={make:(labels)=>make(labels,{widthMm:40,heightMm:30}),widthPt:40*PT_PER_MM,heightPt:30*PT_PER_MM};
})(window);
