// Paso 3: clasifica cada estructura (sistema, subsistema, capa, region, grupo_es, id, lado, licencia)
import path from 'node:path';
import * as THREE from 'three';
import { INTER, DIR, leerJSON, escribirJSON, slug, norm } from './comun.mjs';
import { cargarFBX, mallas, leerTA2, casar } from './fbx.mjs';

const R = leerJSON(path.join(DIR, 'reglas.json'));
const inv = leerJSON(path.join(INTER, 'inventario.json'));
const { mapa: TA2 } = leerTA2();
const rx = (s) => { const i = s.startsWith('(?i)'); return new RegExp(i ? s.slice(4) : s, i ? 'i' : ''); };
const rutaDe = (x) => x.grupos.filter(g => g.endsWith('g')).map(g => g.slice(0, -1)).join('/');

// 1. seleccionar y nombrar
const orden = ['SkeletalSystem100', 'MuscularSystem100', 'CardioVascular41', 'NervousSystem100', 'VisceralSystem100', 'Joints100', 'LymphoidOrgans100', 'Regions_of_human_body100'];
const cand = [];
for (const x of inv) {
  let tipoMalla = 'estructura';
  let t = x.tipo;
  if (t === 'descartar' || t === 'etiqueta') continue;
  if (t === 'otro') { if (x.tris <= R.etiqueta_sin_ta2_max_tris) continue; t = 'estructura'; }
  if (t === 'origen' || t === 'insercion') tipoMalla = t;
  else if (t === 'estructura_sin_ta2') {
    if (x.tris <= R.etiqueta_sin_ta2_max_tris && /[ij]$/.test(x.nombre)) continue;   // etiquetas/anclas
    const m = x.nombre.match(/^(.+?)([eo])(\d+)([lr])$/);                              // parches origen/insercion sin TA2
    if (m && x.padreMalla) tipoMalla = m[2] === 'o' ? 'origen' : 'insercion';
  }
  cand.push({ ...x, tipoMalla, conTA2: x.ta2 !== null && t !== 'estructura_sin_ta2' });
}
// Alias de erratas del modelo: el objeto se trata como si se llamara igual que su gemelo bien escrito
for (const c of cand) {
  const al = (R.alias_objeto || {})[c.nombre]; if (!al || c.conTA2) continue;
  const m = casar(al, TA2); if (!m) throw new Error('Alias sin TA2: ' + al);
  Object.assign(c, { conTA2: true, base: m.base, sufijo: m.sufijo, ta2: m.fila.ta2, en: m.fila.en, la: m.fila.la, es: m.fila.es });
}
// Objetos sin letra de lado cuyo gemelo (mismo ta2 en el mismo archivo) la lleva: el lado que falta se deduce de la posicion (x < 0 derecha)
export const ladoDeducido = [];
{
  const lados = new Map();
  for (const c of cand) if (c.conTA2 && c.tipoMalla === 'estructura' && ['r', 'l'].includes(c.sufijo)) { const k = c.archivo + '|' + c.ta2 + '|' + c.base; (lados.get(k) || lados.set(k, new Set()).get(k)).add(c.sufijo); }
  for (const c of cand) {
    if (!c.conTA2 || c.tipoMalla !== 'estructura' || c.sufijo !== '' || !c.centroide || Math.abs(c.centroide[0]) < 0.5) continue;
    const s = lados.get(c.archivo + '|' + c.ta2 + '|' + c.base); if (!s || s.size !== 1) continue;
    const falta = s.has('r') ? 'l' : 'r'; if ((falta === 'r') !== (c.centroide[0] < 0)) continue;
    ladoDeducido.push({ nombre: c.nombre, ta2: c.ta2, lado: falta === 'r' ? 'derecho' : 'izquierdo', x_cm: c.centroide[0] }); c.sufijo = falta;
  }
}
escribirJSON(path.join(INTER, 'lado-deducido.json'), ladoDeducido, 1);
console.log('Lado deducido por gemelo:', JSON.stringify(ladoDeducido));

