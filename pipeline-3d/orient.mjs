// Paso 0 (R2): orientacion y lateralidad. Calcula la transformacion world(cm) -> escena (m) a partir del inventario.
// Meta: anterior = +Z, izquierda del paciente = +X, pies en y = 0, cuerpo centrado en x = 0 y z = 0.
import { leerJSON, escribirJSON } from './comun.mjs';
import path from 'node:path';
import { INTER } from './comun.mjs';

export function verificarOrientacion(inv) {
  const f = (n, a) => inv.find(x => x.nombre === n && (!a || x.archivo === a) && x.centroide);
  const esternon = f('Body_of_sternum'), t5 = f('Vertebra_T5'), higado = f('Liver'), femurL = f('Femurl'), femurR = f('Femurr');
  const r = {
    z_esternon: esternon.centroide[2], z_T5: t5.centroide[2], x_higado: higado.centroide[0],
    x_femur_l: femurL.centroide[0], x_femur_r: femurR.centroide[0],
  };
  r.anterior_es_mas_z = r.z_esternon > r.z_T5;
  r.higado_en_x_negativo = r.x_higado < 0;
  r.femur_l_en_x_positivo = r.x_femur_l > 0;
  return r;
}

// Devuelve { rotY180, espejoX, escala, offset:[ox,oy,oz] } (offset en metros, aplicado tras escala/rotacion/espejo)
export function calcularTransformacion(inv) {
  const v = verificarOrientacion(inv);
  let rotY180 = false, espejoX = false;
  let anterior = v.anterior_es_mas_z, hig = v.higado_en_x_negativo;
  if (!anterior) { rotY180 = true; hig = !hig; }         // rotar 180 grados en Y invierte x y z
  if (!hig) espejoX = true;                                // si el higado queda en +X: espejo (con inversion de indices)
  const esc = 0.01;
  const orient = (p) => { let [x, y, z] = p; if (rotY180) { x = -x; z = -z; } if (espejoX) x = -x; return [x, y, z]; };
  // caja de la piel (Regions) y linea media (esternon) en coordenadas ya orientadas
  const piel = inv.filter(x => x.archivo === 'Regions_of_human_body100' && x.bbox);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of piel) for (const c of [p.bbox[0], p.bbox[1]]) for (const cx of [0, 1]) for (const cz of [0, 1]) {
    const o = orient([p.bbox[cx][0], c[1], p.bbox[cz][2]]);
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], o[k]); mx[k] = Math.max(mx[k], o[k]); }
  }
  const est = orient(inv.find(x => x.nombre === 'Body_of_sternum' && x.centroide).centroide);
  const cx = est[0];                          // linea media del cuerpo (los brazos son asimetricos en la caja)
  const cz = (mn[2] + mx[2]) / 2;
  const offset = [-cx * esc, -mn[1] * esc, -cz * esc];
  return { rotY180, espejoX, escala: esc, offset, verificacion: v, caja_piel_cm: { min: mn, max: mx }, linea_media_x_cm: cx, centro_z_cm: cz };
}
