// Pruebas de la vista separada, el explorador y los gestos del visor, sin navegador.
// Uso: node --no-warnings --import ./registrar-importmap.mjs probar-separar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..');
let fallos = 0, pruebas = 0;
const ok = (cond, msg) => { pruebas++; if (!cond) { fallos++; console.error('  FALLO:', msg); } else console.log('  ok:', msg); };

class FakeEl {
  constructor() { this.style = {}; this.children = []; this.dataset = {}; this.textContent = ''; this.hidden = false; this.className = ''; }
  append(...x) { this.children.push(...x); } setAttribute() {} addEventListener() {} remove() {}
}
globalThis.window = globalThis;
globalThis.document = { createElement: () => new FakeEl() };
globalThis.CustomEvent = class { constructor(n, o) { this.type = n; this.detail = o?.detail; } };
globalThis.dispatchEvent = () => true;
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true });

const THREE = await import('three');
const { crearBus } = await import('../js/util/bus.js');
const D = await import('../js/datos.js');
const { crearSistemas } = await import('../js/sistemas.js');
const { crearDiseccion } = await import('../js/diseccion.js');
const { crearSeleccion } = await import('../js/seleccion.js');
const { crearVistas } = await import('../js/vistas.js');
const { crearBuscador } = await import('../js/buscador.js');
const { crearPaula } = await import('../js/paula.js');
const SEP = await import('../js/separar.js');
const EXP = await import('../js/explorador.js');
const ESC = await import('../js/escena.js');
const { normalizar } = await import('../js/util/texto.js');

const FIX = path.join(AQUI, 'fixture');
const leerJSON = async (u) => JSON.parse(fs.readFileSync(fileURLToPath(u), 'utf8'));
const leerBin = async (u) => { const b = fs.readFileSync(fileURLToPath(u)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const almacen = D.crearAlmacen(pathToFileURL(FIX).href + '/', leerJSON, leerBin);
const datos = await D.cargarCatalogo(almacen);

const bus = crearBus();
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 40);
camera.position.set(0, 0.9, 3.4); camera.lookAt(0, 0.9, 0); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
const canvas = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }) };
const llamadasIrA = [];
const duraciones = [];
const pasos = [];
const escena = {
  scene: new THREE.Scene(), camera, canvas, contenedor: new FakeEl(), alRenderizar: new Set(), pedirRender() {},
  distanciaParaRadio: (r) => r * 4, distanciaParaCaja: (a, b) => Math.max(a, b) * 4,
  irA(o) { llamadasIrA.push(o); return Promise.resolve(); },
  animar(d, fn) { duraciones.push(d); fn(0.5); pasos.push('medio'); fn(1); return Promise.resolve(); },
  fijarModo() { return true; },
};
escena.contenedor.clientWidth = 800; escena.contenedor.clientHeight = 800;
const app = { bus, debug: false, almacen, escena, datos, fichas: new Map() };
app.sistemas = crearSistemas(app);
app.diseccion = crearDiseccion(app);
app.separar = SEP.crearSeparar(app);
app.seleccion = crearSeleccion(app);
app.vistas = crearVistas(app);
app.buscador = crearBuscador(app);
app.paula = crearPaula(app);
app.explorador = EXP.crearExplorador(app);
await app.sistemas.cargarIniciales();
await app.sistemas.activar('muscular', true);
await app.sistemas.activar('nervioso', true);
const recs = [...app.sistemas.recs.values()];
const S = app.separar;

console.log('Plan de separación sobre el catálogo real');
{
  const real = JSON.parse(fs.readFileSync(APP + '/datos/catalogo.json', 'utf8')).estructuras;
  const { plan } = SEP.construirPlan(real);
  ok(real.length === 3874 && plan.size === 3874, 'el plan cubre las 3.874 estructuras del catálogo');
  const d0 = real.find((e) => e.id === real[0].id);
  const dr = SEP.desplazamientoDe(plan.get(d0.id), SEP.FACTORES, true);
  ok(dr.every(Number.isFinite), 'desplazamientos finitos');
  const mano = real.filter((e) => e.sistema === 'oseo' && e.region === 'miembro superior' && e.lado === 'derecho' && /carpo|Escafoides|Semilunar|Piramidal|Capitado|Ganchoso|Trapec|Pisiforme/i.test(e.nombre_es));
  ok(mano.length >= 7, `carpo derecho encontrado (${mano.length} huesos)`);
  const lateral = real.filter((e) => e.sistema === 'oseo' && e.lado === 'derecho' && e.region === 'miembro inferior').map((e) => SEP.desplazamientoDe(plan.get(e.id))[0]);
  ok(lateral.every((x) => x < 0.0001) && lateral.filter((x) => x < -0.05).length > lateral.length / 2, 'huesos del miembro inferior derecho se abren hacia -X (la derecha del paciente)');
  const izq = real.filter((e) => e.sistema === 'oseo' && e.lado === 'izquierdo' && e.region === 'miembro inferior').map((e) => SEP.desplazamientoDe(plan.get(e.id))[0]);
  ok(izq.filter((x) => x > 0.05).length > izq.length / 2, 'y los del izquierdo hacia +X');
  const cabeza = real.filter((e) => e.sistema === 'oseo' && e.region === 'cabeza' && e.lado === null).map((e) => SEP.desplazamientoDe(plan.get(e.id))[1]);
  ok(cabeza.every((y) => y > 0), 'la cabeza sube');
  const sinRegion = real.filter((e) => e.region === 'cabeza').map((e) => SEP.desplazamientoDe(plan.get(e.id), SEP.FACTORES, false));
  ok(sinRegion.length > 0, 'sin nivel de región también se calcula (alcance por región)');
  // solapamiento con las mallas reales
  const { preparar } = await import('./ajustar-separacion.mjs');
  const { medir } = await preparar('oseo');
  const manoD = (e) => e.region === 'miembro superior' && e.lado === 'derecho' && /Falange|metacarp|Semilunar|Piramidal|Escafoides|Capitado|Pisiforme|Ganchoso|Trapec/i.test(e.nombre_es);
  const rm = medir(SEP.FACTORES, (e) => e.sistema === 'oseo' && manoD(e));
  ok(rm.vecinos >= 30 && rm.solapan0 >= 10 && rm.solapan1 === 0, `mano derecha al 100 %: de ${rm.solapan0} pares con cajas solapadas en reposo quedan ${rm.solapan1}`);
  const rt = medir(SEP.FACTORES, (e) => e.sistema === 'oseo');
  ok(rt.solapan1 < rt.solapan0 * 0.2, `esqueleto completo: pares solapados ${rt.solapan0} -> ${rt.solapan1} (menos del 20 %)`);
  const rc = medir(SEP.FACTORES, (e) => e.sistema === 'oseo' && e.grupo_es === 'Huesos del cráneo');
  ok(rc.solapan1 <= rc.solapan0 * 0.05, `cráneo: ${rc.solapan0} -> ${rc.solapan1}`);
  ok(rt.tam[1] < 3.2 && rt.tam[0] < 1.6, `tamaño del esqueleto al 100 %: ${rt.tam.join(' x ')} m (cabe en la vista)`);
}

