// Mide cuan tosca es la malla ORIGINAL de Z-Anatomy (lado medio de triangulo = sqrt(4*area/(sqrt(3)*tris))) por hueso y subsistema
import path from 'node:path';
import { INTER, CAPTURAS, DATOS, leerJSON, escribirJSON } from './comun.mjs';
const conv = leerJSON(path.join(INTER, 'convertido.json'));
const cat = leerJSON(path.join(DATOS, 'catalogo.json')).estructuras;
const filas = cat.filter(e => ['oseo', 'articular', 'muscular', 'nervioso', 'cardiovascular'].includes(e.sistema) && conv.estructuras[e.id]).map(e => {
  const o = conv.estructuras[e.id]; const lado_mm = Math.sqrt(4 * o.area_m2 / (Math.sqrt(3) * o.tris_in)) * 1000;
  return { id: e.id, nombre: e.nombre_es, sistema: e.sistema, subsistema: e.subsistema, lado: e.lado, tris: o.tris_in, area_cm2: +(o.area_m2 * 1e4).toFixed(1), arista_media_mm: +lado_mm.toFixed(2), tamano_cm: +(o.radio * 200).toFixed(1) };
});
const med = (a) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const porSub = {};
for (const f of filas.filter(f => f.sistema === 'oseo')) (porSub[f.subsistema] ||= []).push(f);
const resumen = Object.entries(porSub).map(([s, a]) => ({ subsistema: s, huesos: a.length, tris_total: a.reduce((x, y) => x + y.tris, 0), arista_mediana_mm: +med(a.map(x => x.arista_media_mm)).toFixed(2), arista_max_mm: Math.max(...a.map(x => x.arista_media_mm)), tris_mediano: med(a.map(x => x.tris)) }));
const oseos = filas.filter(f => f.sistema === 'oseo');
const toscos = oseos.slice().sort((a, b) => b.arista_media_mm - a.arista_media_mm).slice(0, 15);
const pocos = oseos.filter(f => f.tris < 400).sort((a, b) => a.tris - b.tris).slice(0, 15);
escribirJSON(path.join(CAPTURAS, 'tosquedad-oseo.json'), { metodo: 'arista media = sqrt(4*area/(sqrt(3)*tris)) sobre la malla original soldada', resumen, mas_toscos: toscos, menos_triangulos: pocos, otros_sistemas: Object.fromEntries(['articular', 'muscular', 'nervioso', 'cardiovascular'].map(s => [s, { arista_mediana_mm: +med(filas.filter(f => f.sistema === s).map(f => f.arista_media_mm)).toFixed(2) }])) }, 1);
console.log(JSON.stringify(resumen)); console.log('toscos', toscos.slice(0, 8).map(t => `${t.id}:${t.arista_media_mm}mm/${t.tris}t`).join(' ')); console.log('pocos', pocos.slice(0, 8).map(t => `${t.id}:${t.tris}t/${t.tamano_cm}cm`).join(' '));
