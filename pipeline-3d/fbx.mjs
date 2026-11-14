// Carga de FBX en Node (sin DOM) y recorrido de mallas con su ruta de grupos
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { CRUDO, norm } from './comun.mjs';

export function cargarFBX(archivo) {
  const buf = fs.readFileSync(path.join(CRUDO, archivo + '.fbx'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const root = new FBXLoader().parse(ab, '');
  root.updateMatrixWorld(true);
  return root;
}

// Devuelve [{ obj, nombre, ancestros:[grupos no-malla], padreMalla }]
export function mallas(root) {
  const out = [];
  const rec = (o, anc, pm) => {
    const esMalla = o.isMesh || o.isSkinnedMesh;
    if (esMalla) out.push({ obj: o, nombre: o.name, ancestros: anc.slice(), padreMalla: pm });
    const sig = (!esMalla && o !== root && o.name) ? anc.concat(o.name) : anc;
    for (const h of o.children) rec(h, sig, esMalla ? o.name : pm);
  };
  rec(root, [], null);
  return out;
}

export function trisDe(g) { return g.index ? g.index.count / 3 : g.attributes.position.count / 3; }

// Lee TA2.csv: separador ';', cada linea entre comillas, BOM, cabecera en fila 1
export function leerTA2() {
  let t = fs.readFileSync(path.join(CRUDO, 'TA2.csv'), 'utf8');
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  const lineas = t.split(/\r?\n/).filter(l => l.length);
  const quitar = (l) => { l = l.trim(); if (l.startsWith('"')) l = l.slice(1); if (l.endsWith('"')) l = l.slice(0, -1); return l; };
  const cab = quitar(lineas[0]).split(';');
  const col = (n) => cab.findIndex(c => c.trim().toLowerCase() === n.toLowerCase());
  const iID = col('TA2ID'), iEn = col('English'), iLa = col('Latin'), iEs = col('Español');
  if ([iID, iEn, iLa, iEs].some(i => i < 0)) throw new Error('Cabecera TA2 inesperada: ' + cab.slice(0, 8).join('|'));
  const mapa = new Map(); let filas = 0;
  for (let i = 1; i < lineas.length; i++) {
    const c = quitar(lineas[i]).split(';');
    filas++;
    const en = (c[iEn] || '').trim();
    if (!en) continue;
    const k = norm(en);
    if (!mapa.has(k)) mapa.set(k, { ta2: c[iID].trim(), en, la: (c[iLa] || '').trim(), es: (c[iEs] || '').trim() });
  }
  return { mapa, filas, cabecera: cab };
}

// Algoritmo SPEC 6.4: nombre sin sufijo Blender, probar k=0..3 caracteres finales
export function casar(nombre, mapa) {
  const n0 = nombre.replace(/\.\d+$/, '');
  for (let k = 0; k <= 3; k++) {
    if (n0.length - k < 1) break;
    const base = n0.slice(0, n0.length - k);
    const f = mapa.get(norm(base));
    if (f) return { base, sufijo: n0.slice(n0.length - k), fila: f };
  }
  return null;
}

export function tipoDe(nombre, tris, m) {
  if (tris === 0 || /^Cross_Section/i.test(nombre)) return 'descartar';
  if (!m) return 'estructura_sin_ta2';
  const s = m.sufijo;
  if (s === '' || s === 'r' || s === 'l') return 'estructura';
  if (s === 'i' || s === 'j') return 'etiqueta';
  if (/^o\d*[lr]$/.test(s)) return 'origen';
  if (/^e\d*[lr]$/.test(s)) return 'insercion';
  return 'otro';
}
