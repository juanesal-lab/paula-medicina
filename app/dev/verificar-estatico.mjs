// Verificación sin navegador de la app: sintaxis, importaciones, rutas relativas, esquemas del fixture
// (SPEC §7.3 y §7.4), coherencia GLB <-> catálogo y pesos. Uso: node app/dev/verificar-estatico.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..');
let errores = 0, avisos = 0, total = 0;
const bien = (c, m) => { total++; if (c) console.log('  ok  ', m); else { errores++; console.error('  FALLA', m); } };
const aviso = (m) => { avisos++; console.warn('  aviso', m); };
const leer = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');
const existe = (rel) => fs.existsSync(path.join(APP, rel));

function listar(dir, filtro, salida = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    if (n.name === 'node_modules') continue;
    const p = path.join(dir, n.name);
    if (n.isDirectory()) listar(p, filtro, salida); else if (!filtro || filtro(p)) salida.push(p);
  }
  return salida;
}

// ---------- 1. sintaxis ----------
console.log('1. Sintaxis (node --check)');
const jsApp = listar(path.join(APP, 'js'), (p) => p.endsWith('.js'));
const jsDev = listar(AQUI, (p) => p.endsWith('.mjs') && !p.includes('/fixture/'));
for (const f of [...jsApp, ...jsDev]) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); bien(true, path.relative(APP, f)); }
  catch (e) { bien(false, path.relative(APP, f) + ': ' + String(e.stderr || e.message).split('\n')[0]); }
}

// ---------- 2. index.html ----------
console.log('2. index.html');
const html = leer('index.html');
bien(!/(src|href)\s*=\s*["']\//.test(html), 'ningún src/href empieza por "/"');
bien(!/(src|href)\s*=\s*["']\/\//.test(html), 'ningún src/href protocolo-relativo');
bien(!/https?:\/\//i.test(html), 'sin URL http(s) en index.html');
bien(!/(cdn|unpkg|jsdelivr|fonts\.googleapis)/i.test(html + jsApp.map((f) => fs.readFileSync(f, 'utf8')).join('\n') + leer('css/estilos.css')), 'sin CDN ni Google Fonts en index, js y css');
bien(/<html lang="es"/.test(html), 'html lang="es"');
const mapa = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
bien(mapa.imports.three === './vendor/three/three.module.js' && mapa.imports['three/addons/'] === './vendor/three/addons/', 'importmap según SPEC §7.2');
bien(html.indexOf('type="importmap"') < html.indexOf('type="module"'), 'importmap antes del script de módulo');
for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"#]+)"/g)) {
  const u = m[1];
  if (u.startsWith('http') || u.startsWith('mailto:')) continue;
  bien(existe(u) || u === 'ATRIBUCIONES.md', `recurso referenciado existe: ${u}${u === 'ATRIBUCIONES.md' && !existe(u) ? ' (lo genera el encargo 02)' : ''}`);
}
const css = leer('css/estilos.css');
for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
  bien(!/^(\/|https?:)/.test(m[1]) && fs.existsSync(path.join(APP, 'css', m[1])), `url() del CSS relativa y existente: ${m[1]}`);
}
const idsHtml = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const usados = new Set();
for (const f of jsApp) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\$\('([^']+)'\)/g)) usados.add(m[1]);
for (const id of usados) bien(idsHtml.has(id), `id usado en JS existe en index.html: #${id}`);
bien(![...listar(APP, null)].some((p) => path.relative(APP, p).split(path.sep).some((s) => s.startsWith('_'))), 'ninguna carpeta ni archivo empieza por "_" (Jekyll)');

// ---------- 3. importaciones ----------
console.log('3. Importaciones');
const VENDOR = 'vendor/three';
function resolverImport(desdeArchivo, esp) {
  if (esp === 'three') return path.join(APP, VENDOR, 'three.module.js');
  if (esp.startsWith('three/addons/')) return path.join(APP, VENDOR, 'addons', esp.slice('three/addons/'.length));
  if (esp.startsWith('.')) return path.resolve(path.dirname(desdeArchivo), esp);
  return null;
}
const exportsDe = (src) => {
  const set = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/g)) set.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) for (const n of m[1].split(',')) set.add(n.trim().split(/\s+as\s+/).pop());
  return set;
};
const aRevisar = [...jsApp, ...listar(path.join(APP, VENDOR), (p) => p.endsWith('.js'))];
let nImports = 0;
for (const f of aRevisar) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(APP, f);
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/g)) {
    const esp = m[2];
    const destino = resolverImport(f, esp);
    nImports++;
    if (!destino) { bien(false, `${rel}: importación no resoluble por importmap: "${esp}"`); continue; }
    const dentro = destino.startsWith(APP + path.sep);
    if (!(dentro && fs.existsSync(destino))) { bien(false, `${rel}: "${esp}" no existe dentro de app/`); continue; }
    if (jsApp.includes(f) && esp.startsWith('.') && m[1] && m[1].includes('{')) {
      const nombres = m[1].match(/\{([\s\S]*)\}/)[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      const ex = exportsDe(fs.readFileSync(destino, 'utf8'));
      for (const n of nombres) if (!ex.has(n)) bien(false, `${rel}: "${n}" no se exporta desde ${esp}`);
    }
  }
  for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const destino = resolverImport(f, m[1]);
    bien(destino && fs.existsSync(destino), `${rel}: import dinámico "${m[1]}" resuelve`);
  }
}
bien(true, `${nImports} importaciones revisadas (todas resuelven dentro de app/ y los nombres importados existen)`);
for (const rel of ['three.module.js', 'LICENSE', 'addons/controls/OrbitControls.js', 'addons/loaders/GLTFLoader.js', 'addons/libs/meshopt_decoder.module.js', 'addons/utils/BufferGeometryUtils.js']) {
  bien(existe(`${VENDOR}/${rel}`), `vendor/three/${rel}`);
}
bien(/three@0\.170\.0|REVISION = '170'/.test(leer(`${VENDOR}/three.module.js`)), 'three.js es la revisión 170');
for (const f of ['Fraunces.woff2', 'Fraunces-Italic.woff2', 'Inter.woff2', 'OFL-Fraunces.txt', 'OFL-Inter.txt']) bien(existe('fonts/' + f), `fonts/${f}`);
bien(existe('LICENSE-CODIGO.txt'), 'LICENSE-CODIGO.txt');