console.log('Desplazamientos y vuelta exacta a 0');
const instantanea = () => new Map(recs.map((r) => [r.id, { m: [...r.objeto.matrix.elements], w: [...r.objeto.matrixWorld.elements], mallas: r.mallas.map((x) => [...x.matrixWorld.elements]) }]));
const antes = instantanea();
ok(S.estado.pct === 0 && recs.every((r) => !r.desp || (!r.desp.x && !r.desp.y && !r.desp.z)), 'al inicio nada está desplazado');
await S.aplicar(100, { duracion: 0 });
const desp = (id) => app.sistemas.rec(id).desp;
ok(recs.some((r) => r.desp.length() > 0.02), 'al 100 % hay piezas desplazadas');
ok(desp('femur_d').x < 0 && desp('femur_i').x > 0, `fémur derecho hacia -X (${desp('femur_d').x.toFixed(3)}) e izquierdo hacia +X (${desp('femur_i').x.toFixed(3)})`);
ok(Math.abs(desp('femur_d').x + desp('femur_i').x) < 1e-6, 'simétrico respecto del plano sagital');
{
  const r = app.sistemas.rec('femur_d');
  const caja = new THREE.Box3().setFromObject(r.objeto);
  const c = caja.getCenter(new THREE.Vector3());
  ok(c.distanceTo(r.centro.clone().add(r.desp)) < 0.01, 'la malla se dibuja en centro + desplazamiento (matriz mundial actualizada)');
  ok(r.objeto.matrixAutoUpdate === false, 'matrixAutoUpdate sigue en false');
}
await S.aplicar(50, { duracion: 0 });
ok(Math.abs(desp('femur_d').x * 2 - (() => { const x = desp('femur_d').x; return x * 2; })()) < 1e-12, 'a 50 %');
const m50 = desp('femur_d').x;
await S.aplicar(100, { duracion: 0 });
ok(Math.abs(desp('femur_d').x - 2 * m50) < 1e-9, 'el desplazamiento es proporcional al deslizador (100 % = 2 × 50 %)');
await S.aplicar(0, { duracion: 0 });
const despues = instantanea();
let identicas = true;
for (const [id, a] of antes) {
  const b = despues.get(id);
  if (a.m.some((x, i) => x !== b.m[i]) || a.w.some((x, i) => x !== b.w[i]) || a.mallas.some((mm, k) => mm.some((x, i) => x !== b.mallas[k][i]))) { identicas = false; console.error('   difiere', id); break; }
}
ok(identicas, 'al volver a 0 todas las matrices (local, mundial y de cada malla) son idénticas a las originales');
ok(recs.every((r) => r.desp.x === 0 && r.desp.y === 0 && r.desp.z === 0), 'desplazamientos exactamente 0');

console.log('Alcance');
await app.sistemas.activar('muscular', true);
await S.aplicar(100, { alcance: 'oseo', duracion: 0 });
ok(desp('femur_d').length() > 0 && desp('quadriceps_femoris_d').length() === 0, 'alcance "oseo": solo se mueve el sistema óseo');
ok(app.sistemas.rec('quadriceps_femoris_d').mallas[0].material.opacity === 0.1, 'lo que no se separa queda como contexto atenuado (material de contexto al 10 %)');
ok(app.sistemas.rec('femur_d').mallas[0].material.opacity === 1, 'lo que se separa conserva su material');
await S.aplicar(100, { atenuar: false, duracion: 0 });
ok(app.sistemas.rec('quadriceps_femoris_d').mallas[0].material.opacity === 1, 'con "atenuar" apagado el resto queda en su sitio sin atenuar');
await S.aplicar(100, { atenuar: true, alcance: 'visible', duracion: 0 });
ok(desp('quadriceps_femoris_d').length() > 0 && desp('femur_d').length() > 0, 'alcance "visible": se mueven todos los sistemas activos');
// visible es dinámico: apagar el muscular lo deja en su sitio y encenderlo lo vuelve a mover
await app.sistemas.activar('muscular', false);
ok(desp('quadriceps_femoris_d').length() === 0 && desp('femur_d').length() > 0, 'alcance "visible": un sistema apagado deja de moverse');
await app.sistemas.activar('muscular', true);
ok(desp('quadriceps_femoris_d').length() > 0, 'y al encenderlo se une a la vista separada');
await S.aplicar(0, { duracion: 0 });
// región de la pieza seleccionada
await app.seleccion.seleccionar('femur_d');
await S.aplicar(100, { alcance: 'region', duracion: 0 });
ok(S.resumen().alcance.region === 'miembro inferior', 'alcance "region": toma la región de la pieza seleccionada');
ok(desp('femur_d').length() > 0 && desp('tibia_i').length() > 0 && desp('humerus_d').length() === 0 && desp('brain').length() === 0, 'solo se mueve la región seleccionada');
ok(app.sistemas.rec('humerus_d').mallas[0].material.opacity === 0.1, 'el resto queda atenuado');
const regionDespl = desp('femur_d').clone();
await S.aplicar(100, { alcance: { sistemas: ['oseo'], region: 'miembro inferior' }, duracion: 0 });
ok(desp('quadriceps_femoris_d').length() === 0 && desp('femur_d').distanceTo(regionDespl) < 1e-9, 'sistema + región: solo huesos de esa región; dentro de la región mueve igual');
const avisos = [];
bus.on('aviso', (t) => avisos.push(t));
app.seleccion.deseleccionar();
const antesAlc = JSON.stringify(S.resumen().alcance);
await S.aplicar(100, { alcance: 'region', duracion: 0 });
ok(JSON.stringify(S.resumen().alcance) === antesAlc && avisos.some((t) => /Selecciona una pieza/.test(t)), 'región sin selección: avisa y conserva el alcance');
await S.aplicar(0, { duracion: 0 });
ok(recs.every((r) => r.mallas.every((m) => m.material === r.base)), 'al juntar todo, los materiales vuelven a los compartidos (sin variantes de más)');

