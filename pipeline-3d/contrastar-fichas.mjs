// Contraste automatico parcial de las fichas anatomicas contra StatPearls (encargo C7).
//
// Uso (desde cualquier carpeta):
//   node pipeline-3d/contrastar-fichas.mjs --analizar       -> calcula y guarda $TMPDIR/contraste-analisis.json; NO toca fichas ni informe
//   node pipeline-3d/contrastar-fichas.mjs                  -> calcula, aplica la revision manual (REVISION), escribe `contrastado`/`contraste` en las fichas e informe
//   node pipeline-3d/contrastar-fichas.mjs --solo-informe   -> regenera INFORME-FICHAS.md a partir de las fichas ya escritas; no modifica fichas, no usa red
//
// Insumos locales (no se descargan aqui):
//   $TMPDIR/fuentes/statpearls/*.nxml + indice.tsv   (corpus StatPearls OA de NCBI litarch; ver docs/verificacion/herramientas/extraer_statpearls.py)
//   $TMPDIR/ta2.csv                                   (TA2.csv de Z-Anatomy/Models-of-human-anatomy, SPEC 6.2; si falta se busca $TMPDIR/bp3dcheck/TA2.csv)
// Red: solo E-utilities de NCBI (esearch+esummary, para resolver NBK por titulo), con User-Agent de lector automatico,
// como docs/verificacion/herramientas/fuentes.py. Resultados en cache en $TMPDIR/nbk-fichas-cache.json.
//
// Que significa cada estado (ver INFORME-FICHAS.md):
//  - un termino anatomico de la ficha (en espanol) se extrae por coincidencia mas larga con TA2 (columna Espanol), se traduce a su nombre
//    ingles y se busca en el texto plano del capitulo (solo en las secciones pertinentes si existen; nunca en Clinical/Surgical/Embryology).
//  - campo: hallado (todos los terminos y cobertura >= 0,5 del texto del campo), parcial (>= mitad, o todos pero cobertura baja),
//    no_hallado, sin_terminos.
//  - contrastado:true solo si hay >= 2 campos evaluados, todos hallado/confirmado (revision manual), y el capitulo es propio de la estructura.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const TMP = process.env.TMPDIR || os.tmpdir();
const SP = path.join(TMP, 'fuentes', 'statpearls');
const DIR_FICHAS = path.join(RAIZ, 'app', 'datos', 'fichas');
const INFORME = path.join(AQUI, 'INFORME-FICHAS.md');
const FECHA = '2026-11-13';
const UA = 'material-de-estudio-medicina/1.0 (lector automatico de fuentes abiertas)';
const EU = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const SISTEMAS = ['oseo', 'muscular', 'cardiovascular', 'nervioso', 'digestivo', 'respiratorio', 'urinario', 'reproductor', 'endocrino', 'linfatico', 'articular'];
const args = new Set(process.argv.slice(2));
const MODO = args.has('--solo-informe') ? 'informe' : args.has('--analizar') ? 'analizar' : 'aplicar';

