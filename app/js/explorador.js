// Explorador de estructuras (el "tablero"): árbol Sistema -> Región o subsistema -> Estructura, con filtro,
// "Ver solo esto", "Separar esto", visibilidad por fila, carga bajo demanda y navegación por teclado (ARIA tree).
// La parte de datos (construirArbol, contarCoincidencias, miembros) es pura y no toca el DOM.
import * as THREE from 'three';
import { h, vaciar } from './util/dom.js';
import { icono } from './util/iconos.js';
import { normalizar, colorSeguro } from './util/texto.js';
import { tieneFicha } from './datos.js';
import { SEPARACION_INICIAL } from './separar.js';

// Sistemas cuyo segundo nivel es el subsistema (arterias/venas, SNC/SNP, orígenes/inserciones…).
// En el resto (óseo, articular, piel, urinario, endocrino, reproductor) el segundo nivel es la región.
export const NIVEL_SUBSISTEMA = new Set(['cardiovascular', 'nervioso', 'muscular', 'inserciones', 'linfatico', 'respiratorio', 'digestivo']);
const NOMBRE_SUBSISTEMA = {
  'vainas-bolsas': 'Vainas y bolsas', snc: 'Sistema nervioso central', snp: 'Sistema nervioso periférico',
  'tubo-digestivo': 'Tubo digestivo', 'ganglios-linfaticos': 'Ganglios linfáticos', 'organos-linfoides': 'Órganos linfoides',
  'via-aerea': 'Vía aérea', 'genital-masculino': 'Genital masculino', origen: 'Orígenes', insercion: 'Inserciones',
  musculos: 'Músculos', corazon: 'Corazón', sentidos: 'Órganos de los sentidos',
};
export const LIMITE_FILAS = 150; // filas de estructura que se pintan por rama antes de "Mostrar más"
const mayuscula = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const nombreSub = (s) => NOMBRE_SUBSISTEMA[s] || mayuscula(String(s || 'general').replace(/-/g, ' '));