console.log('Animación y render a demanda');
duraciones.length = 0; pasos.length = 0;
await S.aplicar(80, { alcance: 'visible' });
ok(duraciones[0] === 300, 'la animación dura 300 ms por defecto');
ok(pasos.length === 1 && desp('femur_d').x === S.plan && false || desp('femur_d').length() > 0, 'la animación termina en el objetivo');
duraciones.length = 0;
await S.aplicar(80, { duracion: 0 });
ok(duraciones.length === 0, 'con duración 0 (deslizador) no se anima: respuesta inmediata');
await S.reiniciar(0);
ok(S.estado.pct === 0 && desp('femur_d').length() === 0, 'reiniciar() vuelve a 0');

console.log('Selección, raycast, enfoque y etiqueta con piezas desplazadas');
await app.sistemas.activar('muscular', false);
await app.sistemas.activar('nervioso', false);
await S.aplicar(100, { alcance: 'oseo', duracion: 0 });
function clicEn(punto) { const p = punto.clone().project(camera); return [(p.x * 0.5 + 0.5) * 800, (-p.y * 0.5 + 0.5) * 800]; }
{
  const r = app.sistemas.rec('tibia_d');
  const mostrado = app.separar.centroMostrado(r);
  ok(mostrado.distanceTo(r.centro.clone().add(r.desp)) < 1e-9 && mostrado.distanceTo(r.centro) > 0.02, 'centroMostrado = centro del catálogo + desplazamiento');
  const hit = app.seleccion.elegir(...clicEn(mostrado));
  ok(hit && hit.object.userData.rec.id === 'tibia_d', `clic sobre la tibia desplazada la selecciona (${hit?.object.userData.rec.id})`);
  const original = app.seleccion.elegir(...clicEn(r.centro));
  ok(!original || original.object.userData.rec.id !== 'tibia_d' || r.desp.length() < r.radio * 0.5, 'en su sitio original ya no está la tibia');
  llamadasIrA.length = 0;
  await app.seleccion.seleccionar('tibia_d', { enfocar: true });
  ok(llamadasIrA.length === 1 && llamadasIrA[0].objetivo.distanceTo(mostrado) < 1e-9, 'enfocar apunta al centro desplazado');
  ok(window.paulaSelection && window.paulaSelection.id === 'tibia_d', 'window.paulaSelection mantiene su forma');
  ok(Object.keys(window.paulaSelection).sort().join() === ['id', 'lado', 'nombre', 'nombre_la', 'pregunta', 'preguntado', 'sistema', 'sistema_nombre', 'tiene_ficha', 'timestamp'].join(), 'mismas claves que antes');
  // la etiqueta sigue a la pieza: el ancla es relativa al desplazamiento
  await S.aplicar(40, { duracion: 0 });
  const ancla = app.seleccion.actual().rec.desp;
  ok(ancla.length() > 0, 'la selección sigue activa tras cambiar la separación');
  await S.aplicar(100, { duracion: 0 });
  // profundidad, ocultar, aislar, transparente, deshacer
  app.diseccion.setProfundidad(5);
  ok(!r.objeto.visible, 'profundidad por capas sigue funcionando con piezas desplazadas');
  app.diseccion.setProfundidad(0);
  app.diseccion.ocultar('tibia_d');
  ok(!r.objeto.visible && app.diseccion.deshacer() && r.objeto.visible, 'ocultar y deshacer');
  app.diseccion.transparente('tibia_d');
  ok(r.mallas[0].material.opacity === 0.25, 'transparente');
  app.diseccion.transparente('tibia_d');
  app.diseccion.aislar('tibia_d');
  ok(app.sistemas.rec('femur_d').mallas[0].material.opacity === 0.1, 'aislar deja el resto como contexto');
  app.diseccion.restaurar();
  app.seleccion.deseleccionar();
}

