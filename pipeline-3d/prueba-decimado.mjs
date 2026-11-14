// Paso 0 (R1): prueba de calidad del decimado con capturas en software (sin navegador).
// Uso: node prueba-decimado.mjs   -> capturas/r1-<vista>-{ref,A,B,C}.png y capturas/r1-<vista>-montaje.png, intermedio/r1-metricas.json
import path from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';
import { CAPTURAS, INTER, leerJSON, escribirJSON } from './comun.mjs';
import { calcularTransformacion } from './orient.mjs';
import { cargarFBX, mallas } from './fbx.mjs';
import { extraerPos, extraerIdx, soldar, simplificar, bboxDe } from './geom.mjs';
import { render, escribirPNG } from './raster.mjs';

await MeshoptSimplifier.ready;
const inv = leerJSON(path.join(INTER, 'inventario.json'));
const T = calcularTransformacion(inv);
const CONFIGS = { ref: null, A: { ratio: 0.35, error: 0.002 }, B: { ratio: 0.2, error: 0.005 }, C: { ratio: 0.12, error: 0.01 } };
const COL = { oseo: [0.91, 0.86, 0.77], musculo: [0.72, 0.33, 0.24], nervio: [0.93, 0.78, 0.28], arteria: [0.85, 0.2, 0.25], vena: [0.25, 0.4, 0.8], cerebro: [0.85, 0.75, 0.65] };
const esEstructura = (x) => x.tris > 0 && ['estructura', 'estructura_sin_ta2', 'otro'].includes(x.tipo) && x.tris > 13;

const A = inv.filter(esEstructura);
const cen = (n, a) => inv.find(x => x.nombre === n && x.archivo === a).centroide.map(c => c * 0.01);
const manoC = (() => { const c = inv.find(x => x.nombre === 'Capitate_boner').centroide; return [c[0], c[1], c[2]]; })();
const dist = (c, o) => Math.hypot(c[0] - o[0], c[1] - o[1], c[2] - o[2]);
const grp = (x, g) => x.grupos.includes(g);

const VISTAS = [
  { id: 'a-cara-craneo', desc: 'cara y craneo (hueso + musculos de cabeza), anterior',
    sel: (x) => (x.archivo === 'SkeletalSystem100' && (grp(x, 'Craniumg') || grp(x, 'Extracranial_bones_of_headg')) && !x.padreMalla) || (x.archivo === 'MuscularSystem100' && grp(x, 'Muscles_of_headg')),
    color: (x) => x.archivo.startsWith('Skel') ? COL.oseo : COL.musculo, dir: [0, 0.05, 1] },
  { id: 'b-mano-derecha', desc: 'mano derecha (huesos, nervios, vasos), anterior',
    sel: (x) => ['SkeletalSystem100', 'NervousSystem100', 'CardioVascular41'].includes(x.archivo) && !x.padreMalla && x.centroide && dist(x.centroide, manoC) < 11 && /r$/.test(x.nombre) && x.tipo !== 'origen' && x.tipo !== 'insercion',
    color: (x) => x.archivo.startsWith('Skel') ? COL.oseo : x.archivo.startsWith('Mus') ? COL.musculo : x.archivo.startsWith('Ner') ? COL.nervio : COL.arteria, dir: [0, 0, 1] },
  { id: 'c-corazon', desc: 'corazon y vasos coronarios, anterior',
    sel: (x) => x.archivo === 'CardioVascular41' && (grp(x, 'Heartg') || grp(x, 'Arteries_of_heartg') || grp(x, 'Cardiac_veinsg') || grp(x, 'Valvular_complex_of_heartg')),
    color: (x) => grp(x, 'Venous_systemg') ? COL.vena : COL.arteria, dir: [0.1, 0.1, 1] },
  { id: 'd-plexo-braquial-der', desc: 'plexo braquial derecho (nervios), anterior',
    sel: (x) => x.archivo === 'NervousSystem100' && grp(x, 'Brachial_plexusg') && /r$/.test(x.nombre),
    color: () => COL.nervio, dir: [0, 0, 1], zonaSuperior: 0.17 },
  { id: 'e-encefalo-lateral', desc: 'encefalo, lateral (desde la izquierda del paciente)',
    sel: (x) => x.archivo === 'NervousSystem100' && grp(x, 'Braing'),
    color: () => COL.cerebro, dir: [1, 0, 0.02] },
];

const cache = {};
const metricas = [];
for (const V of VISTAS) {
  const sel = A.filter(V.sel);
  console.log(V.id, sel.length, 'estructuras');
  const porArchivo = {};
  sel.forEach(x => (porArchivo[x.archivo] ||= []).push(x));
  const base = []; // {x, pos, idx}
  for (const [arch, lst] of Object.entries(porArchivo)) {
    cache[arch] ||= mallas(cargarFBX(arch));
    for (const x of lst) {
      const o = cache[arch][x.ord].obj;
      const s = soldar(extraerPos(o, T), extraerIdx(o, T));
      base.push({ x, ...s });
    }
  }
  const todo = base.flatMap(b => Array.from(b.pos));
  // encuadre sobre la union (en metros)
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const b of base) { const [a, c] = bboxDe(b.pos); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a[k]); mx[k] = Math.max(mx[k], c[k]); } }
  const centro = mn.map((v, k) => (v + mx[k]) / 2), semi = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2 * 1.12;
  let centro2 = centro, semi2 = semi;
  if (V.zonaSuperior) { // encuadre solo sobre la zona alta (plexo), no sobre todo el brazo
    const corte = mx[1] - V.zonaSuperior; const a = [Infinity, Infinity, Infinity], c = [-Infinity, -Infinity, -Infinity];
    for (const b of base) for (let i = 0; i < b.pos.length; i += 3) if (b.pos[i + 1] > corte) for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], b.pos[i + k]); c[k] = Math.max(c[k], b.pos[i + k]); }
    centro2 = a.map((v, k) => (v + c[k]) / 2); semi2 = Math.max(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / 2 * 1.12;
  }
  const imgs = {};
  for (const [cid, cfg] of Object.entries(CONFIGS)) {
    let tris = 0;
    const items = base.map(b => {
      const m = cfg ? simplificar(b, { ...cfg, lockBorder: true }) : b;
      tris += m.idx.length / 3;
      return { pos: m.pos, idx: m.idx, color: V.color(b.x) };
    });
    const r = render(items, { dir: V.dir, centro: centro2, semi: semi2, size: 800 });
    const f = path.join(CAPTURAS, `r1-${V.id}-${cid}.png`);
    escribirPNG(f, 800, 800, r.img);
    imgs[cid] = r.img;
    metricas.push({ vista: V.id, config: cid, ...(cfg || {}), estructuras: base.length, tris });
    console.log('  ', cid, tris, 'tris');
  }
  // montaje 2x2: ref | A / B | C
  const M = new Uint8Array(1600 * 1600 * 3);
  [['ref', 0, 0], ['A', 800, 0], ['B', 0, 800], ['C', 800, 800]].forEach(([k, ox, oy]) => {
    for (let y = 0; y < 800; y++) M.set(imgs[k].subarray(y * 2400, (y + 1) * 2400), ((oy + y) * 1600 + ox) * 3);
  });
  escribirPNG(path.join(CAPTURAS, `r1-${V.id}-montaje.png`), 1600, 1600, M);
}
escribirJSON(path.join(CAPTURAS, 'r1-metricas.json'), metricas, 1);
