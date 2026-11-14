// Pruebas de lógica sin navegador: carga los GLB del fixture con GLTFLoader (meshopt), arma la app
// con una escena simulada y comprueba índice id->malla, visibilidad, profundidad, corte, disección,
// raycast, buscador y la API paulaApp. Uso: node --import ./registrar-importmap.mjs probar-logica.mjs [carpeta-datos]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(AQUI, process.argv[2] || 'fixture');
let fallos = 0, pruebas = 0;
const ok = (cond, msg) => { pruebas++; if (!cond) { fallos++; console.error('  FALLO:', msg); } else console.log('  ok:', msg); };

// ---- globals mínimos de navegador ----
class FakeEl {
  constructor() { this.style = {}; this.children = []; this.dataset = {}; this.textContent = ''; this.hidden = false; this.className = ''; }
  append(...x) { this.children.push(...x); }
  setAttribute() {}
  addEventListener() {}
  remove() {}
}
globalThis.window = globalThis;
globalThis.document = { createElement: () => new FakeEl() };
globalThis.CustomEvent = class { constructor(n, o) { this.type = n; this.detail = o?.detail; } };
const eventos = [];
globalThis.dispatchEvent = (e) => { eventos.push(e); return true; };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', clipboard: { writeText: async (t) => { globalThis.__copiado = t; } } }, configurable: true });
globalThis.isSecureContext = true;

const THREE = await import('three');
const { crearBus } = await import('../js/util/bus.js');
const datosMod = await import('../js/datos.js');
const { crearSistemas } = await import('../js/sistemas.js');
const { crearDiseccion } = await import('../js/diseccion.js');
const { crearSeleccion } = await import('../js/seleccion.js');
const { crearBuscador } = await import('../js/buscador.js');
const { crearPaula, construirPregunta } = await import('../js/paula.js');
const { crearVistas } = await import('../js/vistas.js');
const { normalizar } = await import('../js/util/texto.js');
const { crearMaterial, planoCorte } = await import('../js/materiales.js');

const leerJSON = async (url) => JSON.parse(fs.readFileSync(fileURLToPath(url), 'utf8'));
const leerBinario = async (url, prog) => {
  const b = fs.readFileSync(fileURLToPath(url));
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  prog?.(ab.byteLength, ab.byteLength);
  return ab;
};
const almacen = datosMod.crearAlmacen(pathToFileURL(BASE).href + '/', leerJSON, leerBinario);

console.log('Datos y utilidades');
ok(normalizar('  Fémur  ÓSEO ') === 'femur oseo', 'normalizar quita tildes y colapsa espacios');
ok(datosMod.baseDesdeParametro('dev/fixture/', 'http://x/y/') === 'http://x/y/dev/fixture/', 'baseDesdeParametro relativa');
ok(datosMod.baseDesdeParametro('//evil.com', 'http://x/y/') === 'http://x/y/', 'baseDesdeParametro rechaza //');
ok(datosMod.baseDesdeParametro('../x', 'http://x/y/') === 'http://x/y/', 'baseDesdeParametro rechaza ..');
ok(datosMod.baseDesdeParametro('https://evil.com/', 'http://x/y/') === 'http://x/y/', 'baseDesdeParametro rechaza URL absoluta');

const datos = await datosMod.cargarCatalogo(almacen);
const fichas = await datosMod.cargarFichas(almacen);
console.log(`  (${datos.estructuras.length} estructuras, ${fichas.size} fichas)`);

const bus = crearBus();
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 40);
camera.position.set(0, 0.9, 3.4);
camera.lookAt(0, 0.9, 0);
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();
const canvas = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }) };
const llamadasIrA = [];
const escena = {
  scene: new THREE.Scene(), camera, canvas, contenedor: new FakeEl(), alRenderizar: new Set(),
  pedirRender() {}, distanciaParaRadio: (r) => r * 4, distanciaParaCaja: (a, b) => Math.max(a, b) * 4,
  irA(o) { llamadasIrA.push(o); return Promise.resolve(); },
};
escena.contenedor.clientWidth = 800; escena.contenedor.clientHeight = 800;
const app = { bus, debug: true, almacen, escena, datos, fichas };
app.sistemas = crearSistemas(app);
app.diseccion = crearDiseccion(app);
app.seleccion = crearSeleccion(app);
app.vistas = crearVistas(app);
app.buscador = crearBuscador(app);
app.paula = crearPaula(app);

console.log('Carga diferida');
ok(app.sistemas.estadoDe('muscular').estado === 'pendiente', 'muscular no se carga al inicio');
await app.sistemas.cargarIniciales();
ok(app.sistemas.estadoDe('oseo').estado === 'listo', 'oseo (visible_inicio) cargado');
ok(app.sistemas.estadoDe('muscular').estado === 'pendiente', 'muscular sigue pendiente tras la carga inicial');
const p1 = app.sistemas.cargar('muscular'), p2 = app.sistemas.cargar('muscular');
ok(p1 === p2, 'cargar dos veces devuelve la misma promesa (cache)');
await p1;
await app.sistemas.activar('muscular', true);
await app.sistemas.activar('nervioso', true);
const esperadas = datos.estructuras.length;
ok(app.sistemas.recs.size === esperadas, `índice id -> estructura completo (${app.sistemas.recs.size}/${esperadas})`);
ok(app.sistemas.sinCatalogo.length === 0, 'ninguna malla sin entrada de catálogo');
const rec = app.sistemas.rec('femur_d');
ok(rec && rec.mallas.length === 1 && rec.mallas[0].isMesh, 'femur_d es una malla');
ok(rec.mallas[0].material.userData.cfg.color === '#E8DCC4', 'material del sistema con el color de sistemas.json');
ok(rec.mallas[0].material.clippingPlanes[0] === planoCorte, 'el material usa el plano de corte compartido');
const cb = app.sistemas.cuerpoBox;
ok(cb.min.y < 0.2 && cb.max.y > 1.6 && cb.max.y < 1.9, `caja del cuerpo plausible (y ${cb.min.y.toFixed(2)}..${cb.max.y.toFixed(2)})`);
// orientación del fixture: derecho = -X
ok(app.sistemas.rec('femur_d').centro.x < 0 && app.sistemas.rec('femur_i').centro.x > 0, 'derecho en -X, izquierdo en +X');
// geometría decodificada = catálogo
const bb = new THREE.Box3().setFromObject(rec.objeto);
const c = bb.getCenter(new THREE.Vector3());
ok(c.distanceTo(rec.centro) < 0.01, 'centro de la malla decodificada coincide con el catálogo');

