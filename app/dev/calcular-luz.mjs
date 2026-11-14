// Estimación por cálculo de la luminancia final (tras ACES y sRGB) de cada tejido en el aspecto realista.
// Sin navegador: reproduce el modelo de iluminación de three.js r170 para UNA superficie de frente a la luz principal.
// Uso: cd app/dev && node --no-warnings --import ./registrar-importmap.mjs calcular-luz.mjs [--exposicion=0.7 --entorno=0.4 --hemisferica=0.2 --camara=1.3 --contraluz=0.35] [--csv]
// Los parámetros por defecto son los de ESTILO_LUZ.realista (app/js/escena.js); los de la línea de órdenes los sustituyen.
//
// Modelo (three r170, luces físicas, BRDF Lambert = albedo/π):
//   salida lineal = albedo · [ camara·cosθ/π  +  hemisferica·mezcla(suelo, cielo, ½·n_y+½)/π  +  L̄entorno·entorno ]  + brillos especulares
//   · camara: luz direccional pegada a la cámara; la superficie "de frente" tiene cosθ = 1.
//   · L̄entorno: radiancia media ponderada por coseno de RoomEnvironment en la dirección de la normal (Monte Carlo
//     sobre la escena real de RoomEnvironment: luces de área emisivas + punto de luz principal; el π de la BRDF se cancela con el del IBL).
//   · especular dieléctrico F0 = 0,04 con la rugosidad media del mapa de rugosidad del tejido (GGX, cara a cara).
//   · después: exposición, ACESFilmicToneMapping de three (matrices de entrada y salida y ajuste RRT/ODT) y codificación sRGB.
//   La luminancia de salida es el luma Rec. 709 de los valores sRGB codificados (0–100 %, lo que se ve en pantalla).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ESTILO_LUZ } from '../js/escena.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? Number(a.split('=')[1]) : d; };
const P = {
  exposicion: arg('exposicion', ESTILO_LUZ.realista.exposicion),
  entorno: arg('entorno', ESTILO_LUZ.realista.entorno),
  hemisferica: arg('hemisferica', ESTILO_LUZ.realista.hemisferica),
  camara: arg('camara', ESTILO_LUZ.realista.camara),
  contraluz: arg('contraluz', ESTILO_LUZ.realista.contraluz),
};
// Objetivos de la dirección (luma sRGB de salida, %):
export const OBJETIVOS = { hueso: [70, 78], musculo: [28, 38] };

// ---------------------------------------------------------------- utilidades de color
const sRGBaLineal = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const linealASRGB = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// ACESFilmicToneMapping de three.js r170 (src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js)
function acesFilmic(c, exposicion) {
  const k = exposicion / 0.6;
  const r = c[0] * k, g = c[1] * k, b = c[2] * k;
  let v = [
    0.59719 * r + 0.35458 * g + 0.04823 * b,
    0.07600 * r + 0.90834 * g + 0.01566 * b,
    0.02840 * r + 0.13383 * g + 0.83777 * b,
  ];
  v = v.map((x) => { const a = x * (x + 0.0245786) - 0.000090537; const bb = x * (0.983729 * x + 0.4329510) + 0.238081; return a / bb; });
  const o = [
    1.60475 * v[0] - 0.53108 * v[1] - 0.07367 * v[2],
    -0.10208 * v[0] + 1.10813 * v[1] - 0.00605 * v[2],
    -0.00327 * v[0] - 0.07276 * v[1] + 1.07602 * v[2],
  ];
  return o.map((x) => Math.min(Math.max(x, 0), 1));
}