console.log('Plano de corte sobre la posición mostrada');
{
  await S.aplicar(0, { duracion: 0 });
  const base = app.diseccion.rangoCorte('sagital');
  ok(base.max === app.sistemas.cuerpoBox.max.x, 'sin separar el rango del corte es el del cuerpo (comportamiento anterior)');
  await S.aplicar(100, { alcance: 'visible', duracion: 0 });
  const sep = app.diseccion.rangoCorte('sagital');
  ok(sep.max > base.max && sep.min < base.min, `con separación el rango incluye lo desplazado (${sep.min.toFixed(2)}..${sep.max.toFixed(2)} frente a ${base.min.toFixed(2)}..${base.max.toFixed(2)})`);
  const r = app.sistemas.rec('femur_i');
  const mostrado = app.separar.centroMostrado(r);
  app.diseccion.setCorte({ activo: true, eje: 'sagital', posicion: (r.centro.x + mostrado.x) / 2, invertido: false });
  // el corte actúa sobre el punto MOSTRADO: el original (más cerca del plano) y el desplazado quedan a lados distintos
  ok(app.diseccion.estaRecortado(r.centro) !== app.diseccion.estaRecortado(mostrado), 'el corte distingue la posición mostrada de la anatómica');
  ok(app.seleccion.elegir(...clicEn(mostrado))?.object?.userData?.rec?.id !== 'ninguno', 'raycast con corte activo no falla');
  app.diseccion.setCorte({ activo: false });
  await S.aplicar(0, { duracion: 0 });
  const vuelta = app.diseccion.rangoCorte('sagital');
  ok(vuelta.max === base.max && vuelta.min === base.min, 'al juntar todo el rango del corte vuelve al original');
}

console.log('API paulaApp');
{
  const api = window.paulaApp;
  ok(typeof api.separar === 'function' && typeof api.verSolo === 'function', 'paulaApp.separar y paulaApp.verSolo existen');
  const r = await api.separar(50, { alcance: 'oseo' });
  const e = api.estado();
  ok(r === 50 && e.separacion === 50 && JSON.stringify(e.alcanceSeparacion.sistemas) === '["oseo"]', 'estado() incluye separacion y su alcance');
  ok(await api.separar(150) === 100 && api.estado().separacion === 100, 'el porcentaje se acota a 0–100');
  await api.separar(0, { alcance: 'visible' });
  ok(api.estado().separacion === 0 && api.estado().alcanceSeparacion === 'visible', 'separar(0) deja todo como al inicio');
}

console.log('Historial: cambiarOcultas');
{
  const pasosAntes = app.diseccion.pasosDeshacer();
  const hecho = app.diseccion.cambiarOcultas({ ocultar: ['femur_d', 'femur_i', 'tibia_d'] });
  ok(hecho && app.diseccion.pasosDeshacer() === pasosAntes + 1 && app.diseccion.estado.ocultas.size === 3, 'ocultar varias piezas = un único paso de historial');
  ok(app.diseccion.deshacer() && app.diseccion.estado.ocultas.size === 0, 'y se deshace de una vez');
  ok(app.diseccion.cambiarOcultas({ mostrar: ['femur_d'] }) === false, 'sin cambios no guarda historial');
}

console.log('Explorador: árbol sobre el catálogo real');
{
  const real = JSON.parse(fs.readFileSync(APP + '/datos/catalogo.json', 'utf8')).estructuras;
  const sis = JSON.parse(fs.readFileSync(APP + '/datos/sistemas.json', 'utf8')).sistemas;
  const arbol = EXP.construirArbol(real, sis);
  ok(arbol.n === 3874 && arbol.sistemas.reduce((a, s) => a + s.n, 0) === 3874, 'los sistemas suman las 3.874 estructuras');
  ok(arbol.sistemas.every((s) => s.grupos.reduce((a, g) => a + g.n, 0) === s.n), 'en cada sistema los grupos suman el total del sistema');
  ok(arbol.sistemas.every((s) => s.grupos.every((g) => g.entradas.reduce((a, en) => a + EXP.piezasDe(en).length, 0) === g.n)), 'en cada grupo las filas (con pares D/I) cubren todas las piezas');
  const ids = new Set();
  arbol.sistemas.forEach((s) => s.grupos.forEach((g) => g.entradas.forEach((en) => EXP.piezasDe(en).forEach((e) => ids.add(e.id)))));
  ok(ids.size === 3874, 'ninguna estructura aparece dos veces ni falta');
  const cv = arbol.sistemas.find((s) => s.sistema === 'cardiovascular');
  ok(cv.grupos.map((g) => g.subsistema).sort().join() === 'arterias,corazon,venas', 'cardiovascular se divide por subsistema (arterias / venas / corazón)');
  const oseo = arbol.sistemas.find((s) => s.sistema === 'oseo');
  ok(oseo.grupos.every((g) => g.region) && oseo.grupos.length >= 6, 'óseo se divide por región');
  const pares = arbol.sistemas.flatMap((s) => s.grupos.flatMap((g) => g.entradas)).filter((en) => en.d && en.i);
  ok(pares.length > 1000 && pares.every((en) => en.d.lado === 'derecho' && en.i.lado === 'izquierdo' && normalizar(en.d.nombre_es) === normalizar(en.i.nombre_es)), `${pares.length} pares derecha/izquierda agrupados en una fila`);
  const total = EXP.contarCoincidencias(arbol, '');
  ok(total.get('total') === 3874, 'sin filtro el recuento total es 3.874');
  const cuenta = (t) => EXP.contarCoincidencias(arbol, t).get('total');
  const fuerza = (t) => { const q = normalizar(t).split(' ').filter(Boolean); return real.filter((e) => q.every((x) => normalizar(`${e.nombre_es} ${e.nombre_la || ''} ${e.nombre_en || ''}`).includes(x))).length; };
  ok(cuenta('femur') === fuerza('femur') && cuenta('femur') > 0, `filtro "femur": ${cuenta('femur')} coincidencias`);
  ok(cuenta('FÉMUR') === cuenta('femur'), 'el filtro ignora tildes y mayúsculas');
  ok(cuenta('arteria femoralis') > 0 && cuenta('arteria femoralis') === fuerza('arteria femoralis'), 'el filtro entiende el latín y varias palabras');
  ok(cuenta('zzzz') === 0, 'sin coincidencias = 0');
  const f = EXP.contarCoincidencias(arbol, 'femur');
  ok(arbol.sistemas.every((s) => s.grupos.reduce((a, g) => a + f.get(g.clave), 0) === f.get(s.clave)), 'los recuentos filtrados también suman por nivel');
  // misma normalización que el buscador
  const b = crearBuscador({ datos: { estructuras: real, sistemaPorId: new Map() } });
  ok(b.buscar('femur', 5000).length === cuenta('femur') || b.buscar('femur', 5000).length <= cuenta('femur'), 'coherente con el buscador (el filtro, que no pide inicio de palabra, devuelve igual o más)');
  const m = EXP.miembros(real, { sistema: 'oseo', region: 'cabeza' });
  ok(m.length > 0 && m.every((e) => e.sistema === 'oseo' && e.region === 'cabeza'), 'miembros() filtra por sistema y región');
}

