// Capturas de los GLB finales (decodificados desde app/modelos) con el rasterizador por software. -> capturas/final-*.png
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { MODELOS, DATOS, CAPTURAS, leerJSON } from './comun.mjs';
import { render, escribirPNG } from './raster.mjs';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const cat = leerJSON(path.join(DATOS, 'catalogo.json')).estructuras; const porId = new Map(cat.map(e => [e.id, e]));
const cache = {};
async function cargar(sis) {
  if (cache[sis]) return cache[sis];
  const doc = await io.read(path.join(MODELOS, sis + '.glb')); const out = new Map();
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const a = p.getAttribute('POSITION'), ix = p.getIndices(); const pos = new Float32Array(a.getCount() * 3); const v = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); pos[3 * i] = W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12]; pos[3 * i + 1] = W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13]; pos[3 * i + 2] = W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14]; }
      out.set(n.getName(), { pos, idx: Uint32Array.from(ix.getArray()) });
    }
  }
  return (cache[sis] = out);
}
const COL = { oseo: [0.91, 0.86, 0.77], muscular: [0.72, 0.33, 0.24], nervioso: [0.93, 0.78, 0.28], arteria: [0.85, 0.2, 0.25], vena: [0.25, 0.4, 0.8], snc: [0.85, 0.75, 0.65] };
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pie = porId.get('talus_d').centro;
const mano = porId.get('capitate_bone_d').centro, corazon = porId.get('left_ventricle').centro;
const VISTAS = [
  { id: 'a-cara-craneo', sel: e => (e.sistema === 'oseo' && e.subsistema === 'craneo') || (e.sistema === 'muscular' && e.region === 'cabeza'), dir: [0, 0.05, 1] },
  { id: 'b-mano-derecha', sel: e => ['oseo', 'nervioso', 'cardiovascular'].includes(e.sistema) && d(e.centro, mano) < 0.11 && e.lado === 'derecho', dir: [0, 0, 1] },
  { id: 'c-corazon', sel: e => e.sistema === 'cardiovascular' && d(e.centro, corazon) < 0.09 && e.capa === 5, dir: [0.1, 0.1, 1] },
  { id: 'd-plexo-braquial-der', sel: e => e.sistema === 'nervioso' && e.lado === 'derecho' && /braquial/i.test(e.grupo_es) , dir: [0, 0, 1], zonaSuperior: 0.17 },
  { id: 'e-encefalo-lateral', sel: e => e.sistema === 'nervioso' && e.subsistema === 'snc' && e.centro[1] > 1.45 && e.region === 'cabeza', dir: [1, 0, 0.02] },
  { id: 'a2-craneo-oseo', sel: e => e.sistema === 'oseo' && (e.subsistema === 'craneo'), dir: [0.35, 0.1, 1] },
  { id: 'f-pie-derecho', sel: e => e.sistema === 'oseo' && e.lado === 'derecho' && d(e.centro, pie) < 0.13, dir: [-0.5, 0.8, 1] },
  { id: 'g-columna-cervical', sel: e => e.sistema === 'oseo' && ['atlas_c1', 'axis_c2', 'vertebra_c3', 'vertebra_c4', 'vertebra_c5', 'vertebra_c6', 'vertebra_c7', 'hyoid_bone'].includes(e.id), dir: [1, 0.15, 0.35] },
  { id: 'cuerpo-oseo-muscular', sel: e => (e.sistema === 'oseo') || (e.sistema === 'muscular' && e.capa === 1), dir: [0, 0, 1], cuerpo: true },
];
for (const V of VISTAS) {
  const sel = cat.filter(V.sel); const base = [];
  for (const e of sel) { const g = (await cargar(e.sistema)).get(e.id); if (g) base.push({ e, ...g }); }
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const b of base) for (let i = 0; i < b.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], b.pos[i + k]); mx[k] = Math.max(mx[k], b.pos[i + k]); }
  let ctr = mn.map((v, k) => (v + mx[k]) / 2), semi = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2 * 1.12;
  if (V.zonaSuperior) { const corte = mx[1] - V.zonaSuperior, a = [Infinity, Infinity, Infinity], c = [-Infinity, -Infinity, -Infinity]; for (const b of base) for (let i = 0; i < b.pos.length; i += 3) if (b.pos[i + 1] > corte) for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], b.pos[i + k]); c[k] = Math.max(c[k], b.pos[i + k]); } ctr = a.map((v, k) => (v + c[k]) / 2); semi = Math.max(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / 2 * 1.12; }
  const col = (e) => e.sistema === 'cardiovascular' ? (e.subsistema === 'venas' ? COL.vena : COL.arteria) : e.subsistema === 'snc' ? COL.snc : COL[e.sistema];
  const r = render(base.map(b => ({ pos: b.pos, idx: b.idx, color: col(b.e) })), { dir: V.dir, centro: ctr, semi, size: 800 });
  escribirPNG(path.join(CAPTURAS, `final-${V.id}.png`), 800, 800, r.img);
  console.log('final-' + V.id + '.png', base.length, 'estructuras');
}