// ============================================================================
// REVISION MANUAL (se rellena tras leer los pasajes; ver INFORME-FICHAS.md)
// ============================================================================
// Fichas oseas que ya eran `true` antes de C7 por lectura de OpenStax (el SPEC 7.4 lo permite); conservan `true`
const PREVIO_OPENSTAX = new Set(['ta2:641', 'ta2:835']);
const NERV_TORACICA = 'Seccion "Nerves": ramos dorsales (posteriores) de los nervios espinales y ramos meningeos recurrentes (sinuvertebrales).';
const RIBS = 'Seccion "Blood Supply": arterias intercostales anteriores y posteriores. Lo entre parentesis (periostio, medula) no esta en el capitulo.';
const REVISION = {
  // clave de ficha -> { campo: nota }  (leido el pasaje del capitulo y el dato de la ficha coincide con lo que dice la fuente)
  confirmados: {
    'ta2:1059*6': { inervacion: 'Vertebras toracicas: "Dorsal rami ... recurrent meningeal (sinuvertebral) branches"; la extraccion no traduce "ramos posteriores" = dorsal rami.' },
    'ta2:1068*3': { inervacion: 'Vertebras lumbares: "Lumbar dorsal rami" y nervio sinuvertebral; igual causa que arriba.' },
    'ta2:1168': { inervacion: 'Seccion "Nerves": supraclavicular, subclavio, toracico largo y supraescapular (inervacion "controvertida"); la ficha cita dos de ellos.',
      irrigacion: 'Seccion "Blood Supply": "suprascapular, thoracoacromial, and internal thoracic arteries"; la extraccion fallo por la grafia toracoacromial.' },
    'ta2:1484': { inervacion: 'Fuente: nervios plantar medial (rama del tibial) y fibular profundo; la ficha dice tibial y peroneo profundo.' },
    'ta2:1106*3': { irrigacion: RIBS }, 'ta2:1106*4': { irrigacion: RIBS }, 'ta2:1106*5': { irrigacion: RIBS }, 'ta2:1106*6': { irrigacion: RIBS },
    'ta2:1113*8': { irrigacion: RIBS }, 'ta2:1113*9': { irrigacion: RIBS }, 'ta2:1113*10': { irrigacion: RIBS }, 'ta2:1114*11': { irrigacion: RIBS },
    'ta2:2459': { irrigacion: 'Fuente: arteria circunfleja escapular (rama de la subescapular) y circunfleja humeral posterior; el diccionario TA2 usa otra denominacion en espanol.' },
    'ta2:2614': { irrigacion: 'Fuente: arteria femoral por su rama circunfleja femoral lateral.' },
    'ta2:2641': { irrigacion: 'Fuente: ramas perforantes de la arteria femoral profunda ("profunda femoris").' },
    'ta2:2042': { inervacion: 'Fuente: division superior del III par (oculomotor).' },
    'ta2:2043': { inervacion: 'Fuente: division inferior del III par (oculomotor).' },
    'ta2:1890': { irrigacion: 'Fuente: arteria genicular media.' },
    'ta2:1891': { irrigacion: 'Fuente: arteria genicular media.' },
    'ta2:1888': { irrigacion: 'Fuente: arterias geniculares medial, lateral y media; solo 10-30 % recibe aporte directo.',
      inervacion: 'Fuente: rama articular del tibial posterior y ramas terminales de obturador y femoral.' },
    'ta2:1885': { irrigacion: 'Fuente: arterias geniculares lateral y media; solo el 10-25 % periferico esta bien vascularizado.',
      inervacion: 'Texto corregido (ver correcciones): rama fibular recurrente del fibular comun.' },
    'ta2:978': { inervacion: 'Texto corregido (ver correcciones): la fuente dice cartilago aneural.', irrigacion: 'Texto corregido (ver correcciones): la fuente dice cartilago avascular.' },
  },
  // clave -> null (sin capitulo propio: el capitulo hallado automaticamente no es el de la estructura) | titulo exacto del capitulo
  capitulos: {
    'ta2:1307': null,   // "Hueso coxal" coincidia con "Anatomy, Bony Pelvis and Lower Limb, Hip" (region/articulacion de la cadera, no el hueso)
  },
  // correcciones al texto de la ficha: { clave, ruta, antes, despues, fuente, nota }
  correcciones: [
    { clave: 'ta2:978', ruta: 'inervacion', antes: 'Nervio laríngeo recurrente.',
      despues: 'Cartílago sin inervación propia. El nervio laríngeo superior (rama del vago) pasa por encima e inerva el músculo cricotiroideo.',
      fuente: 'StatPearls: Anatomy, Head and Neck, Cricoid Cartilage, sección "Nerves" ("The cricoid cartilage is aneural")', nota: 'La ficha atribuía la inervación del cartílago al recurrente; la fuente dice que el cartílago es aneural.' },
    { clave: 'ta2:978', ruta: 'irrigacion', antes: 'Arteria tiroidea inferior.',
      despues: 'Cartílago avascular: se nutre por difusión desde los tejidos vecinos. Cerca pasan ramas de la arteria tiroidea superior.',
      fuente: 'StatPearls: Anatomy, Head and Neck, Cricoid Cartilage, sección "Blood Supply and Lymphatics"', nota: 'La fuente cita la tiroidea superior (no la inferior) y describe el cartílago como avascular.' },
    { clave: 'ta2:1885', ruta: 'inervacion', antes: 'Nervio tibial y obturador (periferia).',
      despues: 'Rama fibular recurrente del nervio fibular común, que sigue a los vasos hacia la periferia y los cuernos del menisco.',
      fuente: 'StatPearls: Anatomy, Bony Pelvis and Lower Limb, Knee Lateral Meniscus, sección "Nerves"', nota: 'El texto era el del menisco medial; el lateral se inerva por el fibular común (el tibial y el obturador corresponden al medial).' },
  ],
  // 20 hallado revisados al azar: { clave, campo, veredicto, nota }
  // primeras 20: muestra aleatoria (semilla 11) del extractor final; las 8 ultimas son de la muestra equivalente de una version anterior del extractor
  muestraHallado: [
    { clave: 'ta2:2635', campo: 'irrigacion', veredicto: 'correcto', nota: 'Gracilis: "deep femoral artery" entre las ramas que lo irrigan.' },
    { clave: 'ta2:2045', campo: 'inervacion', veredicto: 'correcto', nota: 'Recto lateral: "supplied by cranial nerve VI, the abducens nerve".' },
    { clave: 'ta2:2650', campo: 'inervacion', veredicto: 'correcto', nota: 'Nervio fibular profundo confirmado; las raices L5-S1 no se verificaron una a una.' },
    { clave: 'ta2:2666', campo: 'irrigacion', veredicto: 'correcto', nota: 'Arteria tibial posterior y fibular (peroneal) citadas.' },
    { clave: 'ta2:2052', campo: 'inervacion', veredicto: 'correcto', nota: '"CN III innervates the levator palpebrae superioris"; rama superior ("superior branch").' },
    { clave: 'ta2:1059*5', campo: 'irrigacion', veredicto: 'correcto', nota: 'Arterias intercostales posteriores (seccion Blood Supply de vertebras toracicas).' },
    { clave: 'ta2:1068*1', campo: 'irrigacion', veredicto: 'correcto', nota: '"lumbar arteries, typically L1 through L4".' },
    { clave: 'ta2:2666', campo: 'origen', veredicto: 'correcto', nota: 'Membrana interosea y caras posteriores de tibia y peroné (fibula).' },
    { clave: 'ta2:2650', campo: 'origen', veredicto: 'correcto', nota: 'Cara anterior del peroné y membrana interosea.' },
    { clave: 'ta2:3081', campo: 'irrigacion', veredicto: 'correcto', nota: 'Arteria cistica, rama de la hepatica derecha.' },
    { clave: 'ta2:2976', campo: 'irrigacion', veredicto: 'correcto', nota: 'Arteria apendicular, rama de la ileocolica.' },
    { clave: 'ta2:1360', campo: 'inervacion', veredicto: 'debil', nota: 'Los nombres (femoral, obturador, ciatico) aparecen en el capitulo del femur como relaciones y vasos, no como inervacion del hueso; el campo debia leerse "hallado" solo con reserva. Caso tipico de sobreestimacion para huesos.' },
    { clave: 'ta2:2635', campo: 'inervacion', veredicto: 'correcto', nota: 'Rama anterior del nervio obturador.' },
    { clave: 'ta2:2469', campo: 'inervacion', veredicto: 'correcto', nota: 'Musculocutaneo (principal) y radial (lateral).' },
    { clave: 'ta2:1500', campo: 'inervacion', veredicto: 'parcial', nota: 'Plantares medial y lateral y fibular profundo estan en el capitulo; la extraccion solo conto "fibular profundo" (cobertura 0,5).' },
    { clave: 'ta2:1210', campo: 'articulaciones', veredicto: 'correcto', nota: 'Escafoides, semilunar, cubito citados como articulaciones del radio.' },
    { clave: 'ta2:2382', campo: 'insercion', veredicto: 'correcto', nota: '12.a costilla y apofisis transversas L1-L4.' },
    { clave: 'ta2:3114', campo: 'inervacion', veredicto: 'correcto', nota: 'Plexo celiaco y esplacnicos T6-T10; el vago no se evaluo.' },
    { clave: 'ta2:1068*5', campo: 'irrigacion', veredicto: 'correcto', nota: 'Lumbares e iliolumbar para L5.' },
    { clave: 'ta2:2165', campo: 'origen', veredicto: 'correcto', nota: 'Origen en la mandibula (la "linea milohioidea" aparece en el capitulo).' },
    { clave: 'ta2:2044', campo: 'irrigacion', veredicto: 'correcto', nota: 'Rama inferior de la arteria oftalmica.' },
    { clave: 'ta2:2644', campo: 'insercion', veredicto: 'correcto', nota: 'Cuneiforme medial y base del primer metatarsiano.' },
    { clave: 'ta2:2666', campo: 'inervacion', veredicto: 'correcto', nota: 'Tibial; raices L4-S3 del ciatico, mas amplias que L4-L5 de la ficha.' },
    { clave: 'ta2:2051', campo: 'irrigacion', veredicto: 'correcto', nota: 'Rama muscular medial de la oftalmica (y la infraorbitaria).' },
    { clave: 'ta2:1068*2', campo: 'irrigacion', veredicto: 'correcto', nota: 'Igual que L1.' },
    { clave: 'ta2:2650', campo: 'irrigacion', veredicto: 'correcto', nota: 'Arteria tibial anterior.' },
    { clave: 'ta2:3081', campo: 'inervacion', veredicto: 'correcto', nota: 'Plexo celiaco y vago; dolor referido al hombro por el frenico.' },
    { clave: 'ta2:2976', campo: 'inervacion', veredicto: 'correcto', nota: 'Plexo mesenterico superior; aferentes a T10.' },
  ],
  falsosNegativos: [
    "Nombres que el diccionario TA2 escribe distinto del texto de la ficha o de StatPearls: circunfleja escapular (TA2: \"de la escápula\"), toracoacromial/thoracoacromial, \"ramos posteriores\" = \"dorsal rami\", \"peroneo\" = \"fibular\". Se añadieron sinónimos (fibular/peroneal, coeliac/celiac, vermiform appendix/appendix, ductus/vas deferens, calcaneal/Achilles).",
    "Raíces nerviosas C5-C8, L4-S2: StatPearls suele dar el rango del plexo o del ciático, no el del músculo; la ficha puede ser correcta y quedar sin confirmar (p. ej. extensor largo del pulgar C7-C8, esternocleidomastoideo C2-C3).",
    "Estructuras citadas por su rama en vez de por el tronco (\"nervio plantar lateral\" frente a \"LPN\" del capítulo; \"arteria femoral profunda\" frente a \"profunda femoris\" o \"deep artery of the thigh\") y abreviaturas del capítulo (EPL, PIN, AIA, LPN).",
    "Frases calificativas dentro del campo (\"periostio y médula ósea\", \"(rama muscular)\", \"zona roja\"): no son términos TA2, bajan la cobertura y el campo pasa a parcial aunque el núcleo del dato esté en la fuente.",
    "Huesos: los campos articulaciones e inserciones mezclan nombres propios con descripciones (\"Cara plantar\", \"Base de la cara dorsal\"); TA2 casi no los reconoce, de modo que casi ningún hueso llega a true.",
    "Capítulos de familia (Ribs, Metatarsal Bones, Cervical/Thoracic/Lumbar Vertebrae): el texto cubre toda la familia, no cada pieza; los términos se hallan aunque no se hable de esa costilla o vértebra en particular (riesgo de falso positivo).",
    "Capítulo equivocado por nombre parcial: \"Hueso coxal\" cayó en \"Hip\" (región) y se descartó a mano; \"Arteria coronaria derecha/izquierda\" comparten el capítulo general \"Heart Coronary Arteries (Archived)\".",
    "Falsos positivos de coincidencia: un nombre puede aparecer en el capítulo como relación o complicación (fémur: nervios femoral/obturador/ciático) sin ser la inervación del hueso; la muestra revisada encontró 1 caso débil en 28.",
  ],
  notas: [
    "Corpus: StatPearls OA de NCBI litarch (9 536 artículos, 673 \"Anatomy, ...\"). Las fichas sin capítulo (la mayoría de huesos de mano y pie, vértebras sueltas, cartílagos, sub-porciones musculares, vías del SNC, ramas segmentarias) no tienen capítulo \"Anatomy, ...\" con su nombre en el corpus: `contrastado` es false y no llevan `contraste`.",
    "Las fichas con capítulo regional (nervios craneales y arterias sin capítulo propio) quedan siempre en false: que el nombre aparezca en un capítulo general no contrasta los datos de esa estructura.",
    "Discrepancia no corregida: redondo mayor, nervio subescapular inferior: la ficha dice C5-C6; StatPearls dice C5, C6 y C7. No se cambió porque ambas cifras circulan en los textos; queda para decisión humana.",
    "Extensor largo del pulgar: la ficha da la arteria interósea posterior; la introducción del capítulo cita interósea anterior y posterior, radial y cubital (ficha correcta pero incompleta).",
    "Correcciones de contenido: 3 campos de 2 fichas (cartílago cricoides; menisco lateral). Detalle arriba.",
  ],
};