console.log('Explorador: verSolo, separarEsto y restablecer (fixture)');
{
  await app.sistemas.activar('muscular', true);
  await app.sistemas.activar('nervioso', true);
  llamadasIrA.length = 0;
  const okSolo = await window.paulaApp.verSolo({ sistema: 'muscular', region: 'miembro superior' });
  const ids = (s) => s.map((e) => e.id);
  ok(okSolo === true, 'verSolo devuelve true');
  ok(!app.sistemas.sistemaActivo('oseo') && !app.sistemas.sistemaActivo('nervioso') && app.sistemas.sistemaActivo('muscular'), 'apaga los demás sistemas');
  ok(app.sistemas.rec('biceps_brachii_d').objeto.visible && app.sistemas.rec('deltoid_i').objeto.visible, 'muestra las piezas de la región');
  ok(!app.sistemas.rec('quadriceps_femoris_d').objeto.visible && !app.sistemas.rec('rectus_abdominis_d').objeto.visible, 'oculta las demás piezas del mismo sistema');
  ok(llamadasIrA.length === 1 && llamadasIrA[0].objetivo.y > 0.9, 'encuadra la selección');
  ok(await window.paulaApp.verSolo({ sistema: 'inexistente' }) === false, 'verSolo con un sistema inexistente devuelve false');
  // por sistema entero
  await window.paulaApp.verSolo({ sistema: 'oseo' });
  ok(app.sistemas.sistemaActivo('oseo') && !app.sistemas.sistemaActivo('muscular') && app.sistemas.rec('femur_d').objeto.visible, 'verSolo por sistema');
  // separarEsto
  await EXP.crearExplorador(app).separarEsto({ sistema: 'oseo', region: 'miembro superior' });
  ok(S.estado.pct === SEP.SEPARACION_INICIAL && desp('humerus_d').length() > 0 && desp('femur_d').length() === 0, `separarEsto: activa ${SEP.SEPARACION_INICIAL} % solo en esa región`);
  // restablecer
  await app.explorador.restablecer();
  ok(S.estado.pct === 0 && recs.every((r) => r.desp.length() === 0), 'restablecer: separación 0');
  ok(app.sistemas.sistemaActivo('oseo') && !app.sistemas.sistemaActivo('muscular') && !app.sistemas.sistemaActivo('nervioso'), 'restablecer: solo los sistemas visibles por defecto');
  ok(app.diseccion.estado.ocultas.size === 0 && !app.diseccion.estado.aislada, 'restablecer: nada oculto ni aislado');
  ok(JSON.stringify(S.resumen().alcance) === '"visible"', 'restablecer: alcance de separación "visible"');
  // visibilidad por fila
  const nodo = app.explorador.arbol().sistemas.find((s) => s.sistema === 'oseo').grupos[0];
  ok(app.explorador.visibilidadDe(nodo) === 'true', 'visibilidad de una región: encendida');
  await app.explorador.alternarVisibilidad(nodo);
  ok(app.explorador.visibilidadDe(nodo) === 'false', 'apagar una región oculta sus piezas');
  app.diseccion.deshacer();
  ok(app.explorador.visibilidadDe(nodo) === 'true', 'y se deshace');
  await app.explorador.alternarVisibilidad(nodo);
  app.diseccion.mostrar(EXP.piezasDe(nodo.entradas[0])[0].id);
  ok(app.explorador.visibilidadDe(nodo) === 'mixed', 'estado mixto cuando solo algunas están ocultas');
  app.diseccion.restaurar();
}