// Correccion de casos "<termino> + letra de lado" que casan con OTRO termino TA2 (Tibial = Tibia + l, Fibular = Fibula + r, Ulnar = Ulna + r):
// si el objeto termina en r/l, existe su gemelo contralateral y el nombre sin la letra es un termino TA2, manda el lado (SPEC 6.4 k=0 los confundia).
const nomSet = new Set(inv.map(x => x.archivo + '\u0001' + x.nombre));
export const lateralCorregidos = [];
if (R.preferir_lado_si_hay_pareja) for (const c of cand) {
  if (c.tipoMalla !== 'estructura' || !c.conTA2 || !['', "'"].includes(c.sufijo)) continue;
  const n = c.nombre.replace(/\.\d+$/, ''), u = n.slice(-1); if (u !== 'r' && u !== 'l') continue;
  const gemelo = n.slice(0, -1) + (u === 'r' ? 'l' : 'r'); if (!nomSet.has(c.archivo + '\u0001' + gemelo)) continue;
  const f = TA2.get(norm(n.slice(0, -1))); if (!f) continue;
  lateralCorregidos.push({ nombre: c.nombre, ta2_viejo: c.ta2, ta2_nuevo: f.ta2, en_viejo: c.en, en_nuevo: f.en });
  Object.assign(c, { base: n.slice(0, -1), sufijo: u, ta2: f.ta2, en: f.en, la: f.la, es: f.es });
}
escribirJSON(path.join(INTER, 'lateral-corregidos.json'), lateralCorregidos, 1);
console.log('Casos lado-vs-termino corregidos:', JSON.stringify(lateralCorregidos));

// pares laterales para las estructuras sin TA2
const nombresPorArchivo = {};
for (const c of cand) (nombresPorArchivo[c.archivo] ||= new Set()).add(c.nombre);
for (const c of cand) {
  c.lado = null; c.baseNombre = null;
  if (c.conTA2) {
    c.baseNombre = c.base;
    if (c.sufijo === 'r' || /r$/.test(c.sufijo)) c.lado = 'derecho'; else if (c.sufijo === 'l' || /l$/.test(c.sufijo)) c.lado = 'izquierdo';
    if (c.tipoMalla === 'estructura' && !['r', 'l'].includes(c.sufijo)) c.lado = null;
  } else {
    const n = c.nombre.replace(/\.\d+$/, ''); const u = n.slice(-1);
    const par = u === 'r' ? n.slice(0, -1) + 'l' : u === 'l' ? n.slice(0, -1) + 'r' : null;
    if (c.tipoMalla !== 'estructura') { const m = n.match(/^(.+?)[eo]\d+([lr])$/); c.baseNombre = m ? m[1] : n; c.lado = m ? (m[2] === 'r' ? 'derecho' : 'izquierdo') : null; }
    else if (par && nombresPorArchivo[c.archivo].has(par)) { c.lado = u === 'r' ? 'derecho' : 'izquierdo'; c.baseNombre = n.slice(0, -1); }
    else if (/\)[lr]$/.test(n)) { c.lado = u === 'r' ? 'derecho' : 'izquierdo'; c.baseNombre = n.slice(0, -1); }   // erratas del modelo: '(M3_segment)l' sin pareja con el mismo nombre
    else c.baseNombre = n;
  }
}

// 2. sistema / subsistema / capa
const grupoMatch = (re, ruta) => rx(re).test(ruta);
function aplicarReglas(c) {
  const ruta = rutaDe(c);
  for (const r of R.sistema) {
    if (r.archivo && r.archivo !== c.archivo) continue;
    if (r.tipoMalla && !r.tipoMalla.includes(c.tipoMalla)) continue;
    if (r.grupo && !grupoMatch(r.grupo, ruta)) continue;
    if (r.nombre && !rx(r.nombre).test(c.baseNombre.replace(/_/g, '_'))) continue;
    let sub = r.subsistema || null;
    if (r.subsistemaPorGrupo) { const s = R.subsistema_por_grupo.find(g => grupoMatch(g.grupo, ruta)); sub = s ? s.subsistema : (/vena/i.test(c.baseNombre) ? 'venas' : 'arterias'); }
    if (!sub) { const l = (R.subsistema_otros[c.archivo] || []).find(g => grupoMatch(g.grupo, ruta)); sub = l ? l.subsistema : 'general'; }
    return { sistema: r.sistema, subsistema: sub, capa: r.capa, regla: r };
  }
  return null;
}
for (const c of cand) {
  const a = aplicarReglas(c);
  if (!a) throw new Error('Sin regla: ' + c.archivo + ' ' + c.nombre);
  Object.assign(c, { sistema: a.sistema, subsistema: a.subsistema, capa: a.capa });
}
// los vasos sin grupo de sistema en el nombre: venas por nombre en el archivo Cardio (ya cubierto por grupo Venous_system)