// ============================================================================
// utilidades
// ============================================================================
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const leerJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const unico = (a) => [...new Set(a)];

function cargarFichas() {
  const out = {};
  for (const s of SISTEMAS) out[s] = leerJSON(path.join(DIR_FICHAS, s + '.json'));
  return out;
}

// ============================================================================
// INFORME (solo depende de las fichas escritas y de REVISION)
// ============================================================================
function informe(fichasPorSistema) {
  const filas = []; const tasa = {}; const tipoCamp = {};
  let tot = [0, 0, 0, 0, 0];
  for (const s of SISTEMAS) {
    const f = Object.values(fichasPorSistema[s].fichas);
    const conCap = f.filter((x) => x.contraste).length;
    const propio = f.filter((x) => x.contraste && !x.contraste.capitulo_regional).length;
    const t = f.filter((x) => x.contrastado === true).length;
    const fa = f.filter((x) => x.contrastado === false).length;
    filas.push([s, f.length, conCap, t, fa]);
    tot = [tot[0] + f.length, tot[1] + conCap, tot[2] + t, tot[3] + fa, tot[4] + propio];
    for (const x of f) for (const [c, v] of Object.entries(x.contraste?.campos || {})) {
      tasa[c] ??= { hallado: 0, confirmado: 0, parcial: 0, no_hallado: 0, sin_terminos: 0 };
      tasa[c][v] = (tasa[c][v] || 0) + 1;
    }
    for (const x of f) if (x.contraste) {
      const k = x.tipo; tipoCamp[k] ??= { n: 0, t: 0 }; tipoCamp[k].n++; if (x.contrastado === true) tipoCamp[k].t++;
    }
  }
  const L = [];
  L.push('# Informe de contraste de fichas anatomicas (C7)', '');
  L.push(`Generado por \`pipeline-3d/contrastar-fichas.mjs\` el ${FECHA}. Fuente de contraste: corpus StatPearls (OA, NCBI litarch), capitulos "Anatomy, ...". `
    + 'Diccionario espanol-ingles: TA2.csv. Regenerar sin tocar las fichas: `node pipeline-3d/contrastar-fichas.mjs --solo-informe`.', '');
  L.push('## Que significa `contrastado`', '',
    '- `true`: al menos 2 campos evaluados y todos ellos tienen sus terminos anatomicos en el texto del capitulo StatPearls de esa estructura (o fueron confirmados leyendo el pasaje) y el capitulo es propio de la estructura. Los terminos se extraen del texto espanol de la ficha con TA2; es una comprobacion de presencia de nombres, no una lectura linea por linea.',
    '- `false`: cualquier otro caso (sin capitulo propio, capitulo regional, algun campo `parcial`/`no_hallado`, o menos de 2 campos con terminos extraibles: un solo campo no basta para dar por contrastada la ficha). La app muestra el aviso "sin contraste" solo en este caso.',
    '- Las 2 fichas oseas que ya eran `true` por OpenStax (temporal y mandibula) conservan `true` por esa lectura previa.', '');
  L.push('## Tabla por sistema', '', '| Sistema | Fichas | Con capitulo | Contrastadas `true` | `false` |', '|---|---:|---:|---:|---:|');
  for (const r of filas) L.push(`| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} |`);
  L.push(`| **Total** | **${tot[0]}** | **${tot[1]}** | **${tot[2]}** | **${tot[3]}** |`, '');
  L.push(`De las ${tot[1]} fichas con capitulo, ${tot[4]} tienen capitulo propio y ${tot[1] - tot[4]} solo capitulo regional (nervios y arterias; nunca llegan a \`true\`).`, '');
  L.push('## Tasa por campo (solo fichas con capitulo; el campo cuenta cuando la ficha lo tiene con terminos extraibles)', '',
    '| Campo | hallado | confirmado (manual) | parcial | no_hallado | sin_terminos | % hallado+confirmado sobre evaluados |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const [c, v] of Object.entries(tasa)) {
    const ev = v.hallado + v.confirmado + v.parcial + v.no_hallado;
    L.push(`| ${c} | ${v.hallado} | ${v.confirmado} | ${v.parcial} | ${v.no_hallado} | ${v.sin_terminos} | ${ev ? Math.round(100 * (v.hallado + v.confirmado) / ev) + ' %' : '-'} |`);
  }
  L.push('', '## `true` por tipo de estructura (fichas con capitulo)', '', '| Tipo | Con capitulo | `true` |', '|---|---:|---:|');
  for (const [k, v] of Object.entries(tipoCamp)) L.push(`| ${k} | ${v.n} | ${v.t} |`);
  L.push('', '## Correcciones de contenido (antes -> despues y fuente)', '');
  if (!REVISION.correcciones.length) L.push('Ninguna: la revision manual no encontro datos erroneos que corregir.');
  for (const c of REVISION.correcciones) L.push(`- \`${c.clave}\` (${c.ruta}): "${c.antes}" -> "${c.despues}". Fuente: ${c.fuente}. ${c.nota || ''}`);
  L.push('', '## Revision manual', '');
  L.push(`Campos confirmados leyendo el pasaje: ${Object.values(REVISION.confirmados).reduce((n, o) => n + Object.keys(o).length, 0)} (en ${Object.keys(REVISION.confirmados).length} fichas).`, '');
  if (REVISION.muestraHallado.length) {
    L.push('### Muestra de `hallado` revisados al azar', '', '| Ficha | Campo | Veredicto | Nota |', '|---|---|---|---|');
    for (const m of REVISION.muestraHallado) L.push(`| ${m.clave} | ${m.campo} | ${m.veredicto} | ${String(m.nota).replace(/\|/g, '/')} |`);
    L.push('');
  }
  L.push('## Falsos negativos tipicos de la extraccion', '');
  for (const t of REVISION.falsosNegativos) L.push('- ' + t);
  if (REVISION.notas.length) { L.push('', '## Notas', ''); for (const t of REVISION.notas) L.push('- ' + t); }
  L.push('');
  fs.writeFileSync(INFORME, L.join('\n'));
  console.log('Informe escrito:', path.relative(RAIZ, INFORME));
}