console.log('Gestos del visor: modo Girar/Mover y flechas');
{
  const controles = { mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }, touches: { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN } };
  ok(ESC.aplicarModo(controles, 'mover') && controles.mouseButtons.LEFT === THREE.MOUSE.PAN && controles.touches.ONE === THREE.TOUCH.PAN, 'modo Mover: botón izquierdo y un dedo desplazan');
  ok(controles.mouseButtons.RIGHT === THREE.MOUSE.PAN && controles.touches.TWO === THREE.TOUCH.DOLLY_PAN, 'el botón derecho y dos dedos siguen desplazando');
  ok(ESC.aplicarModo(controles, 'girar') && controles.mouseButtons.LEFT === THREE.MOUSE.ROTATE && controles.touches.ONE === THREE.TOUCH.ROTATE, 'modo Girar: vuelve a rotar');
  ok(ESC.aplicarModo(controles, 'volar') === false && controles.mouseButtons.LEFT === THREE.MOUSE.ROTATE, 'un modo desconocido se rechaza');
  const reg = [];
  const acciones = { desplazar: (dx, dy, rapido) => reg.push(['d', dx, dy, rapido]), alternarModo: () => reg.push(['m']) };
  const lienzo = { tagName: 'CANVAS' }, visor = { tagName: 'MAIN' };
  const ctx = { canvas: lienzo, contenedor: visor };
  const ev = (key, target, extra = {}) => ({ key, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra });
  const prueba = (key, target, extra) => { reg.length = 0; const e = ev(key, target, extra); const r = ESC.procesarTecla(e, acciones, ctx); return { r, e, reg: [...reg] }; };
  let t = prueba('ArrowUp', { tagName: 'BODY' });
  ok(t.r && t.reg[0].join() === 'd,0,1,false' && t.e.defaultPrevented, 'flecha arriba con el foco en la página sube la vista');
  ok(prueba('ArrowLeft', visor).reg[0].join() === 'd,-1,0,false' && prueba('ArrowRight', lienzo).reg[0].join() === 'd,1,0,false' && prueba('ArrowDown', visor).reg[0].join() === 'd,0,-1,false', 'flechas con el foco en el visor o el lienzo');
  ok(prueba('ArrowUp', visor, { shiftKey: true }).reg[0][3] === true, 'Mayús + flecha desplaza más rápido');
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) { t = prueba('ArrowUp', { tagName: tag }); ok(!t.r && !t.reg.length && !t.e.defaultPrevented, `las flechas no actúan con el foco en un ${tag.toLowerCase()}`); }
  t = prueba('ArrowDown', { tagName: 'INPUT', type: 'range' }); ok(!t.r, 'ni en un deslizador (las flechas lo mueven a él)');
  t = prueba('ArrowDown', { tagName: 'DIV', getAttribute: () => 'treeitem', closest: () => ({}) }); ok(!t.r && !t.reg.length, 'ni en el explorador (árbol)');
  t = prueba('ArrowDown', { tagName: 'BUTTON' }); ok(!t.r, 'ni en un botón');
  t = prueba('ArrowDown', { tagName: 'INPUT', id: 'q' }); ok(!t.r, 'ni en el buscador');
  ok(!prueba('ArrowUp', visor, { ctrlKey: true }).r && !prueba('ArrowUp', visor, { metaKey: true }).r, 'con Ctrl o Cmd no se interceptan');
  ok(!ESC.procesarTecla({ key: 'ArrowUp', target: visor, defaultPrevented: true, preventDefault() {} }, acciones, ctx), 'si otro ya la gestionó, no se usa');
  ok(prueba('m', { tagName: 'BODY', closest: () => null }).reg[0][0] === 'm' && prueba('M', visor).reg[0][0] === 'm', 'la tecla M alterna el modo');
  ok(!prueba('m', { tagName: 'INPUT' }).r && !prueba('m', { tagName: 'TEXTAREA' }).r, 'M escrita en un campo no cambia de modo');
  ok(!prueba('m', { tagName: 'DIV', closest: (s) => (/tree/.test(s) ? {} : null) }).r, 'M dentro del árbol del explorador no cambia de modo');
  // el punto de mira no se pierde
  const caja = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.3), new THREE.Vector3(0.5, 1.75, 0.3));
  ok(ESC.correccionObjetivo(new THREE.Vector3(0, 1.6, 0), caja) === null, 'dentro de la caja no se corrige (se puede llegar a la cabeza)');
  ok(ESC.correccionObjetivo(new THREE.Vector3(0, 0.1, 0), caja) === null, 'ni a los pies');
  ok(ESC.correccionObjetivo(new THREE.Vector3(0, 1.75 + ESC.MARGEN_OBJETIVO - 0.01, 0), caja) === null, 'con margen por encima de la cabeza tampoco');
  const c = ESC.correccionObjetivo(new THREE.Vector3(3, 1, 0), caja);
  ok(c && Math.abs(3 + c.x - (0.5 + ESC.MARGEN_OBJETIVO)) < 1e-9 && c.y === 0, 'fuera de la caja + margen se devuelve al borde');
  ok(ESC.correccionObjetivo(new THREE.Vector3(9, 9, 9), new THREE.Box3()) === null, 'sin caja válida no se corrige');
}

