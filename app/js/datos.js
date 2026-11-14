// Carga de sistemas.json, catalogo.json y fichas. Todas las rutas se resuelven contra una base
// (por defecto "./"; con ?datos=dev/fixture/ se usan los datos de prueba).

const RUTA_SEGURA = /^[A-Za-z0-9_\-./]+$/;

export function baseDesdeParametro(param, referencia) {
  let rel = './';
  if (param && RUTA_SEGURA.test(param) && !param.startsWith('/') && !param.includes('..')) rel = param;
  if (!rel.endsWith('/')) rel += '/';
  return new URL(rel, referencia).href;
}

export function crearAlmacen(base, leerJSON, leerBinario) {
  return {
    base,
    url(ruta) { return new URL(ruta, base).href; },
    leerJSON: (ruta) => leerJSON(new URL(ruta, base).href),
    leerBinario: (ruta, progreso) => leerBinario(new URL(ruta, base).href, progreso),
  };
}

export async function leerJSONRed(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} al leer ${url}`);
  return r.json();
}

// Lee un binario informando el avance (bytes cargados, total conocido o 0).
export async function leerBinarioRed(url, progreso) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} al leer ${url}`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body || !r.body.getReader) {
    const buf = await r.arrayBuffer();
    progreso?.(buf.byteLength, buf.byteLength);
    return buf;
  }
  const lector = r.body.getReader();
  const trozos = [];
  let cargado = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
    cargado += value.byteLength;
    progreso?.(cargado, total);
  }
  const salida = new Uint8Array(cargado);
  let pos = 0;
  for (const t of trozos) { salida.set(t, pos); pos += t.byteLength; }
  return salida.buffer;
}

// Devuelve {sistemas, estructuras, porId, sistemaPorId}. Lanza si faltan los archivos esenciales.
export async function cargarCatalogo(almacen) {
  const [sis, cat] = await Promise.all([
    almacen.leerJSON('datos/sistemas.json'),
    almacen.leerJSON('datos/catalogo.json'),
  ]);
  const sistemas = [...(sis.sistemas || [])].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
  const estructuras = cat.estructuras || [];
  const porId = new Map();
  for (const e of estructuras) porId.set(e.id, e);
  const sistemaPorId = new Map(sistemas.map((s) => [s.id, s]));
  return { sistemas, estructuras, porId, sistemaPorId };
}

// Carga todas las fichas del manifest. Nunca lanza: si algo falta, devuelve lo que haya.
export async function cargarFichas(almacen) {
  const mapa = new Map();
  try {
    const manifest = await almacen.leerJSON('datos/fichas/manifest.json');
    const archivos = Array.isArray(manifest.archivos) ? manifest.archivos : [];
    await Promise.all(archivos.map(async (nombre) => {
      try {
        const doc = await almacen.leerJSON('datos/fichas/' + nombre);
        for (const [clave, ficha] of Object.entries(doc.fichas || {})) mapa.set(clave, ficha);
      } catch (e) {
        console.warn('[paula] no se pudo cargar el archivo de fichas', nombre, e);
      }
    }));
  } catch (e) {
    console.warn('[paula] sin fichas (manifest no disponible)', e);
  }
  return mapa;
}

export function claveFicha(est) {
  return est && est.ta2 !== null && est.ta2 !== undefined && est.ta2 !== '' ? 'ta2:' + est.ta2 : null;
}

export function fichaDe(fichas, est) {
  const clave = claveFicha(est);
  return clave ? fichas.get(clave) || null : null;
}

// Una estructura "tiene ficha" si existe su ficha cargada. Antes de que carguen, se indica con false.
export function tieneFicha(fichas, est) {
  return !!fichaDe(fichas, est);
}