if (MODO === 'informe') { informe(cargarFichas()); process.exit(0); }

// ============================================================================
// DICCIONARIO TA2
// ============================================================================
function ta2Ruta() {
  for (const p of [path.join(TMP, 'ta2.csv'), path.join(TMP, 'bp3dcheck', 'TA2.csv'), path.join(TMP, 'TA2.csv')]) if (fs.existsSync(p)) return p;
  throw new Error('Falta TA2.csv: bajalo a $TMPDIR/ta2.csv desde la URL del SPEC 6.2');
}
const TA2 = new Map();   // id -> {en, la, es}
for (let l of fs.readFileSync(ta2Ruta(), 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
  l = l.trim(); if (!l) continue;
  if (l.startsWith('"') && l.endsWith('"')) l = l.slice(1, -1);
  const c = l.split(';'); if (!/^\d+$/.test(c[0])) continue;
  TA2.set(c[0], { en: c[1] || '', la: c[2] || '', es: c[4] || '' });
}
const catalogo = leerJSON(path.join(RAIZ, 'app', 'datos', 'catalogo.json')).estructuras;
const inventario = leerJSON(path.join(RAIZ, 'docs', 'datos', 'inventario-zanatomy.json'));
const ENPORTA2 = new Map();
for (const e of catalogo) if (e.ta2 && e.nombre_en && !ENPORTA2.has(e.ta2)) ENPORTA2.set(e.ta2, e.nombre_en);

// ---- sinonimos ingles (TA2 / StatPearls usan formas distintas); se aplican en ambos sentidos como variantes de busqueda
const SINON = [['coeliac', 'celiac'], ['urinary bladder', 'bladder'], ['vermiform appendix', 'appendix'], ['calcaneal tendon', 'achilles tendon'],
  ['fibularis', 'peroneus'], ['fibular', 'peroneal'], ['ductus deferens', 'vas deferens'], ['suprarenal', 'adrenal'], ['hypophysis', 'pituitary'],
  ['pharyngotympanic', 'eustachian'], ['great saphenous', 'greater saphenous'], ['small saphenous', 'lesser saphenous'], ['small intestine', 'small bowel'],
  ['brachii', 'brachialis'], ['musculus ', ''], ['oesophagus', 'esophagus'], ['haemorrhoidal', 'hemorrhoidal'], ['sural', 'sural']];
const ORDINALES = /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\b/g;
const SING = { vertebrae: 'vertebra', phalanges: 'phalanx', teeth: 'tooth', sinuses: 'sinus', nodes: 'node', ribs: 'rib', ossicles: 'ossicle', cartilages: 'cartilage', glands: 'gland' };
const sing1 = (w) => SING[w] || w;
const clave = (g) => { const w = g.split(' ').filter(Boolean); if (w.length) w[w.length - 1] = sing1(w[w.length - 1]); return w.join(' '); };
function conSinonimos(n) {
  const v = new Set([n]);
  for (const [a, b] of SINON) { if (!a || a === b) continue; for (const x of [...v]) { if (x.includes(a)) v.add(x.replace(a, b)); if (b && x.includes(b)) v.add(x.replace(b, a)); } }
  return [...v].map((x) => x.trim()).filter(Boolean);
}

// ---- nombre ingles: variantes de busqueda
const GEN_SUELTO = new Set(['muscle', 'muscles', 'bone', 'bones', 'ligament', 'ligaments', 'gland', 'glands']);       // se puede quitar
const GEN_FIJO = new Set(['artery', 'arteries', 'vein', 'veins', 'nerve', 'nerves']);                              // no se quita (evita falsos positivos)
function sinLado(en) { return norm(String(en).replace(/\([^)]*\)/g, ' ')).replace(/\b(right|left|dexter|sinister)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
function plural(w) {
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
  if (/(s|x|ch|sh)$/.test(w)) return w + 'es';
  if (/is$/.test(w)) return w.slice(0, -2) + 'es';
  return w + 's';
}
function variantesEn(en) {
  const base = sinLado(en); if (!base) return [];
  const v = new Set([base]); const w = base.split(' ');
  const ult = w[w.length - 1];
  if (w.length > 1 || ult.length > 5) { const p = [...w.slice(0, -1), plural(ult)].join(' '); v.add(p); }
  if (GEN_SUELTO.has(ult)) { const r = w.slice(0, -1).join(' '); if (r && (w.length > 2 || r.length >= 6)) { v.add(r); } }
  if (/ of /.test(base)) v.add(base.replace(/ of /g, ' '));
  for (const x of [...v]) { const m = x.match(/^branch(?:es)? (?:of |to )(?:the )?(.+)$/); if (m) v.add(m[1]); }
  if (/^(?:the )/.test(base)) v.add(base.replace(/^the /, ''));
  for (const x of [...v]) for (const y of conSinonimos(x)) v.add(y);
  return [...v].filter((x) => x.length >= 3);
}
const tipoGen = (en) => { const u = sinLado(en).split(' ').pop(); return /^(artery|arteries|vein|veins)$/.test(u) ? 'vas' : /^(nerve|nerves)$/.test(u) ? 'nervio' : /^(muscle|muscles)$/.test(u) ? 'musculo' : /^(ligament|ligaments)$/.test(u) ? 'lig' : 'otro'; };

// ---- indice espanol -> [{en}]
const STOP1 = new Set(('anterior posterior superior inferior medial lateral medio media interno interna externo externa profundo profunda superficial derecho derecha izquierdo izquierda '
  + 'rama ramas cuerpo cara base borde cabeza cuello arteria arterias nervio nervios vena venas musculo musculos ligamento ligamentos hueso huesos tronco raiz raices ganglio plexo red '
  + 'mayor menor comun propia propio largo corto ancho principal accesorio nervioso tendon tejido hacia desde entre parte porcion zona region area lado cavidad pared '
  + 'general generales sistema simple segmento canal vertical horizontal frontal sagital pelvis fascia fosa cresta apofisis tuberculo cara espina surco foramen agujero').split(' '));
const STOP_IDX = new Set(('articulacion articulaciones capitulo plantar palmar proximal distal flexor extensor tibial radial cubital fibular lumbar toracico toracica cervical dorsal ventral '
  + 'musculos huesos nervios arterias venas ligamentos tendones cara caras tuberosidad tuberculo anillo membrana insercion insercion origen origenes ambos').split(' '));
const IDX = new Map();       // clave norm -> Set(en)
const ALIAS = new Map();     // clave norm sin prefijo -> [{en, kind}]
const PREF = { arteria: 'vas', vena: 'vas', nervio: 'nervio', musculo: 'musculo', ligamento: 'lig', rama: 'otro' };
const PLUR_A_SING = { arterias: 'arteria', venas: 'vena', nervios: 'nervio', musculos: 'musculo', ligamentos: 'ligamento', ramas: 'rama' };
function addIdx(es, en) {
  const k = norm(es); if (!k || !en) return;
  const nw = k.split(' ');
  if (nw.length === 1 && (STOP1.has(k) || STOP_IDX.has(k) || k.length < 4)) return;
  if (!IDX.has(k)) IDX.set(k, new Set()); IDX.get(k).add(en);
  const p = nw[0];
  if (PREF[p] && nw.length > 1) {
    const r = nw.slice(1).join(' ');
    if (!ALIAS.has(r)) ALIAS.set(r, []); ALIAS.get(r).push({ en, kind: PREF[p] });
    const pl = Object.keys(PLUR_A_SING).find((q) => PLUR_A_SING[q] === p);
    if (pl) { const kk = pl + ' ' + r; if (!IDX.has(kk)) IDX.set(kk, new Set()); IDX.get(kk).add(en); }
  }
}
for (const { es, en } of TA2.values()) addIdx(es, en);
for (const e of catalogo) if (e.nombre_es && e.nombre_en) addIdx(e.nombre_es.replace(/\s+(derech[oa]s?|izquierd[oa]s?)$/i, ''), e.nombre_en);
for (const e of inventario) if (e.es && e.en) addIdx(e.es, e.en);

const KIND_OK = { inervacion: ['nervio', 'otro'], irrigacion: ['vas', 'otro'] };
const RAIZ_RE = /\b([CTLS])\s?(\d{1,2})\b(?:\s*(?:-|–|—|a|al|to|through|and)\s*([CTLS])?\s?(\d{1,2})\b)?/g;
const MAXR = { C: 8, T: 12, L: 5, S: 5 };
function expandirRaices(texto) {
  const out = new Set();
  const T = String(texto).replace(/\b([CTLS])\s?(\d{1,2})\s*(?:-|–|—|\bto\b|\bthrough\b)\s*([CTLS])?\s?(\d{1,2})\b/gi, (m, a, n1, b, n2) => {
    a = a.toUpperCase(); b = (b || a).toUpperCase(); n1 = +n1; n2 = +n2;
    if (a === b) { for (let i = Math.min(n1, n2); i <= Math.max(n1, n2); i++) out.add(a + i); }
    else { for (let i = n1; i <= (MAXR[a] || n1); i++) out.add(a + i); for (let i = 1; i <= n2; i++) out.add(b + i); }
    return ' ';
  });
  for (const m of T.matchAll(/\b([CTLS])\s?(\d{1,2})\b/g)) out.add(m[1].toUpperCase() + m[2]);
  return out;
}

// ---- extraccion de terminos (espanol) de un texto de campo
const FUNC = new Set('de del la las los el y e o u en con a al por para su sus se que lo un una unos unas como mas muy no sin sobre entre hacia desde ademas tambien'.split(' '));
const GENERICAS = new Set(('arteria arterias nervio nervios vena venas rama ramas ramo musculo musculos ligamento ligamentos tendon origen insercion derecha derecho izquierda izquierdo '
  + 'anterior posterior superior inferior medial lateral medio media interna externa profunda superficial propia propias propio propios comun comunes terminal terminales '
  + 'principal principales ramas pequenas pequena grandes grande mayor menor via vias hacia desde parte porcion cara caras borde bordes cuerpo apofisis fosa fosas '
  + 'tronco troncos raiz raices plexo ganglio ganglios red redes irrigacion inervacion drenaje flujo ademas tambien mediante segun junto zona region area lado total tiene lleva '
  + 'ambos ambas todas todos distal proximal visceral parietal sensitiva sensitivas motora motoras fibras fibra territorio territorios').split(' '));
function extraer(texto, campo) {
  const raw = String(texto || '');
  const raices = [...expandirRaices(raw)];
  const sinRaiz = raw.replace(/\b[CTLS]\s?\d{1,2}\b(?:\s*[-–—]\s*[CTLS]?\s?\d{1,2}\b)?/g, ' ');
  const tk = norm(sinRaiz.replace(/,/g, ' , ')).split(' ').filter(Boolean);
  // norm elimina las comas: reconstruir con marcador
  const tks = sinRaiz.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9,]+/g, ' ').replace(/,/g, ' , ').split(/\s+/).filter(Boolean);
  const terms = []; let consumidos = 0; const usado = new Array(tks.length).fill(false);
  const ok = KIND_OK[campo];
  for (let i = 0; i < tks.length;) {
    let hit = null;
    for (let n = Math.min(9, tks.length - i); n >= 1; n--) {
      const seg = tks.slice(i, i + n); if (seg.includes(',')) continue;
      const k = seg.join(' ');
      if (IDX.has(k)) { hit = { n, ens: [...IDX.get(k)], es: k }; break; }
      if (ok && ALIAS.has(k) && (n > 1 || (k.length >= 5 && !STOP1.has(k)))) {
        const c = ALIAS.get(k).filter((a) => ok.includes(a.kind)); if (c.length) { hit = { n, ens: unico(c.map((a) => a.en)), es: k, alias: true }; break; }
      }
    }
    if (hit) {
      terms.push({ es: hit.es, en: hit.ens }); for (let j = 0; j < hit.n; j++) usado[i + j] = true; consumidos += hit.n;
      // lista coordinada: "arterias radial y cubital"
      const p = PLUR_A_SING[tks[i]];
      i += hit.n; if (!p) continue;
    } else {
      const p = PLUR_A_SING[tks[i]];
      if (p) {
        usado[i] = true; let j = i + 1;
        while (j < tks.length) {
          let w = tks[j];
          if (w === ',' || w === 'y' || w === 'e' || w === 'o') { j++; continue; }
          const cand = [w, w.replace(/es$/, ''), w.replace(/s$/, ''), w.replace(/(a|as)$/, 'o'), w.replace(/os$/, 'o'), w.replace(/ales$/, 'al'), w.replace(/ares$/, 'ar')];
          let found = null;
          for (const c of cand) { const kk = p + ' ' + c; if (IDX.has(kk)) { found = kk; break; } }
          if (!found) break;
          terms.push({ es: found, en: [...IDX.get(found)] }); usado[j] = true; consumidos++; j++;
        }
        i = j; continue;
      }
      i++;
    }
  }
  const sobrantes = tks.filter((w, i) => !usado[i] && w !== ',' && w.length >= 4 && !FUNC.has(w) && !GENERICAS.has(w) && !/^\d+$/.test(w));
  const nCub = consumidos + raices.length;
  const cobertura = nCub + sobrantes.length ? nCub / (nCub + sobrantes.length) : 0;
  return { terms, raices, sobrantes, cobertura };
}

