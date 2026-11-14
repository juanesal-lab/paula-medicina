// Analiza el contenido de frecuencias de cada albedo y lo traduce a milímetros reales según `escala_m`.
// Sirve para decidir el tamaño del mosaico: si el rasgo dominante (fibra, poro, lóbulo) queda por debajo de ~3 px
// en pantalla a distancia de cuerpo entero, se pierde en los mipmaps y solo se ve el color medio; si queda por encima
// de ~30 px se ve como rayas gruesas.
// Uso: cd app/dev && node --no-warnings analizar-escala.mjs [--px-por-m=500] [--escala-tejido=0.07 ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? Number(a.split('=')[1]) : d; };
const PX_POR_M = arg('px-por-m', 500); // cuerpo entero de 1,75 m en ~880 px de alto (visor típico)
const PX_POR_M_CERCA = arg('px-por-m-cerca', 2500); // un segmento de miembro llenando la pantalla (~35 cm en 880 px)

function fft1(re, im) { // FFT radix-2 en sitio
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len; const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const a = i + k, b = a + len / 2; const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}
// Espectro de potencia (media de los espectros de todas las filas o columnas) -> potencia por frecuencia en ciclos/mosaico.
function dominante(perfil) {
  const n = perfil.length; const m = perfil.reduce((a, b) => a + b, 0) / n;
  const re = Float64Array.from(perfil, (v) => v - m); const im = new Float64Array(n); fft1(re, im);
  let tot = 0; const pot = [];
  for (let k = 1; k < n / 2; k++) { const p = re[k] * re[k] + im[k] * im[k]; pot.push(p); tot += p; }
  // frecuencia centroide por energía (más estable que el pico) y pico
  let c = 0, pico = 1, pmax = -1; pot.forEach((p, i) => { c += (i + 1) * p; if (p > pmax) { pmax = p; pico = i + 1; } });
  return { centroide: c / (tot || 1), pico, energia: Math.sqrt(tot) / n };
}


// PSD media a lo largo de x (promedia el espectro de cada fila) o de y (cada columna). Devuelve potencia por k = 1..N/2-1 (varianza por bin).
function psd(data, W, H, ch, eje) {
  const N = eje === 'x' ? W : H, M = eje === 'x' ? H : W; const out = new Float64Array(N / 2);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let m = 0; m < M; m++) {
    let mean = 0;
    for (let i = 0; i < N; i++) { const v = eje === 'x' ? data[(m * W + i) * ch] : data[(i * W + m) * ch]; re[i] = v / 255; mean += re[i]; }
    mean /= N; for (let i = 0; i < N; i++) { re[i] -= mean; im[i] = 0; }
    fft1(re, im);
    for (let k = 1; k < N / 2; k++) out[k] += (2 * (re[k] * re[k] + im[k] * im[k])) / (N * N) / M; // varianza aportada por el bin k
  }
  return out;
}
// Reparto de la varianza según el tamaño del rasgo en pantalla (px) para un mosaico de `esc` metros a `pxm` px/m.
function reparto(P, esc, pxm, mediaLum) {
  let ruido = 0, legible = 0, grueso = 0, tot = 0;
  for (let k = 1; k < P.length; k++) {
    const periodo = esc * pxm / k; // px de pantalla por ciclo
    tot += P[k];
    if (periodo < 3) ruido += P[k]; else if (periodo <= 30) legible += P[k]; else grueso += P[k];
  }
  return { ruido: ruido / tot, legible: legible / tot, grueso: grueso / tot, cvLegible: Math.sqrt(legible) / mediaLum, cvTotal: Math.sqrt(tot) / mediaLum };
}

const man = JSON.parse(fs.readFileSync(path.join(APP, 'texturas/manifest.json'), 'utf8'));
const defs = JSON.parse(fs.readFileSync(path.join(APP, 'datos/tejidos.json'), 'utf8')).tejidos;
const { default: sharp } = await import('sharp');
const SOLO = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FIBRAS = ['musculo', 'tendon', 'nervio'];
console.log(`Cuerpo entero ≈ ${PX_POR_M} px/m (1 px = ${(1000 / PX_POR_M).toFixed(1)} mm). Rasgo "legible": periodo entre 3 y 30 px de pantalla; "ruido": < 3 px; "rayas gruesas": > 30 px.`);
console.log('tejido      escala_m  | cuerpo entero: ruido  legible  grueso  contraste legible | plano medio (' + PX_POR_M_CERCA + ' px/m): ruido legible grueso | rasgo principal (mm)');
for (const id of Object.keys(man.tejidos)) {
  if (SOLO.length && !SOLO.includes(id)) continue;
  const esc = arg('escala-' + id, defs[id].escala_m);
  const { data, info } = await sharp(path.join(APP, 'texturas', id, 'albedo.webp')).removeAlpha().grayscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  let media = 0; for (let i = 0; i < W * H; i++) media += data[i * ch] / 255; media /= W * H;
  const Px = psd(data, W, H, ch, 'x'), Py = psd(data, W, H, ch, 'y');
  // fibras: el rasgo útil es el contraste ENTRE fibras (perfil a lo largo de x); el resto es isótropo (media de ambos ejes)
  const P = FIBRAS.includes(id) ? Px : Px.map((v, i) => (v + Py[i]) / 2);
  const a = reparto(P, esc, PX_POR_M, media), b = reparto(P, esc, PX_POR_M_CERCA, media);
  // rasgo principal: periodo (mm) por debajo del cual está la mitad de la varianza no continua
  let acum = 0, tot = P.reduce((x, y) => x + y, 0), kmed = 1; for (let k = 1; k < P.length; k++) { acum += P[k]; if (acum >= tot / 2) { kmed = k; break; } }
  const f = (x) => (x * 100).toFixed(0).padStart(3) + '%';
  console.log(`${id.padEnd(11)} ${esc.toFixed(3)}     |  ${f(a.ruido)}   ${f(a.legible)}    ${f(a.grueso)}      ${(a.cvLegible * 100).toFixed(1).padStart(5)} %          |  ${f(b.ruido)}  ${f(b.legible)}  ${f(b.grueso)}   | mediana ${(esc * 1000 / kmed).toFixed(1)} mm`);
}
