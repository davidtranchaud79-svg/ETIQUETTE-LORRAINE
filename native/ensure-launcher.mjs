// Vérifie et corrige la déclaration Android LAUNCHER après synchronisation Capacitor.
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const manifest=resolve('android/app/src/main/AndroidManifest.xml');
try{await access(manifest)}catch{console.error('Projet Android absent. Exécuter : npx cap add android');process.exit(1)}
let xml=await readFile(manifest,'utf8');
const activity=/<activity\b[^>]*>[\s\S]*?<\/activity>/g;
let matched=false,changed=false;
xml=xml.replace(activity,block=>{
 if(matched)return block;
 if(!/android:name="\.MainActivity"|android:name="fr\.etiquettelorraine\.app\.MainActivity"/.test(block))return block;
 matched=true;
 let result=block;
 if(!/android:exported="true"/.test(result)){
  if(/android:exported="false"/.test(result))result=result.replace('android:exported="false"','android:exported="true"');
  else result=result.replace(/<activity\b/,'<activity android:exported="true"');
  changed=true;
 }
 const hasMain=/android\.intent\.action\.MAIN/.test(result);
 const hasLauncher=/android\.intent\.category\.LAUNCHER/.test(result);
 if(!hasMain||!hasLauncher){
  const filter='\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        ';
  result=result.replace('</activity>',filter+'</activity>');
  changed=true;
 }
 return result;
});
if(!matched){console.error('MainActivity introuvable dans AndroidManifest.xml');process.exit(1)}
if(changed){await writeFile(manifest,xml);console.log('Android : icône de lancement et activité exportée corrigées.')}
else console.log('Android : MAIN / LAUNCHER déjà configurés correctement.');