// ============================================================================
// CORPUS STATPEARLS
// ============================================================================
if (!fs.existsSync(path.join(SP, 'indice.tsv'))) { console.error('Falta el corpus ' + SP + ' (ver docs/verificacion/herramientas/extraer_statpearls.py)'); process.exit(1); }
const INDICE = fs.readFileSync(path.join(SP, 'indice.tsv'), 'utf8').split('\n').filter(Boolean).map((l) => { const [f, t] = l.split('\t'); return { f, t, tam: fs.statSync(path.join(SP, f)).size }; });
const CAPS = INDICE.filter((c) => /^Anatomy,/i.test(c.t));
const ult = (t) => t.split(/[,:] /).slice(-1)[0];
const quitarGen = (s) => s.split(' ').filter((w) => !GEN_SUELTO.has(w) && !GEN_FIJO.has(w)).join(' ').trim();
for (const c of CAPS) {
  const seg = ult(c.t); const par = (seg.match(/\(([^)]*)\)/) || [0, ''])[1];
  c.L = norm(seg.replace(/\([^)]*\)/g, ' ').replace(/\barchived\b/i, ''));
  c.nombres = unico([c.L, ...par.split(/,| or /).map(norm).filter((x) => x && x !== 'archived')]);
  c.Lg = quitarGen(c.L); c.tit = norm(c.t); c.archivado = /\(archived\)/i.test(c.t);
}

