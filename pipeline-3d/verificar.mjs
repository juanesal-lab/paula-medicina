// Verificacion de los entregables (criterio 2): GLB, catalogo, sistemas, topes de peso y orientacion
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { MODELOS, DATOS, INTER, RAIZ, leerJSON } from './comun.mjs';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let fallos = 0, aprobados = 0;
const ok = (c, msg) => { if (c) { aprobados++; console.log('  OK    ' + msg); } else { fallos++; console.log('  FALLA ' + msg); } };

const cat = leerJSON(path.join(DATOS, 'catalogo.json'));
const sis = leerJSON(path.join(DATOS, 'sistemas.json'));
const conv = leerJSON(path.join(INTER, 'convertido.json'));
const TOL = 1.10;

console.log('1. GLB por sistema (carga con @gltf-transform/core + decoder meshopt)');
const nodosPorSistema = {}; let total = 0, trisTotal = 0;
for (const s of sis.sistemas) {
  const f = path.join(MODELOS, path.basename(s.glb));
  if (!fs.existsSync(f)) { ok(false, `${s.id}: existe ${s.glb}`); continue; }
  const bytes = fs.statSync(f).size; total += bytes;
  const doc = await io.read(f);
  const nodos = doc.getRoot().listNodes().filter(n => n.getMesh());
  nodosPorSistema[s.id] = new Set(nodos.map(n => n.getName()));
  let tris = 0; for (const n of nodos) for (const p of n.getMesh().listPrimitives()) tris += p.getIndices().getCount() / 3;
  if (!s.opcional) trisTotal += tris;
  const tope = conv.sistemas[s.id].tope_bytes;
  ok(nodos.length === s.estructuras && nodosPorSistema[s.id].size === nodos.length, `${s.id}: ${nodos.length} nodos con malla (sistemas.json: ${s.estructuras}), nombres unicos`);
  ok(bytes === s.bytes, `${s.id}: bytes en disco ${bytes} = sistemas.json`);
  ok(Math.abs(tris - s.tris) < 1, `${s.id}: tris ${tris} = sistemas.json ${s.tris}`);
  ok(bytes <= tope * TOL, `${s.id}: ${(bytes / 1e6).toFixed(2)} MB <= tope ${(tope / 1e6).toFixed(2)} MB (+10 %)`);
  ok(nodos.every(n => n.getMesh().listPrimitives().every(p => p.getAttribute('NORMAL') && p.getAttribute('POSITION'))), `${s.id}: todas las mallas con POSITION y NORMAL`);
}

console.log('2. Catalogo');
const E = cat.estructuras;
const ids = E.map(e => e.id);
ok(new Set(ids).size === ids.length, `sin ids duplicados (${ids.length})`);
ok(E.every(e => typeof e.nombre_es === 'string' && e.nombre_es.trim() && typeof e.sistema === 'string' && e.sistema.trim()), 'todas con nombre_es y sistema no vacios');
ok(E.every(e => e.ta2 === null || (typeof e.ta2 === 'string' && e.ta2 && typeof e.nombre_la === 'string' && e.nombre_la.trim())), 'las que tienen TA2 (string) tienen nombre_la no vacio');
ok(E.every(e => e.ta2 !== null || (e.nombre_la === null && e.nombre_fuente === 'traduccion-propia')), 'las sin TA2: nombre_la null y traduccion-propia');
ok(E.every(e => Number.isInteger(e.capa) && e.capa >= 0 && e.capa <= 5), 'capa entera entre 0 y 5');
ok(E.every(e => [null, 'derecho', 'izquierdo'].includes(e.lado)), 'lado en {null, derecho, izquierdo}');
ok(E.every(e => ['TA2', 'traduccion-propia'].includes(e.nombre_fuente)), 'nombre_fuente valido');
ok(E.every(e => ['CC-BY-SA-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-4.0'].includes(e.licencia)), 'licencia valida');
ok(E.every(e => Array.isArray(e.centro) && e.centro.length === 3 && e.centro.every(Number.isFinite) && e.radio > 0), 'centro (3 numeros) y radio > 0');
ok(E.every(e => !e.lado || !/\s(derech|izquierd)[oa]s?$/i.test(e.nombre_es)), 'el lado no va dentro de nombre_es (cuando hay lado)');
const sist = new Set(sis.sistemas.map(s => s.id));
ok(E.every(e => sist.has(e.sistema)), 'todos los sistemas del catalogo existen en sistemas.json');
for (const s of sis.sistemas) {
  const delSis = new Set(E.filter(e => e.sistema === s.id).map(e => e.id)); const nodos = nodosPorSistema[s.id] || new Set();
  const faltaGlb = [...delSis].filter(i => !nodos.has(i)), faltaCat = [...nodos].filter(i => !delSis.has(i));
  ok(!faltaGlb.length && !faltaCat.length, `${s.id}: ids catalogo <-> nodos GLB (sin nodo: ${faltaGlb.length}, sin catalogo: ${faltaCat.length})`);
}
const raices = {}; for (const e of E) { const m = e.id.match(/^(.*)_(d|i)(_\d+)?$/); if (m && e.lado && e.sistema !== 'inserciones') { const k = e.sistema + ':' + m[1] + (m[3] || ''); (raices[k] ||= new Set()).add(m[2]); } }
const impares = Object.entries(raices).filter(([, s]) => s.size !== 2).map(([k, s]) => k + ' (solo ' + [...s][0] + ')');
const huerf = impares.filter(k => !/^(respiratorio:(intermediate_bronchus|middle_lobar_bronchus)|cardiovascular:right_testicular_artery)/.test(k));
ok(!huerf.length, `toda estructura par tiene d e i (${Object.keys(raices).length} pares revisados; sin gemelo: ${huerf.length}; excluidos por anatomia (solo existen a la derecha o nombre Right/Left): ${impares.length - huerf.length}${huerf.length ? ' -> ' + huerf.join(', ') : ''}; inserciones excluidas: huecos del modelo original)`);
ok(!E.some(e => e.lado === null && /^(tibial|fibular|ulnar)$/.test(e.id)), 'no quedan tibial/fibular/ulnar sin lado');
{ const rf = path.join(RAIZ, 'app', 'datos', 'fichas', 'oseo.json');
  const rutaF = fs.existsSync(rf) ? rf : path.join(DATOS, 'fichas', 'oseo.json');
  if (fs.existsSync(rutaF)) { const F = leerJSON(rutaF).fichas; const malos = E.filter(e => e.sistema === 'oseo' && e.ta2 && F['ta2:' + e.ta2] && F['ta2:' + e.ta2].nombre_es !== e.nombre_es); const n = E.filter(e => e.sistema === 'oseo' && e.ta2 && F['ta2:' + e.ta2]).length; ok(!malos.length, `nombre_es del sistema oseo coincide con su ficha (${n} estructuras con ficha; distintas: ${malos.length}${malos.length ? ' -> ' + malos.slice(0, 5).map(m => m.id).join(', ') : ''})`); }
  else console.log('  (sin fichas/oseo.json: comprobacion omitida)'); }
