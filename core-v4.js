const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const APP_VERSION='4.0.0';
const DB_NAME='etiquette-lorraine-v4', DB_VERSION=1;
const LEGACY={products:'dlc3.products',recent:'dlc3.recent',history:'dlc3.history',initials:'dlc3.initials',pin:'dlc3.pin'};
const MODES={
  production:{label:'Production',key:'daysProduction',dateLabel:'PROD. LE',expiryLabel:'DLC'},
  opening:{label:'Ouverture',key:'daysOpening',dateLabel:'OUVERT LE',expiryLabel:'DLC'},
  defrost:{label:'Décongélation',key:'daysDefrost',dateLabel:'DÉCONG. LE',expiryLabel:'DLC'},
  freeze:{label:'Congélation',key:null,dateLabel:'CONGELÉ LE',expiryLabel:'LIMITE'},
  vacuum:{label:'Sous vide',key:'daysVacuum',dateLabel:'MIS S/V LE',expiryLabel:'DLC'},
  allergens:{label:'Allergènes',key:null,dateLabel:'ÉTIQUETÉ LE',expiryLabel:'ALLERGÈNES'}
};
const defaultProducts=[
  {id:'pdt',name:'Purée de pommes de terre',category:'Garniture',daysProduction:'',daysOpening:'',daysDefrost:'',daysVacuum:'',allergens:'',storage:'',favorite:true,updatedAt:new Date().toISOString(),deleted:false},
  {id:'jus',name:'Jus de cochon',category:'Sauce / Jus',daysProduction:'',daysOpening:'',daysDefrost:'',daysVacuum:'',allergens:'',storage:'',favorite:false,updatedAt:new Date().toISOString(),deleted:false},
  {id:'arti',name:'Artichauts',category:'Légume',daysProduction:'',daysOpening:'',daysDefrost:'',daysVacuum:'',allergens:'',storage:'',favorite:false,updatedAt:new Date().toISOString(),deleted:false}
];
const defaultSettings={
  labelFormat:{preset:'40x30',widthMm:40,heightMm:30},
  freezeMonths:3,
  serviceLocked:false,
  sync:{enabled:false,url:'',secret:'',deviceName:''},
  deviceId:'',
  sharedUpdatedAt:new Date().toISOString(),
  lastSync:null,
  lastBackup:null
};
const state={products:[],recent:[],history:[],settings:structuredCloneSafe(defaultSettings),selected:null,mode:'production',qty:1,batch:[],pinAction:null,pinActionFn:null,db:null,audit:[],registration:null};