console.log('Materiales');
const sh = { fragmentShader: 'a\n#include <opaque_fragment>\nb' };
crearMaterial({ color: '#fff' }).onBeforeCompile(sh);
ok(/gl_FrontFacing \? 1\.0 : 0\.45/.test(sh.fragmentShader), 'parche de caras traseras (55 % más oscuras)');
ok(THREE.ShaderLib.standard.fragmentShader.includes('#include <opaque_fragment>'), 'three@0.170 expone opaque_fragment en el shader estándar');

console.log('Profundidad y visibilidad');
ok(rec.objeto.visible === true, 'femur visible con profundidad 0');
app.diseccion.setProfundidad(5);
ok(app.sistemas.rec('femur_d').objeto.visible === false, 'profundidad 5 oculta el fémur (capa 4)');
ok(app.sistemas.rec('brain').objeto.visible === true, 'profundidad 5 mantiene el encéfalo (capa 5)');
app.diseccion.setProfundidad(3);
ok(app.sistemas.rec('femur_d').objeto.visible === true && app.sistemas.rec('biceps_brachii_d').objeto.visible === false, 'profundidad 3: esqueleto sí, bíceps (capa 1) no');
app.diseccion.setProfundidad(0);
app.sistemas.activar('muscular', false);
ok(app.sistemas.rec('biceps_brachii_d').objeto.visible === false, 'sistema apagado oculta sus estructuras');
await app.sistemas.activar('muscular', true);
ok(app.sistemas.rec('biceps_brachii_d').objeto.visible === true, 'sistema encendido las muestra');

console.log('Disección y deshacer');
const d = app.diseccion;
d.ocultar('femur_d');
ok(!rec.objeto.visible, 'ocultar');
ok(d.deshacer() && rec.objeto.visible, 'deshacer ocultar');
d.aislar('femur_d');
ok(app.sistemas.rec('tibia_d').objeto.visible && app.sistemas.rec('tibia_d').mallas[0].material.opacity === 0.1, 'aislar deja el resto en contexto al 10 %');
d.setContexto(false);
ok(!app.sistemas.rec('tibia_d').objeto.visible && rec.objeto.visible, 'aislar sin contexto oculta el resto');
d.setContexto(true);
d.restaurar();
ok(app.sistemas.rec('tibia_d').mallas[0].material.opacity === 1, 'restaurar devuelve el material normal');
d.deshacer();
ok(d.estado.aislada === 'femur_d', 'restaurar también se deshace');
d.restaurar();
d.transparente('femur_d');
ok(rec.mallas[0].material.opacity === 0.25 && rec.mallas[0].material.transparent && !rec.mallas[0].material.depthWrite, 'transparente 25 %, depthWrite false');
ok(rec.mallas[0].material.clippingPlanes[0] === planoCorte, 'la variante conserva el plano de corte compartido');
d.transparente('femur_d');
ok(rec.mallas[0].material === rec.base, 'quitar transparencia devuelve el material compartido');
for (let i = 0; i < 30; i++) d.transparente('tibia_d');
ok(d.pasosDeshacer() === 20, 'el historial guarda como máximo 20 acciones');
d.restaurar();

console.log('Plano de corte');
const r = d.rangoCorte('sagital');
ok(r.min < -0.2 && r.max > 0.2, `rango sagital plausible (${r.min.toFixed(2)}..${r.max.toFixed(2)})`);
d.setCorte({ activo: true, eje: 'sagital', posicion: 0 });
ok(d.estaRecortado(new THREE.Vector3(-0.1, 1, 0)) && !d.estaRecortado(new THREE.Vector3(0.1, 1, 0)), 'sagital: se conserva X >= posición, se recorta X < posición');
d.setCorte({ invertido: true });
ok(!d.estaRecortado(new THREE.Vector3(-0.1, 1, 0)) && d.estaRecortado(new THREE.Vector3(0.1, 1, 0)), 'invertir cambia el lado');
d.setCorte({ invertido: false, eje: 'transversal', posicion: 1.0 });
ok(d.estaRecortado(new THREE.Vector3(0, 0.5, 0)) && !d.estaRecortado(new THREE.Vector3(0, 1.4, 0)), 'transversal (Y)');
d.setCorte({ eje: 'coronal', posicion: 0 });
ok(d.estaRecortado(new THREE.Vector3(0, 1, -0.1)) && !d.estaRecortado(new THREE.Vector3(0, 1, 0.1)), 'coronal (Z)');
d.setCorte({ activo: false });
ok(planoCorte.constant === 1e6 && !d.estaRecortado(new THREE.Vector3(-5, -5, -5)), 'apagar el corte no recorta nada');

console.log('Raycast y selección');
function clicSobre(id) {
  const p = app.sistemas.rec(id).centro.clone().project(camera);
  return [(p.x * 0.5 + 0.5) * 800, (-p.y * 0.5 + 0.5) * 800];
}
d.setProfundidad(0);
let hit = app.seleccion.elegir(...clicSobre('sternum'));
ok(hit && hit.object.userData.rec.id !== undefined, `raycast sobre el esternón devuelve algo (${hit?.object.userData.rec.id})`);
hit = app.seleccion.elegir(...clicSobre('femur_i'));
// Sin aspecto realista la Fascia lata (funda del cuádriceps) es una malla opaca más y es lo primero que toca el rayo.
ok(['quadriceps_femoris_i', 'femur_i', 'fascia_lata_i'].includes(hit?.object.userData.rec.id), `raycast al muslo izquierdo: ${hit?.object.userData.rec.id}`);
d.setCorte({ activo: true, eje: 'coronal', posicion: 10 }); // recorta todo lo que esté a Z < 10 (todo)
ok(app.seleccion.elegir(...clicSobre('femur_i')) === null, 'el raycast ignora lo recortado');
d.setCorte({ activo: false });
const okSel = await app.seleccion.seleccionar('biceps_brachii_i', { enfocar: true });
ok(okSel === true && window.paulaSelection?.id === 'biceps_brachii_i', 'seleccionar actualiza window.paulaSelection');
ok(window.paulaSelection.tiene_ficha === true && window.paulaSelection.preguntado === false, 'tiene_ficha verdadero y preguntado falso');
ok(llamadasIrA.length === 1 && llamadasIrA[0].objetivo.distanceTo(app.sistemas.rec('biceps_brachii_i').centro) < 1e-6, 'enfocar apunta al centro de la estructura');
ok(app.sistemas.rec('biceps_brachii_i').resaltada && app.sistemas.rec('biceps_brachii_i').mallas[0].material.emissive.getHexString() === 'b3261e', 'resaltado con emisivo #B3261E');
ok(eventos.some((e) => e.type === 'paula:seleccion' && e.detail?.id === 'biceps_brachii_i'), 'se emite el evento paula:seleccion');

