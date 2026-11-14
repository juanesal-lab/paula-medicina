// Aspecto realista: asignación estructura -> tejido, carga diferida de texturas PBR y dirección de fibras.
// No toca el DOM. Avisa por el bus: 'aspecto' (modo), 'tejido-estado' ({id, estado}).
//
// Contrato de texturas (docs/PROMPT-TEXTURAS-APIMART.md): <base>/texturas/manifest.json y
// <base>/texturas/<id>/{albedo,normal,rugosidad}.webp. <base> es la misma carpeta de datos del resto de la
// app (por defecto "./" => app/texturas/; con ?datos=dev/fixture/ => app/dev/fixture/texturas/).
// Las reglas (datos/tejidos.json) viven siempre junto a la app, no en la carpeta de datos alternativa.
import * as THREE from 'three';
import { crearUniformesTejido } from './materiales.js';

export const ASPECTOS = ['realista', 'esquematico'];

export const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ------------------------------------------------------------------------------------------------
// Reglas
// ------------------------------------------------------------------------------------------------
// Una regla coincide si cumple TODOS los filtros que tiene: sistema, subsistema (texto o lista) y
// "alguna" de las expresiones sobre nombre / nombre_la / nombre_en (se combinan con O). Las expresiones
// se escriben sin tildes y se aplican, sin distinguir mayúsculas, a los nombres sin tildes.
export function compilarReglas(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('tejidos.json inválido');
  const porDefecto = doc.por_defecto || {};
  const defsTejido = doc.tejidos || {};
  const CAMPOS = ['nombre', 'nombre_la', 'nombre_en'];
  const compilarUna = (r, i, prefijo) => {
    const re = {};
    for (const c of CAMPOS) if (typeof r[c] === 'string') re[c] = new RegExp(sinTildes(r[c]), 'i');
    const subs = r.subsistema === undefined ? null : [].concat(r.subsistema);
    if (r.sistema === undefined && !subs && !Object.keys(re).length) throw new Error(`regla ${r.id || i} sin filtros`);
    return { id: r.id || prefijo + i, tejido: r.tejido ?? null, sistema: r.sistema, subs, re };
  };
  const reglas = (doc.reglas || []).map((r, i) => compilarUna(r, i, 'regla-'));
  // Película translúcida (aspecto realista): estructuras que envuelven a otras y no deben taparlas (fascias de revestimiento).
  const defPel = doc.pelicula || {};
  const reglasPelicula = (defPel.reglas || []).map((r, i) => compilarUna(r, i, 'pelicula-'));
  const limitar = (v, d) => (Number.isFinite(v) ? Math.min(Math.max(v, 0.03), 0.9) : d);
  const opacidadPelicula = limitar(defPel.opacidad, 0.15);
  const opacidadPeliculaResaltada = Math.max(limitar(defPel.opacidad_resaltada, 0.4), opacidadPelicula);

  function coincide(r, est) {
    if (r.sistema !== undefined && est.sistema !== r.sistema) return false;
    if (r.subs && !r.subs.includes(est.subsistema)) return false;
    const claves = Object.keys(r.re);
    if (claves.length) {
      let alguna = false;
      for (const c of claves) { if (r.re[c].test(sinTildes(est[c === 'nombre' ? 'nombre_es' : c]))) { alguna = true; break; } }
      if (!alguna) return false;
    }
    return true;
  }

  // -> {tejido: id|null, regla: id de la regla | 'defecto' | 'ninguna'}
  function asignar(est) {
    for (const r of reglas) if (coincide(r, est)) return { tejido: r.tejido, regla: r.id };
    if (Object.prototype.hasOwnProperty.call(porDefecto, est.sistema)) return { tejido: porDefecto[est.sistema] ?? null, regla: 'defecto' };
    return { tejido: null, regla: 'ninguna' };
  }
  const esPelicula = (est) => reglasPelicula.some((r) => coincide(r, est));
  return { reglas, asignar, tejidoDe: (est) => asignar(est).tejido, porDefecto, defsTejido, reglasPelicula, esPelicula, opacidadPelicula, opacidadPeliculaResaltada };
}

