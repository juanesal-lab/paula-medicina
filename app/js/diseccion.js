// Disección (ocultar, alternarOculta, aislar, transparente, restaurar, deshacer), profundidad y plano de corte.
import * as THREE from 'three';
import { planoCorte } from './materiales.js';

const MAX_HISTORIAL = 20;
const EJES = { sagital: 'x', coronal: 'z', transversal: 'y' };

export function crearDiseccion(app) {
  const { bus, escena } = app;
  const estado = {
    ocultas: new Set(),
    transparentes: new Set(),
    aislada: null,
    contexto: true, // al aislar, el resto queda como contexto translúcido al 10 %
    profundidad: 0,
    corte: { activo: false, eje: 'sagital', posicion: 0, invertido: false },
  };
  const historial = [];

  const instantanea = () => ({
    ocultas: new Set(estado.ocultas), transparentes: new Set(estado.transparentes), aislada: estado.aislada,
  });
  function guardar() {
    historial.push(instantanea());
    if (historial.length > MAX_HISTORIAL) historial.shift();
  }
  function cambio() {
    app.sistemas.refrescar();
    bus.emit('diseccion', estado);
  }

  // ---- reglas de visibilidad ----
  function esVisible(rec) {
    if (rec.capa < estado.profundidad) return false;
    if (estado.ocultas.has(rec.id)) return false;
    if (estado.aislada && estado.aislada !== rec.id && !estado.contexto) return false;
    return true;
  }
  function estadoVisual(rec) {
    if (app.separar && app.separar.esContexto(rec)) return 'contexto'; // vista separada: lo que no se separa queda atenuado
    if (estado.aislada && estado.aislada !== rec.id) return 'contexto';
    if (estado.transparentes.has(rec.id)) return 'transparente';
    return 'normal';
  }

  // ---- acciones (cada una se puede deshacer) ----
  function ocultar(id) {
    if (!app.datos.porId.has(id)) return false;
    guardar();
    estado.ocultas.add(id);
    if (estado.aislada === id) estado.aislada = null;
    cambio();
    return true;
  }
  function alternarOculta(id) {
    if (!app.datos.porId.has(id)) return false;
    guardar();
    if (estado.ocultas.has(id)) estado.ocultas.delete(id); else { estado.ocultas.add(id); if (estado.aislada === id) estado.aislada = null; }
    cambio();
    return true;
  }
  function aislar(id) {
    if (!app.datos.porId.has(id)) return false;
    guardar();
    estado.ocultas.delete(id);
    estado.aislada = estado.aislada === id ? null : id; // aislar de nuevo la misma estructura sale del aislamiento
    cambio();
    return true;
  }
  function transparente(id) {
    if (!app.datos.porId.has(id)) return false;
    guardar();
    if (estado.transparentes.has(id)) estado.transparentes.delete(id); else estado.transparentes.add(id);
    cambio();
    return true;
  }
  function restaurar() {
    if (!estado.ocultas.size && !estado.transparentes.size && !estado.aislada) return false;
    guardar();
    estado.ocultas.clear();
    estado.transparentes.clear();
    estado.aislada = null;
    cambio();
    return true;
  }
  function deshacer() {
    const previa = historial.pop();
    if (!previa) return false;
    estado.ocultas = previa.ocultas;
    estado.transparentes = previa.transparentes;
    estado.aislada = previa.aislada;
    cambio();
    return true;
  }
  // Hace visible una estructura sin pasar por el historial (p. ej., al seleccionarla desde el buscador).
  function mostrar(id) {
    if (estado.ocultas.delete(id)) { cambio(); return true; }
    return false;
  }
  // Oculta y/o muestra varias estructuras de una vez, en un único paso del historial.
  // `soltarAislada` quita el aislamiento. Devuelve false si no cambió nada.
  function cambiarOcultas({ ocultar = [], mostrar = [], soltarAislada = false } = {}) {
    let hay = soltarAislada && !!estado.aislada;
    for (const id of ocultar) if (!estado.ocultas.has(id)) { hay = true; break; }
    if (!hay) for (const id of mostrar) if (estado.ocultas.has(id)) { hay = true; break; }
    if (!hay) return false;
    guardar();
    for (const id of mostrar) estado.ocultas.delete(id);
    for (const id of ocultar) estado.ocultas.add(id);
    if (soltarAislada) estado.aislada = null;
    else if (estado.aislada && estado.ocultas.has(estado.aislada)) estado.aislada = null;
    cambio();
    return true;
  }
  function setContexto(valor) {
    estado.contexto = !!valor;
    cambio();
  }

  // ---- profundidad ----
  function setProfundidad(n) {
    const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    if (v === estado.profundidad) return v;
    estado.profundidad = v;
    app.sistemas.refrescar();
    bus.emit('profundidad', v);
    return v;
  }

  // ---- corte ----
  function rangoCorte(eje = estado.corte.eje) {
    const k = EJES[eje] || 'x';
    // Con piezas separadas el rango incluye lo desplazado: el plano de corte actúa sobre la posición MOSTRADA.
    const caja = app.separar ? app.separar.caja() : app.sistemas.cuerpoBox;
    return { min: caja.min[k], max: caja.max[k] };
  }
  function actualizarPlano() {
    const c = estado.corte;
    if (!c.activo) {
      planoCorte.normal.set(0, 1, 0);
      planoCorte.constant = 1e6;
    } else {
      const k = EJES[c.eje];
      const n = new THREE.Vector3();
      n[k] = c.invertido ? -1 : 1;
      planoCorte.normal.copy(n);
      // Se conserva el lado donde (n · p) + constante >= 0
      planoCorte.constant = c.invertido ? c.posicion : -c.posicion;
    }
    escena.pedirRender();
    bus.emit('corte', estado.corte);
  }
  function setCorte(cambios = {}) {
    const c = estado.corte;
    const ejeAntes = c.eje;
    if (cambios.eje && EJES[cambios.eje]) c.eje = cambios.eje;
    if (typeof cambios.activo === 'boolean') c.activo = cambios.activo;
    if (typeof cambios.invertido === 'boolean') c.invertido = cambios.invertido;
    const r = rangoCorte();
    if (c.eje !== ejeAntes && cambios.posicion === undefined) c.posicion = (r.min + r.max) / 2;
    if (typeof cambios.posicion === 'number' && isFinite(cambios.posicion)) c.posicion = cambios.posicion;
    c.posicion = Math.min(Math.max(c.posicion, r.min), r.max);
    actualizarPlano();
    return c;
  }
  // Un punto está del lado recortado si su distancia firmada al plano es negativa.
  function estaRecortado(punto) {
    return estado.corte.activo && planoCorte.distanceToPoint(punto) < 0;
  }

  // Al separar o juntar piezas cambia el rango del plano de corte; se reencaja la posición.
  bus.on('separacion', () => { setCorte({}); });

  // Valor inicial del corte: centro del cuerpo en el eje sagital.
  bus.on('cuerpo-caja', () => {
    if (!estado.corte.activo) {
      const r = rangoCorte();
      estado.corte.posicion = (r.min + r.max) / 2;
    } else setCorte({});
    bus.emit('corte', estado.corte);
  });
  {
    const r = rangoCorte();
    estado.corte.posicion = (r.min + r.max) / 2;
  }

  return {
    estado, esVisible, estadoVisual,
    ocultar, alternarOculta, aislar, transparente, restaurar, deshacer, mostrar, setContexto, cambiarOcultas,
    puedeDeshacer: () => historial.length > 0,
    pasosDeshacer: () => historial.length,
    hayCambios: () => !!(estado.ocultas.size || estado.transparentes.size || estado.aislada),
    setProfundidad, setCorte, rangoCorte, estaRecortado,
  };
}