console.log('Paula: pregunta y portapapeles');
const esperado = '/paula Estoy en la app de anatomía viendo: Bíceps braquial (Musculus biceps brachii) — Sistema muscular, lado izquierdo. Explícame su anatomía, función, irrigación e inervación y su relevancia clínica, y hazme 3 preguntas de repaso.';
ok(window.paulaSelection.pregunta === esperado, 'texto de la pregunta exacto según SPEC §7.6');
let eventoCopia = null;
bus.on('pregunta-copiada', (x) => { eventoCopia = x; });
await app.paula.preguntar();
ok(globalThis.__copiado === esperado && eventoCopia?.via === 'portapapeles', 'copia con Clipboard API');
ok(window.paulaSelection.preguntado === true, 'preguntado pasa a true');
ok(construirPregunta({ nombre: 'X', nombre_la: null, sistema_nombre: 'S', lado: null }).startsWith('/paula Estoy en la app de anatomía viendo: X — S.'), 'pregunta sin latín ni lado');

console.log('API paulaApp');
const api = window.paulaApp;
ok(api.version === 1, 'version 1');
ok((await api.seleccionar('no_existe')) === false, 'seleccionar(id inexistente) -> false');
ok((await api.seleccionar(undefined)) === false, 'seleccionar(undefined) -> false, sin excepción');
ok((await api.seleccionar('mandible')) === true, 'seleccionar(id válido) -> true');
const busq = api.buscar('femur');
ok(busq.length >= 2 && busq[0].id.startsWith('femur') && busq[0].sistema === 'oseo' && typeof busq[0].nombre === 'string', 'buscar("femur") devuelve fémur primero');
ok(api.buscar('MUSCULUS  deltoideus').some((x) => x.id === 'deltoid_d'), 'buscar por latín, sin importar mayúsculas');
ok(api.buscar('brain')[0]?.id === 'brain', 'buscar por inglés');
ok(api.buscar('').length === 0 && api.buscar('zzzzqq').length === 0, 'búsqueda vacía o sin resultados');
ok(api.buscar('a').length <= 20, 'máximo 20 resultados');
ok(api.vista('derecha') === true && api.vista('arriba') === false, 'vista válida/ inválida');
ok(api.aislar('femur_d') === true && api.estado().seleccion?.id === 'mandible', 'aislar y estado()');
api.restaurar();
await api.mostrarSistema('nervioso', false);
ok(!api.estado().sistemasVisibles.includes('nervioso'), 'mostrarSistema(id, false)');
await api.mostrarSistema('nervioso', true);
ok(api.estado().sistemasVisibles.includes('nervioso'), 'mostrarSistema(id, true)');
const est = api.estado();
ok(typeof est.profundidad === 'number' && 'activo' in est.corte, 'estado() trae profundidad y corte');
// seleccionar una estructura oculta por profundidad baja la profundidad
d.setProfundidad(5);
ok((await api.seleccionar('femur_d')) === true && d.estado.profundidad === 4, 'seleccionar baja la profundidad si la capa lo exige');

console.log('Buscador: ranking');
const b = app.buscador;
ok(b.buscar('ribs')[0].id.startsWith('ribs'), 'igual primero');
ok(b.buscar('hum')[0].id.startsWith('humerus'), 'empieza por');
ok(b.buscar('nervio')[0].nombre_es.startsWith('Nervio'), 'palabra que empieza');
ok(b.buscar('mayor').some((e) => e.id.startsWith('psoas')), 'contiene / palabra');
ok(b.buscar('tibia').length === 2, 'ambos lados aparecen');