// ---------- 4. fixture: esquemas ----------
console.log('4. Fixture (SPEC §7.3 y §7.4)');
// Esquema de ficha (SPEC §7.4). Devuelve un arreglo de booleanos; false = campo inválido.
// Campos óseos opcionales: accidentes, articulaciones, inserciones, osificacion, contrastado.
const TIPOS_FICHA = ['hueso', 'musculo', 'arteria', 'vena', 'nervio', 'organo', 'articulacion', 'ligamento', 'ganglio', 'region', 'otro'];
function validarFicha(clave, f, claves) {
  const nul = (x) => x === null || typeof x === 'string';
  const str = (x) => typeof x === 'string' && x.trim() !== '';
  const lista = (x, regla) => x === undefined || (Array.isArray(x) && x.every((o) => o && typeof o === 'object' && regla(o)));
  return [
    f.clave === clave, f.ta2 === clave.slice(4), claves.has(clave), typeof f.nombre_es === 'string', typeof f.nombre_la === 'string',
    TIPOS_FICHA.includes(f.tipo), typeof f.resumen === 'string', typeof f.funcion === 'string',
    nul(f.irrigacion), nul(f.drenaje_venoso), nul(f.inervacion), nul(f.drenaje_linfatico), nul(f.relaciones), nul(f.perla),
    f.musculo === null || (f.musculo && ['origen', 'insercion', 'accion'].every((k) => typeof f.musculo[k] === 'string')),
    Array.isArray(f.relevancia_clinica) && f.relevancia_clinica.every((t) => typeof t === 'string'),
    Array.isArray(f.fuentes) && f.fuentes.length > 0 && f.fuentes.every((x) => typeof x.titulo === 'string' && /^https:\/\//.test(x.url)),
    /^\d{4}-\d{2}-\d{2}$/.test(f.revisado),
    // opcionales (solo fichas óseas): si existen, deben cumplir el esquema
    lista(f.accidentes, (o) => str(o.nombre) && nul(o.nombre_la) && str(o.nota)),
    lista(f.articulaciones, (o) => str(o.con) && str(o.tipo) && str(o.nombre)),
    lista(f.inserciones, (o) => str(o.musculo) && ['origen', 'insercion'].includes(o.tipo) && str(o.donde)),
    f.osificacion === undefined || nul(f.osificacion),
    f.contrastado === undefined || typeof f.contrastado === 'boolean',
  ];
}

const FIX = 'dev/fixture';
const COLOR = /^#[0-9A-Fa-f]{6}$/;
if (!existe(`${FIX}/datos/catalogo.json`)) {
  bien(false, 'falta app/dev/fixture (ejecuta: cd app/dev && node generar-fixture.mjs)');
} else {
  const sis = JSON.parse(leer(`${FIX}/datos/sistemas.json`));
  const cat = JSON.parse(leer(`${FIX}/datos/catalogo.json`));
  const man = JSON.parse(leer(`${FIX}/datos/fichas/manifest.json`));
  bien(sis.version === 1 && Array.isArray(sis.sistemas) && sis.sistemas.length === 3, 'sistemas.json: version 1 y 3 sistemas');
  for (const s of sis.sistemas) {
    const ok = typeof s.id === 'string' && typeof s.nombre === 'string' && COLOR.test(s.color) && typeof s.glb === 'string'
      && Number.isInteger(s.bytes) && Number.isInteger(s.tris) && Number.isInteger(s.estructuras)
      && typeof s.visible_inicio === 'boolean' && Number.isInteger(s.orden) && typeof s.opcional === 'boolean';
    bien(ok, `sistemas.json: esquema de "${s.id}"`);
    bien(existe(`${FIX}/${s.glb}`) && fs.statSync(path.join(APP, FIX, s.glb)).size === s.bytes, `GLB de "${s.id}" existe y su peso coincide`);
  }
  bien(sis.sistemas.some((s) => s.visible_inicio), 'al menos un sistema con visible_inicio');
  bien(cat.version === 1 && cat.unidades === 'm' && typeof cat.orientacion === 'string' && Array.isArray(cat.estructuras), 'catalogo.json: cabecera');
  bien(cat.estructuras.length >= 28 && cat.estructuras.length <= 40, `catalogo.json: unas 30 estructuras (${cat.estructuras.length})`);
  const ids = new Set(), sisIds = new Set(sis.sistemas.map((s) => s.id));
  let malas = 0;
  for (const e of cat.estructuras) {
    const v = [
      typeof e.id === 'string' && /^[a-z0-9_]+$/.test(e.id) && !ids.has(e.id),
      typeof e.nombre_es === 'string' && e.nombre_es.length > 0,
      e.nombre_la === null || (typeof e.nombre_la === 'string' && e.nombre_la.length > 0),
      typeof e.nombre_en === 'string',
      [null, 'derecho', 'izquierdo'].includes(e.lado),
      sisIds.has(e.sistema),
      Number.isInteger(e.capa) && e.capa >= 0 && e.capa <= 5,
      ['TA2', 'traduccion-propia'].includes(e.nombre_fuente),
      ['CC-BY-SA-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-4.0'].includes(e.licencia),
      e.ta2 === null || typeof e.ta2 === 'string',
      Number.isInteger(e.tris) && e.tris > 0,
      Array.isArray(e.centro) && e.centro.length === 3 && e.centro.every(Number.isFinite),
      typeof e.radio === 'number' && e.radio > 0,
      e.nombre_fuente !== 'TA2' || (e.ta2 !== null && e.nombre_la !== null),
      (e.lado === null) === !/_[di]$/.test(e.id),
    ];
    ids.add(e.id);
    if (v.some((x) => !x)) { malas++; console.error('   estructura inválida:', e.id, v.map((x, i) => (x ? '' : i)).filter((x) => x !== '').join(',')); }
  }
  bien(malas === 0, 'catalogo.json: cada estructura cumple el esquema');
  bien(cat.estructuras.some((e) => e.lado === 'derecho') && cat.estructuras.some((e) => e.lado === 'izquierdo') && cat.estructuras.some((e) => e.lado === null), 'hay estructuras derechas, izquierdas y de línea media');
  bien(new Set(cat.estructuras.map((e) => e.capa)).size >= 4, 'capas distintas (al menos 4 valores)');
  bien(cat.estructuras.some((e) => e.nombre_fuente === 'traduccion-propia'), 'incluye una estructura sin TA2 (ficha en preparación)');
  // GLB <-> catálogo (se lee el JSON del contenedor GLB)
  for (const s of sis.sistemas) {
    const b = fs.readFileSync(path.join(APP, FIX, s.glb));
    const largo = b.readUInt32LE(12);
    const gltf = JSON.parse(b.slice(20, 20 + largo).toString('utf8'));
    const nodos = (gltf.nodes || []).filter((n) => n.mesh !== undefined).map((n) => n.name);
    const esperados = cat.estructuras.filter((e) => e.sistema === s.id).map((e) => e.id).sort();
    bien(JSON.stringify([...nodos].sort()) === JSON.stringify(esperados), `GLB "${s.id}": node.name = id del catálogo (${nodos.length})`);
    bien((gltf.extensionsUsed || []).includes('EXT_meshopt_compression') && (gltf.extensionsUsed || []).includes('KHR_mesh_quantization'), `GLB "${s.id}": meshopt + quantize`);
    bien(s.estructuras === esperados.length, `sistemas.json "${s.id}": estructuras coincide con el catálogo`);
  }
  // fichas
  bien(man.version === 1 && Array.isArray(man.archivos) && Number.isInteger(man.total), 'fichas/manifest.json: esquema');
  const claves = new Set(cat.estructuras.filter((e) => e.ta2).map((e) => 'ta2:' + e.ta2));
  let nFichas = 0, fichasMalas = 0;
  for (const a of man.archivos) {
    const doc = JSON.parse(leer(`${FIX}/datos/fichas/${a}`));
    bien(doc.version === 1 && typeof doc.sistema === 'string' && sisIds.has(doc.sistema) && typeof doc.fichas === 'object', `fichas/${a}: cabecera`);
    for (const [clave, f] of Object.entries(doc.fichas)) {
      nFichas++;
      const v = validarFicha(clave, f, claves);
      if (v.some((x) => !x)) { fichasMalas++; console.error('   ficha inválida:', clave, v.map((x, i) => (x ? '' : i)).filter((x) => x !== '').join(',')); }
    }
  }
  bien(fichasMalas === 0, `fichas: ${nFichas} fichas cumplen el esquema §7.4`);
  bien(man.total === nFichas, 'manifest.total coincide con las fichas');
  const conFicha = new Set();
  for (const a of man.archivos) for (const k of Object.keys(JSON.parse(leer(`${FIX}/datos/fichas/${a}`)).fichas)) conFicha.add(k);
  bien(cat.estructuras.some((e) => e.ta2 && conFicha.has('ta2:' + e.ta2)) && cat.estructuras.some((e) => e.ta2 && !conFicha.has('ta2:' + e.ta2)), 'el fixture mezcla estructuras con ficha y sin ficha');
}

// ---------- 4a2. fichas reales (app/datos/fichas) ----------
console.log('4a2. Fichas reales (esquema §7.4 y cobertura ósea)');
if (!existe('datos/catalogo.json') || !existe('datos/fichas/manifest.json')) {
  aviso('no hay catálogo o fichas reales todavía; se omite');
} else {
  const catR = JSON.parse(leer('datos/catalogo.json'));
  const manR = JSON.parse(leer('datos/fichas/manifest.json'));
  const clavesR = new Set(catR.estructuras.filter((e) => e.ta2).map((e) => 'ta2:' + e.ta2));
  const clavesOseo = new Set(catR.estructuras.filter((e) => e.ta2 && e.sistema === 'oseo').map((e) => 'ta2:' + e.ta2));
  const vistas = new Set();
  let n = 0, malas = 0, dup = 0, bytes = 0;
  let oseasConCampos = 0;
  for (const a of manR.archivos) {
    bytes += fs.statSync(path.join(APP, 'datos/fichas', a)).size;
    const doc = JSON.parse(leer(`datos/fichas/${a}`));
    for (const [clave, f] of Object.entries(doc.fichas)) {
      n++;
      if (vistas.has(clave)) { dup++; console.error('   clave repetida entre archivos:', clave); }
      vistas.add(clave);
      const v = validarFicha(clave, f, clavesR);
      if (v.some((x) => !x)) { malas++; console.error('   ficha inválida:', clave, v.map((x, i) => (x ? '' : i)).filter((x) => x !== '').join(',')); }
      if (doc.sistema !== 'oseo' && ['accidentes', 'articulaciones', 'inserciones', 'osificacion'].some((c) => c in f)) {
        malas++; console.error('   campo óseo en ficha de otro sistema:', clave);
      }
      if (doc.sistema === 'oseo' && typeof f.contrastado === 'boolean' && Array.isArray(f.accidentes)) oseasConCampos++;
    }
  }
  bien(malas === 0, `fichas reales: ${n} fichas cumplen el esquema §7.4 y los campos óseos solo están en oseo.json`);
  bien(dup === 0, 'fichas reales: sin claves repetidas entre archivos');
  bien(manR.total === n, `manifest.total (${manR.total}) coincide con las fichas reales (${n})`);
  // Las fichas se descargan por sistema y a demanda, así que el tope es por el conjunto completo (1.632 fichas).
  bien(bytes <= 3 * 1024 * 1024, `fichas reales: ${(bytes / 1024).toFixed(0)} KB en total (límite 3 MB)`);
  const faltan = [...clavesOseo].filter((k) => !vistas.has(k));
  bien(faltan.length === 0, `cada pieza ósea del catálogo tiene ficha (${clavesOseo.size} claves)${faltan.length ? ': faltan ' + faltan.slice(0, 8).join(', ') : ''}`);
  bien(oseasConCampos === clavesOseo.size, `todas las fichas óseas traen accidentes y la marca contrastado (${oseasConCampos}/${clavesOseo.size})`);
}

// ---------- 4b. aspecto realista (reglas, texturas, IBL, interfaz) ----------
console.log('4b. Aspecto realista');
{
  const IDS = ['musculo', 'tendon', 'fascia', 'hueso', 'cartilago', 'grasa', 'piel', 'nervio', 'arteria', 'vena', 'linfatico', 'miocardio', 'pulmon', 'higado', 'rinon', 'bazo', 'estomago', 'mucosa', 'glandula', 'cerebro', 'cerebelo', 'medula', 'ojo', 'diente'];
  const FIBRAS = ['musculo', 'tendon', 'nervio', 'cerebelo'];
  bien(existe('datos/tejidos.json'), 'datos/tejidos.json existe');
  if (existe('datos/tejidos.json')) {
    const tj = JSON.parse(leer('datos/tejidos.json'));
    bien(tj.version === 1 && Array.isArray(tj.reglas) && tj.reglas.length > 10, 'tejidos.json: versión y reglas');
    bien(JSON.stringify(Object.keys(tj.tejidos).sort()) === JSON.stringify([...IDS].sort()), 'tejidos.json define exactamente los 24 tejidos del contrato');
    bien(Object.values(tj.tejidos).every((d) => d.escala_m > 0.005 && d.escala_m < 1 && d.normal >= 0 && d.rugosidad > 0 && d.variacion >= 0 && typeof d.nombre === 'string'), 'cada tejido con escala_m (en metros), normal, rugosidad y variacion');
    let reMal = 0, idMal = 0, sinFiltro = 0;
    const idsRegla = new Set();
    for (const r of tj.reglas) {
      if (idsRegla.has(r.id) || !r.id) idMal++;
      idsRegla.add(r.id);
      if (r.tejido !== null && !IDS.includes(r.tejido)) idMal++;
      if (r.sistema === undefined && r.subsistema === undefined && !r.nombre && !r.nombre_la && !r.nombre_en) sinFiltro++;
      for (const c of ['nombre', 'nombre_la', 'nombre_en']) if (r[c] !== undefined) { try { new RegExp(r[c].normalize('NFD').replace(/[̀-ͯ]/g, ''), 'i'); } catch (e) { reMal++; } }
    }
    bien(reMal === 0 && idMal === 0 && sinFiltro === 0, 'reglas: ids únicos, tejidos válidos, expresiones compilables y con algún filtro');
    const sistemasReales = existe('datos/sistemas.json') ? JSON.parse(leer('datos/sistemas.json')).sistemas.map((x) => x.id) : [];
    const sistemasFix = existe(`${FIX}/datos/sistemas.json`) ? JSON.parse(leer(`${FIX}/datos/sistemas.json`)).sistemas.map((x) => x.id) : [];
    const sinDefecto = [...new Set([...sistemasReales, ...sistemasFix])].filter((id) => !(id in tj.por_defecto));
    bien(sinDefecto.length === 0, 'cada sistema (real y del fixture) tiene tejido por defecto' + (sinDefecto.length ? ': faltan ' + sinDefecto.join(', ') : ''));
    bien(Object.values(tj.por_defecto).every((t) => t === null || IDS.includes(t)), 'tejidos por defecto válidos');
    const pel = tj.pelicula;
    bien(pel && pel.opacidad >= 0.1 && pel.opacidad <= 0.2 && Array.isArray(pel.reglas) && pel.reglas.length > 0 && pel.reglas.every((r) => r.id && (r.sistema !== undefined || r.subsistema !== undefined || r.nombre || r.nombre_la || r.nombre_en)), 'tejidos.json: bloque "pelicula" (opacidad 0,10–0,20 y reglas con filtros) para las fascias de revestimiento');
    bien(Object.values(tj.tejidos).every((d) => d.brillo === undefined || (d.brillo > 0.5 && d.brillo < 2)), 'tejidos.json: "brillo" opcional entre 0,5 y 2');
  }
  bien(existe('vendor/three/addons/environments/RoomEnvironment.js'), 'vendor/three/addons/environments/RoomEnvironment.js (IBL local, sin CDN)');
  const escSrc = leer('js/escena.js');
  bien(/RoomEnvironment/.test(escSrc) && /PMREMGenerator/.test(escSrc) && /ACESFilmicToneMapping/.test(escSrc) && /fijarAspecto/.test(escSrc), 'escena.js: RoomEnvironment + PMREM + ACES + fijarAspecto');
  const matSrc = leer('js/materiales.js');
  bien(/SRGBColorSpace/.test(leer('js/tejidos.js')) && /NoColorSpace/.test(leer('js/tejidos.js')) && /anisotropy/.test(leer('js/tejidos.js')), 'tejidos.js: albedo sRGB, normal/rugosidad lineales, anisotropía');
  bien(/gl_FrontFacing/.test(matSrc) && /clippingPlanes: \[planoCorte\]/.test(matSrc), 'materiales.js conserva el parche de caras traseras y el plano de corte');
  bien(/data-aspecto="realista"/.test(html) && /data-aspecto="esquematico"/.test(html) && /Aspecto/.test(html), 'index.html: interruptor "Aspecto: Realista / Esquemático"');
  bien(/aspecto:\s*seguro/.test(leer('js/paula.js')), 'paulaApp.aspecto expuesto');
  bien(/id="chk-fascias"[^>]*type="checkbox"|type="checkbox"[^>]*id="chk-fascias"/.test(html) && /Mostrar fascias de revestimiento/.test(html), 'index.html: casilla "Mostrar fascias de revestimiento"');
  bien(/fascias:\s*seguro/.test(leer('js/paula.js')) && /depthWrite: !transparente && !cfg\.pelicula/.test(matSrc) && /enPelicula/.test(leer('js/seleccion.js')), 'película de fascia: paulaApp.fascias, sin escribir profundidad y el raycast la deja para el final');
  bien(existe('dev/calcular-luz.mjs') && existe('dev/analizar-escala.mjs'), 'scripts de luz y de escala del mosaico (calcular-luz.mjs, analizar-escala.mjs)');
  bien(existe('texturas/LEEME.md'), 'texturas/LEEME.md (dónde copiar la carpeta)');
  bien(existe('dev/generar-texturas-prueba.mjs') && existe('dev/asignar-tejidos.mjs'), 'scripts de texturas de prueba y de informe de asignación');
  // Manifest de texturas (real y del fixture): mismo contrato.
  const revisarTexturas = (carpeta, etiqueta, obligatorio) => {
    if (!existe(`${carpeta}/manifest.json`)) { if (obligatorio) bien(false, `${etiqueta}/manifest.json existe`); else aviso(`${etiqueta}: sin manifest.json todavía (la app usa el aspecto esquemático)`); return; }
    const m = JSON.parse(leer(`${carpeta}/manifest.json`));
    bien(m.version === 1 && m.tejidos && typeof m.tejidos === 'object', `${etiqueta}/manifest.json: esquema`);
    const ids = Object.keys(m.tejidos);
    bien(ids.every((id) => IDS.includes(id)), `${etiqueta}: solo ids del contrato`);
    if (obligatorio) bien(ids.length === 24, `${etiqueta}: los 24 tejidos (${ids.length})`);
    else if (ids.length !== 24) aviso(`${etiqueta}: ${ids.length} de 24 tejidos en el manifest (los demás usarán color plano)`);
    let faltan = 0, fibrasMal = 0, bytes = 0;
    for (const id of ids) {
      for (const f of ['albedo', 'normal', 'rugosidad']) { const r = `${carpeta}/${id}/${f}.webp`; if (!existe(r)) faltan++; else { bytes += fs.statSync(path.join(APP, r)).size; const b = fs.readFileSync(path.join(APP, r)); if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') faltan++; } }
      if ((m.tejidos[id].fibras === 'vertical') !== FIBRAS.includes(id)) fibrasMal++;
    }
    bien(faltan === 0, `${etiqueta}: cada tejido listado tiene albedo, normal y rugosidad .webp válidos`);
    bien(fibrasMal === 0, `${etiqueta}: fibras "vertical" solo en musculo, tendon, nervio y cerebelo`);
    console.log(`   ${etiqueta}: ${(bytes / 1048576).toFixed(2)} MB`);
  };
  revisarTexturas('texturas', 'texturas', false);
  revisarTexturas(`${FIX}/texturas`, `${FIX}/texturas`, true);
}

// ---------- 5. cadenas en inglés (revisión básica de texto visible) ----------
console.log('5. Interfaz en español (palabras sueltas en inglés)');
const visible = html.replace(/<script[\s\S]*?<\/script>/g, '') + jsApp.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
for (const palabra of ['Loading', 'Search', 'Close', 'Cancel', 'Undo', 'Reset', 'Settings', 'Copy', 'Failed']) {
  const re = new RegExp(`(text:\\s*|>|['"\`])${palabra}(?![A-Za-zÀ-ÿ])`);
  bien(!re.test(visible), `sin la cadena visible "${palabra}"`);
}

// ---------- 6. lógica con GLB reales del fixture ----------
console.log('6. Lógica (probar-logica.mjs, GLTFLoader + meshopt en Node)');
if (existe(`${FIX}/datos/catalogo.json`)) {
  try {
    const salida = execFileSync(process.execPath, ['--no-warnings', '--import', './registrar-importmap.mjs', 'probar-logica.mjs'], { cwd: AQUI, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const resumen = salida.trim().split('\n').pop();
    bien(true, resumen);
  } catch (e) {
    bien(false, 'probar-logica.mjs falló:\n' + String(e.stdout || '').split('\n').filter((l) => /FALLO|comprobaciones/.test(l)).join('\n') + String(e.stderr || '').slice(0, 600));
  }
}

// ---------- 6b. vista separada, explorador, gestos y puntería ----------
console.log('6b. Separar, explorador, gestos y puntería (probar-separar.mjs)');
if (existe(`${FIX}/datos/catalogo.json`) && existe('modelos/oseo.glb')) {
  try {
    const salida = execFileSync(process.execPath, ['--no-warnings', '--import', './registrar-importmap.mjs', 'probar-separar.mjs'], { cwd: AQUI, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    bien(true, salida.trim().split('\n').pop());
  } catch (e) {
    bien(false, 'probar-separar.mjs falló:\n' + String(e.stdout || '').split('\n').filter((l) => /FALLO|comprobaciones/.test(l)).join('\n') + String(e.stderr || '').slice(0, 600));
  }
} else aviso('probar-separar.mjs omitido: faltan el fixture o modelos/oseo.glb');

// ---------- 7. pesos ----------
console.log('7. Pesos (sin modelos ni dev)');
const du = (rel) => listar(path.join(APP, rel)).reduce((a, f) => a + fs.statSync(f).size, 0);
const partes = { 'index.html': fs.statSync(path.join(APP, 'index.html')).size, css: du('css'), js: du('js'), fonts: du('fonts'), vendor: du('vendor') };
const suma = Object.values(partes).reduce((a, b) => a + b, 0);
for (const [k, v] of Object.entries(partes)) console.log(`   ${k.padEnd(11)} ${(v / 1024).toFixed(0)} KB`);
bien(suma <= 2.5 * 1024 * 1024, `app + vendor + fuentes = ${(suma / 1048576).toFixed(2)} MiB (tope 2,5 MiB)`);
bien(partes.fonts <= 1.2 * 1024 * 1024, `fuentes = ${(partes.fonts / 1024).toFixed(0)} KB (tope 1,2 MB)`);

console.log(`\n${total - errores}/${total} comprobaciones correctas, ${errores} fallo(s), ${avisos} aviso(s).`);
process.exit(errores ? 1 : 0);
