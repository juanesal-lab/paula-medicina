// Vista separada ("explosionada"): aleja las piezas entre sí de forma jerárquica y legible.
//
// Modelo (todo se calcula del catálogo, con la posición ANATÓMICA `centro`; nunca se toca la geometría):
//   cuerpo -> región -> lado (región+lado) -> grupo (sistema+región+lado+grupo_es) -> vecindad -> pieza
// El desplazamiento de una pieza a pct % es
//     d = (pct/100) · ( kR·(C_región − C_cuerpo) + kL·(C_lado − C_región) + kG·(C_grupo − C_lado)
//                        + kV·(C_vecindad − C_grupo) + kP·(centro − C_vecindad) )
// donde C_* son centros de cada nivel. La "vecindad" es un conglomerado espacial dentro del grupo
// (enlace simple a UMBRAL_VECINDAD): p. ej. la mano entera frente al antebrazo, o el carpo frente a las falanges.
// Los desplazamientos son en coordenadas de escena (metros); la derecha del paciente es -X.
//
// Las matrices: cada estructura (`rec.objeto`, con matrixAutoUpdate = false) conserva su matriz original
// (`rec.matrizBase`) y la mostrada es base + traslación; con desplazamiento 0 se copia la base tal cual,
// de modo que la vuelta a 0 es exacta (idéntica bit a bit).
import * as THREE from 'three';

// ---- constantes de ajuste (elegidas con dev/ajustar-separacion.mjs sobre el catálogo y las mallas reales) ----
export const FACTORES = {
  region: 0.5,    // alejamiento de cada región respecto al centro del cuerpo
  lado: 0.7,      // derecha / izquierda dentro de la región se abren hacia su lado
  grupo: 0.6,     // cada grupo del mismo sistema (p. ej. "Costillas verdaderas") respecto al lado
  vecindad: 1.0,  // conglomerados (mano, antebrazo, pie…) dentro del grupo
  pieza: 1.9,     // piezas dentro de su conglomerado (carpo, falanges, vértebras…)
};
// Con el alcance en una sola región (derecha e izquierda juntas) el lado se abre menos: mide ~5 % menos de ancho
// y deja menos hueco central sin perder separación (medido con dev/ajustar-separacion.mjs: 0 solapes en mano y pie).
export const FACTOR_LADO_REGION = 0.3;
export const MARGEN_ENCUADRE = 0.08; // fracción de la mitad de la pantalla que se deja libre alrededor
export const UMBRAL_VECINDAD = 0.055; // m: dos piezas del mismo grupo a menos de esto son del mismo conglomerado
export const DURACION_MS = 300;
export const SEPARACION_INICIAL = 60; // % que usa "Separar esto" si la vista estaba sin separar

const ORIGEN = [0, 0, 0];
const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// ---------- plan: vectores crudos por estructura (función pura, sin THREE ni DOM) ----------
export function construirPlan(estructuras) {
  const con = estructuras.filter((e) => Array.isArray(e.centro));
  const cajaCentro = (lista) => {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const e of lista) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], e.centro[k]); mx[k] = Math.max(mx[k], e.centro[k]); }
    return [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  };
  const media = (lista) => {
    const s = [0, 0, 0];
    for (const e of lista) for (let k = 0; k < 3; k++) s[k] += e.centro[k];
    return [s[0] / lista.length, s[1] / lista.length, s[2] / lista.length];
  };
  const agrupar = (lista, clave) => {
    const m = new Map();
    for (const e of lista) { const c = clave(e); if (!m.has(c)) m.set(c, []); m.get(c).push(e); }
    return m;
  };
  const cuerpo = cajaCentro(con);
  const porRegion = agrupar(con, (e) => e.region || '');
  const centroRegion = new Map([...porRegion].map(([k, l]) => [k, cajaCentro(l)]));
  const claveLado = (e) => (e.region || '') + '|' + (e.lado || 'c');
  const centroLado = new Map([...agrupar(con, claveLado)].map(([k, l]) => [k, cajaCentro(l)]));
  const claveGrupo = (e) => e.sistema + '|' + claveLado(e) + '|' + (e.grupo_es || '');
  const grupos = agrupar(con, claveGrupo);

  const plan = new Map();
  for (const [kg, lista] of grupos) {
    const cg = media(lista);
    const e0 = lista[0];
    const cr = centroRegion.get(e0.region || '');
    const cl = centroLado.get(claveLado(e0));
    // conglomerados por enlace simple con rejilla hash
    const n = lista.length;
    const padre = Array.from({ length: n }, (_, i) => i);
    const raiz = (i) => { while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; } return i; };
    const T = UMBRAL_VECINDAD;
    const celdas = new Map();
    const llave = (x, y, z) => x + ',' + y + ',' + z;
    lista.forEach((e, i) => {
      const cx = Math.floor(e.centro[0] / T), cy = Math.floor(e.centro[1] / T), cz = Math.floor(e.centro[2] / T);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const v = celdas.get(llave(cx + dx, cy + dy, cz + dz));
        if (!v) continue;
        for (const j of v) {
          const o = lista[j].centro;
          if (Math.hypot(e.centro[0] - o[0], e.centro[1] - o[1], e.centro[2] - o[2]) <= T) padre[raiz(i)] = raiz(j);
        }
      }
      const k = llave(cx, cy, cz);
      if (!celdas.has(k)) celdas.set(k, []);
      celdas.get(k).push(i);
    });
    const conglomerados = new Map();
    lista.forEach((e, i) => { const r = raiz(i); if (!conglomerados.has(r)) conglomerados.set(r, []); conglomerados.get(r).push(e); });
    for (const miembros of conglomerados.values()) {
      const cv = media(miembros);
      for (const e of miembros) {
        plan.set(e.id, {
          r: resta(cr, cuerpo), l: resta(cl, cr), g: resta(cg, cl), v: resta(cv, cg), p: resta(e.centro, cv),
        });
      }
    }
  }
  return { plan, cuerpo };
}

