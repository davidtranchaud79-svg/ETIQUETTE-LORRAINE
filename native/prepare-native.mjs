import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const here = resolve(new URL('.', import.meta.url).pathname);
const root = resolve(here, '..');
const out = resolve(here, 'www');

const files = [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'pdf40x30.js',
  'app.js',
  'core-v4.js',
  'print-v4.js',
  'data-v4.js',
  'settings-v4.js',
  'platform-v4.js',
  'printer-v4.js',
  'direct-print-v5.js',
  'sw.js'
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of files) await cp(resolve(root, file), resolve(out, file));
console.log('Étiquette Lorraine : ressources copiées dans native/www');
