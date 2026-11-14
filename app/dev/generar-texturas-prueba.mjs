// Genera texturas PROCEDURALES de prueba con el mismo contrato que las reales (docs/PROMPT-TEXTURAS-APIMART.md):
// app/dev/fixture/texturas/manifest.json y <id>/{albedo,normal,rugosidad}.webp para los 24 tejidos,
// repetibles en mosaico (ruido periódico) y con las fibras verticales en musculo, tendon, nervio y cerebelo.
// No son fotografías: sirven para probar el mapeo triplanar, la carga diferida y el respaldo.
//
// Uso:  cd app/dev && npm install --cache "$TMPDIR/npm-cache" && node generar-texturas-prueba.mjs [--px 512]
// Prueba en el navegador:  http://localhost:8765/?datos=dev/fixture/
// (con ?datos=, la app busca las texturas en <datos>/texturas/, es decir, en app/dev/fixture/texturas/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(AQUI, 'fixture', 'texturas');
const px = Number(process.argv[process.argv.indexOf('--px') + 1]) || 512;
const N = px;

// ---------- ruido periódico (se repite sin costura cada tesela) ----------
function hash(i, j, s) {
  let h = (i * 374761393 + j * 668265263 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const suave = (t) => t * t * (3 - 2 * t);
// Ruido de valor con `fx` x `fy` celdas por tesela.
function ruido(u, v, fx, fy, s) {
  const x = u * fx, y = v * fy;
  const i = Math.floor(x), j = Math.floor(y);
  const a = suave(x - i), b = suave(y - j);
  const g = (ii, jj) => hash(((ii % fx) + fx) % fx, ((jj % fy) + fy) % fy, s);
  return (g(i, j) * (1 - a) + g(i + 1, j) * a) * (1 - b) + (g(i, j + 1) * (1 - a) + g(i + 1, j + 1) * a) * b;
}
function fbm(u, v, fx, fy, octavas, s) {
  let suma = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < octavas; o++) { suma += amp * ruido(u, v, fx << o, fy << o, s + o * 7); tot += amp; amp *= 0.5; }
  return suma / tot;
}
// Distancia al punto más cercano de una rejilla con puntos desplazados (celdas tipo Voronoi, periódico).
function celdas(u, v, n, s) {
  const x = u * n, y = v * n;
  const i = Math.floor(x), j = Math.floor(y);
  let d1 = 9;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ci = i + di, cj = j + dj;
    const wi = ((ci % n) + n) % n, wj = ((cj % n) + n) % n;
    const px_ = ci + hash(wi, wj, s), py_ = cj + hash(wi, wj, s + 11);
    d1 = Math.min(d1, Math.hypot(x - px_, y - py_));
  }
  return Math.min(d1, 1);
}

// ---------- patrones: devuelven altura 0..1 ----------
const PATRONES = {
  fibras: (u, v, s) => 0.6 * fbm(u, v, 56, 3, 3, s) + 0.4 * ruido(u, v, 160, 6, s + 3),
  fibras_finas: (u, v, s) => 0.7 * fbm(u, v, 96, 2, 3, s) + 0.3 * ruido(u, v, 192, 4, s + 3),
  cruzadas: (u, v, s) => 0.5 * fbm(u, v, 40, 6, 3, s) + 0.5 * fbm(u, v, 6, 40, 3, s + 5),
  poros: (u, v, s) => {
    const base = fbm(u, v, 10, 10, 4, s);
    const poro = ruido(u, v, 48, 48, s + 9);
    return poro > 0.78 ? base * 0.35 : base;
  },
  celdas: (u, v, s) => 0.55 * celdas(u, v, 14, s) + 0.45 * fbm(u, v, 8, 8, 3, s),
  lobulos: (u, v, s) => 0.5 * celdas(u, v, 7, s) + 0.5 * fbm(u, v, 12, 12, 4, s + 2),
  liso: (u, v, s) => fbm(u, v, 5, 5, 4, s),
  esponjoso: (u, v, s) => 0.6 * celdas(u, v, 22, s) + 0.4 * fbm(u, v, 16, 16, 3, s),
  pliegues: (u, v, s) => 0.5 * fbm(u, v, 18, 4, 3, s) + 0.5 * celdas(u, v, 26, s + 4),
};

