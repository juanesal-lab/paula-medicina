// Arranque de la app de anatomía: datos -> escena -> módulos -> carga inicial -> fichas en segundo plano.
import { crearBus } from './util/bus.js';
import { baseDesdeParametro, crearAlmacen, leerJSONRed, leerBinarioRed, cargarCatalogo, cargarFichas } from './datos.js';
import { crearEscena } from './escena.js';
import { crearSistemas } from './sistemas.js';
import { crearDiseccion } from './diseccion.js';
import { crearSeparar } from './separar.js';
import { crearExplorador } from './explorador.js';
import { crearSeleccion } from './seleccion.js';
import { crearVistas } from './vistas.js';
import { crearBuscador } from './buscador.js';
import { crearFicha } from './ficha.js';
import { crearPaula } from './paula.js';
import { crearTejidos } from './tejidos.js';
import { montarUI } from './ui.js';

const params = new URLSearchParams(location.search);
const debug = params.get('debug') === '1';
const $ = (id) => document.getElementById(id);

function mostrarMensaje(titulo, detalle) {
  const m = $('mensaje');
  m.hidden = false;
  m.textContent = '';
  const t = document.createElement('strong');
  t.textContent = titulo;
  const p = document.createElement('p');
  p.style.margin = '6px 0 0';
  p.textContent = detalle;
  m.append(t, p);
}

// API mínima para que Claude no falle si la app no pudo arrancar.
function instalarApiVacia() {
  window.paulaSelection = null;
  window.paulaApp = {
    version: 1, estado: () => null, buscar: () => [], seleccionar: async () => false,
    mostrarSistema: async () => false, aislar: () => false, restaurar: () => false, vista: () => false,
    aspecto: () => 'esquematico', fascias: () => true,
    separar: async () => 0, verSolo: async () => false, restablecerVista: async () => false,
  };
}

async function arrancar() {
  instalarApiVacia();
  const bus = crearBus();
  const base = baseDesdeParametro(params.get('datos'), document.baseURI);
  const almacen = crearAlmacen(base, leerJSONRed, leerBinarioRed);

  let escena;
  try {
    escena = crearEscena($('visor'));
  } catch (e) {
    console.error('[paula] WebGL no disponible', e);
    mostrarMensaje('No se pudo iniciar el visor 3D', 'Tu navegador o tu equipo no permite WebGL. Prueba con otro navegador o activa la aceleración por hardware.');
    return;
  }

  let datos;
  try {
    datos = await cargarCatalogo(almacen);
  } catch (e) {
    console.error('[paula] no se pudieron cargar los datos', e);
    mostrarMensaje('No se pudieron cargar los datos de anatomía', 'Falta el catálogo o la lista de sistemas. Si abriste el archivo index.html directamente, usa un servidor estático (por ejemplo, python3 -m http.server).');
    return;
  }

  const app = { bus, debug, almacen, escena, datos, fichas: new Map() };
  // Se resuelve cuando terminan de cargar las fichas (paulaApp.seleccionar la espera).
  let resolverFichas;
  app.fichasListas = new Promise((r) => { resolverFichas = r; });
  // Aspecto realista: reglas de tejidos y manifest de texturas (tolera que no existan: queda el aspecto esquemático).
  app.tejidos = crearTejidos(app, {
    urlReglas: new URL('datos/tejidos.json', document.baseURI).href,
    aspectoInicial: params.get('aspecto'),
  });
  await app.tejidos.iniciar();
  app.sistemas = crearSistemas(app);
  app.diseccion = crearDiseccion(app);
  app.separar = crearSeparar(app);
  app.seleccion = crearSeleccion(app);
  app.vistas = crearVistas(app);
  app.buscador = crearBuscador(app);
  app.paula = crearPaula(app);
  app.ficha = crearFicha(app, $('ficha'));
  app.explorador = crearExplorador(app);
  escena.fijarLimite(() => app.separar.caja()); // el punto de mira no se sale del cuerpo (con margen)
  app.ui = montarUI(app);
  app.buscador.montar($('q'), $('resultados'));
  if (debug) window.__paula = app;

  // Encuadre inicial con la caja del catálogo; se reajusta cuando llegan las mallas reales.
  app.vistas.ir('anterior', 0);
  bus.on('cuerpo-caja', (() => { let primera = true; return () => { if (primera) { primera = false; app.vistas.ir('anterior', 0); } }; })());

  await app.sistemas.cargarIniciales();
  app.sistemas.refrescar();

  // Fichas en segundo plano, tras el primer render.
  requestAnimationFrame(() => setTimeout(async () => {
    app.fichas = await cargarFichas(almacen);
    bus.emit('fichas-cargadas', app.fichas.size);
    resolverFichas(app.fichas.size);
  }, 0));
}

arrancar().catch((e) => {
  console.error('[paula] error al arrancar', e);
  mostrarMensaje('Algo salió mal al iniciar', 'Recarga la página. Si el problema continúa, revisa la consola del navegador.');
});
