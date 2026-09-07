(async function(){
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Chargement impossible : '+src));document.head.appendChild(s)})}
  try{
    await load('./core-v4.js');
    await load('./print-v4.js');
    await load('./data-v4.js');
    await load('./settings-v4.js');
    await init();
  }catch(e){
    console.error(e);
    const t=document.getElementById('toast');
    if(t){t.textContent='Erreur de chargement de l’application';t.classList.add('show')}
  }
})();