// Desplazamiento (vector) de una entrada del plan para unos factores; `usaRegion` false deja la región en su sitio.
export function desplazamientoDe(entrada, factores = FACTORES, usaRegion = true) {
  const kr = usaRegion ? factores.region : 0;
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] = kr * entrada.r[k] + factores.lado * entrada.l[k] + factores.grupo * entrada.g[k]
      + factores.vecindad * entrada.v[k] + factores.pieza * entrada.p[k];
  }
  return out;
}

// ---------- módulo de la app ----------
export function crearSeparar(app) {
  const { bus, escena, datos } = app;
  const { plan } = construirPlan(datos.estructuras);
  const estado = { pct: 0, alcance: { sistemas: null, region: null, subsistema: null }, atenuar: true };
  let ticket = 0;
  let firmaContexto = '';
  let cajaCache = null;
  const cero = new THREE.Vector3();

  // ---- alcance ----
  const regiones = new Set(datos.estructuras.map((e) => e.region).filter(Boolean));
  function normalizarAlcance(a, opciones = {}) {
    const vacio = { sistemas: null, region: null, subsistema: null };
    if (a === undefined || a === null || a === 'visible' || a === 'todo') return vacio;
    if (typeof a === 'string') {
      if (datos.sistemaPorId.has(a)) return { ...vacio, sistemas: [a] };
      if (a === 'sistema') return { ...vacio, sistemas: [].concat(opciones.sistemas || opciones.sistema || []).filter((s) => datos.sistemaPorId.has(s)) };
      if (a === 'region' || a === 'seleccion') {
        const sel = app.seleccion?.actual?.();
        return sel ? { ...vacio, region: sel.est.region || null } : null; // null = no se puede resolver
      }
      if (regiones.has(a)) return { ...vacio, region: a };
      return vacio;
    }
    if (typeof a === 'object') {
      const lista = [].concat(a.sistemas ?? a.sistema ?? []).filter((s) => datos.sistemaPorId.has(s));
      const hayLista = a.sistemas !== undefined || a.sistema !== undefined;
      return {
        sistemas: hayLista ? lista : null,
        region: typeof a.region === 'string' && a.region ? a.region : null,
        subsistema: typeof a.subsistema === 'string' && a.subsistema ? a.subsistema : null,
      };
    }
    return vacio;
  }
  const esTodo = (a) => !a.sistemas && !a.region && !a.subsistema;
  function enAlcance(rec) {
    const a = estado.alcance;
    if (a.sistemas) { if (!a.sistemas.includes(rec.sistema)) return false; } else if (!app.sistemas.sistemaActivo(rec.sistema)) return false;
    if (a.region && rec.est.region !== a.region) return false;
    if (a.subsistema && rec.est.subsistema !== a.subsistema) return false;
    return true;
  }
  const esContexto = (rec) => estado.atenuar && estado.pct > 0 && !esTodo(estado.alcance) && !enAlcance(rec);

  function describirAlcance() {
    const a = estado.alcance;
    if (esTodo(a)) return 'visible';
    return { sistemas: a.sistemas, region: a.region, subsistema: a.subsistema };
  }

  // ---- matrices ----
  const m3 = new THREE.Matrix3();
  const v3 = new THREE.Vector3();
  function aLocal(rec, d) {
    // El padre puede tener escala o rotación: la traslación mundial se expresa en su marco local.
    if (rec.padreLocal === undefined) {
      const p = rec.objeto.parent;
      if (!p) rec.padreLocal = null;
      else {
        p.updateWorldMatrix(true, false);
        const el = p.matrixWorld.elements;
        const ident = el[0] === 1 && el[5] === 1 && el[10] === 1 && !el[1] && !el[2] && !el[4] && !el[6] && !el[8] && !el[9];
        rec.padreLocal = ident ? null : m3.setFromMatrix4(p.matrixWorld).invert().clone();
      }
    }
    return rec.padreLocal ? v3.copy(d).applyMatrix3(rec.padreLocal) : d;
  }
  function aplicar(rec) {
    const o = rec.objeto;
    if (!rec.matrizBase) rec.matrizBase = o.matrix.clone();
    const e = o.matrix.elements, b = rec.matrizBase.elements;
    for (let i = 0; i < 16; i++) e[i] = b[i];
    if (rec.desp.x || rec.desp.y || rec.desp.z) {
      const d = aLocal(rec, rec.desp);
      e[12] += d.x; e[13] += d.y; e[14] += d.z;
    }
    o.matrixWorldNeedsUpdate = true;
    o.updateMatrixWorld(true); // el raycast y el enfoque ven la posición mostrada sin esperar al render
  }
  const asegurar = (rec) => { if (!rec.desp) { rec.desp = new THREE.Vector3(); rec.hasta = new THREE.Vector3(); } return rec; };

  // ---- cálculo de objetivos ----
  function calcularObjetivos() {
    const f = estado.pct / 100;
    const usaRegion = !estado.alcance.region;
    for (const rec of app.sistemas.recs.values()) {
      asegurar(rec);
      const entrada = plan.get(rec.id);
      if (!f || !entrada || !enAlcance(rec)) { rec.hasta.set(0, 0, 0); continue; }
      const d = desplazamientoDe(entrada, usaRegion ? FACTORES : { ...FACTORES, lado: FACTOR_LADO_REGION }, usaRegion);
      rec.hasta.set(d[0] * f, d[1] * f, d[2] * f);
    }
  }

  function sincronizar(duracion = DURACION_MS) {
    calcularObjetivos();
    // El material de contexto depende de pct, del alcance y de los sistemas activos.
    const firma = estado.pct > 0 ? `${estado.atenuar && !esTodo(estado.alcance)}|${JSON.stringify(estado.alcance)}|${app.sistemas.idsActivos().join(',')}` : '';
    const refrescar = firma !== firmaContexto;
    firmaContexto = firma;
    const lista = [];
    for (const rec of app.sistemas.recs.values()) {
      if (!rec.desp.equals(rec.hasta)) { rec.desde = rec.desp.clone(); lista.push(rec); }
    }
    const mio = ++ticket;
    const paso = (t) => {
      if (mio !== ticket) return;
      for (const rec of lista) {
        if (t >= 1) rec.desp.copy(rec.hasta); else rec.desp.lerpVectors(rec.desde, rec.hasta, t);
        aplicar(rec);
      }
      cajaCache = null;
      escena.pedirRender?.();
      if (t >= 1) bus.emit('separacion', resumen());
    };
    let promesa = Promise.resolve();
    if (lista.length) promesa = escena.animar && duracion > 0 ? escena.animar(duracion, paso) : (paso(1), Promise.resolve());
    if (refrescar) app.sistemas.refrescar(); // reaplica materiales de contexto (emite 'sistemas-cambio')
    bus.emit('separacion', resumen());
    return promesa;
  }

  const resumen = () => ({ pct: estado.pct, alcance: describirAlcance(), atenuar: estado.atenuar });

  // ---- API ----
  // aplicar(pct, { alcance, atenuar, duracion }) -> Promise<number>. Sin `alcance` conserva el actual.
  async function separar(pct, opciones = {}) {
    const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    if (opciones.alcance !== undefined) {
      const a = normalizarAlcance(opciones.alcance, opciones);
      if (a) estado.alcance = a;
      else bus.emit('aviso', 'Selecciona una pieza para separar su región.');
    }
    if (typeof opciones.atenuar === 'boolean') estado.atenuar = opciones.atenuar;
    estado.pct = v;
    await sincronizar(opciones.duracion ?? DURACION_MS);
    if (opciones.encuadrar !== false) await encuadrarAlcance();
    return v;
  }

  // ---- encuadre: la cámara solo se mueve si lo separado no cabe en pantalla ----
  const ESQUINAS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const esquinasDe = (caja) => ESQUINAS.map(([a, b, c]) => new THREE.Vector3(
    a ? caja.max.x : caja.min.x, b ? caja.max.y : caja.min.y, c ? caja.max.z : caja.min.z));
  // true si todas las esquinas proyectan dentro de [-1, 1] menos el margen y delante de la cámara
  function cabeEnPantalla(caja, margen = MARGEN_ENCUADRE) {
    const lim = 1 - margen;
    return esquinasDe(caja).every((p) => {
      const q = p.project(escena.camera);
      return q.z > -1 && q.z < 1 && Math.abs(q.x) <= lim && Math.abs(q.y) <= lim;
    });
  }
  // Caja de las piezas del alcance, en su posición mostrada (con las mallas reales).
  function cajaAlcance() {
    const c = new THREE.Box3();
    for (const rec of app.sistemas.recs.values()) if (rec.objeto.visible && enAlcance(rec)) c.expandByObject(rec.objeto);
    return c;
  }
  async function encuadrarAlcance(duracion = 350) {
    const caja = estado.pct > 0 ? cajaAlcance() : app.sistemas.cuerpoBox;
    if (!caja || caja.isEmpty() || !isFinite(caja.min.x)) return false;
    escena.camera.updateMatrixWorld?.(true);
    if (cabeEnPantalla(caja, estado.pct > 0 ? MARGEN_ENCUADRE : 0)) return false; // ya cabe: la cámara no se mueve
    const centro = caja.getCenter(new THREE.Vector3());
    // semiejes de la caja en el sistema de la cámara (derecha, arriba, profundidad)
    const m = escena.camera.matrixWorld.elements;
    const ejes = [new THREE.Vector3(m[0], m[1], m[2]), new THREE.Vector3(m[4], m[5], m[6]), new THREE.Vector3(m[8], m[9], m[10])];
    const mitad = [0, 0, 0];
    for (const p of esquinasDe(caja)) for (let k = 0; k < 3; k++) mitad[k] = Math.max(mitad[k], Math.abs(p.clone().sub(centro).dot(ejes[k])));
    const distancia = escena.distanciaParaCaja(mitad[0] * (1 + MARGEN_ENCUADRE), mitad[1] * (1 + MARGEN_ENCUADRE), mitad[2]);
    await escena.irA({ objetivo: centro, distancia, duracion });
    return true;
  }
  const reiniciar = (duracion) => separar(0, { duracion });

  // Caja que contiene el cuerpo y las piezas desplazadas (la usan el plano de corte y el encuadre).
  function caja() {
    const base = app.sistemas.cuerpoBox;
    if (!estado.pct) return base;
    if (cajaCache) return cajaCache;
    const c = base.clone();
    for (const rec of app.sistemas.recs.values()) {
      if (!rec.desp || !rec.centro || (!rec.desp.x && !rec.desp.y && !rec.desp.z)) continue;
      c.expandByPoint(v3.copy(rec.centro).add(rec.desp));
    }
    c.expandByScalar(0.05);
    cajaCache = c;
    return c;
  }
  const centroMostrado = (rec) => (rec.centro ? rec.centro.clone().add(rec.desp || cero) : null);

  // Cambios de sistemas (activar, cargar): recalcula miembros del alcance y piezas recién cargadas.
  bus.on('sistemas-cambio', () => { if (estado.pct > 0 || firmaContexto) sincronizar(DURACION_MS); });
  bus.on('sistema-cargado', () => { if (estado.pct > 0) sincronizar(0); });

  return {
    estado, aplicar: separar, reiniciar, encuadrarAlcance, cabeEnPantalla, cajaAlcance, caja, centroMostrado, esContexto, enAlcance, resumen,
    normalizarAlcance, plan,
    desplazamiento: (id) => { const r = app.sistemas.rec(id); return r && r.desp ? r.desp.clone() : new THREE.Vector3(); },
  };
}