// ---------- datos puros ----------
// Árbol: { sistemas: [nodo], n } ; nodo sistema { tipo:'sistema', clave, sistema, nombre, color, n, grupos:[nodo] }
// nodo grupo { tipo:'grupo', clave, sistema, region|subsistema, nombre, n, entradas:[{ est, d, i, n }] }
// Una entrada agrupa el par derecha/izquierda de la misma estructura (d e i) o es una estructura suelta (est).
export function construirArbol(estructuras, sistemas) {
  const porSistema = new Map(sistemas.map((s) => [s.id, []]));
  for (const e of estructuras) { if (!porSistema.has(e.sistema)) porSistema.set(e.sistema, []); porSistema.get(e.sistema).push(e); }
  const nodos = [];
  for (const [idSis, lista] of porSistema) {
    const def = sistemas.find((s) => s.id === idSis) || { id: idSis, nombre: idSis, color: '#999999' };
    const porSub = NIVEL_SUBSISTEMA.has(idSis);
    const mapa = new Map();
    for (const e of lista) {
      const k = porSub ? (e.subsistema || 'general') : (e.region || 'sin región');
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(e);
    }
    const grupos = [...mapa].map(([k, piezas]) => ({
      tipo: 'grupo', clave: `grp:${idSis}:${k}`, sistema: idSis,
      ...(porSub ? { subsistema: k } : { region: k }),
      nombre: porSub ? nombreSub(k) : mayuscula(k), n: piezas.length, entradas: agruparPares(piezas),
    })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
    nodos.push({ tipo: 'sistema', clave: 'sis:' + idSis, sistema: idSis, nombre: def.nombre, color: def.color, n: lista.length, grupos, nivelSub: porSub });
  }
  return { sistemas: nodos, n: nodos.reduce((a, x) => a + x.n, 0) };
}

function agruparPares(piezas) {
  const orden = [...piezas].sort((a, b) => a.nombre_es.localeCompare(b.nombre_es, 'es') || (a.lado === 'derecho' ? -1 : 1));
  const pend = new Map(); // clave -> entrada con un lado a la espera de su pareja
  const salida = [];
  for (const e of orden) {
    if (e.lado !== 'derecho' && e.lado !== 'izquierdo') { salida.push({ est: e, n: 1 }); continue; }
    const clave = [e.sistema, e.subsistema, e.grupo_es, normalizar(e.nombre_es), normalizar(e.nombre_la)].join('|');
    const otro = e.lado === 'derecho' ? 'i' : 'd';
    const esp = pend.get(clave + '|' + otro);
    if (esp && esp.length) {
      const ent = esp.shift();
      ent[e.lado === 'derecho' ? 'd' : 'i'] = e;
      ent.n = 2;
      continue;
    }
    const ent = { est: e, n: 1, [e.lado === 'derecho' ? 'd' : 'i']: e };
    const k = clave + '|' + (e.lado === 'derecho' ? 'd' : 'i');
    if (!pend.has(k)) pend.set(k, []);
    pend.get(k).push(ent);
    salida.push(ent);
  }
  return salida;
}

export const piezasDe = (entrada) => (entrada.d || entrada.i ? [entrada.d, entrada.i].filter(Boolean) : [entrada.est]);

const textoBusqueda = new WeakMap();
function indice(e) {
  let t = textoBusqueda.get(e);
  if (t === undefined) { t = normalizar(`${e.nombre_es} ${e.nombre_la || ''} ${e.nombre_en || ''}`); textoBusqueda.set(e, t); }
  return t;
}
// Misma normalización que el buscador (sin tildes ni mayúsculas); todas las palabras deben aparecer.
export function coincide(est, tokens) {
  if (!tokens.length) return true;
  const t = indice(est);
  return tokens.every((x) => t.includes(x));
}
export const tokensDe = (texto) => normalizar(texto).split(' ').filter(Boolean);

// Cuántas piezas coinciden en cada nodo: Map(clave -> n). Con texto vacío devuelve los totales.
export function contarCoincidencias(arbol, texto) {
  const tokens = tokensDe(texto);
  const m = new Map();
  let total = 0;
  for (const s of arbol.sistemas) {
    let ns = 0;
    for (const g of s.grupos) {
      const ng = tokens.length ? g.entradas.reduce((a, en) => a + piezasDe(en).filter((e) => coincide(e, tokens)).length, 0) : g.n;
      m.set(g.clave, ng);
      ns += ng;
    }
    m.set(s.clave, ns);
    total += ns;
  }
  m.set('total', total);
  return m;
}

// Piezas del catálogo que corresponden a una selección { sistema, region, subsistema }.
export function miembros(estructuras, { sistema, region, subsistema } = {}) {
  return estructuras.filter((e) => (!sistema || e.sistema === sistema) && (!region || e.region === region) && (!subsistema || e.subsistema === subsistema));
}

// ---------- módulo ----------
export function crearExplorador(app) {
  const { bus, datos, escena } = app;
  let arbolCache = null;
  const arbol = () => (arbolCache ||= construirArbol(datos.estructuras, datos.sistemas));

  // ---- acciones (también las usa paulaApp) ----
  function encuadrar(lista) {
    const caja = new THREE.Box3();
    for (const e of lista) {
      if (!Array.isArray(e.centro)) continue;
      const rec = app.sistemas.rec(e.id);
      const p = new THREE.Vector3(...e.centro);
      if (rec && rec.desp) p.add(rec.desp);
      const r = Math.min(e.radio || 0.05, 0.3) * 0.5;
      caja.expandByPoint(p.clone().addScalar(r));
      caja.expandByPoint(p.clone().addScalar(-r));
    }
    if (caja.isEmpty()) return Promise.resolve(false);
    const c = caja.getCenter(new THREE.Vector3());
    const t = caja.getSize(new THREE.Vector3());
    const ancho = Math.max(t.x, t.z) / 2;
    return escena.irA({ objetivo: c, distancia: escena.distanciaParaCaja(Math.max(ancho, 0.04), Math.max(t.y / 2, 0.04), ancho * 0.5), duracion: 350 }).then(() => true);
  }

  // Apaga todo lo demás y encuadra. sel = { sistema, region, subsistema } (al menos uno).
  async function verSolo(sel = {}) {
    const lista = miembros(datos.estructuras, sel);
    if (!lista.length) return false;
    const objetivo = new Set(lista.map((e) => e.sistema));
    for (const st of app.sistemas.lista()) if (!objetivo.has(st.def.id) && st.activo) app.sistemas.activar(st.def.id, false);
    const ids = new Set(lista.map((e) => e.id));
    const ocultar = datos.estructuras.filter((e) => objetivo.has(e.sistema) && !ids.has(e.id)).map((e) => e.id);
    app.diseccion.cambiarOcultas({ ocultar, mostrar: [...ids], soltarAislada: true });
    const minCapa = Math.min(...lista.map((e) => e.capa ?? 0));
    if (app.diseccion.estado.profundidad > minCapa) {
      app.diseccion.setProfundidad(minCapa);
      bus.emit('aviso', `Profundidad ajustada a ${minCapa} para mostrar la selección.`);
    }
    const oks = await Promise.all([...objetivo].map((id) => app.sistemas.activar(id, true)));
    await encuadrar(lista);
    return oks.every(Boolean);
  }

  // Activa la vista separada limitada a una selección { sistema, region, subsistema }.
  async function separarEsto(sel = {}) {
    const lista = miembros(datos.estructuras, sel);
    if (!lista.length) return false;
    for (const id of new Set(lista.map((e) => e.sistema))) await app.sistemas.activar(id, true);
    app.diseccion.cambiarOcultas({ mostrar: lista.map((e) => e.id) });
    const pct = app.separar.estado.pct > 0 ? app.separar.estado.pct : SEPARACION_INICIAL;
    await app.separar.aplicar(pct, { alcance: { sistemas: sel.sistema ? [sel.sistema] : null, region: sel.region, subsistema: sel.subsistema } }); // reencuadra si no cabe
    return true;
  }

  // Sistemas por defecto, separación 0, sin aislar/ocultar/transparentar, cámara anterior y modo Girar.
  async function restablecer() {
    for (const st of app.sistemas.lista()) {
      const quiere = !!st.def.visible_inicio;
      if (st.activo !== quiere) app.sistemas.activar(st.def.id, quiere);
    }
    app.diseccion.restaurar();
    app.seleccion.deseleccionar(); // cierra la ficha; paulaSelection pasa a null
    await app.separar.aplicar(0, { alcance: 'visible', atenuar: true, encuadrar: false });
    escena.fijarModo?.('girar');
    app.vistas.ir('anterior');
    bus.emit('vista-restablecida');
    return true;
  }

  // Visibilidad de un nodo (sistema: activo; región/subsistema: según las piezas ocultas). 'true' | 'false' | 'mixed'
  function visibilidadDe(nodo) {
    const st = app.sistemas.estadoDe(nodo.sistema);
    if (nodo.tipo === 'sistema') return st && st.activo ? 'true' : 'false';
    if (!st || !st.activo) return 'false';
    let ocultas = 0, total = 0;
    for (const en of nodo.entradas) for (const e of piezasDe(en)) { total++; if (app.diseccion.estado.ocultas.has(e.id)) ocultas++; }
    return ocultas === 0 ? 'true' : ocultas === total ? 'false' : 'mixed';
  }
  async function alternarVisibilidad(nodo) {
    if (nodo.tipo === 'sistema') {
      const st = app.sistemas.estadoDe(nodo.sistema);
      return app.sistemas.activar(nodo.sistema, st.estado === 'error' ? true : !st.activo);
    }
    const ids = nodo.entradas.flatMap((en) => piezasDe(en).map((e) => e.id));
    const v = visibilidadDe(nodo);
    if (v === 'true') { app.diseccion.cambiarOcultas({ ocultar: ids }); return true; }
    const ok = await app.sistemas.activar(nodo.sistema, true);
    app.diseccion.cambiarOcultas({ mostrar: ids });
    return ok;
  }
  const selDe = (nodo) => (nodo.tipo === 'sistema' ? { sistema: nodo.sistema } : { sistema: nodo.sistema, region: nodo.region, subsistema: nodo.subsistema });

  // ---------- interfaz ----------
  function montar({ raiz, filtro, total, vacio, restablecerBtn }) {
    const expandidos = new Set();
    const limites = new Map(); // clave de grupo -> filas pintadas
    let enfocadaClave = null;
    let texto = '';
    let conteos = contarCoincidencias(arbol(), '');
    let pendiente = false;
    let filas = []; // modelo plano de lo visible

    raiz.setAttribute('role', 'tree');
    raiz.setAttribute('aria-label', 'Estructuras por sistema y región');
    raiz.setAttribute('aria-multiselectable', 'false');

    const filtrando = () => tokensDe(texto).length > 0;
    const estaAbierto = (clave) => expandidos.has(clave) || (filtrando() && (conteos.get(clave) || 0) > 0);

    function modeloFilas() {
      const tokens = tokensDe(texto);
      const sal = [];
      for (const s of arbol().sistemas) {
        const ns = conteos.get(s.clave) || 0;
        if (tokens.length && !ns) continue;
        sal.push({ tipo: 'sistema', clave: s.clave, nodo: s, nivel: 1, n: ns });
        if (!estaAbierto(s.clave)) continue;
        for (const g of s.grupos) {
          const ng = conteos.get(g.clave) || 0;
          if (tokens.length && !ng) continue;
          sal.push({ tipo: 'grupo', clave: g.clave, nodo: g, nivel: 2, n: ng, padre: s.clave });
          if (!estaAbierto(g.clave)) continue;
          const limite = limites.get(g.clave) || LIMITE_FILAS;
          let puestas = 0, hay = 0;
          for (const en of g.entradas) {
            if (tokens.length && !piezasDe(en).some((e) => coincide(e, tokens))) continue;
            hay++;
            if (puestas >= limite) continue;
            puestas++;
            sal.push({ tipo: 'est', clave: 'est:' + en.est.id, entrada: en, nivel: 3, padre: g.clave, nodo: g });
          }
          if (hay > puestas) sal.push({ tipo: 'mas', clave: 'mas:' + g.clave, nivel: 3, padre: g.clave, nodo: g, faltan: hay - puestas });
        }
      }
      return sal;
    }

    const selId = () => app.seleccion.actual()?.id || null;

    function elegir(est) { return app.seleccion.seleccionar(est.id, { enfocar: true }); }

    function botonAccion(nombreIcono, etiqueta, fn, extra = {}) {
      const b = h('button', { type: 'button', class: 'ex-btn', tabindex: '-1', 'aria-label': etiqueta, title: etiqueta, ...extra }, icono(nombreIcono, 16));
      b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); });
      return b;
    }

    function pintarFila(f, i) {
      const attrs = { class: 'ex-fila ex-' + f.tipo, role: 'treeitem', 'aria-level': String(f.nivel), tabindex: f.clave === enfocadaClave ? '0' : '-1', 'data-clave': f.clave };
      if (f.tipo === 'sistema' || f.tipo === 'grupo') {
        attrs['aria-expanded'] = String(estaAbierto(f.clave));
        const st = app.sistemas.estadoDe(f.nodo.sistema);
        const nombre = f.nodo.nombre;
        const cargando = st && st.estado === 'cargando';
        const pct = cargando && st.total ? Math.round(Math.min(100, (st.cargado / st.total) * 100)) : 0;
        const vis = visibilidadDe(f.nodo);
        const interruptor = h('button', { type: 'button', class: 'ex-btn ex-vis', role: 'switch', 'aria-checked': vis, tabindex: '-1', 'aria-label': `Mostrar u ocultar ${nombre}`, title: vis === 'false' ? 'Mostrar' : 'Ocultar' },
          icono(vis === 'false' ? 'ocultar' : 'ojo', 16));
        interruptor.addEventListener('click', (ev) => { ev.stopPropagation(); alternarVisibilidad(f.nodo); });
        const fila = h('div', attrs,
          h('span', { class: 'ex-caret', 'aria-hidden': 'true' }, icono('flecha', 14)),
          f.tipo === 'sistema' ? h('span', { class: 'chip-color', style: `background:${colorSeguro(f.nodo.color)}`, 'aria-hidden': 'true' }) : null,
          h('span', { class: 'ex-nombre', text: nombre }),
          h('span', { class: 'ex-cuenta', text: filtrando() ? `${f.n} de ${f.nodo.n}` : String(f.n), 'aria-label': `${f.n} piezas` }),
          h('span', { class: 'ex-acciones' },
            botonAccion('aislar', `Ver solo ${nombre}`, () => verSolo(selDe(f.nodo))),
            botonAccion('separar', `Separar ${nombre}`, () => separarEsto(selDe(f.nodo))),
            interruptor),
          cargando ? h('span', { class: 'ex-estado', role: 'status', text: pct ? `Cargando ${pct} %` : 'Cargando…' }) : null);
        fila.addEventListener('click', () => { alternarRama(f.clave); });
        return fila;
      }
      if (f.tipo === 'mas') {
        const fila = h('div', { ...attrs, class: 'ex-fila ex-mas', 'aria-label': `Mostrar ${f.faltan} más` }, h('span', { class: 'ex-nombre', text: `Mostrar ${f.faltan} más…` }));
        fila.addEventListener('click', () => { limites.set(f.padre, (limites.get(f.padre) || LIMITE_FILAS) + LIMITE_FILAS); pintar(); });
        return fila;
      }
      // estructura
      const en = f.entrada;
      const est = en.est;
      const par = !!(en.d && en.i);
      const ficha = piezasDe(en).some((e) => tieneFicha(app.fichas, e));
      const seleccionada = piezasDe(en).some((e) => e.id === selId());
      attrs['aria-selected'] = String(seleccionada);
      attrs['aria-label'] = est.nombre_es + (par ? ' (derecho e izquierdo)' : est.lado ? ' ' + est.lado : '') + (ficha ? ', con ficha' : ', sin ficha');
      const fila = h('div', attrs,
        h('span', { class: 'ex-ficha' + (ficha ? ' si' : ''), title: ficha ? 'Tiene ficha completa' : 'Ficha en preparación' }, ficha ? icono('ficha', 14) : null),
        h('span', { class: 'ex-textos' },
          h('span', { class: 'ex-nombre', text: est.nombre_es }),
          est.nombre_la ? h('span', { class: 'ex-latin', text: est.nombre_la }) : null),
        par
          ? h('span', { class: 'ex-lados' },
            ladoBtn('D', 'derecho', en.d), ladoBtn('I', 'izquierdo', en.i))
          : (est.lado ? h('span', { class: 'ex-lado', text: est.lado === 'derecho' ? 'der.' : 'izq.' }) : null));
      fila.addEventListener('click', () => elegir(par ? en.d : est));
      return fila;
    }
    function ladoBtn(letra, lado, est) {
      const b = h('button', { type: 'button', class: 'ex-lado-btn', tabindex: '-1', 'aria-label': `Seleccionar ${est.nombre_es} ${lado}`, title: lado[0].toUpperCase() + lado.slice(1), 'aria-pressed': String(selId() === est.id), text: letra });
      b.addEventListener('click', (ev) => { ev.stopPropagation(); elegir(est); });
      return b;
    }

    function pintar() {
      pendiente = false;
      const tenia = raiz.contains(document.activeElement) ? document.activeElement.getAttribute('data-clave') : null;
      filas = modeloFilas();
      if (!filas.some((f) => f.clave === enfocadaClave)) enfocadaClave = filas[0]?.clave || null;
      vaciar(raiz);
      for (let i = 0; i < filas.length; i++) raiz.append(pintarFila(filas[i], i));
      if (total) total.textContent = filtrando() ? `${conteos.get('total')} de ${arbol().n} estructuras` : `${arbol().n.toLocaleString('es-CO')} estructuras`;
      if (vacio) vacio.hidden = filas.length > 0;
      if (tenia) { const clave = filas.some((f) => f.clave === tenia) ? tenia : enfocadaClave; [...raiz.children].find((c) => c.getAttribute('data-clave') === clave)?.focus(); }
    }
    const repintar = () => { if (pendiente) return; pendiente = true; (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 0))(pintar); };

    function alternarRama(clave, abrir) {
      const ya = expandidos.has(clave);
      if (abrir === undefined) abrir = !ya;
      if (abrir) expandidos.add(clave); else expandidos.delete(clave);
      enfocadaClave = clave;
      pintar();
      [...raiz.children].find((c) => c.getAttribute('data-clave') === clave)?.focus();
    }

    function enfocarIndice(i) {
      const f = filas[Math.max(0, Math.min(filas.length - 1, i))];
      if (!f) return;
      const ant = raiz.querySelector('[tabindex="0"]');
      if (ant) ant.setAttribute('tabindex', '-1');
      enfocadaClave = f.clave;
      const el = [...raiz.children].find((c) => c.getAttribute('data-clave') === f.clave);
      if (el) { el.setAttribute('tabindex', '0'); el.focus(); el.scrollIntoView?.({ block: 'nearest' }); }
    }

    raiz.addEventListener('keydown', (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const el = ev.target.closest?.('[role="treeitem"]');
      if (!el) return;
      const i = filas.findIndex((f) => f.clave === el.getAttribute('data-clave'));
      const f = filas[i];
      if (!f) return;
      const rama = f.tipo === 'sistema' || f.tipo === 'grupo';
      const k = ev.key;
      let uso = true;
      if (k === 'ArrowDown') enfocarIndice(i + 1);
      else if (k === 'ArrowUp') enfocarIndice(i - 1);
      else if (k === 'Home') enfocarIndice(0);
      else if (k === 'End') enfocarIndice(filas.length - 1);
      else if (k === 'ArrowRight') {
        if (rama && !estaAbierto(f.clave)) alternarRama(f.clave, true);
        else if (rama) enfocarIndice(i + 1);
        else uso = false;
      } else if (k === 'ArrowLeft') {
        if (rama && estaAbierto(f.clave) && !filtrando()) alternarRama(f.clave, false);
        else if (f.padre) enfocarIndice(filas.findIndex((x) => x.clave === f.padre));
        else uso = false;
      } else if (k === 'Enter' || k === ' ') {
        if (rama) alternarRama(f.clave);
        else if (f.tipo === 'mas') el.click();
        else elegir(f.entrada.d || f.entrada.est);
      } else if (rama && (k === 'v' || k === 'V')) verSolo(selDe(f.nodo));
      else if (rama && (k === 's' || k === 'S')) separarEsto(selDe(f.nodo));
      else if (rama && (k === 'o' || k === 'O')) alternarVisibilidad(f.nodo);
      else if (f.tipo === 'est' && (k === 'd' || k === 'D') && (f.entrada.d)) elegir(f.entrada.d);
      else if (f.tipo === 'est' && (k === 'i' || k === 'I') && (f.entrada.i)) elegir(f.entrada.i);
      else uso = false;
      if (uso) ev.preventDefault();
    });

    // Filtro de texto (con pequeña espera para no repintar en cada tecla).
    let espera = null;
    function aplicarFiltro(t) {
      texto = t;
      conteos = contarCoincidencias(arbol(), t);
      limites.clear();
      pintar();
    }
    if (filtro) {
      filtro.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => aplicarFiltro(filtro.value), 120); });
      filtro.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && filtro.value) { ev.preventDefault(); ev.stopPropagation(); filtro.value = ''; aplicarFiltro(''); }
        else if (ev.key === 'ArrowDown') { ev.preventDefault(); if (filas.length) enfocarIndice(0); }
      });
    }
    if (restablecerBtn) restablecerBtn.addEventListener('click', () => { restablecer(); });

    bus.on('sistema-estado', repintar);
    bus.on('sistemas-cambio', repintar);
    bus.on('diseccion', repintar);
    bus.on('seleccion', repintar);
    bus.on('fichas-cargadas', repintar);
    pintar();
    return { pintar, aplicarFiltro, filas: () => filas, alternarRama, expandidos };
  }

  return { arbol, verSolo, separarEsto, restablecer, montar, encuadrar, visibilidadDe, alternarVisibilidad };
}
