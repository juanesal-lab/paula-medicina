// Paso 2: inventario de mallas (SPEC 6.4) -> intermedio/inventario.json y comparacion con el inventario de la direccion
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBX, INTER, RAIZ, escribirJSON, leerJSON } from './comun.mjs';
import { cargarFBX, mallas, trisDe, leerTA2, casar, tipoDe } from './fbx.mjs';

const { mapa, filas, cabecera } = leerTA2();
console.log(`TA2.csv: ${filas} filas, ${mapa.size} terminos ingleses unicos. Cabecera: ${cabecera.slice(0, 6).join(' | ')}`);

const inv = [];
const v = new THREE.Vector3();
for (const f of FBX) {
  const root = cargarFBX(f.archivo);
  const ms = mallas(root);
  let ord = -1;
  for (const m of ms) {
    ord++;
    const g = m.obj.geometry;
    const tris = Math.round(trisDe(g));
    const c = casar(m.nombre, mapa);
    const tipo = tipoDe(m.nombre, tris, c);
    // bbox y centroide (promedio de vertices) en coordenadas world (cm)
    let bb = null, cen = null;
    if (tris > 0) {
      const pos = g.attributes.position, mw = m.obj.matrixWorld;
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], s = [0, 0, 0];
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mw);
        for (let k = 0; k < 3; k++) { const x = v.getComponent(k); if (x < mn[k]) mn[k] = x; if (x > mx[k]) mx[k] = x; s[k] += x; }
      }
      bb = [mn, mx].map(a => a.map(x => +x.toFixed(3)));
      cen = s.map(x => +(x / pos.count).toFixed(3));
    }
    inv.push({
      archivo: f.archivo, ord, nombre: m.nombre, tris, tipo,
      sufijo: c ? c.sufijo : null, ta2: c ? c.fila.ta2 : null, en: c ? c.fila.en : null,
      la: c ? c.fila.la : null, es: c ? c.fila.es : null,
      base: c ? c.base : null, grupos: m.ancestros, padreMalla: m.padreMalla,
      bbox: bb, centroide: cen,
    });
  }
  console.log(f.archivo, ms.length, 'mallas');
}
escribirJSON(path.join(INTER, 'inventario.json'), inv);
console.log('Total objetos:', inv.length);

// Comparacion contra docs/datos/inventario-zanatomy.json
const ref = leerJSON(path.join(RAIZ, 'docs', 'datos', 'inventario-zanatomy.json'));
const clave = (x) => x.archivo + '\u0001' + x.nombre;
const mref = new Map();
for (const r of ref) { const k = clave(r); if (!mref.has(k)) mref.set(k, []); mref.get(k).push(r); }
let comparables = 0, iguales = 0; const dif = []; let sinPar = 0; const sinParLista = [];
const usados = new Map();
for (const x of inv) {
  const k = clave(x); const arr = mref.get(k);
  const i = usados.get(k) || 0; usados.set(k, i + 1);
  if (!arr || !arr[i]) { sinPar++; sinParLista.push(k.replace('\u0001', ':')); continue; }
  const r = arr[i];
  comparables++;
  if ((r.ta2 ?? null) === (x.ta2 ?? null)) iguales++; else dif.push({ k: k.replace('\u0001', ':'), ref: r.ta2, nuevo: x.ta2 });
}
const pct = (100 * iguales / comparables).toFixed(2);
console.log(`Comparacion con inventario de la direccion: ${comparables} filas emparejadas por archivo+nombre, ta2 igual en ${iguales} (${pct}%). Sin pareja: ${sinPar}. ref=${ref.length}, nuevo=${inv.length}`);
if (dif.length) console.log('Diferencias de ta2 (primeras 20):', JSON.stringify(dif.slice(0, 20)));
if (sinParLista.length) console.log('Sin pareja (primeras 20):', sinParLista.slice(0, 20));
const tiposRef = {}, tiposNew = {};
ref.forEach(r => tiposRef[r.tipo] = (tiposRef[r.tipo] || 0) + 1); inv.forEach(r => tiposNew[r.tipo] = (tiposNew[r.tipo] || 0) + 1);
console.log('tipos ref:', JSON.stringify(tiposRef)); console.log('tipos nuevo:', JSON.stringify(tiposNew));
escribirJSON(path.join(INTER, 'comparacion-inventario.json'), { comparables, iguales, pct: +pct, sinPar, dif, sinParLista, refTotal: ref.length, nuevoTotal: inv.length, tiposRef, tiposNew }, 1);
if (+pct < 99) { console.error('ERROR: coincidencia de ta2 menor al 99 %'); process.exit(1); }