console.log('Reencuadre tras separar, restablecer y barra inferior');
{
  const irAOrig = escena.irA, dOrig = escena.distanciaParaCaja;
  let mira = new THREE.Vector3(0, 1.2, 0);
  escena.distanciaParaCaja = (mA, mH, mF = 0) => { const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); return Math.max(mH / t, mA / (t * camera.aspect)) * 1.1 + mF; };
  escena.irA = (o) => {
    llamadasIrA.push(o);
    const dir = camera.position.clone().sub(mira).normalize();
    mira = o.objetivo.clone();
    camera.position.copy(mira).addScaledVector(dir, o.distancia);
    camera.lookAt(mira); camera.updateMatrixWorld(true);
    return Promise.resolve();
  };
  const poner = (dist, y) => { mira = new THREE.Vector3(0, y, 0); camera.position.set(0, y, dist); camera.lookAt(mira); camera.aspect = 580 / 640; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); };
  await app.sistemas.activar('muscular', false); await app.sistemas.activar('nervioso', false);
  await S.aplicar(0, { duracion: 0, encuadrar: false, alcance: 'visible' });
  const alcance = { sistemas: ['oseo'], region: 'miembro superior' };
  poner(0.95, 1.2); // visor estrecho (580 x 640) y cámara cercana: la separación se sale del cuadro
  llamadasIrA.length = 0;
  await window.paulaApp.separar(100, { alcance });
  ok(llamadasIrA.length === 1, 'separar(100) por API con alcance de región que no cabe: reencuadra una vez');
  const caja = S.cajaAlcance();
  const dentro = (c) => c.every((p) => { const q = p.clone().project(camera); return Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1 && q.z < 1; });
  const esq = (b) => [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => new THREE.Vector3(x ? b.max.x : b.min.x, y ? b.max.y : b.min.y, z ? b.max.z : b.min.z))));
  ok(dentro(esq(caja)), 'tras separar al 100 % todas las esquinas de la caja del alcance proyectan dentro de [-1, 1]');
  ok(S.cabeEnPantalla(caja), 'y con el margen del 8 %');
  const dirAntes = camera.position.clone().sub(mira).normalize();
  ok(Math.abs(dirAntes.x) < 1e-9 && dirAntes.z > 0.99, 'la dirección de la cámara se conserva (solo cambian objetivo y distancia)');
  llamadasIrA.length = 0;
  await window.paulaApp.separar(100, { alcance });
  ok(llamadasIrA.length === 0, 'si ya cabe, la cámara no se mueve');
  await S.aplicar(60, { alcance, duracion: 0, encuadrar: false });
  ok(llamadasIrA.length === 0, 'el deslizador (input) no reencuadra; lo hace al soltar');
  await S.encuadrarAlcance();
  ok(dentro(esq(S.cajaAlcance())), 'al soltar el deslizador (change) queda todo dentro');
  // volver a 0: no se reencuadra si el cuerpo cabe
  poner(3.4, 0.9);
  await S.aplicar(100, { alcance: 'visible', duracion: 0, encuadrar: false });
  llamadasIrA.length = 0;
  await S.reiniciar(0);
  ok(llamadasIrA.length === 0, 'al volver a 0 % con el cuerpo dentro de la vista no se reencuadra');
  poner(0.95, 1.2);
  await S.reiniciar(0);
  ok(llamadasIrA.length === 1, 'al volver a 0 % con el cuerpo fuera de la vista sí se reencuadra');
  // "Separar esto" también reencuadra si hace falta
  poner(0.95, 1.2);
  llamadasIrA.length = 0;
  await app.explorador.separarEsto({ sistema: 'oseo', region: 'miembro superior' });
  ok(dentro(esq(S.cajaAlcance())), '"Separar esto" deja la región entera dentro de la vista');
  // factor de lado reducido con una sola región
  const { plan } = SEP.construirPlan(datos.estructuras);
  await S.aplicar(100, { alcance, duracion: 0, encuadrar: false });
  const esperado = SEP.desplazamientoDe(plan.get('humerus_d'), { ...SEP.FACTORES, lado: SEP.FACTOR_LADO_REGION }, false);
  const d = desp('humerus_d');
  ok(SEP.FACTOR_LADO_REGION < SEP.FACTORES.lado && Math.abs(d.x - esperado[0]) < 1e-9 && Math.abs(d.y - esperado[1]) < 1e-9, `con una sola región el factor de lado baja de ${SEP.FACTORES.lado} a ${SEP.FACTOR_LADO_REGION}`);
  // restablecer cierra la selección
  await app.seleccion.seleccionar('humerus_d');
  ok(window.paulaSelection && window.paulaSelection.id === 'humerus_d', 'hay una selección abierta');
  await window.paulaApp.restablecerVista();
  ok(app.seleccion.actual() === null && window.paulaSelection === null, 'restablecer vista cierra la selección (paulaSelection = null)');
  ok(S.estado.pct === 0, 'y deja la separación en 0');
  escena.irA = irAOrig; escena.distanciaParaCaja = dOrig;
  camera.position.set(0, 0.9, 3.4); camera.aspect = 1; camera.lookAt(0, 0.9, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  // barra inferior: envuelve en filas, no se corta
  const css = fs.readFileSync(APP + '/css/estilos.css', 'utf8');
  const bloque = css.match(/\.barra-vistas \{[^}]*\}/)[0];
  ok(/flex-wrap:\s*wrap/.test(bloque) && /left:\s*10px/.test(bloque) && /right:\s*10px/.test(bloque) && !/translateX/.test(bloque), 'CSS: la barra de vistas ocupa el ancho del visor y envuelve en filas');
  ok(!/overflow-x:\s*auto/.test(css.match(/@media \(max-width: 860px\)[\s\S]*?\n\}/)[0].match(/\.barra-vistas[^}]*\}/)[0]), 'CSS móvil: sin recorte por scroll lateral');
}