// 3. capas de musculo por heuristica (distancia a la piel)
const musc = cand.filter(c => c.capa === 'heuristica');
const CM = R.capas_musculo;
const piel = mallas(cargarFBX('Regions_of_human_body100'));
const pts = [];
{
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3();
  for (const m of piel) {
    const g = m.obj.geometry, pa = g.attributes.position, mw = m.obj.matrixWorld, ix = g.index;
    const nt = (ix ? ix.count : pa.count) / 3;
    for (let t = 0; t < nt; t++) {
      const i0 = ix ? ix.getX(3 * t) : 3 * t, i1 = ix ? ix.getX(3 * t + 1) : 3 * t + 1, i2 = ix ? ix.getX(3 * t + 2) : 3 * t + 2;
      a.fromBufferAttribute(pa, i0).applyMatrix4(mw); b.fromBufferAttribute(pa, i1).applyMatrix4(mw); c3.fromBufferAttribute(pa, i2).applyMatrix4(mw);
      const L = Math.max(a.distanceTo(b), b.distanceTo(c3), a.distanceTo(c3));
      const n = Math.max(1, Math.ceil(L / CM.espaciado_muestreo_piel_cm));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        pts.push(a.x * w + b.x * u + c3.x * v, a.y * w + b.y * u + c3.y * v, a.z * w + b.z * u + c3.z * v);
      }
    }
  }
}
const P = Float32Array.from(pts); const NP = P.length / 3;
let mn = [Infinity, Infinity, Infinity], mxx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < NP; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[3 * i + k]); mxx[k] = Math.max(mxx[k], P[3 * i + k]); }
const dim = mn.map((v, k) => Math.ceil(mxx[k] - v) + 3);
const head = new Int32Array(dim[0] * dim[1] * dim[2]).fill(-1), next = new Int32Array(NP);
const cel = (x, k) => Math.floor(x - mn[k]) + 1;
for (let i = 0; i < NP; i++) { const id = (cel(P[3 * i], 0) * dim[1] + cel(P[3 * i + 1], 1)) * dim[2] + cel(P[3 * i + 2], 2); next[i] = head[id]; head[id] = i; }
function distPiel(x, y, z) {
  const cx = cel(x, 0), cy = cel(y, 1), cz = cel(z, 2); let mejor = Infinity;
  for (let r = 0; r <= CM.radio_busqueda_celdas; r++) {
    for (let ix = cx - r; ix <= cx + r; ix++) for (let iy = cy - r; iy <= cy + r; iy++) for (let iz = cz - r; iz <= cz + r; iz++) {
      if (Math.max(Math.abs(ix - cx), Math.abs(iy - cy), Math.abs(iz - cz)) !== r) continue;
      if (ix < 0 || iy < 0 || iz < 0 || ix >= dim[0] || iy >= dim[1] || iz >= dim[2]) continue;
      for (let p = head[(ix * dim[1] + iy) * dim[2] + iz]; p >= 0; p = next[p]) {
        const d = Math.hypot(P[3 * p] - x, P[3 * p + 1] - y, P[3 * p + 2] - z); if (d < mejor) mejor = d;
      }
    }
    if (mejor <= r) break;
  }
  return Math.min(mejor, CM.radio_busqueda_celdas + 1);
}
const mus = mallas(cargarFBX('MuscularSystem100'));
const distancias = {};
for (const c of musc) {
  const o = mus[c.ord].obj, pa = o.geometry.attributes.position, mw = o.matrixWorld, v = new THREE.Vector3();
  const paso = Math.max(1, Math.floor(pa.count / CM.muestras_por_malla)); const ds = [];
  for (let i = 0; i < pa.count; i += paso) { v.fromBufferAttribute(pa, i).applyMatrix4(mw); ds.push(distPiel(v.x, v.y, v.z)); }
  ds.sort((a, b) => a - b); const med = ds[Math.floor(ds.length / 2)];
  c.distPiel = +med.toFixed(2); c.capa = med < CM.umbral_cm ? 1 : 2; distancias[c.nombre] = c.distPiel;
}
escribirJSON(path.join(INTER, 'capas-musculos.json'), { umbral_cm: CM.umbral_cm, puntos_piel: NP, distancias }, 1);
const controles = { 'Acromial_part_of_deltoid_muscler': 1, 'Clavicular_head_of_pectoralis_major_muscler': 1, 'Descending_part_of_trapezius_muscler': 1, 'Rectus_abdominis_muscler': 1, 'Supraspinatus_muscler': 2, 'Psoas_majorr': 2, 'Transversus_abdominis_muscler': 2, 'Subscapularis_muscler': 2, 'Iliacus_muscler': 2, 'Tibialis_anterior_muscler': 1 };
console.log('Controles de capa (distancia mediana a piel en cm -> capa; umbral ' + CM.umbral_cm + '):');
const ctrl = [];
for (const [k, esp] of Object.entries(controles)) { const f = cand.find(c => c.nombre === k); const ok = f && f.capa === esp; ctrl.push({ nombre: k, dist_cm: f ? f.distPiel : null, capa: f ? f.capa : null, esperada: esp, ok }); console.log('  ', k, f && f.distPiel, '->', f && f.capa, '(esperada ' + esp + ')', ok ? 'OK' : 'FALLA'); }
escribirJSON(path.join(INTER, 'capas-controles.json'), ctrl, 1);

