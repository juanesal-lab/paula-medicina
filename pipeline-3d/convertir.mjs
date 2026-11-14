// Paso 4: FBX -> GLB por sistema (world -> escala 0,01 -> orientacion -> traslacion; weld, simplify, normales, prune, quantize, meshopt)
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { prune, quantize, meshopt, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { INTER, MODELOS, DIR, leerJSON, escribirJSON } from './comun.mjs';
import { calcularTransformacion } from './orient.mjs';
import { cargarFBX, mallas } from './fbx.mjs';
import { extraerPos, extraerIdx, soldar, simplificar, normalesSuaves, bboxDe, UMBRAL_SIN_SIMPLIFICAR } from './geom.mjs';

await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const R = leerJSON(path.join(DIR, 'reglas.json')); const P = R.presupuesto;
const inv = leerJSON(path.join(INTER, 'inventario.json'));
const cls = leerJSON(path.join(INTER, 'clasificado.json')).estructuras;
const T = calcularTransformacion(inv);
escribirJSON(path.join(INTER, 'transformacion.json'), T, 1);
console.log('Transformacion:', JSON.stringify({ rotY180: T.rotY180, espejoX: T.espejoX, escala: T.escala, offset: T.offset }));
fs.mkdirSync(MODELOS, { recursive: true });
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// presupuesto por sistema
const sysIds = [...new Set(cls.map(c => c.sistema))];
const trisIn = {}; for (const c of cls) trisIn[c.sistema] = (trisIn[c.sistema] || 0) + c.tris;
const presup = {};
for (const s of sysIds) {
  if (P.sistemas[s]) presup[s] = { ...P.sistemas[s] };
  else { const tot = P.visceral.sistemas.reduce((a, k) => a + (trisIn[k] || 0), 0); const f = trisIn[s] / tot; presup[s] = { ratio: P.visceral.ratio, bytes: Math.round(P.visceral.bytes * f), error: P.visceral.error }; }
}

// archivo -> sistemas
const porArchivo = {}; for (const c of cls) (porArchivo[c.archivo] ||= []).push(c);
const resultados = {}; const estructurasOut = {};

function areaDe(b) { let a = 0; const p = b.pos, ix = b.idx; for (let t = 0; t < ix.length; t += 3) { const i = ix[t] * 3, j = ix[t + 1] * 3, k = ix[t + 2] * 3; const ux = p[j] - p[i], uy = p[j + 1] - p[i + 1], uz = p[j + 2] - p[i + 2], vx = p[k] - p[i], vy = p[k + 1] - p[i + 1], vz = p[k + 2] - p[i + 2]; a += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); } return +a.toFixed(6); }
function construirYEscribir(sys, items, bases, ratio, error, opt) {
  let tris = 0; const doc = new Document(); const buf = doc.createBuffer(); const scene = doc.createScene(sys);
  const info = [];
  for (const c of items) {
    const b = bases.get(c.id);
    const m = simplificar(b, { ratio, error, lockBorder: R.presupuesto.lockBorder, ...(opt || {}) });
    const nrm = normalesSuaves(m.pos, m.idx);
    tris += m.idx.length / 3;
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buf))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx).setBuffer(buf));
    scene.addChild(doc.createNode(c.id).setMesh(doc.createMesh(c.id).addPrimitive(prim)));
    const [mn, mx] = bboxDe(m.pos);
    info.push({ id: c.id, tris_in: b.idx.length / 3, area_m2: areaDe(b), tris: m.idx.length / 3, centro: mn.map((v, k) => +((v + mx[k]) / 2).toFixed(4)), radio: +(Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2).toFixed(4) });
  }
  return { doc, tris, info };
}

for (const [archivo, lista] of Object.entries(porArchivo)) {
  console.log('==', archivo, lista.length, 'estructuras');
  const mm = mallas(cargarFBX(archivo));
  const bases = new Map();
  for (const c of lista) {
    const o = mm[c.ord].obj;
    bases.set(c.id, soldar(extraerPos(o, T), extraerIdx(o, T)));
  }
  mm.length = 0;
  for (const sys of [...new Set(lista.map(c => c.sistema))]) {
    const items = lista.filter(c => c.sistema === sys);
    const pr = presup[sys]; const tol = 1 + P.tolerancia;
    const entrada = items.reduce((a, c) => a + bases.get(c.id).idx.length / 3, 0);
    const ratio = pr.ratio, error = pr.error;
    const res = construirYEscribir(sys, items, bases, ratio, error, pr.opciones);
    await res.doc.transform(dedup(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const bin = await io.writeBinary(res.doc);
    if (bin.length > pr.bytes * tol) { console.error(`${sys}: ${bin.length} B supera el tope ${pr.bytes} (+10 %)`); process.exit(1); }
    fs.writeFileSync(path.join(MODELOS, sys + '.glb'), bin);
    resultados[sys] = { estructuras: items.length, tris_in: Math.round(entrada), tris_out: res.tris, bytes: bin.length, tope_bytes: pr.bytes, ratio, error };
    for (const i of res.info) estructurasOut[i.id] = i;
    console.log(`   ${sys}: ${items.length} estr, ${Math.round(entrada)} -> ${res.tris} tris, ${(bin.length / 1e6).toFixed(2)} MB (tope ${(pr.bytes / 1e6).toFixed(2)}), ratio ${ratio}, err ${error}`);
    if (!resultados[sys]) { console.error('No se logro ajustar', sys); process.exit(1); }
  }
}
escribirJSON(path.join(INTER, 'convertido.json'), { transformacion: T, sistemas: resultados, estructuras: estructurasOut }, 1);
console.log('Convertido. Total bytes:', Object.values(resultados).reduce((a, r) => a + r.bytes, 0));