// =====================================================================================================
// Aspecto realista: tejidos, texturas, respaldo sin texturas, corte y selección con el material triplanar
// =====================================================================================================
console.log('Tejidos: reglas de asignación');
const { compilarReglas, informeAsignacion, ejePrincipal, asegurarFibras, crearTejidos } = await import('../js/tejidos.js');
const { crearUniformesTejido, parcheTriplanar } = await import('../js/materiales.js');
const URL_REGLAS = pathToFileURL(path.resolve(AQUI, '../datos/tejidos.json')).href;
const docReglas = JSON.parse(fs.readFileSync(fileURLToPath(URL_REGLAS), 'utf8'));
const comp = compilarReglas(docReglas);
const IDS_TEJIDO = ['musculo', 'tendon', 'fascia', 'hueso', 'cartilago', 'grasa', 'piel', 'nervio', 'arteria', 'vena', 'linfatico', 'miocardio', 'pulmon', 'higado', 'rinon', 'bazo', 'estomago', 'mucosa', 'glandula', 'cerebro', 'cerebelo', 'medula', 'ojo', 'diente'];
const e = (sistema, subsistema, nombre_es, nombre_la = null) => ({ sistema, subsistema, nombre_es, nombre_la, nombre_en: '' });
const T = (x) => comp.tejidoDe(x);
ok(Object.keys(docReglas.tejidos).sort().join() === [...IDS_TEJIDO].sort().join(), 'tejidos.json define los 24 tejidos del contrato');
ok(comp.reglas.every((r) => r.tejido === null || IDS_TEJIDO.includes(r.tejido)) && Object.values(docReglas.por_defecto).every((t) => t === null || IDS_TEJIDO.includes(t)), 'las reglas solo usan ids de tejido del contrato');
ok(T(e('digestivo', 'general', 'Hígado', 'Hepar')) === 'higado', 'hígado -> higado');
ok(T(e('respiratorio', 'pulmones', 'Lóbulo superior del pulmón')) === 'pulmon', 'pulmón -> pulmon');
ok(T(e('muscular', 'musculos', 'Tendón calcáneo', 'Tendo calcaneus')) === 'tendon' && T(e('muscular', 'fascias', 'Aponeurosis palmar')) === 'tendon', 'tendón y aponeurosis -> tendon');
ok(T(e('oseo', 'cartilagos', 'Cartílago tiroideo')) === 'cartilago' && T(e('articular', 'miembro-inferior', 'Menisco medial')) === 'cartilago', 'cartílago y menisco -> cartilago');
ok(T(e('articular', 'torax', 'Ligamento costotransverso')) === 'fascia' && T(e('muscular', 'fascias', 'Fascia lata')) === 'fascia', 'ligamento y fascia -> fascia');
ok(T(e('muscular', 'musculos', 'Tensor de la fascia lata')) === 'musculo', 'un músculo con "fascia" en el nombre sigue siendo musculo');
ok(T(e('cardiovascular', 'venas', 'Vena cava inferior')) === 'vena' && T(e('cardiovascular', 'arterias', 'Arteria femoral')) === 'arteria', 'venas y arterias');
ok(T(e('cardiovascular', 'arterias', 'Arteria renal')) === 'arteria' && T(e('cardiovascular', 'venas', 'Vena pulmonar superior')) === 'vena', 'un vaso con nombre de órgano sigue siendo vaso');
ok(T(e('cardiovascular', 'corazon', 'Ventrículo derecho')) === 'miocardio', 'corazón -> miocardio');
ok(T(e('nervioso', 'snc', 'Cerebelo')) === 'cerebelo' && T(e('nervioso', 'snc', 'Lóbulo frontal')) === 'cerebro', 'cerebelo y encéfalo');
ok(T(e('nervioso', 'snc', 'Tracto espinocerebeloso anterior')) === 'medula' && T(e('nervioso', 'snc', 'Sustancia blanca de la médula espinal')) === 'medula', 'médula y tractos -> medula');
ok(T(e('nervioso', 'snp', 'Nervio mediano')) === 'nervio', 'nervio periférico -> nervio');
ok(T(e('oseo', 'dientes', 'Incisivo central')) === 'diente', 'diente -> diente');
ok(T(e('oseo', 'craneo', 'Frontal')) === 'hueso' && T(e('muscular', 'musculos', 'Músculo bíceps braquial')) === 'musculo', 'por defecto: óseo -> hueso, muscular -> musculo');
ok(T(e('inserciones', 'origen', 'Origen: Bíceps')) === null, 'inserciones: sin tejido (color plano)');
ok(T(e('sistema_nuevo', 'x', 'Algo')) === null, 'sistema desconocido: sin tejido, sin error');
ok(comp.asignar(e('oseo', 'craneo', 'Frontal')).regla === 'defecto', 'asignar informa si cayó en el valor por defecto');
ok(T(e('linfatico', 'organos-linfoides', 'Lóbulo derecho del timo')) === 'linfatico' && T(e('muscular', 'musculos', 'Músculos intercostales íntimos')) === 'musculo', '"timo" no coincide dentro de "íntimos"');
let lanza = false;
try { compilarReglas({ reglas: [{ tejido: 'hueso' }] }); } catch (x) { lanza = true; }
ok(lanza, 'una regla sin filtros se rechaza');
const catFix = datos.estructuras;
const inf = informeAsignacion(comp, catFix);
ok(inf.sinTejido.every((x) => x.sistema === 'inserciones'), `todas las estructuras del fixture tienen tejido (${catFix.length})`);
const infoReal = path.resolve(AQUI, '../datos/catalogo.json');
if (fs.existsSync(infoReal)) {
  const real = JSON.parse(fs.readFileSync(infoReal, 'utf8')).estructuras;
  const r = informeAsignacion(comp, real);
  ok(r.sinTejido.every((x) => x.sistema === 'inserciones') && [...r.porTejido.keys()].every((k) => k === '(plano)' || IDS_TEJIDO.includes(k)), `catálogo real (${real.length}): solo las inserciones quedan sin tejido y todos los ids existen`);
  ok(r.porTejido.size >= 20, `catálogo real: ${r.porTejido.size - 1} tejidos distintos en uso`);
}

console.log('Tejidos: materiales triplanares');
const IMG = { width: 2, height: 2, data: new Uint8Array(16) };
function montarApp2({ manifest = true, sin = [], imagenFalla = false, aspecto = null, manifestReal = false } = {}) {
  const peticiones = [];
  const lj = async (url) => {
    if (url.endsWith('texturas/manifest.json')) {
      if (!manifest) throw new Error('HTTP 404');
      const m = manifestReal ? JSON.parse(fs.readFileSync(path.resolve(AQUI, '../texturas/manifest.json'), 'utf8')) : await leerJSON(url);
      for (const k of sin) delete m.tejidos[k];
      return m;
    }
    return leerJSON(url);
  };
  const a2 = { bus: crearBus(), debug: false, almacen: datosMod.crearAlmacen(pathToFileURL(BASE).href + '/', lj, leerBinario), datos, fichas };
  a2.escena = { ...escena, scene: new THREE.Scene(), pedirRender() {}, fijarAspecto(m) { a2.escena.aspectoFijado = m; return true; } };
  a2.tejidos = crearTejidos(a2, {
    urlReglas: URL_REGLAS, leerJSON: leerJSON, aspectoInicial: aspecto,
    cargarImagen: async (url) => { peticiones.push(url); if (imagenFalla) throw new Error('404'); return IMG; },
  });
  return { a2, peticiones };
}
function levantar(a2) {
  a2.sistemas = crearSistemas(a2); a2.diseccion = crearDiseccion(a2); a2.seleccion = crearSeleccion(a2);
  a2.vistas = crearVistas(a2); a2.buscador = crearBuscador(a2); a2.paula = crearPaula(a2);
  return a2;
}
const erroresConsola = [];
const consolaError = console.error;
console.error = (...a) => { erroresConsola.push(a.join(' ')); };

