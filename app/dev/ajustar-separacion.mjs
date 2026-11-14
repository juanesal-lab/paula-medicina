// Herramienta de ajuste de la vista separada: mide el solapamiento de cajas entre piezas vecinas
// con las mallas reales (app/modelos/oseo.glb) al 100 % y con distintos factores.
// Uso: node --no-warnings --import ./registrar-importmap.mjs ajustar-separacion.mjs [oseo|muscular|...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..');
const THREE = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
const { construirPlan, desplazamientoDe, FACTORES } = await import('../js/separar.js');

export async function preparar(sistema = 'oseo') {
const cat = JSON.parse(fs.readFileSync(APP + '/datos/catalogo.json', 'utf8')).estructuras;
const { plan } = construirPlan(cat);
const b = fs.readFileSync(APP + `/modelos/${sistema}.glb`);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((ok, mal) => loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', ok, mal));
gltf.scene.updateMatrixWorld(true);
const porId = new Map(cat.map((e) => [e.id, e]));
const cajas = new Map();
gltf.scene.traverse((o) => { const e = porId.get(o.userData?.name) || porId.get(o.name); if (e && !cajas.has(e.id)) { const c = new THREE.Box3().setFromObject(o); if (!c.isEmpty()) cajas.set(e.id, c); } });

function medir(factores, filtro, usaRegion = true) {
  const ids = [...cajas.keys()].filter((id) => filtro(porId.get(id)));
  const cs = ids.map((id) => {
    const d = desplazamientoDe(plan.get(id), factores, usaRegion);
    return cajas.get(id).clone().translate(new THREE.Vector3(...d));
  });
  const o = ids.map((id) => cajas.get(id));
  let vecinos = 0, solapan0 = 0, solapan1 = 0;
  const vol = (c) => { const s = c.getSize(new THREE.Vector3()); return s.x * s.y * s.z; };
  const inter = (a, c) => { const i = a.clone().intersect(c); return i.isEmpty() ? 0 : vol(i); };
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = o[i].clone().expandByScalar(0.004);
    if (!a.intersectsBox(o[j])) continue; // vecinos = cajas a menos de 4 mm
    vecinos++;
    const m = Math.min(vol(o[i]), vol(o[j])) || 1e-12;
    if (inter(o[i], o[j]) / m > 0.1) solapan0++;
    if (inter(cs[i], cs[j]) / m > 0.1) solapan1++;
  }
  const todo = new THREE.Box3(); cs.forEach((c) => todo.union(c));
  return { n: ids.length, vecinos, solapan0, solapan1, tam: todo.getSize(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)) };
}
  return { medir, cat };
}

const sets = {
  'mano d': (e) => e.region === 'miembro superior' && e.lado === 'derecho' && /Falange|metacarp|Semilunar|Piramidal|Escafoides|Capitado|Pisiforme|Ganchoso|Trapec/i.test(e.nombre_es),
  'pie d': (e) => e.region === 'miembro inferior' && e.lado === 'derecho' && /tarso|pie|metatars|Falange/i.test(e.grupo_es || ''),
  'craneo': (e) => e.grupo_es === 'Huesos del cráneo',
  'columna': (e) => e.region === 'dorso',
  'torax': (e) => e.region === 'tórax',
  'todo': () => true,
};
if (process.argv[1] && process.argv[1].endsWith('ajustar-separacion.mjs')) {
const sistema = process.argv[2] || 'oseo';
const { medir } = await preparar(sistema);
const variantes = process.argv[3] ? [JSON.parse(process.argv[3])] : [FACTORES];
for (const f of variantes) {
  console.log('factores', JSON.stringify(f));
  for (const [n, fl] of Object.entries(sets)) { const r = medir(f, (e) => e.sistema === sistema && fl(e)); console.log(' ', n.padEnd(8), JSON.stringify(r)); }
}
}