// id -> color base sRGB, patrón, variación de brillo, rugosidad media (blanco = mate), intensidad del relieve
const TEJIDOS = {
  musculo: { c: [150, 38, 36], p: 'fibras', v: 0.55, r: 0.45, k: 3.0, fibras: 'vertical' },
  tendon: { c: [226, 220, 205], p: 'fibras_finas', v: 0.3, r: 0.4, k: 2.0, fibras: 'vertical' },
  fascia: { c: [214, 206, 190], p: 'cruzadas', v: 0.3, r: 0.5, k: 1.8 },
  hueso: { c: [226, 214, 188], p: 'poros', v: 0.4, r: 0.8, k: 3.0 },
  cartilago: { c: [196, 214, 224], p: 'liso', v: 0.25, r: 0.25, k: 1.0 },
  grasa: { c: [234, 205, 120], p: 'lobulos', v: 0.35, r: 0.35, k: 2.0 },
  piel: { c: [208, 164, 138], p: 'poros', v: 0.25, r: 0.75, k: 1.6 },
  nervio: { c: [232, 218, 168], p: 'fibras_finas', v: 0.3, r: 0.5, k: 2.0, fibras: 'vertical' },
  arteria: { c: [200, 96, 98], p: 'cruzadas', v: 0.3, r: 0.45, k: 1.6 },
  vena: { c: [70, 74, 132], p: 'cruzadas', v: 0.3, r: 0.4, k: 1.4 },
  linfatico: { c: [180, 190, 130], p: 'liso', v: 0.3, r: 0.5, k: 1.2 },
  miocardio: { c: [118, 44, 40], p: 'fibras', v: 0.4, r: 0.45, k: 2.4 },
  pulmon: { c: [214, 150, 152], p: 'esponjoso', v: 0.4, r: 0.6, k: 2.4 },
  higado: { c: [110, 44, 34], p: 'lobulos', v: 0.3, r: 0.3, k: 1.4 },
  rinon: { c: [136, 58, 44], p: 'liso', v: 0.3, r: 0.35, k: 1.2 },
  bazo: { c: [96, 40, 62], p: 'lobulos', v: 0.3, r: 0.35, k: 1.2 },
  estomago: { c: [216, 168, 150], p: 'liso', v: 0.3, r: 0.35, k: 1.2 },
  mucosa: { c: [218, 128, 130], p: 'pliegues', v: 0.4, r: 0.3, k: 2.2 },
  glandula: { c: [208, 160, 136], p: 'lobulos', v: 0.35, r: 0.5, k: 1.8 },
  cerebro: { c: [214, 176, 166], p: 'liso', v: 0.3, r: 0.4, k: 1.2 },
  cerebelo: { c: [210, 172, 164], p: 'fibras_finas', v: 0.35, r: 0.45, k: 1.8, fibras: 'vertical' },
  medula: { c: [236, 228, 208], p: 'liso', v: 0.2, r: 0.5, k: 0.8 },
  ojo: { c: [240, 236, 232], p: 'liso', v: 0.15, r: 0.25, k: 0.6 },
  diente: { c: [240, 232, 214], p: 'fibras_finas', v: 0.12, r: 0.2, k: 0.6 },
};

const clamp8 = (x) => Math.max(0, Math.min(255, Math.round(x)));

function altura(spec, semilla) {
  const h = new Float32Array(N * N);
  const f = PATRONES[spec.p];
  let min = 1e9, max = -1e9;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const val = f((x + 0.5) / N, (y + 0.5) / N, semilla);
    h[y * N + x] = val;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  const rango = max - min || 1;
  for (let i = 0; i < h.length; i++) h[i] = (h[i] - min) / rango; // 0..1
  return h;
}

async function escribirWebp(ruta, datos, canales) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  await sharp(datos, { raw: { width: N, height: N, channels: canales } }).webp({ quality: 82 }).toFile(ruta);
}

const ids = Object.keys(TEJIDOS);
fs.rmSync(SALIDA, { recursive: true, force: true });
const manifest = { version: 1, generado: new Date().toISOString().slice(0, 10), tejidos: {} };
let semilla = 1;
for (const id of ids) {
  const spec = TEJIDOS[id];
  const h = altura(spec, semilla++ * 31);
  const albedo = Buffer.alloc(N * N * 3), normal = Buffer.alloc(N * N * 3), rug = Buffer.alloc(N * N);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)]; // acceso con envoltura: el mosaico no se corta
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const hv = h[i];
    const luz = 1 + (hv - 0.5) * spec.v;
    albedo[i * 3] = clamp8(spec.c[0] * luz); albedo[i * 3 + 1] = clamp8(spec.c[1] * luz); albedo[i * 3 + 2] = clamp8(spec.c[2] * luz);
    // Sobel sobre la altura; convención OpenGL (verde hacia arriba): ny = +dh/dfila.
    const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -gx * spec.k, ny = gy * spec.k, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    normal[i * 3] = clamp8((nx * 0.5 + 0.5) * 255); normal[i * 3 + 1] = clamp8((ny * 0.5 + 0.5) * 255); normal[i * 3 + 2] = clamp8((nz * 0.5 + 0.5) * 255);
    rug[i] = clamp8((spec.r + (0.5 - hv) * 0.25) * 255);
  }
  await escribirWebp(path.join(SALIDA, id, 'albedo.webp'), albedo, 3);
  await escribirWebp(path.join(SALIDA, id, 'normal.webp'), normal, 3);
  await escribirWebp(path.join(SALIDA, id, 'rugosidad.webp'), rug, 1);
  manifest.tejidos[id] = { modelo: 'procedural-prueba', prompt: 'textura procedural de prueba (no es una fotografía)', fibras: spec.fibras || null, px: N };
  console.log('  ' + id);
}
fs.writeFileSync(path.join(SALIDA, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const bytes = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? bytes(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`${ids.length} tejidos de prueba en ${path.relative(process.cwd(), SALIDA)} (${N}px, ${(bytes(SALIDA) / 1048576).toFixed(2)} MB)`);