// --- con texturas ---
{
  const { a2, peticiones } = montarApp2();
  await a2.tejidos.iniciar();
  levantar(a2);
  ok(a2.tejidos.disponible() && a2.tejidos.aspecto() === 'realista', 'con manifest: el aspecto realista es el modo por defecto');
  ok(a2.escena.aspectoFijado === 'realista', 'se avisa a la escena (IBL y tone mapping)');
  await a2.sistemas.cargarIniciales();
  await a2.tejidos.todasLasPromesas();
  const tejidosOseo = new Set([...a2.sistemas.recs.values()].filter((r) => r.sistema === 'oseo').map((r) => r.tejido));
  const pedidos = new Set(peticiones.map((u) => u.match(/texturas\/([a-z]+)\//)[1]));
  ok([...pedidos].every((t) => tejidosOseo.has(t)) && pedidos.has('hueso') && !pedidos.has('musculo'), `carga diferida: solo los tejidos del sistema visible (${[...pedidos].join(', ')})`);
  ok(peticiones.length === pedidos.size * 3, 'tres imágenes por tejido (albedo, normal, rugosidad), una sola vez');
  const rf = a2.sistemas.rec('femur_d');
  const mf = rf.mallas[0].material;
  ok(mf.userData.tejido === 'hueso' && mf === rf.base, 'el fémur usa el material compartido del tejido hueso');
  ok(a2.sistemas.rec('femur_i').base === rf.base && a2.sistemas.rec('tibia_d').base === rf.base, 'el material se comparte entre estructuras del mismo (sistema, subsistema, tejido)');
  const u = a2.tejidos.tejido('hueso').uniformes;
  ok(u.uTriListo.value === 1 && u.uTriAlbedo.value.colorSpace === THREE.SRGBColorSpace && u.uTriNormal.value.colorSpace === THREE.NoColorSpace && u.uTriRug.value.colorSpace === THREE.NoColorSpace, 'albedo en sRGB; normal y rugosidad lineales');
  ok(u.uTriAlbedo.value.wrapS === THREE.RepeatWrapping && u.uTriAlbedo.value.generateMipmaps && u.uTriAlbedo.value.minFilter === THREE.LinearMipmapLinearFilter, 'texturas repetibles con mipmaps trilineales');
  ok(Math.abs(u.uTriFrec.value - 1 / docReglas.tejidos.hueso.escala_m) < 1e-9, 'escala de mosaico en metros reales (tejidos.json)');
  // parche del shader
  const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  mf.onBeforeCompile(sh, null);
  const equilibrado = (txt) => (txt.match(/\{/g) || []).length === (txt.match(/\}/g) || []).length;
  ok(sh.fragmentShader.includes('triPeso') && sh.fragmentShader.includes('uTriRugMul') && sh.fragmentShader.includes('viewMatrix * vec4( triPw') && sh.vertexShader.includes('vTriW = '), 'el parche triplanar se inyecta en las 4 posiciones del shader estándar');
  ok(sh.fragmentShader.includes('gl_FrontFacing ? 1.0 : 0.45'), 'convive con el parche de caras traseras oscurecidas');
  ok(equilibrado(sh.fragmentShader) && equilibrado(sh.vertexShader), 'llaves equilibradas en los dos shaders');
  ok(sh.uniforms.uTriAlbedo === u.uTriAlbedo && sh.uniforms.uTriListo === u.uTriListo, 'los uniformes son los compartidos del tejido');
  ok(!sh.vertexShader.startsWith('#define TRI_FIBRAS'), 'el hueso no lleva atributo de fibras');
  ok(mf.customProgramCacheKey() !== crearMaterial({ color: '#fff' }).customProgramCacheKey(), 'programa distinto del material plano');
  // corte, selección, transparencia, contexto
  ok(mf.clippingPlanes[0] === planoCorte, 'el material realista usa el plano de corte compartido');
  a2.diseccion.setCorte({ activo: true, eje: 'sagital', posicion: 0 });
  ok(a2.diseccion.estaRecortado(new THREE.Vector3(-0.1, 1, 0)) && !a2.diseccion.estaRecortado(new THREE.Vector3(0.1, 1, 0)), 'el corte sigue funcionando con el material realista');
  ok(a2.seleccion.elegir(...(() => { const p = rf.centro.clone().project(camera); return [(p.x * 0.5 + 0.5) * 800, (-p.y * 0.5 + 0.5) * 800]; })()) !== undefined, 'el raycast no depende del material');
  a2.diseccion.setCorte({ activo: false });
  await a2.seleccion.seleccionar('femur_d');
  const ms = rf.mallas[0].material;
  ok(rf.resaltada && ms !== rf.base && ms.userData.tejido === 'hueso' && ms.emissive.getHexString() === 'b3261e' && ms.clippingPlanes[0] === planoCorte, 'selección: variante con resaltado emisivo que conserva textura y corte');
  ok(ms.userData.cfg.tejido.uniformes === u, 'la variante comparte los uniformes (sin descargar nada más)');
  a2.seleccion.deseleccionar();
  ok(rf.mallas[0].material === rf.base, 'al deseleccionar vuelve el material compartido');
  a2.diseccion.transparente('femur_d');
  const mt = rf.mallas[0].material;
  ok(mt.opacity === 0.25 && mt.transparent && !mt.depthWrite && mt.userData.tejido === 'hueso' && mt.clippingPlanes[0] === planoCorte, 'transparente al 25 % conserva tejido y corte');
  a2.diseccion.transparente('femur_d');
  a2.diseccion.aislar('femur_d');
  const mc = a2.sistemas.rec('tibia_d').mallas[0].material;
  ok(mc.opacity === 0.1 && mc.userData.tejido === 'hueso', 'contexto al 10 % conserva el tejido');
  a2.diseccion.restaurar();
  // carga diferida del siguiente sistema
  const antes = peticiones.length;
  await a2.sistemas.activar('muscular', true);
  await a2.tejidos.todasLasPromesas();
  const pedidos2 = new Set(peticiones.map((x) => x.match(/texturas\/([a-z]+)\//)[1]));
  ok(peticiones.length > antes && pedidos2.has('musculo'), 'al encender el sistema muscular se descargan sus tejidos');
  ok(!pedidos2.has('piel') && !pedidos2.has('nervio'), 'los tejidos de sistemas apagados no se descargan');
  const bic = a2.sistemas.rec('biceps_brachii_d');
  const mm = bic.mallas[0];
  ok(bic.base.userData.tejido === 'musculo' && mm.geometry.attributes.aFibra && mm.geometry.attributes.aFibra.itemSize === 4 && mm.geometry.attributes.aFibra.count === mm.geometry.attributes.position.count, 'músculo: atributo aFibra por vértice');
  const sm = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  bic.base.onBeforeCompile(sm, null);
  ok(sm.vertexShader.startsWith('#define TRI_FIBRAS') && bic.base.customProgramCacheKey().endsWith('-fib'), 'el músculo compila con fibras (clave de programa propia)');
  const dir = mm.userData.fibraDir;
  ok(Math.abs(dir.length() - 1) < 1e-6, 'dirección de fibras normalizada');
  // aspecto: cambiar y volver
  const api = window.paulaApp;
  ok(api.aspecto() === 'realista' && api.estado().aspecto === 'realista', 'paulaApp.aspecto() y estado().aspecto');
  ok(api.aspecto('esquematico') === 'esquematico' && a2.escena.aspectoFijado === 'esquematico', "paulaApp.aspecto('esquematico')");
  ok(rf.base.userData.tejido === undefined && rf.mallas[0].material.userData.cfg.color === '#E8DCC4' && rf.mallas[0].material.clippingPlanes[0] === planoCorte, 'esquemático: color plano del sistema y mismo corte');
  ok(api.aspecto('inventado') === false && api.aspecto() === 'esquematico', 'valor desconocido -> false y no cambia nada');
  const nPet = peticiones.length;
  ok(api.aspecto('realista') === 'realista' && rf.base.userData.tejido === 'hueso' && peticiones.length === nPet, "paulaApp.aspecto('realista') reutiliza las texturas ya descargadas");
}

// --- fibras: eje principal ---
{
  const geo = new THREE.BoxGeometry(0.02, 0.4, 0.02);
  const m = new THREE.Mesh(geo);
  m.rotation.z = THREE.MathUtils.degToRad(30);
  m.position.set(0.1, 1, 0);
  m.updateMatrixWorld(true);
  const d = ejePrincipal(m);
  const esperado = new THREE.Vector3(0, 1, 0).applyQuaternion(m.quaternion);
  ok(Math.abs(d.dot(esperado)) > 0.995, 'ejePrincipal encuentra el eje largo de una caja girada 30°');
  const m2 = new THREE.Mesh(geo);
  m2.rotation.x = Math.PI / 2;
  m2.updateMatrixWorld(true);
  const d1 = asegurarFibras(m);
  const d2 = asegurarFibras(m2);
  ok(m.geometry !== m2.geometry && Math.abs(d2.z) > 0.99 && Math.abs(d1.y) > 0.8, 'una geometría compartida con otra matriz de mundo se clona para esta malla');
  ok(asegurarFibras(m) === d1, 'asegurarFibras es idempotente');
  const plana = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)));
  plana.updateMatrixWorld(true);
  ok(ejePrincipal(plana).y === 1, 'malla degenerada: eje vertical, sin NaN');
}

// --- sin manifest ---
{
  const { a2, peticiones } = montarApp2({ manifest: false });
  await a2.tejidos.iniciar();
  levantar(a2);
  await a2.sistemas.cargarIniciales();
  const rf = a2.sistemas.rec('femur_d');
  ok(!a2.tejidos.disponible() && a2.tejidos.aspecto() === 'esquematico', 'sin manifest: aspecto esquemático por defecto');
  ok(rf.base.userData.tejido === undefined && rf.base.userData.cfg.color === '#E8DCC4' && peticiones.length === 0, 'sin manifest: color plano y ninguna descarga');
  ok(window.paulaApp.aspecto('realista') === false && a2.tejidos.fijar('realista') === false && a2.tejidos.aspecto() === 'esquematico', "sin manifest: aspecto('realista') devuelve false");
}
// --- falta un tejido en el manifest ---
{
  const { a2, peticiones } = montarApp2({ sin: ['hueso'] });
  await a2.tejidos.iniciar();
  levantar(a2);
  await a2.sistemas.cargarIniciales();
  await a2.tejidos.todasLasPromesas();
  const rf = a2.sistemas.rec('femur_d');
  ok(a2.tejidos.aspecto() === 'realista' && rf.base.userData.tejido === undefined && !peticiones.some((u) => u.includes('/hueso/')), 'tejido ausente del manifest: esa estructura queda en color plano sin pedir nada');
}
// --- las imágenes no se pueden leer ---
{
  const { a2 } = montarApp2({ imagenFalla: true });
  await a2.tejidos.iniciar();
  levantar(a2);
  await a2.sistemas.cargarIniciales();
  await a2.tejidos.todasLasPromesas();
  const rf = a2.sistemas.rec('femur_d');
  ok(a2.tejidos.tejido('hueso').estado === 'error' && a2.tejidos.tejido('hueso').uniformes.uTriListo.value === 0, 'imágenes con error: el tejido queda en estado error, con uTriListo = 0 (se ve el color plano)');
  ok(rf.base.userData.cfg.color === '#E8DCC4', 'y el material conserva el color del sistema');
}
// --- aspecto inicial pedido por URL ---
{
  const { a2 } = montarApp2({ aspecto: 'esquematico' });
  await a2.tejidos.iniciar();
  ok(a2.tejidos.aspecto() === 'esquematico' && a2.tejidos.disponible(), '?aspecto=esquematico respeta lo pedido aunque haya texturas');
}

// =====================================================================================================
// Fascias de revestimiento: película translúcida solo en realista
// =====================================================================================================
console.log('Fascias de revestimiento: regla de datos');
{
  const P = (n, sub = 'fascias', sis = 'muscular') => comp.esPelicula(e(sis, sub, n));
  ok(P('Fascia lata') && P('Fascia crural') && P('Fascia braquial') && P('Fascia antebraquial') && P('Fascia pectoral') && P('Fascia deltoidea') && P('Fascia de revestimiento del abdomen') && P('Fascia de revestimiento superficial del cuello') && P('Fascia dorsal de la mano'), 'las fascias que envuelven grupos musculares son película');
  ok(!P('Retináculo de los extensores del carpo') && !P('Septo intermuscular femoral medial') && !P('Aponeurosis palmar') && !P('Lámina posterior de la fascia toracolumbar') && !P('Ligamento metacarpiano transverso superficial'), 'retináculos, septos, aponeurosis y ligamentos siguen opacos');
  ok(!P('Vaina tendinosa del flexor largo de los dedos', 'vainas-bolsas') && !P('Bolsa subacromial', 'vainas-bolsas') && !P('Tendón calcáneo', 'musculos') && !P('Tensor de la fascia lata', 'musculos') && !P('Fascia lata', 'x', 'articular'), 'vainas, bolsas, tendones y el músculo tensor de la fascia lata no son película; la regla exige sistema y subsistema');
  ok(comp.opacidadPelicula >= 0.12 && comp.opacidadPelicula <= 0.18 && comp.opacidadPeliculaResaltada > comp.opacidadPelicula, `opacidad de la película ${comp.opacidadPelicula} (entre 0,12 y 0,18) y mayor al resaltar (${comp.opacidadPeliculaResaltada})`);
  ok(compilarReglas({ reglas: [{ tejido: 'hueso', sistema: 'oseo' }] }).esPelicula(e('muscular', 'fascias', 'Fascia lata')) === false, 'sin bloque "pelicula" nada es película');
  let lanza2 = false;
  try { compilarReglas({ reglas: [], pelicula: { reglas: [{ id: 'x' }] } }); } catch (x) { lanza2 = true; }
  ok(lanza2, 'una regla de película sin filtros se rechaza');
  const infoReal2 = path.resolve(AQUI, '../datos/catalogo.json');
  if (fs.existsSync(infoReal2)) {
    const real = JSON.parse(fs.readFileSync(infoReal2, 'utf8')).estructuras;
    const pel = real.filter((x) => comp.esPelicula(x));
    const fasc = real.filter((x) => x.sistema === 'muscular' && /^Fascia/.test(x.nombre_es));
    ok(pel.length >= 28 && pel.length <= 36 && fasc.every((x) => comp.esPelicula(x)), `catálogo real: ${pel.length} fascias de revestimiento (todas las "Fascia …" del sistema muscular: ${fasc.length})`);
    ok(pel.every((x) => x.sistema === 'muscular' && x.subsistema === 'fascias' && x.capa === 1 && T(x) === 'fascia'), 'todas son del sistema muscular, capa 1, y su tejido sigue siendo fascia');
    const resto = real.filter((x) => x.sistema === 'muscular' && !comp.esPelicula(x));
    ok(resto.filter((x) => /(retinaculo|aponeurosis|vaina|tendon|ligamento|septo)/.test(sinTildes2(x.nombre_es))).every((x) => !comp.esPelicula(x)) && resto.length === real.filter((x) => x.sistema === 'muscular').length - pel.length, 'ningún retináculo, aponeurosis, vaina, tendón ni septo es película');
  }
}
function sinTildes2(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

console.log('Fascias de revestimiento: material, casilla y selección');
{
  const { a2 } = montarApp2();
  await a2.tejidos.iniciar();
  levantar(a2);
  await a2.sistemas.cargarIniciales();
  await a2.sistemas.activar('muscular', true);
  await a2.tejidos.todasLasPromesas();
  const fl = a2.sistemas.rec('fascia_lata_d'), quad = a2.sistemas.rec('quadriceps_femoris_d');
  ok(fl && fl.pelicula && fl.enPelicula && !quad.pelicula && !quad.enPelicula, 'realista: la Fascia lata es película y el cuádriceps no');
  const mf = fl.mallas[0].material, mq = quad.mallas[0].material;
  ok(mf.transparent && mf.opacity >= 0.12 && mf.opacity <= 0.18 && mf.depthWrite === false && mf.userData.pelicula && mf.userData.tejido === 'fascia', `realista: película translúcida (opacidad ${mf.opacity}), sin escribir profundidad, con el tejido fascia`);
  ok(mq.opacity === 1 && !mq.transparent && mq.depthWrite === true && mq.userData.tejido === 'musculo', 'realista: el músculo sigue opaco');
  ok(fl.mallas[0].renderOrder > quad.mallas[0].renderOrder && fl.mallas[0].renderOrder < 10, 'la película se dibuja después de los músculos (y antes que la piel)');
  ok(mf.clippingPlanes[0] === planoCorte, 'la película respeta el plano de corte');
  const shF = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  mf.onBeforeCompile(shF, null);
  ok(shF.fragmentShader.includes('uTriBrillo') && shF.fragmentShader.includes('triAlb'), 'la película conserva la textura de fascia (aporta el velo)');
  // aspecto esquemático: todo como estaba
  ok(window.paulaApp.aspecto('esquematico') === 'esquematico', 'cambio a esquemático');
  const mfe = fl.mallas[0].material;
  ok(!fl.enPelicula && mfe.opacity === 1 && !mfe.transparent && mfe.depthWrite === true && !mfe.userData.pelicula && mfe.userData.cfg.color === '#B5523B' && fl.mallas[0].renderOrder === 0, 'esquemático: la fascia es opaca y con el color del sistema (sin película)');
  a2.tejidos.fijarFascias(false);
  ok(fl.objeto.visible === true, 'esquemático: la casilla no oculta nada');
  a2.tejidos.fijarFascias(true);
  // casilla en realista
  ok(window.paulaApp.aspecto('realista') === 'realista' && fl.enPelicula && fl.mallas[0].material.opacity < 0.2, 'vuelta a realista: de nuevo película');
  ok(a2.tejidos.fascias() === true && window.paulaApp.fascias() === true && window.paulaApp.estado().fascias === true && fl.objeto.visible, 'casilla activa por defecto: la película se ve');
  const llamadas = [];
  a2.bus.on('fascias', (v) => llamadas.push(v));
  ok(window.paulaApp.fascias(false) === false && fl.objeto.visible === false && a2.sistemas.rec('fascia_lata_i').objeto.visible === false && quad.objeto.visible === true, 'casilla inactiva: las fascias de revestimiento se ocultan y los músculos no');
  ok(llamadas.length === 1 && llamadas[0] === false && !a2.sistemas.mallasVisibles().includes(fl.mallas[0]), 'se avisa por el bus y la malla oculta no entra en el raycast');
  // seleccionar por buscador/explorador con la casilla apagada
  const res = a2.buscador.buscar('fascia lata');
  ok(res.length >= 2 && res.some((r) => r.id === 'fascia_lata_d'), 'el buscador encuentra las fascias aunque estén ocultas');
  await a2.seleccion.seleccionar('fascia_lata_d');
  const mr = fl.mallas[0].material;
  ok(fl.resaltada && fl.objeto.visible && mr.emissive.getHexString() === 'b3261e' && mr.opacity === a2.tejidos.opacidadPeliculaResaltada() && mr.userData.pelicula && mr.depthWrite === false, 'seleccionada con la casilla apagada: se muestra y se resalta (opacidad mayor, emisión)');
  ok(window.paulaSelection?.id === 'fascia_lata_d', 'paulaSelection recoge la fascia');
  a2.seleccion.deseleccionar();
  ok(fl.objeto.visible === false && !fl.resaltada, 'al deseleccionar vuelve a quedar oculta');
  window.paulaApp.fascias(true);
  await a2.seleccion.seleccionar('fascia_lata_d');
  ok(fl.mallas[0].material.opacity === a2.tejidos.opacidadPeliculaResaltada() && fl.mallas[0].material !== fl.base, 'seleccionada con la casilla activa: también se resalta');
  a2.seleccion.deseleccionar();
  ok(fl.mallas[0].material === fl.base, 'al deseleccionar vuelve el material compartido');
  // contexto y transparencia nunca la hacen más opaca
  a2.diseccion.aislar('quadriceps_femoris_d');
  ok(fl.mallas[0].material.opacity <= 0.1 + 1e-9, 'aislar otra estructura: la película queda en contexto (no más opaca)');
  a2.diseccion.restaurar();
  a2.diseccion.transparente('fascia_lata_d');
  ok(fl.mallas[0].material.opacity <= fl.base.opacity + 1e-9 && fl.mallas[0].material.userData.pelicula, 'transparente: nunca más opaca que la película');
  a2.diseccion.restaurar();
  // raycast: prefiere el músculo de debajo
  const proy = (x, y, z) => { const p = new THREE.Vector3(x, y, z).project(camera); return [(p.x * 0.5 + 0.5) * 800, (-p.y * 0.5 + 0.5) * 800]; };
  const cx = fl.centro.x, cz = fl.centro.z;
  const centro = a2.seleccion.elegir(...proy(cx, 0.7, cz), { exacto: true });
  ok(centro?.object.userData.rec.id === 'quadriceps_femoris_d', `raycast al centro del muslo: gana el músculo de debajo (${centro?.object.userData.rec.id})`);
  const borde = proy(cx + 0.047, 0.7, cz); // dentro de la funda (r = 0,05) pero fuera del cuádriceps (r = 0,045)
  const hitBorde = a2.seleccion.elegir(...borde, { exacto: true });
  ok(hitBorde?.object.userData.rec.id === 'fascia_lata_d', `raycast al borde de la funda: no hay nada opaco detrás, se acierta la fascia (${hitBorde?.object.userData.rec.id})`);
  ok(a2.seleccion.elegir(...borde) !== undefined, 'el clic normal (con tolerancia de estructuras finas) funciona con la película');
  window.paulaApp.fascias(false);
  ok(a2.seleccion.elegir(...borde, { exacto: true }) === null && a2.seleccion.elegir(...proy(cx, 0.7, cz), { exacto: true })?.object.userData.rec.id === 'quadriceps_femoris_d', 'con la casilla apagada el borde no acierta nada y el centro sigue dando el músculo');
  window.paulaApp.fascias(true);
  // esquemático: la fascia opaca tapa al músculo, como antes
  window.paulaApp.aspecto('esquematico');
  ok(a2.seleccion.elegir(...proy(cx, 0.7, cz), { exacto: true })?.object.userData.rec.id === 'fascia_lata_d', 'esquemático: sin película, el rayo toca la fascia opaca (comportamiento anterior)');
  // con la piel delante
  window.paulaApp.aspecto('realista');
}

console.log('Texturas ausentes del manifest (bazo, cerebelo, médula): color plano sin errores ni peticiones');
{
  const real = path.resolve(AQUI, '../texturas/manifest.json');
  if (!fs.existsSync(real)) console.log('  (sin app/texturas/manifest.json: se omite)');
  else {
    const { a2, peticiones } = montarApp2({ manifestReal: true, sin: ['bazo', 'cerebelo', 'medula'] });
    await a2.tejidos.iniciar();
    levantar(a2);
    await a2.sistemas.cargarIniciales();
    await a2.sistemas.activar('nervioso', true);
    await a2.tejidos.todasLasPromesas();
    ok(a2.tejidos.disponible() && a2.tejidos.aspecto() === 'realista', 'manifest sin esos tres: el aspecto realista sigue disponible');
    ok(['bazo', 'cerebelo', 'medula'].every((t) => !a2.tejidos.tejidoDisponible(t) && a2.tejidos.configuracion(t) === null), 'configuracion() devuelve null para los tejidos ausentes');
    const med = a2.sistemas.rec('spinal_cord');
    ok(med.tejido === 'medula' && med.base.userData.tejido === undefined && med.base.userData.cfg.color === '#E8C547' && !med.base.userData.cfg.tejido, 'la médula (tejido ausente) cae al color plano de su sistema');
    ok(a2.sistemas.rec('sciatic_nerve_d').base.userData.tejido === 'nervio', 'un tejido presente (nervio) sí usa su textura');
    ok(!peticiones.some((u) => /\/(bazo|cerebelo|medula)\//.test(u)), 'ninguna petición de imagen para tejidos ausentes');
    ok(a2.tejidos.tejido('medula') === null && a2.tejidos.tejido('bazo') === null, 'ni siquiera se crea estado de carga para ellos');
    const n0 = peticiones.length;
    for (let i = 0; i < 25; i++) { a2.sistemas.refrescar(); await a2.tejidos.necesitar('medula'); await a2.tejidos.necesitar('bazo'); await a2.tejidos.necesitar('cerebelo'); }
    a2.tejidos.fijar('esquematico'); a2.tejidos.fijar('realista'); window.paulaApp.fascias(false); window.paulaApp.fascias(true);
    ok(peticiones.length === n0, 'refrescar, cambiar de aspecto y pedir los tejidos ausentes en bucle no genera peticiones nuevas');
    ok((await a2.tejidos.necesitar('medula')) === false, 'necesitar() de un tejido ausente resuelve false sin lanzar');
  }
}

// =====================================================================================================
// Luz del aspecto realista: estimación por cálculo (calcular-luz.mjs)
// =====================================================================================================
console.log('Luz del aspecto realista (estimación por cálculo)');
{
  let luz = null;
  try { luz = await import('./calcular-luz.mjs'); await luz.calcular(); } catch (x) { luz = null; console.log('  (se omite: ' + (x.code || x.message) + ')'); }
  if (luz) {
    const { ESTILO_LUZ } = await import('../js/escena.js');
    const { filas } = await luz.calcular(ESTILO_LUZ.realista);
    const f = (id) => filas.find((x) => x.id === id);
    ok(f('hueso').lumaSal >= 70 && f('hueso').lumaSal <= 78, `hueso: ${f('hueso').lumaSal.toFixed(1)} % de luminancia de salida (objetivo 70–78 %)`);
    ok(f('musculo').lumaSal >= 28 && f('musculo').lumaSal <= 38, `músculo: ${f('musculo').lumaSal.toFixed(1)} % (objetivo 28–38 %)`);
    ok(filas.every((x) => x.pico < 0.985), 'ningún tejido recorta canales (p99 con variación) con los parámetros reales de ESTILO_LUZ');
    ok(filas.every((x) => Math.max(...x.sal) < 0.9), 'el valor medio de ningún tejido se acerca al blanco puro');
  }
}

console.error = consolaError;
ok(erroresConsola.length === 0, 'ninguna de las rutas (con texturas, sin ellas, con fallos) escribe errores en la consola' + (erroresConsola.length ? ': ' + erroresConsola[0] : ''));

console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