const cacheTexto = new Map();
function textoCapitulo(c) {
  if (cacheTexto.has(c.f)) return cacheTexto.get(c.f);
  let x = fs.readFileSync(path.join(SP, c.f), 'utf8');
  x = x.replace(/<ref-list[\s\S]*?<\/ref-list>/g, ' ');
  const cuerpo = (x.match(/<body>([\s\S]*)<\/body>/) || [0, x])[1];
  // secciones de primer nivel
  const secs = []; let prof = 0; let ini = 0; let cur = null;
  const re = /<sec\b[^>]*>|<\/sec>/g; let m;
  const plano = (s) => ' ' + norm(s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ')) + ' ';
  const pre = [];
  while ((m = re.exec(cuerpo))) {
    if (m[0].startsWith('<sec')) { if (prof === 0) { cur = { ini: m.index }; } prof++; }
    else { prof--; if (prof === 0 && cur) { cur.fin = m.index + m[0].length; secs.push(cur); cur = null; } }
  }
  const out = secs.map((s) => {
    const trozo = cuerpo.slice(s.ini, s.fin); const t = (trozo.match(/<title>([\s\S]*?)<\/title>/) || [0, ''])[1].replace(/<[^>]+>/g, '');
    return { titulo: t, norm: norm(t), txt: plano(trozo) };
  }).filter((s) => !/review question|reference/.test(s.norm));
  const todo = ' ' + out.map((s) => s.txt).join(' ') + ' ';
  const r = { secs: out, todo, raices: expandirRaices(out.map((s) => s.txt.replace(/ ([ctls]) (\d)/g, ' $1$2')).join(' ')) };
  // las raices se buscan en texto original (mayusculas); recalcular desde el crudo
  r.raices = expandirRaices(cuerpo.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' '));
  cacheTexto.set(c.f, r); return r;
}
const EXCL = /clinical|surg|embryo|variant|other issues|pathophys|history|etiolog|testing|imaging|nursing|complication|enhancing/;
const WL = { inervacion: /introduc|struct|function|nerve|innerv|neurovasc|supply|relation|gross|neuro|anatomy|muscles|overview/, irrigacion: /introduc|struct|function|blood|vascul|arter|vein|venous|lymph|supply|relation|gross|circul|anatomy|muscles|overview/ };
const WL_DEF = /introduc|struct|function|muscle|bone|articul|joint|gross|relation|attach|anatomy|overview|nerve|blood|vascul/;
function textoCampo(cap, campo) {
  const wl = WL[campo] || WL_DEF;
  let s = cap.secs.filter((x) => wl.test(x.norm) && !EXCL.test(x.norm));
  if (!s.length) s = cap.secs.filter((x) => !EXCL.test(x.norm));
  if (!s.length) s = cap.secs;
  return ' ' + s.map((x) => x.txt).join(' ') + ' ';
}

// ---- eleccion de capitulo
const BAN = new Set(['artery', 'vein', 'nerve', 'muscle', 'bone', 'arch', 'head', 'neck', 'wall', 'canal', 'duct', 'arm', 'hand', 'foot', 'leg', 'skull', 'face', 'ear', 'eye', 'nose', 'lobe', 'gland', 'sinus', 'root', 'trunk', 'cord', 'plexus', 'fossa', 'ring', 'tract', 'apex', 'angle', 'base']);
function nombresEn(ta2) {
  const base = String(ta2).split('*')[0];
  const n = [];
  const t = TA2.get(base); if (t?.en) n.push(t.en);
  if (ENPORTA2.has(ta2)) n.push(ENPORTA2.get(ta2));
  if (ENPORTA2.has(base)) n.push(ENPORTA2.get(base));
  for (const e of inventario) if ((e.ta2 === ta2 || e.ta2 === base) && e.en) { n.push(e.en); break; }
  const out = [];
  for (const x of n.map(sinLado).filter(Boolean)) { out.push(x); const y = x.replace(ORDINALES, ' ').replace(/\s+/g, ' ').trim(); if (y !== x && y) out.push(y); }
  return unico(out).flatMap(conSinonimos).filter((x, i, a) => a.indexOf(x) === i);
}
const REG_RE = /plexus|aorta|cranial nerve|\bnerves\b|arteries|arterial|vascul|venous|\bveins\b|circulation|innervation|carotid|subclavian/i;
const REGION_PREF = new Set(('hand forearm arm calf thigh foot leg knee wrist elbow shoulder eye ear heart ankle hip head neck thorax abdomen pelvis back nose orbit face cervical lumbar thoracic '
  + 'palm finger digit lower upper limb pelvic spinal').split(' '));