// Informe de asignación: cuántas estructuras caen en cada tejido y cuáles se quedan en el valor por defecto.
export function informeAsignacion(compiladas, estructuras) {
  const porTejido = new Map();
  const porDefecto = [];
  const sinTejido = [];
  for (const est of estructuras) {
    const { tejido, regla } = compiladas.asignar(est);
    const k = tejido ?? '(plano)';
    porTejido.set(k, (porTejido.get(k) || 0) + 1);
    if (regla === 'defecto') porDefecto.push(est);
    if (tejido === null) sinTejido.push(est);
  }
  return { porTejido, porDefecto, sinTejido };
}

// ------------------------------------------------------------------------------------------------
// Dirección de fibras
// ------------------------------------------------------------------------------------------------
// APROXIMACIÓN: las fibras de musculo, tendon, nervio y cerebelo se orientan según el eje de MAYOR VARIANZA
// de los vértices de cada malla (PCA barato por iteración de potencias, en coordenadas de mundo). Es el eje
// más largo de la malla. No simula la arquitectura real de cada músculo (fibras oblicuas, peniformes,
// abanicos...): solo hace que las fibras vayan "a lo largo" en la gran mayoría de músculos, tendones y nervios.
export function ejePrincipal(malla, maxPuntos = 2000) {
  const pos = malla.geometry && malla.geometry.attributes.position;
  const arriba = new THREE.Vector3(0, 1, 0);
  if (!pos || pos.count < 3) return arriba;
  malla.updateWorldMatrix(true, false);
  const n = pos.count;
  const paso = Math.max(1, Math.floor(n / maxPuntos));
  const pts = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i += paso) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(malla.matrixWorld).clone());
  const media = new THREE.Vector3();
  for (const p of pts) media.add(p);
  media.multiplyScalar(1 / pts.length);
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const p of pts) {
    const dx = p.x - media.x, dy = p.y - media.y, dz = p.z - media.z;
    xx += dx * dx; xy += dx * dy; xz += dx * dz; yy += dy * dy; yz += dy * dz; zz += dz * dz;
  }
  if (xx + yy + zz < 1e-12) return arriba;
  // Arranque: el eje de coordenadas con más varianza (evita partir ortogonal al principal).
  const e = new THREE.Vector3(xx >= yy && xx >= zz ? 1 : 0, yy > xx && yy >= zz ? 1 : 0, zz > xx && zz > yy ? 1 : 0).addScalar(0.01).normalize();
  for (let it = 0; it < 24; it++) {
    const x = xx * e.x + xy * e.y + xz * e.z;
    const y = xy * e.x + yy * e.y + yz * e.z;
    const z = xz * e.x + yz * e.y + zz * e.z;
    e.set(x, y, z);
    const l = e.length();
    if (l < 1e-18) return arriba;
    e.multiplyScalar(1 / l);
  }
  return e;
}

// Añade a la geometría el atributo aFibra (xyz = dirección de mundo, Int8 normalizado; 4 bytes por vértice).
// Si la geometría está compartida con otra malla de distinta matriz de mundo, se clona para esta malla.
export function asegurarFibras(malla) {
  if (malla.userData.fibraLista) return malla.userData.fibraDir;
  const mw = malla.matrixWorld.elements.map((x) => x.toFixed(5)).join(',');
  let geo = malla.geometry;
  if (geo.attributes.aFibra && geo.userData.fibraMatriz !== mw) {
    geo = geo.clone();
    geo.deleteAttribute('aFibra');
    malla.geometry = geo;
  }
  const dir = ejePrincipal(malla);
  if (!geo.attributes.aFibra) {
    const n = geo.attributes.position.count;
    const datos = new Int8Array(n * 4);
    const q = [Math.round(dir.x * 127), Math.round(dir.y * 127), Math.round(dir.z * 127)];
    for (let i = 0; i < n; i++) { datos[i * 4] = q[0]; datos[i * 4 + 1] = q[1]; datos[i * 4 + 2] = q[2]; }
    geo.setAttribute('aFibra', new THREE.Int8BufferAttribute(datos, 4, true));
    geo.userData.fibraMatriz = mw;
  }
  malla.userData.fibraLista = true;
  malla.userData.fibraDir = dir;
  return dir;
}