const propiasCat = E.filter(e => e.nombre_fuente === 'traduccion-propia').length;
const informe = leerJSON(path.join(INTER, 'informe-datos.json'));
ok(propiasCat === informe.sinTA2.length, `traduccion-propia: ${propiasCat} en catalogo = ${informe.sinTA2.length} en la lista del INFORME`);
ok(sis.sistemas.every(s => /^#[0-9A-F]{6}$/i.test(s.color) && s.visible_inicio === (s.id === 'oseo' || s.id === 'piel')), 'colores validos; visible_inicio solo en oseo y piel');

console.log('3. Pesos');
const byId = Object.fromEntries(sis.sistemas.map(s => [s.id, s]));
ok(total <= 45e6, `total ${(total / 1e6).toFixed(2)} MB <= 45 MB`);
ok(byId.oseo.bytes + byId.piel.bytes <= 9e6, `carga inicial oseo + piel = ${((byId.oseo.bytes + byId.piel.bytes) / 1e6).toFixed(2)} MB <= 9 MB`);
ok(conv.sistemas.oseo.tris_out === conv.sistemas.oseo.tris_in, `oseo sin decimar: ${conv.sistemas.oseo.tris_out} tris = entrada ${conv.sistemas.oseo.tris_in}`);
ok(byId.oseo.bytes <= 8e6, `oseo ${(byId.oseo.bytes / 1e6).toFixed(2)} MB <= 8 MB`);
ok(trisTotal <= 4.5e6, `triangulos con todo visible (sin inserciones) = ${trisTotal} <= 4,5 M`);

console.log('4. Orientacion (catalogo, coordenadas finales)');
const g = (id) => E.find(e => e.id === id);
const est = g('body_of_sternum'), t5 = g('vertebra_t5'), hig = g('liver'), fem = g('femur_i'), femD = g('femur_d');
ok(est && t5 && est.centro[2] > t5.centro[2], `anterior = +Z: z esternon ${est && est.centro[2]} > z T5 ${t5 && t5.centro[2]}`);
ok(hig && hig.centro[0] < 0, `higado a la derecha del paciente (x < 0): x = ${hig && hig.centro[0]}`);
ok(fem && femD && fem.centro[0] > 0 && femD.centro[0] < 0, `femur izquierdo x = ${fem && fem.centro[0]} > 0; derecho x = ${femD && femD.centro[0]} < 0`);
const pielY = Math.min(...E.filter(e => e.sistema === 'piel').map(e => e.centro[1] - e.radio));
ok(Math.abs(pielY) < 0.06, `punto mas bajo de la piel en y ~ 0 (centro-radio minimo = ${pielY.toFixed(3)} m)`);
let alto = 0; for (const e of E.filter(e => e.sistema === 'piel')) alto = Math.max(alto, e.centro[1] + e.radio); ok(alto > 1.6 && alto < 2.0, `altura ~ ${alto.toFixed(2)} m`);

console.log(`\nResumen: ${aprobados} comprobaciones correctas, ${fallos} fallas`);
process.exit(fallos ? 1 : 0);
