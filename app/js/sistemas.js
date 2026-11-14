// Carga diferida de GLB por sistema, índice id -> estructura, visibilidad y materiales.
// No toca el DOM: avisa por el bus ('sistema-estado', 'sistemas-cambio').
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  COLOR_SUBSISTEMA, OPACIDAD_PIEL, OPACIDAD_TRANSPARENTE, OPACIDAD_CONTEXTO,
  INTENSIDAD_RESALTE, ACENTO, OPACIDAD_PELICULA, OPACIDAD_PELICULA_RESALTADA, crearMaterial, variante, materialContexto,
} from './materiales.js';

export function crearSistemas(app) {
  const { bus, datos, almacen, escena } = app;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  // Estado por sistema.
  const estados = new Map();
  for (const def of datos.sistemas) {
    estados.set(def.id, {
      def, estado: 'pendiente', // pendiente | cargando | listo | error
      activo: !!def.visible_inicio, cargado: 0, total: def.bytes || 0,
      promesa: null, grupo: null, error: null,
    });
  }
  const materialesBase = new Map(); // "sistema/subsistema" -> material
  const recs = new Map(); // id -> registro de estructura
  const sinCatalogo = [];
  const cuerpoBox = new THREE.Box3();
  const hayCuerpo = { valor: false };

  // Caja inicial desde los centros del catálogo (hasta que carguen las mallas reales).
  for (const e of datos.estructuras) {
    if (Array.isArray(e.centro)) { cuerpoBox.expandByPoint(new THREE.Vector3(...e.centro)); hayCuerpo.valor = true; }
  }
  if (!hayCuerpo.valor) cuerpoBox.set(new THREE.Vector3(-0.5, 0, -0.3), new THREE.Vector3(0.5, 1.75, 0.3));

  // Material compartido por (sistema, subsistema, tejido, película). `tejido` solo se pasa en aspecto realista.
  // `pelicula` (solo realista): fascia de revestimiento, translúcida y sin escribir profundidad.
  function materialBase(def, subsistema, tejido = null, pelicula = false) {
    const tej = tejido && app.tejidos ? app.tejidos.configuracion(tejido) : null;
    const clave = def.id + '/' + (subsistema || '') + (tej ? '#' + tejido : '') + (pelicula ? '~pelicula' : '');
    if (!materialesBase.has(clave)) {
      const sub = COLOR_SUBSISTEMA[def.id]?.[subsistema];
      const esPiel = def.id === 'piel';
      materialesBase.set(clave, crearMaterial({
        color: sub || def.color || '#cccccc',
        roughness: esPiel ? 0.7 : 0.62,
        opacity: esPiel ? OPACIDAD_PIEL : pelicula ? opacidadPelicula() : 1,
        esPiel,
        ...(pelicula ? { pelicula: true } : {}),
        ...(tej ? { tejido: tej } : {}),
      }));
    }
    return materialesBase.get(clave);
  }
  const opacidadPelicula = () => (app.tejidos?.opacidadPelicula ? app.tejidos.opacidadPelicula() : OPACIDAD_PELICULA);
  const opacidadPeliculaResaltada = () => (app.tejidos?.opacidadPeliculaResaltada ? app.tejidos.opacidadPeliculaResaltada() : OPACIDAD_PELICULA_RESALTADA);
  // La película solo existe en aspecto realista; en esquemático la fascia es una malla opaca más del sistema.
  const peliculaActiva = (rec) => !!rec.pelicula && !!app.tejidos && app.tejidos.aspecto() === 'realista';

  // Asigna a la estructura el material base del aspecto actual. Se hace de forma perezosa, solo cuando la
  // estructura es visible: así las texturas se descargan únicamente para los tejidos que se ven.
  function resolverBase(rec) {
    const modo = app.tejidos ? app.tejidos.aspecto() : 'esquematico';
    if (rec.baseModo === modo) return;
    const def = estados.get(rec.sistema).def;
    rec.base = materialBase(def, rec.est.subsistema, modo === 'realista' ? rec.tejido : null, peliculaActiva(rec));
    rec.baseModo = modo;
    if (rec.base.userData.tejido) for (const m of rec.mallas) app.tejidos.prepararMalla(m, rec.tejido);
  }

  function dispararCambio() { bus.emit('sistemas-cambio'); escena.pedirRender(); }
  function avisar(st) { bus.emit('sistema-estado', st); }

  // ---------- carga ----------
  function cargar(id) {
    const st = estados.get(id);
    if (!st) return Promise.resolve(false);
    if (st.promesa) return st.promesa;
    st.estado = 'cargando';
    st.cargado = 0;
    avisar(st);
    st.promesa = (async () => {
      try {
        const buffer = await almacen.leerBinario(st.def.glb, (cargado, total) => {
          st.cargado = cargado;
          if (total) st.total = total;
          avisar(st);
        });
        const gltf = await new Promise((ok, mal) => loader.parse(buffer, '', ok, mal));
        indexar(st, gltf.scene);
        st.cargado = st.total = buffer.byteLength;
        st.estado = 'listo';
        avisar(st);
        refrescar();
        bus.emit('sistema-cargado', st);
        return true;
      } catch (e) {
        console.error('[paula] error al cargar', id, e);
        st.estado = 'error';
        st.error = String(e && e.message ? e.message : e);
        st.promesa = null; // permite reintentar
        avisar(st);
        return false;
      }
    })();
    return st.promesa;
  }

  function indexar(st, raiz) {
    const def = st.def;
    const grupo = new THREE.Group();
    grupo.name = 'sistema:' + def.id;
    grupo.add(raiz);
    st.grupo = grupo;
    const nodos = [];
    const vistos = new Set();
    raiz.traverse((o) => {
      if (o === raiz) return;
      const est = datos.porId.get(o.userData?.name) || datos.porId.get(o.name);
      if (est && !recs.has(est.id) && !vistos.has(est.id)) { vistos.add(est.id); nodos.push({ o, est }); }
    });
    const indexados = new Set();
    for (const { o, est } of nodos) {
      const mallas = [];
      o.traverse((m) => { if (m.isMesh) mallas.push(m); });
      if (!mallas.length) continue;
      const base = materialBase(def, est.subsistema);
      const rec = {
        id: est.id, est, sistema: def.id, capa: est.capa ?? 0, objeto: o, mallas, base, baseModo: null,
        tejido: app.tejidos ? app.tejidos.tejidoDe(est) : null,
        pelicula: app.tejidos ? app.tejidos.esPelicula(est) : false, enPelicula: false, // fascia de revestimiento / película activa ahora
        oculta: false, transparente: false, resaltada: false, propio: null,
        centro: Array.isArray(est.centro) ? new THREE.Vector3(...est.centro) : null,
        radio: est.radio || 0.05,
      };
      for (const m of mallas) { m.userData.rec = rec; m.material = base; indexados.add(m); }
      recs.set(est.id, rec);
    }
    // Mallas sin entrada de catálogo: siguen visibles con el material del sistema.
    raiz.traverse((m) => {
      if (m.isMesh && !indexados.has(m)) {
        m.material = materialBase(def, null);
        sinCatalogo.push(m.name || '(sin nombre)');
        if (app.debug) console.debug('[paula] malla sin entrada de catálogo:', m.name, 'en', def.id);
      }
    });
    raiz.updateMatrixWorld(true);
    raiz.traverse((o) => { o.matrixAutoUpdate = false; });
    escena.scene.add(grupo);
    grupo.visible = st.activo;
    // Amplía la caja del cuerpo con las mallas reales.
    const caja = new THREE.Box3().setFromObject(raiz);
    if (!caja.isEmpty() && isFinite(caja.min.x)) {
      if (!cuerpoBoxReal.valor) { cuerpoBox.copy(caja); cuerpoBoxReal.valor = true; } else cuerpoBox.union(caja);
    }
    bus.emit('cuerpo-caja', cuerpoBox);
  }
  const cuerpoBoxReal = { valor: false };

  // ---------- visibilidad y materiales ----------
  function sistemaActivo(id) { const st = estados.get(id); return !!(st && st.activo && st.estado === 'listo'); }

  function refrescarRec(rec) {
    const dis = app.diseccion;
    rec.enPelicula = peliculaActiva(rec);
    // Con la casilla "Mostrar fascias de revestimiento" apagada la película se oculta (salvo que esté seleccionada).
    const ocultaPelicula = rec.enPelicula && !app.tejidos.fascias() && !rec.resaltada;
    const visible = sistemaActivo(rec.sistema) && dis.esVisible(rec) && !ocultaPelicula;
    if (rec.objeto.visible !== visible) rec.objeto.visible = visible;
    if (!visible) return;
    resolverBase(rec);
    const vis = dis.estadoVisual(rec); // 'normal' | 'transparente' | 'contexto'
    // La película ya es más transparente que esos estados: nunca los hace más opacos.
    const tope = (o) => (rec.enPelicula ? Math.min(o, rec.base.userData.cfg.opacity) : o);
    // Calcula el material que corresponde.
    let mat;
    let propio = false;
    if (rec.resaltada) {
      // Una película resaltada sube de opacidad: al 15 % el resalte no se vería.
      const opacity = vis === 'transparente' ? tope(OPACIDAD_TRANSPARENTE) : vis === 'contexto' ? tope(OPACIDAD_CONTEXTO) : rec.enPelicula ? opacidadPeliculaResaltada() : rec.base.userData.cfg.opacity;
      mat = variante(rec.base, { opacity, emissive: ACENTO, emisividad: INTENSIDAD_RESALTE });
      propio = true;
    } else if (vis === 'transparente') {
      mat = variante(rec.base, { opacity: tope(OPACIDAD_TRANSPARENTE), emissive: null });
      propio = true;
    } else if (vis === 'contexto') {
      mat = materialContexto(rec.base);
    } else {
      mat = rec.base;
    }
    if (rec.propio) { rec.propio.dispose(); rec.propio = null; }
    if (propio) rec.propio = mat;
    for (const m of rec.mallas) m.material = mat;
    // Las estructuras translúcidas se ordenan por encima de las opacas; la película de fascia después de los músculos
    // (que son opacos u orden 2 si están transparentes); la piel, aún más.
    const orden = rec.sistema === 'piel' ? 10 : rec.enPelicula ? 3 : (mat.transparent ? 2 : 0);
    for (const m of rec.mallas) m.renderOrder = orden;
  }

  function refrescar() {
    for (const st of estados.values()) if (st.grupo) st.grupo.visible = st.activo;
    for (const rec of recs.values()) refrescarRec(rec);
    dispararCambio();
  }

  async function activar(id, visible = true) {
    const st = estados.get(id);
    if (!st) return false;
    st.activo = !!visible;
    avisar(st);
    if (visible && st.estado !== 'listo') {
      const ok = await cargar(id);
      if (!ok) { st.activo = false; avisar(st); refrescar(); return false; }
    }
    refrescar();
    return true;
  }

  // Resalte: marca/desmarca una estructura.
  function resaltar(id, valor) {
    const rec = recs.get(id);
    if (!rec) return;
    rec.resaltada = valor;
    refrescarRec(rec);
    escena.pedirRender();
  }

  function mallasVisibles() {
    const lista = [];
    for (const rec of recs.values()) {
      if (rec.objeto.visible && sistemaActivo(rec.sistema)) for (const m of rec.mallas) lista.push(m);
    }
    return lista;
  }

  return {
    estados, recs, cuerpoBox, sinCatalogo,
    lista: () => [...estados.values()],
    estadoDe: (id) => estados.get(id),
    cargar, activar, refrescar, refrescarRec, resaltar, mallasVisibles,
    sistemaActivo,
    rec: (id) => recs.get(id),
    idsActivos: () => [...estados.values()].filter((s) => s.activo && s.estado === 'listo').map((s) => s.def.id),
    // Carga inicial: los sistemas con visible_inicio.
    cargarIniciales: () => Promise.all([...estados.values()].filter((s) => s.def.visible_inicio).map((s) => cargar(s.def.id))),
  };
}