const ultGen = (x) => x.split(' ').pop();
const GENS = { arteries: 'artery', veins: 'vein', nerves: 'nerve', muscles: 'muscle', bones: 'bone', ligaments: 'ligament', glands: 'gland' };
const genOk = (a, b) => {
  const ua = ultGen(a), ub = ultGen(b);
  const GA = GEN_FIJO.has(ua) || GEN_SUELTO.has(ua), GB = GEN_FIJO.has(ub) || GEN_SUELTO.has(ub);
  return !(GA && GB) || (GENS[ua] || ua) === (GENS[ub] || ub);
};
function elegirCapitulo(f) {
  const nombres = nombresEn(f.ta2);
  const ord = (a, b) => (a.archivado - b.archivado) || (b.tam - a.tam);
  // tier 1: igualdad con el nombre (o con el de la familia en singular: "Fifth metatarsal bone" -> "Metatarsal Bones")
  for (const nom of nombres) {
    const ng = quitarGen(nom); if (!ng || (BAN.has(ng) && nom === ng)) continue;
    const c1 = CAPS.filter((c) => c.nombres.some((cn) => (cn === nom || clave(quitarGen(cn)) === clave(ng)) && genOk(nom, cn)));
    if (c1.length) { c1.sort(ord); return { cap: c1[0], tier: 1, regional: false, nombre: nom, otros: c1.length }; }
  }
  // tier 2: el nombre aparece como palabras completas dentro del nombre del capitulo (p. ej. "Hand Extensor Pollicis Longus Muscle")
  for (const nom of nombres) {
    const ng = quitarGen(nom); if (!ng || ng.length < 5 || BAN.has(ng)) continue;
    const re = new RegExp('(^| )' + ng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)');
    const resto = (cn) => quitarGen(cn).replace(re, ' ').split(' ').filter(Boolean);
    const c2 = CAPS.filter((c) => c.nombres.some((cn) => re.test(quitarGen(cn)) && genOk(nom, cn) && resto(cn).every((w) => REGION_PREF.has(w))));
    if (c2.length) { c2.sort(ord); return { cap: c2[0], tier: 2, regional: false, nombre: nom, otros: c2.length }; }
  }
  if (f.tipo === 'nervio' || f.tipo === 'arteria') {
    // capitulo regional: el que mas veces nombra la estructura
    let mejor = null;
    for (const nom of nombres) for (const v of variantesEn(nom)) {
      for (const c of CAPS.filter((c) => REG_RE.test(c.t) && (f.tipo === 'nervio' ? /nerve|plexus|ganglion|innervation/i : /arter|aorta|vascul|circulation|carotid|subclavian/i).test(c.t))) {
        const cap = textoCapitulo(c); const n = cap.todo.split(' ' + v + ' ').length - 1;
        if (n > 0 && (!mejor || n > mejor.n || (n === mejor.n && c.tam > mejor.cap.tam))) mejor = { cap: c, n, nombre: nom };
      }
    }
    if (mejor && mejor.n >= 3) return { cap: mejor.cap, tier: 3, regional: true, nombre: mejor.nombre, otros: 0 };
  }
  return null;
}

