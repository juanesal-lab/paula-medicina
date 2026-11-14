// Geometria: extraccion world -> escena, soldadura, simplificacion (meshoptimizer) y normales suaves
import { MeshoptSimplifier } from 'meshoptimizer';

// Aplica matrixWorld (cm) + escala + orientacion + traslacion. Devuelve Float32Array en metros (escena final).
export function extraerPos(obj, T) {
  const g = obj.geometry, pa = g.attributes.position, mw = obj.matrixWorld.elements;
  const n = pa.count, out = new Float32Array(n * 3);
  const { rotY180, espejoX, escala, offset } = T;
  for (let i = 0; i < n; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    let wx = mw[0] * x + mw[4] * y + mw[8] * z + mw[12];
    let wy = mw[1] * x + mw[5] * y + mw[9] * z + mw[13];
    let wz = mw[2] * x + mw[6] * y + mw[10] * z + mw[14];
    if (rotY180) { wx = -wx; wz = -wz; }
    if (espejoX) wx = -wx;
    out[3 * i] = wx * escala + offset[0]; out[3 * i + 1] = wy * escala + offset[1]; out[3 * i + 2] = wz * escala + offset[2];
  }
  return out;
}

// Indices originales (o secuencia si no hay indice), invirtiendo el orden del triangulo si hay espejo
export function extraerIdx(obj, T) {
  const g = obj.geometry;
  const n = g.index ? g.index.count : g.attributes.position.count;
  const idx = new Uint32Array(n);
  if (g.index) for (let i = 0; i < n; i++) idx[i] = g.index.getX(i); else for (let i = 0; i < n; i++) idx[i] = i;
  // El FBX trae matrices con determinante negativo (objetos del lado izquierdo espejados). three.js lo compensa al
  // dibujar (frontFace), pero al hornear la matriz hay que invertir el devanado. Tambien se invierte si espejoX.
  const m = obj.matrixWorld.elements;
  const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
  const invertir = (det < 0) !== !!T.espejoX;
  if (invertir) for (let i = 0; i < n; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return idx;
}

// Suelda vertices por posicion (cuantizada a 1e-5 m = 10 micras) y elimina triangulos degenerados. Devuelve {pos, idx}.
export function soldar(pos, idx) {
  const mapa = new Map(); const remap = new Uint32Array(pos.length / 3);
  const q = 1e5; const nuevos = [];
  for (let i = 0; i < remap.length; i++) {
    const k = Math.round(pos[3 * i] * q) + ',' + Math.round(pos[3 * i + 1] * q) + ',' + Math.round(pos[3 * i + 2] * q);
    let j = mapa.get(k);
    if (j === undefined) { j = nuevos.length / 3; mapa.set(k, j); nuevos.push(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]); }
    remap[i] = j;
  }
  const out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
    if (a === b || b === c || a === c) continue;
    out.push(a, b, c);
  }
  return { pos: Float32Array.from(nuevos), idx: Uint32Array.from(out) };
}

// Compacta: deja solo vertices usados
export function compactar(pos, idx) {
  const map = new Int32Array(pos.length / 3).fill(-1); let n = 0;
  const np = [];
  const ni = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i];
    if (map[v] < 0) { map[v] = n++; np.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]); }
    ni[i] = map[v];
  }
  return { pos: Float32Array.from(np), idx: ni };
}

export const UMBRAL_SIN_SIMPLIFICAR = 300;
export const MIN_TRIS = 64;

/** Simplifica una malla (sin tocar si < 300 triangulos). opciones: { ratio, error, lockBorder } */
export function simplificar(m, { ratio, error, lockBorder = true, umbral = UMBRAL_SIN_SIMPLIFICAR, minTris = MIN_TRIS }) {
  const tris = m.idx.length / 3;
  if (ratio >= 1 || tris < umbral) return { ...m, simplificada: false, error: 0 };
  const objetivoTris = Math.min(tris, Math.max(minTris, Math.ceil(tris * ratio)));
  const objetivoIdx = objetivoTris * 3;
  const flags = lockBorder ? ['LockBorder'] : [];
  const [nidx, err] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, objetivoIdx, error, flags);
  const c = compactar(m.pos, nidx);
  return { ...c, simplificada: true, error: err };
}

// Normales suaves (area ponderada)
export function normalesSuaves(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]);
    if (l > 0) { n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; } else { n[i + 1] = 1; }
  }
  return n;
}

export function bboxDe(pos) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = pos[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  return [mn, mx];
}
