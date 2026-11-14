// Paso 1: descarga los 8 FBX y TA2.csv a crudo/ verificando SHA-256 (commits fijados, SPEC 6.2)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CRUDO, FBX, TA2, COMMIT_Z, COMMIT_TA2 } from './comun.mjs';

fs.mkdirSync(CRUDO, { recursive: true });
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const items = FBX.map(f => ({
  destino: f.archivo + '.fbx', sha: f.sha, bytes: f.bytes,
  url: `https://raw.githubusercontent.com/LluisV/Z-Anatomy/${COMMIT_Z}/Resources/Models/FBX/${encodeURIComponent(f.fichero || f.archivo)}.fbx`,
}));
items.push({ destino: TA2.fichero, sha: TA2.sha, bytes: TA2.bytes,
  url: `https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/${COMMIT_TA2}/TA2.csv` });

for (const it of items) {
  const p = path.join(CRUDO, it.destino);
  if (fs.existsSync(p) && sha(p) === it.sha) { console.log('ok (ya existe)', it.destino); continue; }
  let ultimo;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      process.stdout.write(`descargando ${it.destino} (${(it.bytes / 1e6).toFixed(1)} MB) intento ${intento}... `);
      // curl respeta HTTPS_PROXY/ALL_PROXY del entorno (el fetch de Node no)
      execFileSync('curl', ['-fsSL', '--retry', '2', '--max-time', '300', '-o', p + '.tmp', it.url], { stdio: 'pipe' });
      const buf = fs.readFileSync(p + '.tmp');
      if (crypto.createHash('sha256').update(buf).digest('hex') !== it.sha) throw new Error('SHA-256 distinto');
      fs.renameSync(p + '.tmp', p);
      console.log('ok'); ultimo = null; break;
    } catch (e) { console.log('fallo:', e.message); ultimo = e; }
  }
  if (ultimo) { console.error('No se pudo obtener', it.destino); process.exit(1); }
}
console.log('Descarga verificada.');