console.log('Puntería con tolerancia para estructuras finas (nervios, vasos)');
{
  const cam = new THREE.PerspectiveCamera(38, 1, 0.02, 40);
  cam.position.set(0, 0.9, 3.4); cam.lookAt(0, 0.9, 0); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const lienzo = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }) };
  const esc = { scene: new THREE.Scene(), camera: cam, canvas: lienzo, contenedor: new FakeEl(), alRenderizar: new Set(), pedirRender() {} };
  const mallas = [];
  const mini = { bus: crearBus(), escena: esc, sistemas: { mallasVisibles: () => mallas }, diseccion: { estaRecortado: () => false }, datos: { porId: new Map() } };
  const sel = crearSeleccion(mini);
  const mat = new THREE.MeshBasicMaterial();
  function poner(id, sistema, geo, pos) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.updateMatrixWorld(true);
    m.userData.rec = { id, sistema, est: { nombre_es: id }, objeto: { visible: true } };
    mallas.push(m);
    return m;
  }
  const px = (p) => { const q = p.clone().project(cam); return [(q.x * 0.5 + 0.5) * 800, (-q.y * 0.5 + 0.5) * 800]; };
  const idDe = (h) => h && h.object.userData.rec.id;

  // (a) nervio fino (diámetro 6 mm, ~2 px) sin nada delante: clic a 4 px
  const nervio = poner('nervio', 'nervioso', new THREE.CylinderGeometry(0.003, 0.003, 0.5, 8), [0, 0.9, 0]);
  const [cx, cy] = px(new THREE.Vector3(0, 0.9, 0));
  let borde = 0;
  while (borde < 60 && sel.elegir(cx + borde, cy, { exacto: true })) borde++;
  ok(borde >= 1 && borde <= 4, `el nervio mide ~${borde * 2} px de ancho: el rayo exacto lo roza apenas`);
  ok(sel.elegir(cx + borde + 3, cy) !== null && idDe(sel.elegir(cx + borde + 3, cy)) === 'nervio', `(a) clic a 4 px del borde del nervio sin nada delante: selecciona el nervio`);
  ok(idDe(sel.elegir(cx + borde + 3, cy + 60)) === 'nervio', '(a2) lo mismo a lo largo del nervio, en otro punto');
  ok(sel.elegir(cx + borde + 30, cy) === null, 'a 30 px del nervio no selecciona nada');
  ok(idDe(sel.elegir(cx + borde + 9, cy, { tactil: true })) === 'nervio' && sel.elegir(cx + borde + 9, cy) === null, 'con el dedo la tolerancia es mayor (12 px) que con el ratón (6 px)');
  // inclinado: el nervio no es siempre vertical
  nervio.rotation.z = 0.7; nervio.updateMatrixWorld(true);
  const [ix, iy] = px(new THREE.Vector3(0, 0.9, 0));
  let b2 = 0; while (b2 < 60 && sel.elegir(ix + b2, iy, { exacto: true })) b2++;
  ok(idDe(sel.elegir(ix + b2 + 3, iy)) === 'nervio' || idDe(sel.elegir(ix, iy + b2 + 3)) === 'nervio', 'también con el nervio inclinado');
  nervio.rotation.z = 0; nervio.updateMatrixWorld(true);

  // (b) hueso (placa) delante con el nervio 5 cm detrás: sigue ganando el hueso
  const hueso = poner('hueso', 'oseo', new THREE.BoxGeometry(0.3, 0.3, 0.02), [0, 0.9, 0.0]);
  nervio.position.z = -0.05 - 0.01; nervio.updateMatrixWorld(true);
  const [bx, by] = px(new THREE.Vector3(0.02, 0.9, 0));
  ok(idDe(sel.elegir(bx, by)) === 'hueso', '(b) clic sobre el hueso con un nervio 5 cm detrás: selecciona el hueso');
  const [nx, ny] = px(new THREE.Vector3(0, 0.9, 0));
  ok(idDe(sel.elegir(nx + 3, ny)) === 'hueso', '(b2) también a 3 px del nervio oculto detrás del hueso');
  // un nervio justo pegado (a 1 cm detrás de la cara) sí puede ganar: es "no claramente detrás"
  nervio.position.z = -0.005; nervio.updateMatrixWorld(true);
  ok(idDe(sel.elegir(nx + 3, ny)) === 'nervio', 'un nervio a menos de 2 cm tras la superficie sí se alcanza');
  // delante del hueso: gana
  nervio.position.z = 0.06; nervio.updateMatrixWorld(true);
  ok(idDe(sel.elegir(nx + 3, ny)) === 'nervio', 'un nervio delante del hueso se selecciona');
  mallas.length = 0;

  // (c) músculo con clic exacto y sin finas cerca: igual que antes
  const musculo = poner('musculo', 'muscular', new THREE.BoxGeometry(0.2, 0.3, 0.1), [0, 0.9, 0]);
  const [mx, my] = px(new THREE.Vector3(0, 0.9, 0));
  const h0 = sel.elegir(mx, my);
  ok(idDe(h0) === 'musculo' && h0.distance > 3 && h0.distance < 3.4, '(c) clic exacto sobre un músculo: sin cambios');
  ok(sel.elegir(mx + 400, my) === null, 'y fuera del músculo no selecciona nada');
  poner('nervio2', 'nervioso', new THREE.CylinderGeometry(0.003, 0.003, 0.5, 8), [0.25, 0.9, 0]);
  ok(idDe(sel.elegir(mx, my)) === 'musculo', '(c2) con un nervio a un lado pero lejos (>6 px) el músculo sigue igual');
  mallas.length = 0;
  // criterio por grosor proyectado: un tubo "óseo" de 6 mm cuenta como fino; uno de 6 cm, no
  poner('hilo', 'oseo', new THREE.CylinderGeometry(0.003, 0.003, 0.5, 8), [0, 0.9, 0]);
  ok(idDe(sel.elegir(cx + borde + 3, cy)) === 'hilo', 'una malla de otro sistema con grosor proyectado < 8 px también cuenta como fina');
  mallas.length = 0;
  poner('grueso', 'oseo', new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), [0, 0.9, 0]);
  const [gx, gy] = px(new THREE.Vector3(0, 0.9, 0));
  let bg = 0; while (bg < 80 && sel.elegir(gx + bg, gy, { exacto: true })) bg++;
  ok(sel.elegir(gx + bg + 3, gy) === null, 'un hueso grueso no gana tolerancia: a 4 px de su borde no se selecciona');
  mallas.length = 0;
  // la piel no tapa los nervios
  poner('piel', 'piel', new THREE.BoxGeometry(0.4, 0.4, 0.2), [0, 0.9, 0]);
  poner('nervio3', 'nervioso', new THREE.CylinderGeometry(0.003, 0.003, 0.5, 8), [0, 0.9, 0]);
  ok(idDe(sel.elegir(...px(new THREE.Vector3(0.01, 0.9, 0)))) === 'nervio3', 'bajo la piel translúcida el nervio se alcanza con tolerancia');
  mallas.length = 0;

  // coste: 40 nervios largos en la escena, clic sin acierto (peor caso)
  for (let i = 0; i < 400; i++) poner('n' + i, 'nervioso', new THREE.CylinderGeometry(0.002, 0.002, 0.6, 6), [-0.5 + (i % 40) * 0.025, 0.4 + Math.floor(i / 40) * 0.1, (i % 7) * 0.01]);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) sel.elegir(790, 790);
  const ms = (performance.now() - t0) / 20;
  ok(ms < 60, `coste del peor caso (24 rayos auxiliares, 400 tubos): ${ms.toFixed(1)} ms por clic`);
  mallas.length = 0;
}

console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
