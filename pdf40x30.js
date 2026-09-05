(function(global){
  const PT_PER_MM = 72 / 25.4;
  const W = 40 * PT_PER_MM;
  const H = 30 * PT_PER_MM;
  const CP1252 = {0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
  function cpByte(code){ if(code<256) return code; return CP1252[code] ?? 63; }
  function binaryEncode(str){let out='';for(const ch of String(str)){out+=String.fromCharCode(cpByte(ch.codePointAt(0)));}return out;}
  function pdfEscape(str){const b=binaryEncode(str).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\r\n]+/g,' ');return b;}
  function safe(str){return String(str??'').normalize('NFC').replace(/[\u0000-\u001F]/g,' ')}
  function text(x,y,size,font,str){return `BT /${font} ${size.toFixed(2)} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(safe(str))}) Tj ET\n`;}
  function approxWidth(str,size,bold=false){let units=0;for(const ch of safe(str)){if('MW@#%'.includes(ch))units+=0.88;else if('ilI1.,:;|/'.includes(ch))units+=0.28;else if(ch===' ')units+=0.28;else units+=bold?0.58:0.53;}return units*size;}
  function fitSize(str,maxW,start,min,bold=true){let s=start;while(s>min && approxWidth(str,s,bold)>maxW)s-=0.20;return Math.max(min,s)}
  function wrap(str,maxW,size,bold=true,maxLines=2){
    const words=safe(str).trim().split(/\s+/).filter(Boolean);if(!words.length)return [''];
    const lines=[];let line='';let used=0;
    for(let i=0;i<words.length;i++){
      const w=words[i],test=line?line+' '+w:w;
      if(approxWidth(test,size,bold)<=maxW||!line){line=test;used=i+1;}
      else{lines.push(line);line=w;used=i+1;if(lines.length===maxLines-1)break;}
    }
    if(line&&lines.length<maxLines)lines.push(line);
    if(used<words.length){
      let last=lines[maxLines-1]||'';
      const rest=(last+' '+words.slice(used).join(' ')).trim();
      last=rest;
      while(last.length>1&&approxWidth(last+'…',size,bold)>maxW)last=last.slice(0,-1);
      lines[maxLines-1]=last.replace(/[\s,;:-]+$/,'')+'…';
    }
    return lines.slice(0,maxLines);
  }
  function labelContent(l){
    // Version "grande lisibilité" : marges réduites et texte agrandi.
    const m=3.2, inner=W-2*m;
    let c='0 G 0 g\n0.70 w\n';
    c += `1.00 1.00 ${(W-2).toFixed(2)} ${(H-2).toFixed(2)} re S\n`;

    const product=(l.product||'PRODUIT').toUpperCase();
    let pSize=13.6, lines;
    if(approxWidth(product,pSize,true)<=inner){
      lines=[product];
    }else{
      pSize=11.4;
      lines=wrap(product,inner,pSize,true,2);
      while(pSize>9.4 && lines.some(line=>approxWidth(line,pSize,true)>inner)){
        pSize-=0.2;
        lines=wrap(product,inner,pSize,true,2);
      }
    }

    let y=H-10.0;
    for(const line of lines){
      c+=text(m,y,pSize,'F1',line);
      y-=pSize+0.45;
    }

    const mode=(l.type||'PRODUCTION').toUpperCase();
    const modeY=lines.length===1 ? 56.8 : Math.max(49.7,y-0.2);
    c += text(m,modeY,6.2,'F2',mode);

    const dividerY=45.8;
    c += `${m.toFixed(2)} ${dividerY.toFixed(2)} ${inner.toFixed(2)} 0 l S\n`;

    const col2=W/2+1.5;
    const halfW=W/2-m-2.2;
    c += text(m,38.8,5.5,'F2',l.dateLabel||'DATE');
    c += text(col2,38.8,5.5,'F2',l.expiryLabel||'DLC');

    const ds1=fitSize(l.date||'--/--/----',halfW,9.4,8.2,true);
    const ds2=fitSize(l.dlc||'--/--/----',halfW,9.4,8.2,true);
    c += text(m,28.8,ds1,'F1',l.date||'--/--/----');
    c += text(col2,28.8,ds2,'F1',l.dlc||'--/--/----');

    const lot = l.lot ? `Lot : ${l.lot}` : 'Lot : —';
    const initials = l.initials ? String(l.initials).toUpperCase() : '—';
    const lotSize=fitSize(lot,W-2*m-20,6.0,4.7,false);
    c += text(m,18.7,lotSize,'F2',lot);
    const iSize=fitSize(initials,19,7.0,5.8,true);
    const iw=approxWidth(initials,iSize,true);
    c += text(W-m-iw,18.7,iSize,'F1',initials);

    if(l.storage){
      const ss=fitSize(l.storage,inner,5.7,4.5,false);
      c+=text(m,10.7,ss,'F2',l.storage);
    } else if(l.note){
      const ns=fitSize(l.note,inner,5.4,4.3,false);
      c+=text(m,10.7,ns,'F2',l.note);
    }
    return c;
  }
  function make(labels){
    if(!Array.isArray(labels)||!labels.length) throw new Error('Aucune étiquette');
    const objs=[];
    const add=(n,s)=>{objs[n]=s};
    add(1,'<< /Type /Catalog /Pages 2 0 R >>');
    add(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    add(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const kids=[];
    labels.forEach((l,i)=>{
      const page=5+i*2, content=page+1; kids.push(`${page} 0 R`);
      const stream=labelContent(l);
      add(page,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${content} 0 R >>`);
      add(content,`<< /Length ${binaryEncode(stream).length} >>\nstream\n${stream}endstream`);
    });
    add(2,`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${labels.length} >>`);
    let pdf='%PDF-1.4\n%âãÏÓ\n'; const offsets=[0];
    for(let n=1;n<objs.length;n++){offsets[n]=binaryEncode(pdf).length;pdf+=`${n} 0 obj\n${objs[n]}\nendobj\n`;}
    const xref=binaryEncode(pdf).length;
    pdf+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for(let n=1;n<objs.length;n++) pdf+=String(offsets[n]).padStart(10,'0')+' 00000 n \n';
    pdf+=`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255;
    return new Blob([bytes],{type:'application/pdf'});
  }
  global.PDF40x30={make,widthPt:W,heightPt:H};
})(window);