// ---------------------------------------------------------------- entorno (RoomEnvironment, Monte Carlo)
function radianciaEntorno(normal, muestras = 6000) {
  const escena = new RoomEnvironment();
  escena.updateMatrixWorld(true);
  const mallas = []; let punto = null;
  escena.traverse((o) => { if (o.isMesh) mallas.push(o); if (o.isPointLight) punto = o; });
  const rc = new THREE.Raycaster(); rc.near = 0; rc.far = 200;
  const n = new THREE.Vector3(...normal).normalize();
  const t = Math.abs(n.y) < 0.99 ? new THREE.Vector3(0, 1, 0).cross(n).normalize() : new THREE.Vector3(1, 0, 0);
  const b = n.clone().cross(t);
  const pl = punto.position, I = punto.intensity, corte = punto.distance;
  const tmpN = new THREE.Vector3(); const m3 = new THREE.Matrix3(); const dir = new THREE.Vector3(); const toL = new THREE.Vector3();
  let suma = 0;
  for (let i = 0; i < muestras; i++) {
    // Hammersley con muestreo ponderado por coseno
    const u1 = (i + 0.5) / muestras;
    let u2 = 0, f = 0.5, k = i; while (k > 0) { u2 += (k & 1) * f; k >>= 1; f *= 0.5; }
    const r = Math.sqrt(u1), ph = 2 * Math.PI * u2;
    dir.copy(t).multiplyScalar(r * Math.cos(ph)).addScaledVector(b, r * Math.sin(ph)).addScaledVector(n, Math.sqrt(1 - u1));
    rc.set(new THREE.Vector3(0, 0, 0), dir);
    const hit = rc.intersectObjects(mallas, false)[0];
    if (!hit) continue;
    const mat = hit.object.material;
    if (mat.isMeshBasicMaterial) { suma += mat.color.r; continue; } // luz de área emisiva
    m3.getNormalMatrix(hit.object.matrixWorld);
    tmpN.copy(hit.face.normal).applyMatrix3(m3).normalize();
    if (mat.side === THREE.BackSide) tmpN.negate();
    toL.copy(pl).sub(hit.point); const d = toL.length(); toL.divideScalar(d);
    const ventana = corte > 0 ? Math.pow(Math.min(Math.max(1 - Math.pow(d / corte, 4), 0), 1), 2) : 1;
    suma += (mat.color.r / Math.PI) * I * Math.max(0, tmpN.dot(toL)) / (d * d) * ventana; // difuso de la pared lisa blanca
  }
  return suma / muestras;
}

// Normal "de frente": la dirección de la luz de cámara (0,6, 0,9, 1) con la cámara horizontal => n_y = 0,614.
const LUZ = new THREE.Vector3(0.6, 0.9, 1).normalize();
function entornoMedio() {
  const az = 12; const v = [];
  for (let i = 0; i < az; i++) {
    const a = (i / az) * Math.PI * 2; const h = Math.sqrt(1 - LUZ.y * LUZ.y);
    v.push(radianciaEntorno([Math.cos(a) * h, LUZ.y, Math.sin(a) * h]));
  }
  return { media: v.reduce((x, y) => x + y, 0) / az, min: Math.min(...v), max: Math.max(...v) };
}