// 4. region
const C = R.region_por_centroide_cm;
for (const c of cand) {
  const ruta = rutaDe(c); let reg = null;
  const rn = R.region_por_nombre.find(r => rx(r.nombre).test(c.baseNombre)); if (rn) reg = rn.region;
  if (!reg) { const rg = R.region_por_grupo.find(r => grupoMatch(r.grupo, ruta)); if (rg) reg = rg.region; }
  if (!reg && c.centroide) {
    const [x, y] = c.centroide; const alto = c.bbox ? c.bbox[1][1] - c.bbox[0][1] : 0;
    if (alto > C.general_si_altura_mayor_cm) reg = 'general';
    else if (y >= C.cabeza_min_y) reg = 'cabeza'; else if (y >= C.cuello_min_y) reg = 'cuello';
    else if (Math.abs(x) > C.brazo_abs_x && y > 70) reg = 'miembro superior';
    else if (y >= C.torax_min_y) reg = 'tórax'; else if (y >= C.abdomen_min_y) reg = 'abdomen'; else if (y >= C.pelvis_min_y) reg = 'pelvis'; else reg = 'miembro inferior';
  }
  c.region = reg || 'general';
  if (c.sistema === 'piel') c.region = c.region === 'general' ? 'general' : c.region;
}

// 5. grupo_es: el grupo mas profundo con nombre TA2 (en espanol)
const cacheG = new Map();
function grupoEs(g) {
  const b = g.slice(0, -1); if (cacheG.has(b)) return cacheG.get(b);
  const f = TA2.get(norm(b)); const v = f && f.es ? f.es : null; cacheG.set(b, v); return v;
}
for (const c of cand) {
  const gs = c.grupos.filter(g => g.endsWith('g')); let es = null;
  for (let i = gs.length - 1; i >= 0 && !es; i--) es = grupoEs(gs[i]);
  c.grupo_es = es || (gs.length ? gs[gs.length - 1].slice(0, -1).replace(/_/g, ' ') : 'Sin grupo');
}

// 6. licencias NC
for (const c of cand) {
  c.licencia = 'CC-BY-SA-4.0'; const ruta = rutaDe(c);
  for (const l of R.licencias_nc) {
    if (l.archivo && l.archivo !== c.archivo) continue;
    if (l.grupo && !rx(l.grupo).test(ruta)) continue;
    if (rx(l.nombre).test(c.baseNombre)) { c.licencia = l.licencia; break; }
  }
}

// 7. ids unicos (SPEC 6.4)
const usados = new Set();
for (const o of orden) for (const c of cand.filter(x => x.archivo === o)) {
  let base = slug(c.baseNombre);
  if (c.tipoMalla !== 'estructura') {
    const m = c.nombre.match(/([eo])(\d*)([lr])$/); base += '_' + (c.tipoMalla === 'origen' ? 'origen' : 'insercion') + (m && m[2] ? '_' + m[2] : '');
  }
  let id = base + (c.lado === 'derecho' ? '_d' : c.lado === 'izquierdo' ? '_i' : '');
  let n = 2; const id0 = id; while (usados.has(id)) id = id0 + '_' + n++;
  usados.add(id); c.id = id;
}

// 8. verificacion de lateralidad con TODAS las estructuras con lado
let ok = 0, mal = 0; const malos = [];
for (const c of cand) if (c.lado && c.centroide && c.tipoMalla === 'estructura') {
  const esperado = c.lado === 'derecho' ? c.centroide[0] < 0 : c.centroide[0] > 0;
  if (Math.abs(c.centroide[0]) < 0.3) continue;
  if (esperado) ok++; else { mal++; malos.push(c.nombre + ' x=' + c.centroide[0]); }
}
console.log(`Lateralidad (todas las estructuras con lado): ${ok} coherentes, ${mal} incoherentes`, malos.slice(0, 12));

const out = cand.sort((a, b) => orden.indexOf(a.archivo) - orden.indexOf(b.archivo) || a.ord - b.ord);
escribirJSON(path.join(INTER, 'clasificado.json'), { lateralidad: { ok, mal, malos }, estructuras: out });
const cuenta = {}; for (const c of out) { const k = c.sistema; cuenta[k] = (cuenta[k] || 0) + 1; }
console.log('Estructuras por sistema:', JSON.stringify(cuenta), 'total', out.length);
const capas = {}; for (const c of out) capas[c.capa] = (capas[c.capa] || 0) + 1; console.log('Por capa:', JSON.stringify(capas));
const regs = {}; for (const c of out) regs[c.region] = (regs[c.region] || 0) + 1; console.log('Por region:', JSON.stringify(regs));