// ---- evaluacion por campo
function terminosCampo(f) {
  const c = {};
  if (f.inervacion) c.inervacion = { texto: f.inervacion };
  if (f.irrigacion) c.irrigacion = { texto: f.irrigacion };
  if (f.musculo?.origen) c.origen = { texto: f.musculo.origen };
  if (f.musculo?.insercion) c.insercion = { texto: f.musculo.insercion };
  if (Array.isArray(f.articulaciones) && f.articulaciones.length) c.articulaciones = { texto: f.articulaciones.map((a) => [a.nombre, a.con].filter(Boolean).join(' ; ')).join(' ; ') };
  if (Array.isArray(f.inserciones) && f.inserciones.length) c.inserciones = { texto: f.inserciones.map((a) => [a.musculo, a.donde].filter(Boolean).join(' ; ')).join(' ; ') };
  return c;
}
function evaluarCampo(cap, campo, texto) {
  const ex = extraer(texto, campo);
  const txt = textoCampo(cap, campo);
  const grupos = [];
  for (const t of ex.terms) grupos.push({ tipo: 'es', es: t.es, en: t.en, vars: unico(t.en.flatMap(variantesEn)) });
  for (const r of ex.raices) grupos.push({ tipo: 'raiz', es: r, en: [r], vars: [] });
  // terminos duplicados por traduccion igual
  const vistos = new Set(); const g2 = grupos.filter((g) => { const k = g.tipo + ':' + [...g.en].sort().join('|'); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const rescap = txt; const rt = cap.raices;
  let enc = 0; const faltan = []; const hallados = [];
  for (const g of g2) {
    const ok = g.tipo === 'raiz' ? rt.has(g.es) : g.vars.some((v) => rescap.includes(' ' + v + ' '));
    const okTodo = g.tipo === 'raiz' ? ok : g.vars.some((v) => cap.todo.includes(' ' + v + ' '));
    if (ok) { enc++; hallados.push(g.es); } else faltan.push({ es: g.es, en: g.en[0], enTodoElCapitulo: okTodo });
  }
  const n = g2.length; let estado;
  if (!n) estado = 'sin_terminos';
  else if (enc === n) estado = ex.cobertura >= 0.5 ? 'hallado' : 'parcial';
  else if (enc * 2 >= n) estado = 'parcial';
  else estado = 'no_hallado';
  return { estado, n, enc, faltan, hallados, cobertura: +ex.cobertura.toFixed(2), sobrantes: ex.sobrantes.slice(0, 8) };
}

// ============================================================================
// NBK por titulo (E-utilities; cache en $TMPDIR)
// ============================================================================
const CACHE_NBK = path.join(TMP, 'nbk-fichas-cache.json');
let cacheNbk = {}; try { cacheNbk = leerJSON(CACHE_NBK); } catch { /* vacio */ }
async function get(url, intento = 0) {
  // curl respeta el proxy del entorno (fetch de Node 22 no); User-Agent de lector automatico, nunca de navegador
  const out = execFileSync('curl', ['-sS', '-m', '60', '-A', UA, url], { encoding: 'utf8', maxBuffer: 1 << 26 });
  await dormir(400);
  let j; try { j = JSON.parse(out); } catch { j = null; }
  if ((!j || j.error || (j.esearchresult && !j.esearchresult.idlist)) && intento < 3) { await dormir(1500 * (intento + 1)); return get(url, intento + 1); }
  if (!j) throw new Error('respuesta no valida: ' + url.slice(0, 80));
  return j;
}
const falloNbk = new Map();
const STOPW = new Set(['and', 'of', 'the', 'to', 'in', 'for', 'with', 'or', 'a', 'an']);
async function buscarNBK(titulo, palabras) {
  const term = palabras.map((w) => `${w}[ti]`).join(' AND ') + ' AND statpearls[book]';
  const ids = (await get(EU + 'esearch.fcgi?db=pubmed&retmode=json&term=' + encodeURIComponent(term))).esearchresult.idlist;
  if (!ids.length) return { nbk: null, motivo: 'sin resultado' };
  const r = (await get(EU + 'esummary.fcgi?db=pubmed&retmode=json&id=' + ids.join(','))).result;
  let motivo = 'titulo no coincide';
  for (const id of ids) {
    const t = r[id]?.title || ''; const nb = (r[id]?.articleids || []).find((a) => a.idtype === 'bookaccession')?.value;
    if (nb && norm(t) === norm(titulo)) return { nbk: nb, pmid: id, titulo: t };
    motivo = 'titulo no coincide: ' + t;
  }
  return { nbk: null, motivo };
}
async function resolverNBK(titulo) {
  if (cacheNbk[titulo]) return cacheNbk[titulo];
  if (falloNbk.has(titulo)) return falloNbk.get(titulo);
  // PubMed no indexa la frase con comas ("...Deltoid Muscle"[ti] da 0) y rechaza "and"/"of": se buscan las palabras del titulo en [ti] y se verifica el titulo completo
  const todas = titulo.split(/[^A-Za-z0-9]+/).filter(Boolean).filter((w) => !STOPW.has(w.toLowerCase()));
  const sinArchivado = todas.filter((w) => w.toLowerCase() !== 'archived');
  let res = { nbk: null, motivo: 'sin resultado' };
  try {
    res = await buscarNBK(titulo, todas);
    if (!res.nbk && sinArchivado.length !== todas.length) res = await buscarNBK(titulo, sinArchivado);
  } catch (e) { res = { nbk: null, motivo: 'error de red: ' + e.message }; }
  if (res.nbk) { cacheNbk[titulo] = res; fs.writeFileSync(CACHE_NBK, JSON.stringify(cacheNbk, null, 1)); } else falloNbk.set(titulo, res);
  return res;
}

// ============================================================================
// EJECUCION
// ============================================================================
const fichasPorSistema = cargarFichas();
const analisis = {};
let sinCap = 0;
for (const s of SISTEMAS) {
  for (const [clave, f] of Object.entries(fichasPorSistema[s].fichas)) {
    const ch = Object.hasOwn(REVISION.capitulos, clave) ? (REVISION.capitulos[clave] === null ? null : elegirCapitulo(f)) : elegirCapitulo(f);
    const a = { sistema: s, nombre: f.nombre_es, tipo: f.tipo, ta2: f.ta2, previoTrue: PREVIO_OPENSTAX.has(clave) };
    if (!ch) { a.capitulo = null; sinCap++; analisis[clave] = a; continue; }
    const cap = textoCapitulo(ch.cap);
    a.capitulo = { archivo: ch.cap.f, titulo: ch.cap.t, tier: ch.tier, regional: ch.regional, via: ch.nombre, candidatos: ch.otros };
    a.campos = {};
    for (const [campo, { texto }] of Object.entries(terminosCampo(f))) a.campos[campo] = { texto, ...evaluarCampo(cap, campo, texto) };
    analisis[clave] = a;
  }
}
fs.writeFileSync(path.join(TMP, 'contraste-analisis.json'), JSON.stringify(analisis, null, 1));
console.log(`Fichas: ${Object.keys(analisis).length}; sin capitulo: ${sinCap}; con capitulo: ${Object.keys(analisis).length - sinCap}`);
if (MODO === 'analizar') process.exit(0);

// ---- aplicar
const ESTADO_OK = new Set(['hallado', 'confirmado']);
let nbkFallo = 0;
for (const s of SISTEMAS) {
  for (const [clave, f] of Object.entries(fichasPorSistema[s].fichas)) {
    // correcciones manuales de texto (idempotentes)
    for (const c of REVISION.correcciones.filter((x) => x.clave === clave)) {
      const partes = c.ruta.split('.'); let o = f; for (const p of partes.slice(0, -1)) o = o?.[p];
      const k = partes[partes.length - 1];
      if (o && o[k] === c.antes) o[k] = c.despues;
    }
    const a = analisis[clave];
    if (!a.capitulo) { f.contrastado = a.previoTrue ? true : false; delete f.contraste; continue; }
    const { titulo, regional } = a.capitulo;
    const nb = await resolverNBK(titulo);
    if (!nb.nbk) { nbkFallo++; console.warn('NBK sin resolver:', titulo, '-', nb.motivo); }
    const url = nb.nbk ? `https://www.ncbi.nlm.nih.gov/books/${nb.nbk}/` : null;
    const campos = {};
    // los campos se recalculan tras correcciones: si cambio el texto, reevaluar
    const cap = textoCapitulo(CAPS.find((c) => c.f === a.capitulo.archivo));
    for (const [campo, { texto }] of Object.entries(terminosCampo(f))) {
      const ev = a.campos[campo] && a.campos[campo].texto === texto ? a.campos[campo] : { texto, ...evaluarCampo(cap, campo, texto) };
      let est = ev.estado;
      if (REVISION.confirmados[clave]?.[campo] && est !== 'sin_terminos' && est !== 'hallado') est = 'confirmado';
      campos[campo] = est;
    }
    const evaluados = Object.values(campos).filter((v) => v !== 'sin_terminos');
    let ok = evaluados.length >= 2 && evaluados.every((v) => ESTADO_OK.has(v)) && !regional;
    f.contrastado = ok || a.previoTrue;
    f.contraste = {
      fuente: `StatPearls: ${titulo}${nb.nbk ? ` (${nb.nbk})` : ' (NBK sin resolver)'}`,
      url, ...(regional ? { capitulo_regional: true } : {}),
      campos, metodo: 'automatico+revision', fecha: FECHA,
    };
    if (url && !f.fuentes.some((x) => x.url === url)) f.fuentes.push({ titulo: `StatPearls: ${titulo}`, url });
  }
  const d = fichasPorSistema[s];
  fs.writeFileSync(path.join(DIR_FICHAS, s + '.json'), JSON.stringify(d, null, 1) + '\n');
}
if (nbkFallo) console.warn('NBK sin resolver:', nbkFallo);
const tam = SISTEMAS.reduce((n, s) => n + fs.statSync(path.join(DIR_FICHAS, s + '.json')).size, 0) + fs.statSync(path.join(DIR_FICHAS, 'manifest.json')).size;
console.log('Tamano total de app/datos/fichas:', (tam / 1e6).toFixed(3), 'MB');
informe(fichasPorSistema);