// ---------------------------------------------------------------- albedos
async function estadisticas(id) {
  const { default: sharp } = await import('sharp');
  const leer = async (f) => sharp(path.join(APP, 'texturas', id, f + '.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = await leer('albedo');
  const px = a.info.width * a.info.height; const lut = new Float32Array(256).map((_, i) => sRGBaLineal(i / 255));
  const s = [0, 0, 0]; const lum = new Float32Array(px);
  for (let i = 0; i < px; i++) {
    const r = lut[a.data[i * 3]], g = lut[a.data[i * 3 + 1]], bl = lut[a.data[i * 3 + 2]];
    s[0] += r; s[1] += g; s[2] += bl; lum[i] = luma([r, g, bl]);
  }
  const media = s.map((x) => x / px);
  const orden = Float32Array.from(lum).sort();
  const rg = await leer('rugosidad'); let sr = 0; const pr = rg.info.width * rg.info.height;
  for (let i = 0; i < pr; i++) sr += rg.data[i * rg.info.channels] / 255;
  return { media, lumMedia: luma(media), p99: orden[Math.floor(px * 0.99)], rugosidad: sr / pr };
}

// ---------------------------------------------------------------- modelo
const sky = new THREE.Color(0xfff4e6), ground = new THREE.Color(0x2a2e36); // THREE.Color ya convierte a lineal
function modelo(alb, rug, def, p, env, factorBrillo = 1) {
  const w = 0.5 * LUZ.y + 0.5;
  const hemi = [0, 1, 2].map((i) => [ground.r, ground.g, ground.b][i] * (1 - w) + [sky.r, sky.g, sky.b][i] * w);
  const r = Math.min(Math.max(rug * (def.rugosidad ?? 1), 0.05), 1);
  // Especular GGX (D, V de Smith correlacionado, F de Schlick) con N = luz, vista = (0, 0, 1): H queda a ~23° de N.
  const al = r * r, nl = 1, nv = LUZ.z; const H = LUZ.clone().add(new THREE.Vector3(0, 0, 1)).normalize();
  const nh = H.dot(LUZ), vh = H.z;
  const D = (al * al) / (Math.PI * Math.pow(nh * nh * (al * al - 1) + 1, 2));
  const gv = nl * Math.sqrt(al * al + (1 - al * al) * nv * nv), gl = nv * Math.sqrt(al * al + (1 - al * al) * nl * nl);
  const F = 0.04 + 0.96 * Math.pow(1 - vh, 5);
  const espDir = F * (0.5 / (gv + gl)) * D * p.camara * nl; // brillo especular de la luz directa
  const espEnv = 0.04 * env * p.entorno; // reflejo del entorno sobre un dieléctrico rugoso (aprox.)
  return alb.map((c, i) => {
    const dif = c * ((p.camara + p.hemisferica * hemi[i]) / Math.PI + env * p.entorno);
    return dif + espDir + espEnv;
  });
}
function salida(lin, exposicion) { return acesFilmic(lin, exposicion); }

// Calcula la tabla completa. `P` sustituye (parcialmente) a ESTILO_LUZ.realista; `brillos` = {tejido: ganancia} sustituye al `brillo` de tejidos.json.
export async function calcular(P = ESTILO_LUZ.realista, brillos = {}) {
  const man = JSON.parse(fs.readFileSync(path.join(APP, 'texturas/manifest.json'), 'utf8'));
  const defs = JSON.parse(fs.readFileSync(path.join(APP, 'datos/tejidos.json'), 'utf8')).tejidos;
  const env = entornoMedio();
  const filas = [];
  for (const id of Object.keys(man.tejidos)) {
    const e = await estadisticas(id);
    const def = defs[id] || {};
    const g = brillos[id] ?? def.brillo ?? 1; // `brillo`: ganancia del albedo por tejido (tejidos.json)
    const media = e.media.map((x) => x * g);
    const lin = modelo(media, e.rugosidad, def, P, env.media);
    const sal = salida(lin, P.exposicion).map(linealASRGB);
    // pico: píxel p99 de luminancia, con la variación +uTriVar del ruido de baja frecuencia
    const k = (e.p99 / e.lumMedia) * (1 + (def.variacion ?? 0.1));
    const pico = salida(modelo(media.map((x) => x * k), e.rugosidad, def, P, env.media), P.exposicion).map(linealASRGB);
    filas.push({ id, albedo: media, lumLineal: luma(media), sal, lumaSal: luma(sal) * 100, pico: Math.max(...pico) });
  }
  return { env, filas };
}

async function main() {
  const brillos = {};
  for (const a of process.argv) { const m = a.match(/^--brillo-([a-z]+)=(.+)$/); if (m) brillos[m[1]] = Number(m[2]); }
  const { env, filas } = await calcular(P, brillos);
  console.log(`Entorno RoomEnvironment (radiancia media ponderada por coseno, normal n_y=${LUZ.y.toFixed(3)}): media ${env.media.toFixed(3)} (por acimut: mín ${env.min.toFixed(3)}, máx ${env.max.toFixed(3)})`);
  console.log(`Parámetros: exposición ${P.exposicion}, entorno ${P.entorno}, hemisférica ${P.hemisferica}, cámara ${P.camara}, contraluz ${P.contraluz} (el contraluz no ilumina una cara frontal)`);
  console.log('\ntejido      albedo lin. medio x brillo (R G B)   lumin. lin.  ->  salida sRGB (R G B)    luma salida  pico p99 (canal máx)  objetivo');
  for (const f of filas) {
    const obj = OBJETIVOS[f.id];
    const estado = obj ? (f.lumaSal >= obj[0] && f.lumaSal <= obj[1] ? 'ok' : 'FUERA') : '';
    console.log(`${f.id.padEnd(11)} ${f.albedo.map((x) => x.toFixed(3)).join(' ')}         ${f.lumLineal.toFixed(3)}     ->  ${f.sal.map((x) => (x * 255).toFixed(0).padStart(3)).join(' ')}      ${f.lumaSal.toFixed(1).padStart(5)} %      ${(f.pico * 100).toFixed(1).padStart(5)} %      ${obj ? obj.join('–') + ' % ' + estado : ''}`);
  }
  const quemados = filas.filter((f) => f.pico > 0.985).map((f) => f.id);
  console.log(`\nTejidos con píxeles recortados (canal > 98,5 % en el p99): ${quemados.length ? quemados.join(', ') : 'ninguno'}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