function structuredCloneSafe(v){return JSON.parse(JSON.stringify(v))}
function uid(){return crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)}
function nowISO(){return new Date().toISOString()}
function todayISO(){const d=new Date(),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,10)}
function addDays(iso,n){const [y,m,d]=iso.split('-').map(Number),x=new Date(y,m-1,d);x.setDate(x.getDate()+Number(n));const z=new Date(x.getTime()-x.getTimezoneOffset()*60000);return z.toISOString().slice(0,10)}
function addMonths(iso,n){const [y,m,d]=iso.split('-').map(Number);const base=new Date(y,m-1,1);base.setMonth(base.getMonth()+Number(n));const ly=base.getFullYear(),lm=base.getMonth(),last=new Date(ly,lm+1,0).getDate();const x=new Date(ly,lm,Math.min(d,last)),off=x.getTimezoneOffset();return new Date(x.getTime()-off*60000).toISOString().slice(0,10)}
function fmt(iso){if(!iso)return'—';const [y,m,d]=iso.split('-');return`${d}/${m}/${y}`}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function slug(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,35)||'Etiquette'}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2300)}
function numOrBlank(v){if(v==='')return'';const n=Number(v);return Number.isFinite(n)&&n>=0?Math.min(365,n):''}
function activeProducts(){return state.products.filter(p=>!p.deleted)}
function safeLocalParse(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');if(!db.objectStoreNames.contains('audit'))db.createObjectStore('audit',{keyPath:'id'});if(!db.objectStoreNames.contains('backups'))db.createObjectStore('backups',{keyPath:'id'});if(!db.objectStoreNames.contains('outbox'))db.createObjectStore('outbox',{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function idbGet(store,key){return new Promise((resolve,reject)=>{const tx=state.db.transaction(store,'readonly'),req=tx.objectStore(store).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function idbPut(store,value,key){return new Promise((resolve,reject)=>{const tx=state.db.transaction(store,'readwrite'),os=tx.objectStore(store),req=key===undefined?os.put(value):os.put(value,key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function idbDelete(store,key){return new Promise((resolve,reject)=>{const tx=state.db.transaction(store,'readwrite'),req=tx.objectStore(store).delete(key);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}
function idbAll(store){return new Promise((resolve,reject)=>{const tx=state.db.transaction(store,'readonly'),req=tx.objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}

async function persistKV(key,value){await idbPut('kv',structuredCloneSafe(value),key);if(key==='products')localStorage.setItem(LEGACY.products,JSON.stringify(value));if(key==='recent')localStorage.setItem(LEGACY.recent,JSON.stringify(value));if(key==='history')localStorage.setItem(LEGACY.history,JSON.stringify(value));if(key==='settings')localStorage.setItem('dlc4.settings',JSON.stringify(value))}
async function queueOutbox(kind){try{await idbPut('outbox',{id:uid(),kind,createdAt:nowISO()})}catch(_){}}
async function makeInternalBackup(reason){const snap={id:Date.now(),createdAt:nowISO(),reason,payload:{version:4,products:state.products,settings:sanitisedSettingsForBackup(),recent:state.recent,history:state.history}};await idbPut('backups',snap);let all=await idbAll('backups');all.sort((a,b)=>b.id-a.id);for(const old of all.slice(12))await idbDelete('backups',old.id);state.settings.lastBackup=snap.createdAt;await persistKV('settings',state.settings);renderBackupStatus()}
function sanitisedSettingsForBackup(){const s=structuredCloneSafe(state.settings);return s}
async function audit(action,entity,before=null,after=null){const row={id:uid(),createdAt:nowISO(),actor:($('#initials')?.value||localStorage.getItem(LEGACY.initials)||'').trim().toUpperCase()||'—',action,entity,before,after};state.audit.unshift(row);state.audit=state.audit.slice(0,100);try{await idbPut('audit',row)}catch(_){}renderAudit()}
async function markChanged(kind,reason){await queueOutbox(kind);await makeInternalBackup(reason);if(navigator.onLine&&state.settings.sync?.enabled)syncNow(true).catch(()=>{})}

async function loadState(){
  state.db=await openDB();
  let products=await idbGet('kv','products');
  let recent=await idbGet('kv','recent');
  let history=await idbGet('kv','history');
  let settings=await idbGet('kv','settings');
  if(!products){products=safeLocalParse(LEGACY.products,defaultProducts);products=(products||[]).map(p=>({...p,updatedAt:p.updatedAt||nowISO(),deleted:!!p.deleted}));await persistKV('products',products)}
  if(!recent){recent=safeLocalParse(LEGACY.recent,[]);await persistKV('recent',recent)}
  if(!history){history=safeLocalParse(LEGACY.history,[]);await persistKV('history',history)}
  if(!settings){settings={...structuredCloneSafe(defaultSettings),...safeLocalParse('dlc4.settings',{})};await persistKV('settings',settings)}
  settings={...structuredCloneSafe(defaultSettings),...settings,labelFormat:{...defaultSettings.labelFormat,...(settings.labelFormat||{})},sync:{...defaultSettings.sync,...(settings.sync||{})}};
  if(!settings.deviceId)settings.deviceId=uid();
  state.products=products?.length?products:structuredCloneSafe(defaultProducts);state.recent=recent||[];state.history=history||[];state.settings=settings;
  state.audit=(await idbAll('audit')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,100);
  await persistKV('settings',state.settings);
}

async function init(){
  try{await loadState()}catch(e){console.error(e);state.products=safeLocalParse(LEGACY.products,defaultProducts);state.recent=safeLocalParse(LEGACY.recent,[]);state.history=safeLocalParse(LEGACY.history,[]);state.settings=structuredCloneSafe(defaultSettings);toast('Stockage avancé indisponible : mode de secours')}
  $('#eventDate').value=todayISO();$('#initials').value=localStorage.getItem(LEGACY.initials)||'';
  bindNav();bindDialogs();bindPrint();bindProducts();bindHistory();bindService();bindPin();bindSettings();
  renderProducts();renderQuick();renderBatch();renderHistory();renderAudit();renderSettings();updateAdminUI();updatePreview();updateConnection();
  await registerServiceWorker();
  if(!state.settings.lastBackup)makeInternalBackup('Initialisation').catch(()=>{});
  if(navigator.onLine&&state.settings.sync?.enabled)syncNow(true).catch(()=>{});
}
