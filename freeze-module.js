// Module Congélation — règle fixe de 3 mois calendaires.
// À utiliser uniquement si cette règle est validée par le PMS/HACCP de l'établissement.
(function(){
  MODES.freeze={label:'Congélation',key:null,months:3};

  function addMonthsISO(iso,months){
    const [y,m,d]=iso.split('-').map(Number);
    const base=new Date(y,m-1,1);
    base.setMonth(base.getMonth()+Number(months));
    const ty=base.getFullYear(),tm=base.getMonth();
    const lastDay=new Date(ty,tm+1,0).getDate();
    const day=Math.min(d,lastDay);
    const x=new Date(ty,tm,day);
    const z=new Date(x.getTime()-x.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,10);
  }

  // Ajoute le 4e bouton sans toucher au cœur de l'application.
  const tabs=document.getElementById('modeTabs');
  if(tabs && !tabs.querySelector('[data-mode="freeze"]')){
    const b=document.createElement('button');
    b.type='button';
    b.dataset.mode='freeze';
    b.textContent='Congélation';
    tabs.appendChild(b);
  }

  const css=document.createElement('style');
  css.textContent=`
    #modeTabs{grid-template-columns:repeat(4,1fr)}
    #modeTabs button[data-mode="freeze"].active{background:#315f78;border-color:#315f78;color:#fff}
    @media(max-width:430px){#modeTabs{grid-template-columns:repeat(2,1fr)}}
  `;
  document.head.appendChild(css);

  const originalRuleDays=ruleDays;
  ruleDays=function(p,mode=state.mode){
    if(mode==='freeze') return 3;
    return originalRuleDays(p,mode);
  };

  const originalCurrentItem=currentItem;
  currentItem=function(){
    if(state.mode!=='freeze') return originalCurrentItem();
    const p=state.selected;
    if(!p) return {error:'Sélectionne un produit'};
    const date=$('#eventDate').value||todayISO();
    return {
      id:uid(),
      product:p.name,
      category:p.category||'',
      type:'Congélation',
      date,
      days:'3 mois',
      dlc:addMonthsISO(date,3),
      lot:$('#lot').value.trim(),
      initials:$('#initials').value.trim().toUpperCase(),
      storage:p.storage||'Congélation 3 mois',
      qty:state.qty
    };
  };

  const originalUpdatePreview=updatePreview;
  updatePreview=function(){
    if(state.mode!=='freeze'){
      originalUpdatePreview();
      const unit=document.querySelector('.duration-box span');
      if(unit) unit.textContent='jour(s)';
      $('#expiryLabel').textContent='DLC / limite';
      const labels=document.querySelectorAll('.lp-grid span');
      if(labels[0]) labels[0].textContent=state.mode==='opening'?'OUVERT LE':state.mode==='defrost'?'DÉCONG. LE':'DATE';
      if(labels[1]) labels[1].textContent='DLC';
      return;
    }

    const p=state.selected;
    const date=$('#eventDate').value||todayISO();
    const limit=addMonthsISO(date,3);
    $('#lpProduct').textContent=p?.name||'NOM DU PRODUIT';
    $('#lpMode').textContent='CONGÉLATION';
    $('#lpDate').textContent=fmt(date);
    $('#lpDlc').textContent=fmt(limit);
    $('#lpLot').textContent='Lot : '+($('#lot').value.trim()||'—');
    $('#lpInitials').textContent=$('#initials').value.trim().toUpperCase()||'—';
    $('#lpTemp').textContent=p?.storage||'Congélation 3 mois';
    $('#durationValue').textContent='3';
    const unit=document.querySelector('.duration-box span');
    if(unit) unit.textContent='mois';
    $('#dlcValue').textContent=fmt(limit);
    $('#expiryLabel').textContent='Limite congélation';
    $('#ruleHint').textContent='Congélation : +3 mois calendaires · règle à valider dans le PMS';
    const labels=document.querySelectorAll('.lp-grid span');
    if(labels[0]) labels[0].textContent='CONGELÉ LE';
    if(labels[1]) labels[1].textContent='LIMITE';
    setExpiryStatus(limit);
  };

  const originalLabelObject=labelObject;
  labelObject=function(x){
    if(x.type!=='Congélation') return originalLabelObject(x);
    return {
      product:x.product,
      type:'Congélation',
      date:fmt(x.date),
      dlc:fmt(x.dlc),
      lot:x.lot,
      initials:x.initials,
      storage:x.storage||'Congélation 3 mois',
      dateLabel:'CONGELÉ LE',
      expiryLabel:'LIMITE'
    };
  };
})();