// ------------------------------------------------------------------------------------------------
// Carga de imágenes
// ------------------------------------------------------------------------------------------------
export function cargarImagenRed(url) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error('no se pudo leer ' + url));
    img.src = url;
  });
}

async function leerJSONTolerante(leer, url) {
  try { return await leer(url); } catch (e) { return null; }
}

// ------------------------------------------------------------------------------------------------
// Módulo principal
// ------------------------------------------------------------------------------------------------
// opciones: {urlReglas, leerJSON(url), cargarImagen(url), aspectoInicial}
export function crearTejidos(app, opciones = {}) {
  const { bus, almacen } = app;
  const leerJSONUrl = opciones.leerJSON || (async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  const cargarImagen = opciones.cargarImagen || cargarImagenRed;
  const estado = { modo: 'esquematico', disponible: false, manifest: null, compiladas: null, fascias: true }; // fascias: mostrar la película de las fascias de revestimiento (solo realista)
  const tejidos = new Map(); // id -> {def, uniformes, estado: 'pendiente'|'cargando'|'listo'|'error', promesa}

  const maxAnisotropia = () => app.escena?.renderer?.capabilities?.getMaxAnisotropy?.() || 1;

  // Lee reglas y manifest. Nunca lanza: sin reglas o sin manifest todo queda en aspecto esquemático.
  async function iniciar() {
    const doc = opciones.urlReglas ? await leerJSONTolerante(leerJSONUrl, opciones.urlReglas) : null;
    try { estado.compiladas = doc ? compilarReglas(doc) : null; } catch (e) { console.warn('[paula] tejidos.json no es válido', e.message); estado.compiladas = null; }
    const man = await leerJSONTolerante((ruta) => almacen.leerJSON(ruta), 'texturas/manifest.json');
    estado.manifest = man && typeof man.tejidos === 'object' && man.tejidos ? man : null;
    estado.disponible = !!(estado.compiladas && estado.manifest && Object.keys(estado.manifest.tejidos).length);
    const pedido = opciones.aspectoInicial;
    const inicial = ASPECTOS.includes(pedido) ? pedido : 'realista';
    estado.modo = estado.disponible && inicial === 'realista' ? 'realista' : 'esquematico';
    if (estado.modo === 'realista') app.escena?.fijarAspecto?.('realista');
    bus.emit('aspecto', estado.modo);
    return estado.modo;
  }

  // Un tejido se puede dibujar con texturas si el manifest lo lista y las reglas lo definen.
  function tejidoDisponible(id) {
    return !!(id && estado.disponible && estado.manifest.tejidos[id] && estado.compiladas.defsTejido[id]);
  }

  function datosTejido(id) {
    let t = tejidos.get(id);
    if (!t) {
      const def = { ...(estado.compiladas.defsTejido[id] || {}) };
      def.fibras = (estado.manifest.tejidos[id] || {}).fibras === 'vertical' || def.fibras === 'vertical';
      t = { id, def, uniformes: crearUniformesTejido(def), estado: 'pendiente', promesa: null };
      tejidos.set(id, t);
    }
    return t;
  }

  function crearTextura(img, srgb) {
    const t = new THREE.Texture(img);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; // albedo en sRGB; normal y rugosidad lineales
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = maxAnisotropia();
    t.needsUpdate = true;
    return t;
  }

  // Descarga las tres texturas del tejido (una sola vez). Si algo falla el tejido sigue con su color plano.
  function necesitar(id) {
    if (!tejidoDisponible(id)) return Promise.resolve(false);
    const t = datosTejido(id);
    if (t.promesa) return t.promesa;
    t.estado = 'cargando';
    bus.emit('tejido-estado', { id, estado: t.estado });
    t.promesa = (async () => {
      try {
        const [a, n, r] = await Promise.all(['albedo', 'normal', 'rugosidad'].map((f) => cargarImagen(almacen.url(`texturas/${id}/${f}.webp`))));
        t.uniformes.uTriAlbedo.value = crearTextura(a, true);
        t.uniformes.uTriNormal.value = crearTextura(n, false);
        t.uniformes.uTriRug.value = crearTextura(r, false);
        t.uniformes.uTriListo.value = 1;
        t.estado = 'listo';
        bus.emit('tejido-estado', { id, estado: t.estado });
        app.escena?.pedirRender?.();
        return true;
      } catch (e) {
        t.estado = 'error';
        console.info('[paula] sin texturas para el tejido', id, '- se usa el color plano');
        bus.emit('tejido-estado', { id, estado: t.estado });
        return false;
      }
    })();
    return t.promesa;
  }

  // Configuración para crearMaterial: null si el aspecto es esquemático o el tejido no tiene texturas.
  function configuracion(id) {
    if (estado.modo !== 'realista' || !tejidoDisponible(id)) return null;
    const t = datosTejido(id);
    necesitar(id);
    return { id, uniformes: t.uniformes, fibras: t.def.fibras };
  }

  // Orienta las fibras de la malla si su tejido las tiene (atributo aFibra, una vez por malla).
  function prepararMalla(malla, id) {
    if (!tejidoDisponible(id) || !datosTejido(id).def.fibras) return null;
    return asegurarFibras(malla);
  }

  function fijar(modo) {
    if (!ASPECTOS.includes(modo)) return false;
    if (modo === 'realista' && !estado.disponible) return false;
    if (modo === estado.modo) return true;
    estado.modo = modo;
    app.escena?.fijarAspecto?.(modo);
    app.sistemas?.refrescar();
    bus.emit('aspecto', modo);
    return true;
  }

  // Fascias de revestimiento: película translúcida (activa) u ocultas (inactiva). Solo tiene efecto en aspecto realista.
  const esPelicula = (est) => !!(estado.compiladas && estado.compiladas.esPelicula(est));
  function fijarFascias(valor) {
    const v = !!valor;
    if (v === estado.fascias) return v;
    estado.fascias = v;
    app.sistemas?.refrescar();
    bus.emit('fascias', v);
    return v;
  }

  return {
    estado, iniciar, fijar, necesitar, esPelicula, fijarFascias,
    fascias: () => estado.fascias,
    opacidadPelicula: () => (estado.compiladas ? estado.compiladas.opacidadPelicula : 0.15),
    opacidadPeliculaResaltada: () => (estado.compiladas ? estado.compiladas.opacidadPeliculaResaltada : 0.4), configuracion, prepararMalla, tejidoDisponible,
    aspecto: () => estado.modo,
    disponible: () => estado.disponible,
    tejidoDe: (est) => (estado.compiladas ? estado.compiladas.tejidoDe(est) : null),
    asignar: (est) => (estado.compiladas ? estado.compiladas.asignar(est) : { tejido: null, regla: 'ninguna' }),
    tejido: (id) => tejidos.get(id) || null,
    pendientes: () => [...tejidos.values()].filter((t) => t.estado === 'cargando').length,
    listos: () => [...tejidos.values()].filter((t) => t.estado === 'listo').map((t) => t.id),
    todasLasPromesas: () => Promise.all([...tejidos.values()].map((t) => t.promesa).filter(Boolean)),
  };
}
