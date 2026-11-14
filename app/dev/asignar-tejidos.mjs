// Informe de asignación estructura -> tejido contra un catálogo.
// Uso: cd app/dev && node --no-warnings --import ./registrar-importmap.mjs asignar-tejidos.mjs [ruta/al/catalogo.json] [--lista-defecto] [--lista-pelicula]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilarReglas, informeAsignacion } from '../js/tejidos.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ruta = args.find((a) => !a.startsWith('--')) || path.join(APP, 'datos/catalogo.json');
const c = compilarReglas(JSON.parse(fs.readFileSync(path.join(APP, 'datos/tejidos.json'), 'utf8')));
const cat = JSON.parse(fs.readFileSync(ruta, 'utf8'));
const inf = informeAsignacion(c, cat.estructuras);
console.log(`Estructuras: ${cat.estructuras.length}`);
for (const [t, n] of [...inf.porTejido].sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(12)} ${String(n).padStart(5)}`);
const grupos = new Map();
for (const e of inf.porDefecto) { const k = `${e.sistema}/${e.subsistema} -> ${c.tejidoDe(e)}`; grupos.set(k, (grupos.get(k) || 0) + 1); }
console.log(`\nEn el tejido por defecto del sistema (ninguna regla coincidió): ${inf.porDefecto.length}`);
for (const [k, n] of [...grupos].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
if (args.includes('--lista-defecto')) for (const e of inf.porDefecto) console.log(`    ${e.sistema}/${e.subsistema}: ${e.nombre_es} (${e.nombre_la ?? '-'})`);
console.log(`\nSin tejido (color plano): ${inf.sinTejido.length}`);
// Sistema muscular: reparto por tejido y cuántas son película translúcida (fascias de revestimiento, aspecto realista).
const musc = cat.estructuras.filter((e) => e.sistema === 'muscular');
const pel = musc.filter((e) => c.esPelicula(e));
const reparto = new Map();
for (const e of musc) { const k = `${c.tejidoDe(e)}${c.esPelicula(e) ? ' (película translúcida)' : ''}`; reparto.set(k, (reparto.get(k) || 0) + 1); }
console.log(`\nSistema muscular (${musc.length}): fascias de revestimiento como película translúcida: ${pel.length}`);
for (const [k, n] of [...reparto].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(32)} ${String(n).padStart(5)}`);
if (args.includes('--lista-pelicula')) for (const e of pel) console.log(`    ${e.nombre_es}${e.lado ? ' (' + e.lado + ')' : ''}`);
// Reglas que nunca se usaron: suelen ser errores de escritura.
const usos = new Map();
for (const e of cat.estructuras) { const r = c.asignar(e).regla; usos.set(r, (usos.get(r) || 0) + 1); }
const muertas = c.reglas.filter((r) => !usos.has(r.id)).map((r) => r.id);
console.log(`Reglas sin ninguna coincidencia: ${muertas.length ? muertas.join(', ') : 'ninguna'}`);
