// Rasterizador por software (z-buffer, sombreado lambert, proyeccion ortografica) y escritor PNG con zlib.
// Sin dependencias nativas. Entrada: [{ pos:Float32Array(xyz), idx:Uint32Array|null, color:[r,g,b] 0..1 }]
import fs from 'node:fs';
import zlib from 'node:zlib';

const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcT[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(tipo, datos) {
  const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo), datos]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
export function escribirPNG(ruta, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(ruta, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Normales suaves por vertice (acumulacion ponderada por area). Para mallas sin indice se usa plano.
export function normales(pos, idx) {
  const n = new Float32Array(pos.length);
  const nt = idx.length / 3;
  for (let t = 0; t < nt; t++) {
    const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/**
 * opciones: dir = direccion HACIA la camara (vector), up, centro [x,y,z], semi = semi-ancho de la vista (mismas unidades),
 * size = px, fondo = [r,g,b] 0..255
 */
export function render(items, { dir, up = [0, 1, 0], centro, semi, size = 800, fondo = [24, 26, 30] }) {
  const w = size, h = size;
  const z = norm3(dir);                       // eje hacia la camara
  let x = norm3(cross(up, z)); const y = cross(z, x);
  const zb = new Float32Array(w * h).fill(-Infinity);
  const img = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { img[3 * i] = fondo[0]; img[3 * i + 1] = fondo[1]; img[3 * i + 2] = fondo[2]; }
  const esc = (w / 2) / semi;
  let dibujados = 0;
  for (const it of items) {
    const pos = it.pos, idx = it.idx;
    const nv = pos.length / 3;
    const sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      const px = pos[3 * i] - centro[0], py = pos[3 * i + 1] - centro[1], pz = pos[3 * i + 2] - centro[2];
      sx[i] = w / 2 + (px * x[0] + py * x[1] + pz * x[2]) * esc;
      sy[i] = h / 2 - (px * y[0] + py * y[1] + pz * y[2]) * esc;
      sz[i] = px * z[0] + py * z[1] + pz * z[2];
    }
    const nrm = it.nrm || normales(pos, idx);
    // sombreado por vertice (headlight + luz de relleno superior-izquierda)
    const luz2 = norm3([z[0] * 0.6 - x[0] * 0.5 + y[0] * 0.6, z[1] * 0.6 - x[1] * 0.5 + y[1] * 0.6, z[2] * 0.6 - x[2] * 0.5 + y[2] * 0.6]);
    const sh = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      const nx = nrm[3 * i], ny = nrm[3 * i + 1], nzv = nrm[3 * i + 2];
      let d1 = nx * z[0] + ny * z[1] + nzv * z[2];
      let d2 = nx * luz2[0] + ny * luz2[1] + nzv * luz2[2];
      const back = d1 < 0;
      d1 = Math.abs(d1); d2 = back ? -d2 : d2;
      sh[i] = (0.18 + 0.62 * d1 + 0.25 * Math.max(0, d2)) * (back ? 0.55 : 1);
    }
    const [cr, cg, cb] = it.color.map(c => c * 255);
    const nt = idx.length / 3;
    for (let t = 0; t < nt; t++) {
      const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
      const x0 = sx[a], y0 = sy[a], x1 = sx[b], y1 = sy[b], x2 = sx[c], y2 = sy[c];
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
      if (minX > maxX || minY > maxY) continue;
      const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (Math.abs(den) < 1e-12) continue;
      const inv = 1 / den;
      dibujados++;
      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const qx = px + 0.5, qy = py + 0.5;
          const l0 = ((y1 - y2) * (qx - x2) + (x2 - x1) * (qy - y2)) * inv;
          const l1 = ((y2 - y0) * (qx - x2) + (x0 - x2) * (qy - y2)) * inv;
          const l2 = 1 - l0 - l1;
          if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue;
          const zz = l0 * sz[a] + l1 * sz[b] + l2 * sz[c];
          const o = py * w + px;
          if (zz <= zb[o]) continue;
          zb[o] = zz;
          const s = Math.min(1.2, l0 * sh[a] + l1 * sh[b] + l2 * sh[c]);
          img[3 * o] = Math.min(255, cr * s); img[3 * o + 1] = Math.min(255, cg * s); img[3 * o + 2] = Math.min(255, cb * s);
        }
      }
    }
  }
  return { w, h, img, dibujados };
}
