import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
// Prueba de la interfaz con jsdom (sin WebGL): lista de sistemas, buscador, ficha, disección, corte, créditos y móvil.
// jsdom NO es dependencia del proyecto. Uso:
//   npm install --prefix "$TMPDIR/jd" jsdom@24.1.3 --cache "$TMPDIR/npm-cache"
//   JSDOM_PATH="$TMPDIR/jd/node_modules/jsdom/lib/api.js" node --no-warnings app/dev/probar-ui.mjs
const { JSDOM } = await import(process.env.JSDOM_PATH || 'jsdom');
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register(pathToFileURL(APP + '/dev/hooks-importmap.mjs').href);
const dom = new JSDOM(fs.readFileSync(APP + '/index.html', 'utf8').replace(/<script[\s\S]*?<\/script>/g, ''), { url: 'http://localhost:8765/?datos=dev/fixture/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['window', 'document', 'HTMLElement', 'CustomEvent', 'Node', 'KeyboardEvent', 'Event']) Object.defineProperty(globalThis, k, { value: k === 'window' ? w : w[k], configurable: true, writable: true });
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', clipboard: { writeText: async (t) => { globalThis.__copiado = t; } } }, configurable: true });
w.matchMedia = (q) => ({ matches: q.includes('max-width') ? !!globalThis.__movil : false, addEventListener() {} });
globalThis.matchMedia = w.matchMedia;
w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
w.Element.prototype.scrollIntoView = () => {};

const THREE = await import('three');
const { crearBus } = await import(APP + '/js/util/bus.js');
const D = await import(APP + '/js/datos.js');
const { crearSistemas } = await import(APP + '/js/sistemas.js');
const { crearDiseccion } = await import(APP + '/js/diseccion.js');
const { crearSeleccion } = await import(APP + '/js/seleccion.js');
const { crearSeparar } = await import(APP + '/js/separar.js');
const { crearExplorador } = await import(APP + '/js/explorador.js');
const { crearVistas } = await import(APP + '/js/vistas.js');
const { crearBuscador } = await import(APP + '/js/buscador.js');
const { crearFicha } = await import(APP + '/js/ficha.js');
const { crearPaula } = await import(APP + '/js/paula.js');
const { montarUI } = await import(APP + '/js/ui.js');
const { crearTejidos } = await import(APP + '/js/tejidos.js');

const FIX = APP + '/dev/fixture/';
const almacen = D.crearAlmacen(pathToFileURL(FIX).href, async (u) => JSON.parse(fs.readFileSync(fileURLToPath(u), 'utf8')), async (u) => { const b = fs.readFileSync(fileURLToPath(u)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
const datos = await D.cargarCatalogo(almacen);
const bus = crearBus();
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 40); camera.position.set(0, 0.9, 3.4); camera.updateMatrixWorld(true);
const cont = document.getElementById('visor');
const canvas = document.createElement('canvas'); cont.prepend(canvas);
Object.defineProperty(cont, 'clientWidth', { value: 800 }); Object.defineProperty(cont, 'clientHeight', { value: 600 });
const escena = { scene: new THREE.Scene(), camera, canvas, contenedor: cont, alRenderizar: new Set(), pedirRender() {}, distanciaParaRadio: (r) => r * 4, distanciaParaCaja: () => 3, irA: () => Promise.resolve() };
const app = { bus, debug: true, almacen, escena, datos, fichas: new Map() };
escena.fijarAspecto = () => true;
escena.animar = (d, fn) => { fn(1); return Promise.resolve(); };
{ let modo = 'girar'; const cbs = new Set(); escena.fijarModo = (m) => { modo = m; cbs.forEach((f) => f(m)); return true; }; escena.modo = () => modo; escena.alCambiarModo = cbs; }
app.tejidos = crearTejidos(app, { urlReglas: pathToFileURL(APP + '/datos/tejidos.json').href, leerJSON: async (u) => JSON.parse(fs.readFileSync(fileURLToPath(u), 'utf8')), cargarImagen: async () => ({ width: 2, height: 2, data: new Uint8Array(16) }) });
await app.tejidos.iniciar();
app.sistemas = crearSistemas(app); app.diseccion = crearDiseccion(app); app.separar = crearSeparar(app); app.seleccion = crearSeleccion(app); app.vistas = crearVistas(app);
app.buscador = crearBuscador(app); app.paula = crearPaula(app); app.ficha = crearFicha(app, document.getElementById('ficha')); app.explorador = crearExplorador(app); app.ui = montarUI(app);
app.buscador.montar(document.getElementById('q'), document.getElementById('resultados'));
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.error('FALLO', m); } else console.log('ok', m); };
const $ = (id) => document.getElementById(id);
await app.sistemas.cargarIniciales();
app.fichas = await D.cargarFichas(almacen); bus.emit('fichas-cargadas');

ok($('lista-sistemas').children.length === 3, 'lista de 3 sistemas');
ok($('lista-sistemas').textContent.includes('Sistema óseo') && /\d,\d MB/.test($('lista-sistemas').textContent), 'sistemas con peso en MB (coma decimal)');
ok($('lista-sistemas').querySelector('[aria-checked="true"]') && $('lista-sistemas').querySelectorAll('[aria-checked="true"]').length === 1, 'solo el óseo está encendido al inicio');
// encender muscular con clic
$('lista-sistemas').children[1].querySelector('button').click();
await new Promise((r) => setTimeout(r, 200));
ok(app.sistemas.estadoDe('muscular').estado === 'listo' && $('lista-sistemas').children[1].querySelector('button').getAttribute('aria-checked') === 'true', 'interruptor carga y enciende el sistema muscular');
// aspecto
const bReal = document.querySelector('[data-aspecto="realista"]'), bEsq = document.querySelector('[data-aspecto="esquematico"]');
ok(bReal.getAttribute('aria-checked') === 'true' && bEsq.getAttribute('aria-checked') === 'false' && !bReal.disabled, 'aspecto: con texturas, "Realista" es el modo por defecto');
ok(/Texturas de tejido/.test($('txt-aspecto').textContent) && !/[Ll]oading|[Rr]ealistic/.test(document.body.textContent), 'aspecto: texto de ayuda en español');
bEsq.click();
ok(app.tejidos.aspecto() === 'esquematico' && bEsq.getAttribute('aria-checked') === 'true' && bReal.getAttribute('aria-checked') === 'false' && window.paulaApp.aspecto() === 'esquematico', 'aspecto: clic en "Esquemático" cambia el modo');
ok(app.sistemas.rec('femur_d').base.userData.tejido === undefined, 'aspecto: esquemático usa el material plano');
bReal.click();
await new Promise((r) => setTimeout(r, 50));
ok(app.tejidos.aspecto() === 'realista' && app.sistemas.rec('femur_d').base.userData.tejido === 'hueso', 'aspecto: clic en "Realista" vuelve a las texturas');
// casilla "Mostrar fascias de revestimiento" (solo aplica en realista)
{
  const chk = $('chk-fascias'), flRec = app.sistemas.rec('fascia_lata_d');
  ok(chk && chk.type === 'checkbox' && /Mostrar fascias de revestimiento/.test($('lbl-fascias').textContent) && $('grupo-aspecto').contains(chk), 'fascias: casilla "Mostrar fascias de revestimiento" junto al interruptor de aspecto');
  ok(chk.checked && !chk.disabled && flRec.enPelicula && flRec.objeto.visible, 'fascias: activa por defecto en realista (la película se ve)');
  chk.checked = false; chk.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(app.tejidos.fascias() === false && !flRec.objeto.visible && /ocultas/.test($('txt-fascias').textContent), 'fascias: desmarcar oculta la película y avisa en español');
  chk.checked = true; chk.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(app.tejidos.fascias() === true && flRec.objeto.visible, 'fascias: marcar la vuelve a mostrar');
  bEsq.click();
  ok(chk.disabled && $('lbl-fascias').classList.contains('inactiva') && /Solo en el aspecto Realista/.test($('txt-fascias').textContent) && flRec.objeto.visible && !flRec.enPelicula, 'fascias: en esquemático la casilla se desactiva y la fascia es una malla opaca más');
  bReal.click();
  await new Promise((r) => setTimeout(r, 50));
  ok(!chk.disabled && flRec.enPelicula && !/[Ll]oading|[Ss]how|[Ff]ascia[s]? (overlay|film)/.test($('txt-fascias').textContent), 'fascias: al volver a realista la casilla se reactiva');
}
// buscador
const q = $('q'); q.value = 'femur'; q.dispatchEvent(new w.Event('input'));
ok($('resultados').children.length >= 2 && !$('resultados').hidden, 'el buscador lista resultados');
ok($('resultados').children[0].textContent.includes('Fémur'), 'primer resultado: Fémur, ' + $('resultados').children[0].textContent);
q.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
ok($('resultados').children[1].getAttribute('aria-selected') === 'true' && q.getAttribute('aria-activedescendant') === 'res-1', 'flecha abajo mueve la selección y aria-activedescendant');
q.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await new Promise((r) => setTimeout(r, 100));
ok(app.seleccion.actual()?.id === 'femur_i', 'Enter selecciona el resultado activo: ' + app.seleccion.actual()?.id);
ok(window.paulaSelection?.id === 'femur_i', 'paulaSelection actualizada');
const ficha = $('ficha');
ok(ficha.textContent.includes('Fémur') && ficha.textContent.includes('Femur') && ficha.textContent.includes('Sistema óseo') && ficha.textContent.includes('izquierdo'), 'ficha muestra nombre, latín, sistema y lado');
ok(ficha.textContent.includes('Función') && ficha.textContent.includes('Fuentes') && ficha.querySelector('a[href^="https://"]'), 'ficha con función y fuentes');
// secciones óseas opcionales (SPEC §7.4): se muestran cuando el campo existe y tiene contenido
ok(ficha.textContent.includes('Accidentes óseos') && ficha.textContent.includes('Trocánter mayor') && ficha.querySelector('i[lang="la"]'), 'ficha ósea: Accidentes óseos con nombre latino');
ok(ficha.textContent.includes('Articulaciones') && ficha.textContent.includes('Articulación de la cadera') && ficha.textContent.includes('sinovial esferoidea'), 'ficha ósea: Articulaciones');
ok(ficha.textContent.includes('Músculos que se insertan') && ficha.querySelector('.f-ins-tipo.es-origen') && ficha.querySelector('.f-ins-tipo.es-insercion'), 'ficha ósea: Músculos que se insertan (origen e inserción)');
ok(ficha.textContent.includes('Osificación') && ficha.textContent.includes('sin contraste'), 'ficha ósea: Osificación y aviso de contraste');
ok(!ficha.textContent.includes('Línea áspera —null') && !ficha.textContent.includes('null'), 'ficha ósea: nombre_la nulo no se imprime');
await app.seleccion.seleccionar('deltoid_d');
ok(!$('ficha').textContent.includes('Accidentes óseos') && !$('ficha').textContent.includes('Músculos que se insertan') && !$('ficha').textContent.includes('Osificación'), 'ficha de otro sistema: sin secciones óseas');
await app.seleccion.seleccionar('femur_i');
ok(ficha.dataset.estado === 'abierta', 'panel de ficha abierto');
// botones de disección
const botones = [...ficha.querySelectorAll('button')];
const btn = (t) => botones.find((b) => b.textContent.includes(t));
btn('Aislar').click();
ok(app.diseccion.estado.aislada === 'femur_i' && $('btn-deshacer').disabled === false && $('btn-restaurar').disabled === false, 'aislar activa Deshacer/Restaurar');
ok([...ficha.querySelectorAll('button')].find((b) => b.textContent.includes('Aislar')).getAttribute('aria-pressed') === 'true', 'botón Aislar queda presionado');
$('btn-restaurar').click();
ok(!app.diseccion.hayCambios(), 'Restaurar limpia');
$('btn-deshacer').click();
ok(app.diseccion.estado.aislada === 'femur_i', 'Deshacer revierte Restaurar');
$('btn-restaurar').click();
[...ficha.querySelectorAll('button')].find((b) => b.textContent.includes('Transparente')).click();
ok(app.diseccion.estado.transparentes.has('femur_i'), 'Transparente');
[...ficha.querySelectorAll('button')].find((b) => b.textContent.includes('Ocultar')).click();
ok(app.diseccion.estado.ocultas.has('femur_i') && [...ficha.querySelectorAll('button')].some((b) => b.textContent.includes('Mostrar')), 'Ocultar cambia el botón a Mostrar');
$('btn-restaurar').click();
// preguntar a Paula
[...ficha.querySelectorAll('button')].find((b) => b.textContent.includes('Preguntar a mi tutora')).click();
await new Promise((r) => setTimeout(r, 50));
ok(globalThis.__copiado?.startsWith('/paula Estoy en la app de anatomía viendo: Fémur (Femur) — Sistema óseo, lado izquierdo.'), 'el botón copia la pregunta');
ok($('avisos').textContent.includes('Pregunta copiada: pégala en Claude') && window.paulaSelection.preguntado === true, 'aviso "Pregunta copiada" y preguntado=true');
// profundidad
const rp = $('rng-profundidad'); rp.value = '4'; rp.dispatchEvent(new w.Event('input'));
ok(app.diseccion.estado.profundidad === 4 && $('txt-profundidad').textContent.startsWith('Nivel 4'), 'deslizador de profundidad');
rp.value = '0'; rp.dispatchEvent(new w.Event('input'));
// corte
$('btn-corte').click();
ok(app.diseccion.estado.corte.activo && !$('rng-corte').disabled && !$('btn-invertir').disabled && $('txt-btn-corte').textContent === 'Apagar corte', 'activar corte habilita controles');
document.querySelector('[data-eje="transversal"]').click();
ok(app.diseccion.estado.corte.eje === 'transversal' && document.querySelector('[data-eje="transversal"]').getAttribute('aria-checked') === 'true', 'eje transversal');
ok(Math.abs(app.diseccion.estado.corte.posicion - (app.sistemas.cuerpoBox.min.y + app.sistemas.cuerpoBox.max.y) / 2) < 0.01, 'posición inicial al centro del cuerpo');
$('btn-invertir').click(); ok(app.diseccion.estado.corte.invertido, 'invertir');
$('btn-corte').click(); ok(!app.diseccion.estado.corte.activo, 'apagar corte');
// vistas
document.querySelector('[data-vista="posterior"]').click(); ok(true, 'vista posterior sin error');
// créditos
$('btn-creditos').click();
ok($('dlg-creditos').hasAttribute('open') && $('dlg-creditos').textContent.includes('CC BY-SA 4.0') && $('dlg-creditos').querySelector('a[href="ATRIBUCIONES.md"]'), 'créditos con licencias y enlace a ATRIBUCIONES.md');
// Esc deselecciona
document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
$('dlg-creditos').removeAttribute('open');
document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
ok(app.seleccion.actual() === null && window.paulaSelection === null, 'Esc cierra la ficha');
ok(ficha.textContent.includes('Ninguna estructura seleccionada'), 'ficha vacía en español');
// estructura sin ficha
await app.seleccion.seleccionar('psoas_major_d');
ok(ficha.textContent.includes('Ficha en preparación') && window.paulaSelection.tiene_ficha === false && !ficha.textContent.includes('Función'), 'sin ficha: mínimo + "Ficha en preparación"');
// atajo "/"
document.dispatchEvent(new w.KeyboardEvent('keydown', { key: '/', bubbles: true }));
ok(document.activeElement === q, '"/" enfoca el buscador');

// ---- separar (panel Vista) ----
{
  const rng = $('rng-separar');
  ok(rng && $('txt-separar').textContent === '0 %' && $('btn-separar-reiniciar').disabled, 'separar: deslizador en 0 % y botón de reinicio desactivado');
  rng.value = '70'; rng.dispatchEvent(new w.Event('input'));
  await new Promise((r) => setTimeout(r, 20));
  ok(app.separar.estado.pct === 70 && $('txt-separar').textContent === '70 %' && !$('btn-separar-reiniciar').disabled, 'separar: el deslizador mueve la separación y activa el reinicio');
  ok(window.paulaApp.estado().separacion === 70, 'paulaApp.estado().separacion = 70');
  const alc = document.querySelector('[data-alcance="sistema"]');
  alc.click();
  await new Promise((r) => setTimeout(r, 20));
  ok(!$('sel-sep-sistema').hidden && alc.getAttribute('aria-checked') === 'true' && /Solo se separa/.test($('txt-sep-alcance').textContent), 'separar: "Un sistema" muestra la lista de sistemas y explica el alcance');
  ok(JSON.stringify(app.separar.estado.alcance.sistemas) === '["' + $('sel-sep-sistema').value + '"]', 'separar: el alcance es el sistema elegido');
  const rg = document.querySelector('[data-alcance="region"]');
  await app.seleccion.deseleccionar();
  rg.click();
  ok(rg.getAttribute('aria-checked') === 'false', 'separar: "Región de la pieza" sin selección no cambia (avisa)');
  await app.seleccion.seleccionar('femur_d');
  rg.click();
  await new Promise((r) => setTimeout(r, 20));
  ok(rg.getAttribute('aria-checked') === 'true' && app.separar.estado.alcance.region === 'miembro inferior', 'separar: con una pieza seleccionada toma su región');
  $('chk-sep-atenuar').checked = false; $('chk-sep-atenuar').dispatchEvent(new w.Event('change'));
  ok(app.separar.estado.atenuar === false, 'separar: casilla de atenuar');
  $('btn-separar-reiniciar').click();
  await new Promise((r) => setTimeout(r, 20));
  ok(app.separar.estado.pct === 0 && rng.value === '0' && $('btn-separar-reiniciar').disabled, 'separar: el botón de reinicio vuelve a 0');
  document.querySelector('[data-alcance="visible"]').click();
}

// ---- modo Girar / Mover ----
{
  const mover = document.querySelector('[data-modo="mover"]'), girar = document.querySelector('[data-modo="girar"]');
  ok(girar.getAttribute('aria-checked') === 'true' && mover.getAttribute('aria-checked') === 'false' && /Mover/.test(mover.textContent), 'modo: Girar activo por defecto; el botón dice "Mover"');
  mover.click();
  ok(escena.modo() === 'mover' && mover.getAttribute('aria-checked') === 'true' && girar.getAttribute('aria-checked') === 'false', 'modo: clic en "Mover" cambia el modo y el estado visible');
  escena.fijarModo('girar');
  ok(girar.getAttribute('aria-checked') === 'true', 'modo: si cambia desde fuera (tecla M) el botón lo refleja');
}

// ---- explorador ----
{
  const tabExp = $('tab-explorador'), arbol = $('arbol-explorador');
  ok($('pestana-explorador').hidden && tabExp.getAttribute('aria-selected') === 'false', 'explorador: cerrado al inicio');
  $('btn-explorador').click();
  ok(!$('pestana-explorador').hidden && $('pestana-vista').hidden && tabExp.getAttribute('aria-selected') === 'true' && $('btn-explorador').getAttribute('aria-expanded') === 'true', 'explorador: el botón de la barra abre la pestaña');
  ok(document.getElementById('app').classList.contains('explorador-abierto'), 'explorador: el panel se ensancha');
  ok(arbol.getAttribute('role') === 'tree' && arbol.querySelectorAll('[role="treeitem"]').length === 3, 'explorador: árbol ARIA con 3 filas de sistema');
  const fila = (clave) => arbol.querySelector(`[data-clave="${clave}"]`);
  const sOseo = fila('sis:oseo');
  ok(sOseo.getAttribute('aria-level') === '1' && sOseo.getAttribute('aria-expanded') === 'false' && /Sistema óseo/.test(sOseo.textContent) && /14/.test(sOseo.textContent), 'explorador: fila del sistema óseo, plegada, con su número de piezas');
  ok(arbol.querySelectorAll('[aria-level="2"]').length === 0, 'explorador: las regiones están plegadas (no se pintan)');
  const total = [...arbol.querySelectorAll('.ex-cuenta')].reduce((a, e) => a + Number(e.textContent), 0);
  ok(total === datos.estructuras.length, `explorador: los sistemas suman el total del catálogo (${total})`);
  sOseo.focus();
  sOseo.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  ok(fila('sis:oseo').getAttribute('aria-expanded') === 'true' && arbol.querySelectorAll('[aria-level="2"]').length >= 3, 'explorador: flecha derecha despliega y muestra las regiones');
  ok(document.activeElement === fila('sis:oseo'), 'explorador: el foco se conserva al repintar');
  fila('sis:oseo').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const segunda = document.activeElement;
  ok(segunda.getAttribute('aria-level') === '2', 'explorador: flecha abajo baja a la primera región');
  segunda.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  const est = arbol.querySelectorAll('[aria-level="3"]');
  ok(est.length >= 1, `explorador: la región desplegada muestra sus estructuras (${est.length})`);
  const par = [...est].find((e) => e.querySelector('.ex-lados'));
  ok(par && par.querySelectorAll('.ex-lado-btn').length === 2 && par.querySelector('.ex-lado-btn').textContent === 'D' && par.querySelectorAll('.ex-lado-btn')[1].textContent === 'I', 'explorador: el par derecha/izquierda va en una fila con botones D e I');
  par.querySelectorAll('.ex-lado-btn')[1].click();
  await new Promise((r) => setTimeout(r, 120));
  ok(app.seleccion.actual() && app.seleccion.actual().est.lado === 'izquierdo', 'explorador: el botón I selecciona la estructura izquierda');
  // filtro (con tildes y mayúsculas)
  const filtro = $('q-explorador');
  filtro.value = 'FÉMUR'; filtro.dispatchEvent(new w.Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  const nombres = [...arbol.querySelectorAll('[aria-level="3"] .ex-nombre')].map((e) => e.textContent);
  ok(nombres.length >= 1 && nombres.every((n) => /Fémur/i.test(n)), `explorador: el filtro "FÉMUR" deja solo fémures (${nombres.join(', ')})`);
  ok(/de \d+ estructuras/.test($('txt-exp-total').textContent), 'explorador: el total refleja el filtro');
  filtro.value = 'zzzzz'; filtro.dispatchEvent(new w.Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  ok(!$('exp-vacio').hidden && arbol.querySelectorAll('[role="treeitem"]').length === 0, 'explorador: sin coincidencias muestra el aviso');
  filtro.value = ''; filtro.dispatchEvent(new w.Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  // ver solo / separar / visibilidad desde la fila
  const botones = (clave, etiqueta) => [...fila(clave).querySelectorAll('button')].find((b) => b.getAttribute('aria-label').startsWith(etiqueta));
  botones('sis:muscular', 'Ver solo').click();
  await new Promise((r) => setTimeout(r, 100));
  ok(app.sistemas.sistemaActivo('muscular') && !app.sistemas.sistemaActivo('oseo'), 'explorador: "Ver solo" en el sistema muscular apaga los demás');
  botones('sis:oseo', 'Separar').click();
  await new Promise((r) => setTimeout(r, 100));
  ok(app.separar.estado.pct > 0 && app.separar.estado.alcance.sistemas[0] === 'oseo' && app.sistemas.sistemaActivo('oseo'), 'explorador: "Separar" activa la vista separada con alcance en ese sistema (y lo carga)');
  ok($('rng-separar').value === String(app.separar.estado.pct), 'explorador: el deslizador del panel Vista lo refleja');
  const vis = botones('sis:oseo', 'Mostrar u ocultar');
  vis.click();
  await new Promise((r) => setTimeout(r, 50));
  ok(!app.sistemas.sistemaActivo('oseo') && fila('sis:oseo').querySelector('[role="switch"]').getAttribute('aria-checked') === 'false', 'explorador: el interruptor de visibilidad apaga el sistema');
  $('btn-restablecer-vista').click();
  await new Promise((r) => setTimeout(r, 100));
  ok(app.separar.estado.pct === 0 && app.sistemas.sistemaActivo('oseo') && !app.sistemas.sistemaActivo('muscular') && app.diseccion.estado.ocultas.size === 0, 'explorador: "Restablecer vista" devuelve sistemas por defecto, separación 0 y nada oculto');
  // atajo E cierra
  document.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  ok(document.getElementById('app').classList.contains('plegado-izq'), 'explorador: la tecla E con el foco en la página cierra el panel');
  document.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  ok(!document.getElementById('app').classList.contains('plegado-izq') && !$('pestana-explorador').hidden, 'explorador: y la vuelve a abrir');
  filtro.focus();
  filtro.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  ok(!document.getElementById('app').classList.contains('plegado-izq'), 'explorador: escribir "e" en el filtro no cierra el panel');
  tabExp.click(); $('tab-vista').click();
  ok(!$('pestana-vista').hidden, 'pestañas: se puede volver a "Vista"');
  ok(/Gestos y teclas del visor/.test($('dlg-creditos').textContent) && /Mayús/.test($('dlg-creditos').textContent) && /Nervios y vasos/.test($('dlg-creditos').textContent), 'ayuda ⓘ: documenta los gestos (Girar, Mover, Mayús, flechas) y el consejo para nervios y vasos');
}
// móvil
globalThis.__movil = true;
app.seleccion.deseleccionar();
await app.seleccion.seleccionar('sternum');
ok(ficha.dataset.estado === 'asomada', 'móvil: la ficha asoma como hoja inferior');
// textos en inglés visibles
const visible = document.body.textContent;
for (const pal of [' Loading', 'Search ', ' Close ', 'Undo', 'Reset']) ok(!visible.includes(pal), `sin "${pal.trim()}" en la interfaz`);
console.log(fallos ? `\n${fallos} fallos` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
