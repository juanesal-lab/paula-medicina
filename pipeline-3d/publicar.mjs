// Copia lo generado en intermedio/stage/app a app/ de una sola vez (la app puede estar abierta contra app/modelos)
import fs from 'node:fs';
import path from 'node:path';
import { DIR, RAIZ } from './comun.mjs';
const S = path.join(DIR, 'intermedio', 'stage', 'app'), A = path.join(RAIZ, 'app');
const mover = [['modelos', f => f.endsWith('.glb')], ['datos', f => f === 'catalogo.json' || f === 'sistemas.json'], ['.', f => f === 'ATRIBUCIONES.md']];
const lote = [];
for (const [d, ok] of mover) for (const f of fs.readdirSync(path.join(S, d)).filter(ok)) lote.push([path.join(S, d, f), path.join(A, d, f)]);
// 1) copiar cada archivo a un .nuevo junto a su destino; 2) renombrar todos seguidos (rename es atomico por archivo)
for (const [o, d] of lote) { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(o, d + '.nuevo'); }
for (const [, d] of lote) fs.renameSync(d + '.nuevo', d);
console.log('Publicados', lote.length, 'archivos en app/');
