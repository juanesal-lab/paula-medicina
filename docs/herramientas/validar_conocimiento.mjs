#!/usr/bin/env node
// Linter de la base de conocimiento de Paula (reglas duras 1-4 de conocimiento/FORMATO.md).
// Node 22, sin dependencias.
//
// Uso:
//   node docs/herramientas/validar_conocimiento.mjs [--urls] [--v11] [--nbk] [--autotest] [archivo...]
//
// v1.1 (SPEC §12): reconoce la marca " ⚠ sin contrastar", cuenta datos sensibles y no contrastados por archivo,
// y comprueba `verificado:`/`sin_contrastar:` del frontmatter, el sufijo " · leída: <vía> <fecha>" o " · no leída"
// de cada fuente y la bitácora docs/verificacion/<PREFIJO>.tsv. Sin --v11 esas comprobaciones son avisos;
// con --v11 son errores. --nbk compara cada NBKnnnn de Fuentes con el título real de PubMed (E-utilities).
//
// Sin archivos valida los 23 archivos esperados y cualquier otro conocimiento/**/*.md
// (salvo INDICE.md y FORMATO.md). Los que no existen se informan como "no existe" y se sigue.
// Código de salida: 1 si hay errores (incluye archivos que faltan), 0 si no.

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------- constantes
const ARCHIVOS = {
  'conocimiento/basicas/anatomia.md': 'ANAT',
  'conocimiento/basicas/fisiologia.md': 'FISIO',
  'conocimiento/basicas/bioquimica.md': 'BIOQ',
  'conocimiento/basicas/farmacologia.md': 'FARMA',
  'conocimiento/clinica/semiologia.md': 'SEMIO',
  'conocimiento/interna/cardiologia.md': 'CARD',
  'conocimiento/interna/neumologia.md': 'NEUMO',
  'conocimiento/interna/nefrologia.md': 'NEFRO',
  'conocimiento/interna/gastroenterologia.md': 'GASTRO',
  'conocimiento/interna/endocrinologia.md': 'ENDO',
  'conocimiento/interna/hematologia.md': 'HEMATO',
  'conocimiento/interna/reumatologia.md': 'REUMA',
  'conocimiento/interna/infectologia.md': 'INFECTO',
  'conocimiento/cirugia/cirugia-general.md': 'CIRUG',
  'conocimiento/cirugia/trauma.md': 'TRAUMA',
  'conocimiento/urgencias/urgencias.md': 'URG',
  'conocimiento/pediatria/pediatria.md': 'PEDIA',
  'conocimiento/gineco-obstetricia/ginecologia.md': 'GINE',
  'conocimiento/gineco-obstetricia/obstetricia.md': 'OBST',
  'conocimiento/neurologia/neurologia.md': 'NEURO',
  'conocimiento/psiquiatria/psiquiatria.md': 'PSIQ',
  'conocimiento/dermatologia/dermatologia.md': 'DERMA',
  'conocimiento/salud-publica/salud-publica.md': 'SALUDP',
};

const DOMINIOS = [
  'ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov',
  'who.int', 'iris.who.int', 'paho.org', 'iris.paho.org',
  'cdc.gov', 'nice.org.uk', 'msdmanuals.com',
  'minsalud.gov.co', 'gpc.minsalud.gov.co', 'iets.org.co', 'ins.gov.co',
  'openstax.org', 'medlineplus.gov', 'cochranelibrary.com',
  'kdigo.org', 'goldcopd.org', 'ginasthma.org', 'diabetesjournals.org', 'ahajournals.org',
  'escardio.org', 'idsociety.org', 'rcog.org.uk', 'figo.org', 'aap.org', 'acog.org',
  'surgicalcriticalcare.net', 'sccm.org', 'facs.org',
];

const ETIQUETAS_CASO = [
  'Presentación', 'Diagnóstico diferencial', 'Estudios', 'Manejo', 'Perlas', 'Errores típicos', 'Fuente',
];

const MIN_TEMAS = 10;
const MIN_CASOS = 4;
const MIN_BYTES = 20 * 1024;
const MAX_BYTES = 70 * 1024;

// Dato sensible: número con unidad, o un operador de comparación junto a un número.
const UNIDADES_ALFA = 'mcg|mg|µg|UI|mEq|mmol|mmHg|kg|mL|lpm|días|semanas|años|cm|mm|puntos|g|h';
const RE_SENSIBLE = new RegExp(
  '\\d(?:[.,]\\d+)?\\s*(?:' +
    '(?:' + UNIDADES_ALFA + ')(?![A-Za-zÁÉÍÓÚáéíóúñÑµ])' + // unidades con letras (h y g sin letra detrás)
    '|U/|L/|/min|%|°C|x10' +
    ')' +
    '|[≥≤><]=?\\s*\\d',
);
const RE_FN = /\[F(\d+)\]/g;
// v1.1: marca de dato no contrastado (al final de la línea) y sufijo de lectura de cada fuente.
const MARCA = '⚠ sin contrastar';
const RE_MARCA_FIN = /\s⚠ sin contrastar\s*$/;
const VIAS = ['statpearls-oa', 'pubmed-resumen', 'pmc-efetch', 'bookshelf-oa', 'pdf', 'html'];
const RE_LEIDA = new RegExp('\\s·\\s(?:leída:\\s*(' + VIAS.join('|') + ')\\s+(\\d{4}-\\d{2}-\\d{2})|no leída)\\s*$');
const COLUMNAS_TSV = ['id_seccion', 'linea', 'dato', 'estado', 'fuente', 'via', 'ubicacion_en_fuente'];
const ESTADOS_TSV = ['confirmado', 'corregido', 'sin_contrastar'];
const RE_URL = /https?:\/\/[^\s)>\]"']+/g;

// ---------------------------------------------------------------- utilidades
const recorta = (s, n = 100) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const normaliza = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function hostPermitido(host) {
  host = host.toLowerCase();
  return DOMINIOS.some((d) => host === d || host.endsWith('.' + d));
}

function limpiaUrl(u) {
  return u.replace(/[.,;:]+$/, '');
}

// ---------------------------------------------------------------- análisis
function parsea(texto) {
  const lineas = texto.split(/\r?\n/);
  const fm = {};
  let i = 0;
  let tieneFm = false;
  if (lineas[0] && lineas[0].trim() === '---') {
    let fin = -1;
    for (let k = 1; k < lineas.length; k++) {
      if (lineas[k].trim() === '---') { fin = k; break; }
    }
    if (fin > 0) {
      tieneFm = true;
      for (let k = 1; k < fin; k++) {
        const m = lineas[k].match(/^([A-Za-zñÑ_]+):\s*(.*)$/);
        if (m) fm[m[1]] = m[2].replace(/\s+#.*$/, '').trim();
      }
      i = fin + 1;
    }
  }
  return { lineas, fm, tieneFm, inicio: i };
}

/**
 * Valida el texto de un archivo de conocimiento. Devuelve {errores, avisos, stats, fuentes}.
 * Cada hallazgo: {codigo, linea, msg}.
 * opciones.rutaRel: ruta relativa a la raíz (para comprobar archivo/prefijo esperados).
 */
export function validaTexto(texto, opciones = {}) {
  const errores = [];
  const avisos = [];
  const err = (codigo, linea, msg) => errores.push({ codigo, linea, msg });
  const aviso = (codigo, linea, msg) => avisos.push({ codigo, linea, msg });
  // Comprobaciones v1.1: aviso sin --v11, error con --v11.
  const v11 = !!opciones.v11;
  const norma = (codigo, linea, msg) => (v11 ? err : aviso)(codigo, linea, msg);

  const { lineas, fm, tieneFm, inicio } = parsea(texto);
  const bytes = Buffer.byteLength(texto, 'utf8');

  // --- frontmatter
  if (!tieneFm) {
    err('FM', 1, 'falta el frontmatter (--- ... ---)');
  } else {
    for (const k of ['area', 'archivo', 'prefijo', 'actualizado']) {
      if (!fm[k]) err('FM', 1, `frontmatter sin "${k}"`);
    }
    if (fm.actualizado && !/^\d{4}-\d{2}-\d{2}$/.test(fm.actualizado)) {
      err('FM', 1, `"actualizado" debe ser AAAA-MM-DD (es "${fm.actualizado}")`);
    }
    if (fm.prefijo && !/^[A-Z]+$/.test(fm.prefijo)) {
      err('FM', 1, `"prefijo" debe ser MAYÚSCULAS sin guiones (es "${fm.prefijo}")`);
    }
    for (const k of ['temas', 'casos']) {
      if (!fm[k]) aviso('FM', 1, `frontmatter sin la lista "${k}"`);
    }
    if (!fm.verificado) norma('VER', 1, 'frontmatter sin "verificado: AAAA-MM-DD"');
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.verificado)) norma('VER', 1, `"verificado" debe ser AAAA-MM-DD (es "${fm.verificado}")`);
    const rel = opciones.rutaRel;
    if (rel && ARCHIVOS[rel]) {
      if (fm.prefijo && fm.prefijo !== ARCHIVOS[rel]) {
        err('FM', 1, `prefijo "${fm.prefijo}" no coincide con el esperado "${ARCHIVOS[rel]}" para ${rel}`);
      }
      if (fm.archivo && fm.archivo !== rel) {
        err('FM', 1, `"archivo" dice "${fm.archivo}" pero el archivo está en "${rel}"`);
      }
    }
  }
  const prefijo = fm.prefijo || '';

  // --- secciones
  const secciones = []; // {tipo, id, titulo, linea, ini, fin}
  let indiceIni = -1, indiceFin = -1, fuentesIni = -1;
  const encab = [];
  for (let k = inicio; k < lineas.length; k++) {
    if (/^## /.test(lineas[k])) encab.push(k);
  }
  for (let n = 0; n < encab.length; n++) {
    const k = encab[n];
    const fin = n + 1 < encab.length ? encab[n + 1] : lineas.length;
    const texto2 = lineas[k].replace(/^## /, '').trim();
    const norm = normaliza(texto2);
    if (norm === 'indice') { indiceIni = k; indiceFin = fin; continue; }
    if (norm === 'fuentes') { fuentesIni = k; secciones.push({ tipo: 'F', ini: k, fin }); continue; }
    const m = lineas[k].match(/^## \[([A-Z]+)-([TC])(\d+)\]\s*(.*)$/);
    if (m) {
      const [, p, t, num, titulo] = m;
      if (prefijo && p !== prefijo) err('ID', k + 1, `el ID usa el prefijo "${p}" pero el frontmatter dice "${prefijo}"`);
      if (num.length !== 2) err('ID', k + 1, `el número del ID debe tener dos dígitos: [${p}-${t}${num}]`);
      secciones.push({ tipo: t, id: `${p}-${t}${num}`, num: parseInt(num, 10), titulo, ini: k, fin, linea: k + 1 });
    } else if (/^## \[/.test(lineas[k])) {
      err('ID', k + 1, `encabezado con ID mal formado: ${recorta(lineas[k], 60)}`);
    }
    // otros "## " libres se toleran
  }

  const temas = secciones.filter((s) => s.tipo === 'T');
  const casos = secciones.filter((s) => s.tipo === 'C');

  // Regla 1: IDs únicos y consecutivos
  for (const [nombre, lista] of [['T', temas], ['C', casos]]) {
    const vistos = new Set();
    lista.forEach((s, idx) => {
      if (vistos.has(s.id)) err('ID', s.linea, `ID repetido: [${s.id}]`);
      vistos.add(s.id);
      const esperado = idx + 1;
      if (s.num !== esperado && !vistos.has('__saltado' + nombre)) {
        vistos.add('__saltado' + nombre);
        const prev = idx === 0 ? '(primero)' : `[${prefijo}-${nombre}${String(idx).padStart(2, '0')}]`;
        err('ID', s.linea, `IDs no consecutivos: se esperaba ${nombre}${String(esperado).padStart(2, '0')} y está [${s.id}] tras ${prev}`);
      }
    });
  }

  // Índice frente a encabezados
  if (indiceIni < 0) {
    err('IDX', 1, 'falta la sección "## Índice"');
  } else {
    const enIndice = [];
    for (let k = indiceIni + 1; k < indiceFin; k++) {
      const l = lineas[k];
      if (!/^\s*[-*]\s/.test(l)) continue;
      const m = l.match(/^\s*[-*]\s+\[([A-Z]+-[TC]\d+)\]/);
      if (m) enIndice.push({ id: m[1], linea: k + 1 });
      else err('IDX', k + 1, `entrada del índice sin ID: ${recorta(l, 60)}`);
    }
    const setIdx = new Set(enIndice.map((e) => e.id));
    const setHdr = new Set([...temas, ...casos].map((s) => s.id));
    if (setIdx.size !== enIndice.length) err('IDX', indiceIni + 1, 'hay IDs repetidos en el índice');
    for (const s of [...temas, ...casos]) {
      if (!setIdx.has(s.id)) err('IDX', s.linea, `[${s.id}] tiene encabezado pero no está en el Índice`);
    }
    for (const e of enIndice) {
      if (!setHdr.has(e.id)) err('IDX', e.linea, `[${e.id}] está en el Índice pero no tiene encabezado "## "`);
    }
  }

  // Regla 2: etiquetas de cada caso
  for (const c of casos) {
    const hallados = [];
    for (let k = c.ini + 1; k < c.fin; k++) {
      const m = lineas[k].match(/^\*\*([^*:]+):\*\*/);
      if (m && ETIQUETAS_CASO.includes(m[1].trim())) hallados.push(m[1].trim());
    }
    const faltan = ETIQUETAS_CASO.filter((e) => !hallados.includes(e));
    if (faltan.length) {
      err('CASO', c.linea, `[${c.id}] faltan etiquetas: ${faltan.join(', ')}`);
    } else if (hallados.length !== ETIQUETAS_CASO.length) {
      err('CASO', c.linea, `[${c.id}] hay etiquetas repetidas (${hallados.join(' > ')})`);
    } else if (hallados.some((e, idx) => e !== ETIQUETAS_CASO[idx])) {
      err('CASO', c.linea, `[${c.id}] etiquetas fuera de orden (${hallados.join(' > ')}); orden: ${ETIQUETAS_CASO.join(' > ')}`);
    }
  }

  // Fuentes definidas
  const fuentes = new Map(); // n -> {url[], linea}
  if (fuentesIni < 0) {
    err('FN', 1, 'falta la sección "## Fuentes"');
  } else {
    const f = secciones.find((s) => s.tipo === 'F');
    for (let k = f.ini + 1; k < f.fin; k++) {
      const m = lineas[k].match(/^\s*[-*]\s+\[F(\d+)\]\s*(.*)$/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (fuentes.has(n)) err('FN', k + 1, `fuente [F${n}] definida dos veces`);
      const urls = (m[2].match(RE_URL) || []).map(limpiaUrl);
      const ml = m[2].match(RE_LEIDA);
      const titulo = m[2].split(/\s[—–]\s/)[0].trim();
      const nbk = (urls.join(' ').match(/NBK\d+/) || [])[0] || null;
      fuentes.set(n, { urls, linea: k + 1, leida: ml ? ml[0].includes('no leída') ? false : true : null, via: ml && ml[1] ? ml[1] : null, titulo, nbk });
      if (!ml) norma('LEIDA', k + 1, `[F${n}] no termina en " · leída: <vía> <AAAA-MM-DD>" ni en " · no leída" (vías: ${VIAS.join(', ')})`);
      if (!urls.length) err('URL', k + 1, `[F${n}] no tiene URL https://`);
      for (const u of urls) {
        if (!u.startsWith('https://')) { err('URL', k + 1, `[F${n}] URL sin https: ${recorta(u, 70)}`); continue; }
        let host = '';
        try { host = new URL(u).hostname; } catch { err('URL', k + 1, `[F${n}] URL inválida: ${recorta(u, 70)}`); continue; }
        if (!hostPermitido(host)) err('URL', k + 1, `[F${n}] dominio fuera de la lista blanca: ${host}`);
      }
    }
    if (fuentes.size === 0) err('FN', f.ini + 1, 'la sección Fuentes no define ninguna fuente [Fn]');
  }

  // Regla 3 (datos sensibles con [Fn]) y 4 ([Fn] definidos; URLs en el cuerpo)
  const citadas = new Set();
  const fIni = fuentesIni >= 0 ? fuentesIni : Infinity;
  const fFin = fuentesIni >= 0 ? secciones.find((s) => s.tipo === 'F').fin : Infinity;
  let enPresentacion = false;
  let sensibles = 0, sensiblesSinContrastar = 0, marcas = 0;
  for (let k = inicio; k < lineas.length; k++) {
    const l = lineas[k];
    const enFuentes = k >= fIni && k < fFin;
    const enIndice = indiceIni >= 0 && k >= indiceIni && k < indiceFin;

    if (/^## /.test(l)) enPresentacion = false;
    else if (/^\*\*[^*:]+:\*\*/.test(l)) enPresentacion = l.startsWith('**Presentación:**');

    if (enFuentes || enIndice || !l.trim()) continue;

    const marcada = RE_MARCA_FIN.test(l);
    if (marcada) marcas++;
    else if (l.includes(MARCA)) aviso('MARCA', k + 1, `la marca "${MARCA}" debe ir al final de la línea: ${recorta(l.trim(), 70)}`);

    // [Fn] citados
    for (const m of l.matchAll(RE_FN)) {
      const n = parseInt(m[1], 10);
      citadas.add(n);
      if (!fuentes.has(n)) err('FN', k + 1, `[F${n}] citado pero no definido en ## Fuentes`);
    }
    // URLs sueltas en el cuerpo
    for (const u0 of l.match(RE_URL) || []) {
      const u = limpiaUrl(u0);
      try {
        const h = new URL(u);
        if (h.protocol !== 'https:') err('URL', k + 1, `URL sin https en el cuerpo: ${recorta(u, 70)}`);
        else if (!hostPermitido(h.hostname)) err('URL', k + 1, `URL fuera de la lista blanca en el cuerpo: ${h.hostname}`);
      } catch { err('URL', k + 1, `URL inválida en el cuerpo: ${recorta(u, 70)}`); }
    }
    // Datos sensibles
    if (/^## /.test(l)) continue;
    if (enPresentacion) continue;
    if (l.includes('(ejercicio)')) continue;
    if (RE_SENSIBLE.test(l)) {
      sensibles++;
      if (marcada) sensiblesSinContrastar++;
      const citas = [...l.matchAll(RE_FN)].map((m) => parseInt(m[1], 10));
      // Con la marca ⚠ la línea sigue necesitando [Fn] (dónde buscar).
      if (!citas.length) {
        err('DATO', k + 1, `dato sensible sin [Fn] en la misma línea${marcada ? ' (con ⚠ también necesita [Fn]: dónde buscar)' : ''}: ${recorta(l.trim(), 90)}`);
      } else if (!marcada && citas.every((n) => fuentes.get(n) && fuentes.get(n).leida === false)) {
        norma('NOLEIDA', k + 1, `dato sensible que cita solo fuentes "no leída" y no lleva "${MARCA}": no puede estar confirmado: ${recorta(l.trim(), 80)}`);
      }
    }
  }
  for (const [n, f] of fuentes) {
    if (!citadas.has(n)) aviso('FN', f.linea, `[F${n}] está definida pero nadie la cita`);
  }

  // Frontmatter frente a las marcas contadas (v1.1)
  if (tieneFm) {
    if (fm.sin_contrastar === undefined || fm.sin_contrastar === '') {
      norma('SC', 1, `frontmatter sin "sin_contrastar: <n>" (hay ${marcas} marca(s) ${MARCA})`);
    } else if (!/^\d+$/.test(fm.sin_contrastar) || parseInt(fm.sin_contrastar, 10) !== marcas) {
      norma('SC', 1, `"sin_contrastar: ${fm.sin_contrastar}" no coincide con las marcas ${MARCA} del archivo (${marcas})`);
    }
  }

  // Bitácora docs/verificacion/<prefijo>.tsv (solo con --v11 y si quien llama la aporta: texto, o null si no existe)
  if (v11 && opciones.tsvTexto !== undefined) {
    if (opciones.tsvTexto === null) {
      err('TSV', 1, `no existe la bitácora docs/verificacion/${prefijo.toUpperCase() || '<PREFIJO>'}.tsv`);
    } else {
      const filas = opciones.tsvTexto.split(/\r?\n/).filter((x) => x.trim());
      const cab = (filas[0] || '').split('\t').map((c) => c.replace(/\(.*?\)/g, '').trim().toLowerCase());
      if (cab.length < 7 || COLUMNAS_TSV.some((c, i) => cab[i] !== c)) {
        err('TSV', 1, `cabecera de la bitácora incorrecta; debe ser: ${COLUMNAS_TSV.join(' | ')} (separadas por tabulador)`);
      } else {
        let sc = 0;
        for (const f of filas.slice(1)) {
          const est = (f.split('\t')[3] || '').trim().toLowerCase().replace(/ /g, '_');
          if (!ESTADOS_TSV.includes(est)) err('TSV', 1, `estado "${est}" no válido en la bitácora (${ESTADOS_TSV.join(', ')}): ${recorta(f, 60)}`);
          if (est === 'sin_contrastar') sc++;
        }
        if (sc !== marcas) err('TSV', 1, `la bitácora tiene ${sc} fila(s) sin_contrastar y el archivo ${marcas} marca(s) ${MARCA}`);
      }
    }
  }

  // Mínimos
  if (temas.length < MIN_TEMAS) err('MIN', 1, `solo ${temas.length} temas (mínimo ${MIN_TEMAS})`);
  if (casos.length < MIN_CASOS) err('MIN', 1, `solo ${casos.length} casos (mínimo ${MIN_CASOS})`);
  if (bytes < MIN_BYTES) err('TAM', 1, `tamaño ${(bytes / 1024).toFixed(1)} KB por debajo del mínimo de ${MIN_BYTES / 1024} KB`);
  if (bytes > MAX_BYTES) err('TAM', 1, `tamaño ${(bytes / 1024).toFixed(1)} KB por encima del máximo de ${MAX_BYTES / 1024} KB`);

  return {
    errores, avisos, fuentes, fm,
    stats: { temas: temas.length, casos: casos.length, kb: bytes / 1024, fuentes: fuentes.size, sensibles, sensiblesSinContrastar, marcas },
  };
}

// ---------------------------------------------------------------- autotest
const CAB_TSV = COLUMNAS_TSV.join('\t');

function textoValido() {
  const P = 'TST';
  const temas = Array.from({ length: 10 }, (_, i) => `${P}-T${String(i + 1).padStart(2, '0')}`);
  const casos = Array.from({ length: 4 }, (_, i) => `${P}-C${String(i + 1).padStart(2, '0')}`);
  const relleno = 'Explicación de relleno para alcanzar el tamaño mínimo del archivo de prueba, sin cifras ni unidades. '.repeat(26);
  const out = [];
  out.push('---', 'area: Prueba', 'archivo: conocimiento/prueba/prueba.md', `prefijo: ${P}`, 'actualizado: 2026-11-13',
    'verificado: 2026-11-13', 'sin_contrastar: 0',
    'temas: [uno, dos]', 'casos: [uno, dos]', '---', '# Prueba', '', '## Índice');
  temas.forEach((id, i) => out.push(`- [${id}] Tema ${i + 1}`));
  casos.forEach((id, i) => out.push(`- [${id}] Caso: ejemplo ${i + 1}`));
  out.push('');
  temas.forEach((id, i) => {
    out.push(`## [${id}] Tema ${i + 1}`, '**Palabras clave:** prueba, ejemplo', '**Lo esencial:**',
      `- ${relleno}`,
      '**Manejo:** administrar 500 mg por vía oral cada 8 h durante 7 días [F1]',
      '- Punto de corte de ejemplo ≥ 140 mmHg [F1]',
      '- Ejercicio de cálculo: 80 kg x 15 mg/kg = 1200 mg (ejercicio)',
      '**Perlas de examen:** pensar primero en el mecanismo.', '');
  });
  casos.forEach((id, i) => {
    out.push(`## [${id}] Caso: ejemplo ${i + 1}`,
      '**Presentación:** hombre de 54 años, TA 150/95 mmHg, FC 110 lpm, T 38,5 °C, SatO2 91 %.',
      '**Diagnóstico diferencial:** tres opciones con su porqué.',
      '**Estudios:** pedir primero lo que cambia la conducta.',
      '**Manejo:** administrar 40 mg por vía intravenosa una sola vez [F1]',
      '**Perlas:** razonar antes de medicar.',
      '**Errores típicos:** olvidar el contexto.',
      '**Fuente:** [F1]', '');
  });
  out.push('## Fuentes',
    '- [F1] Tratamiento de ejemplo — StatPearls, 2024. https://www.ncbi.nlm.nih.gov/books/NBK430685/ (consultado 2026-11-13) · leída: statpearls-oa 2026-11-13',
    '- [F2] Guía sin leer — OMS, 2020. https://www.who.int/publications/i/item/ejemplo (consultado 2026-11-13) · no leída');
  return out.join('\n') + '\n';
}

export function autotest(verbose = true) {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'paula-lint-'));
  const pruebas = [];
  try {
    const A = textoValido();
    const L1 = '- Punto de corte de ejemplo ≥ 140 mmHg [F1]';
    // B: dato sensible sin [Fn] y etiquetas del caso fuera de orden
    let B = A.replace(L1, '- Punto de corte de ejemplo ≥ 140 mmHg');
    B = B.replace('**Diagnóstico diferencial:** tres opciones con su porqué.\n**Estudios:** pedir primero lo que cambia la conducta.',
      '**Estudios:** pedir primero lo que cambia la conducta.\n**Diagnóstico diferencial:** tres opciones con su porqué.');
    // C: ID salteado, índice distinto, [F9] sin definir y fuente fuera de la lista blanca
    let C = A.replace('## [TST-T03] Tema 3', '## [TST-T04] Tema 3 repetido');
    C = C.replace(L1, '- Punto de corte de ejemplo ≥ 140 mmHg [F9]');
    C += '- [F3] Artículo enciclopédico — Wikipedia. https://es.wikipedia.org/wiki/Hipertension · leída: html 2026-11-13\n';
    // D: una línea marcada ⚠ con [Fn] y frontmatter correcto (1 marca); y una marcada sin [Fn]
    const MD = L1 + ' ⚠ sin contrastar';
    const D = A.replace(L1, MD).replace('sin_contrastar: 0', 'sin_contrastar: 1');
    const D2 = D.replace(MD, '- Punto de corte de ejemplo ≥ 140 mmHg ⚠ sin contrastar');
    // E: el frontmatter dice 0 pero hay una marca (discrepancia)
    const E = A.replace(L1, MD);
    // F: dato sensible que cita solo la fuente "no leída" y sin ⚠; y el mismo con ⚠
    const F = A.replace(L1, '- Punto de corte de ejemplo ≥ 140 mmHg [F2]');
    const F2 = F.replace('[F2]\n', '[F2] ⚠ sin contrastar\n').replace('sin_contrastar: 0', 'sin_contrastar: 1');
    // G: fuente sin sufijo de lectura y sin "verificado"
    const G = A.replace(' · leída: statpearls-oa 2026-11-13', '').replace('verificado: 2026-11-13\n', '');
    // H: bitácora con distinto número de filas sin_contrastar que de marcas
    const tsvOk = (n) => [CAB_TSV, ...Array.from({ length: n }, () => 'TST-T01\t10\t140 mmHg\tsin_contrastar\tF1\tpubmed-resumen\tsección Diagnóstico'),
      'TST-T02\t20\t500 mg\tconfirmado\tF1\tstatpearls-oa\tsección Treatment'].join('\n');
    const v = { v11: true };
    const datos = [
      { nombre: 'valido.md', texto: A, debe: [], noDebe: ['DATO', 'CASO', 'ID', 'IDX', 'FN', 'URL', 'FM', 'MIN', 'TAM', 'SC', 'VER', 'LEIDA', 'NOLEIDA', 'MARCA'] },
      { nombre: 'valido-v11.md', texto: A, op: { ...v, tsvTexto: tsvOk(0) }, debe: [], noDebe: ['DATO', 'SC', 'VER', 'LEIDA', 'NOLEIDA', 'TSV'] },
      { nombre: 'error-dato-y-caso.md', texto: B, debe: ['DATO', 'CASO'], noDebe: ['URL', 'FM'] },
      { nombre: 'error-id-fuentes.md', texto: C, debe: ['ID', 'IDX', 'FN', 'URL'], noDebe: ['CASO', 'FM'] },
      { nombre: 'marca-con-fn-v11.md', texto: D, op: { ...v, tsvTexto: tsvOk(1) }, debe: [], noDebe: ['DATO', 'SC', 'NOLEIDA', 'TSV', 'MARCA'], marcas: 1 },
      { nombre: 'marca-sin-fn.md', texto: D2, debe: ['DATO'], noDebe: ['SC'] },
      { nombre: 'frontmatter-discrepa-v11.md', texto: E, op: v, debe: ['SC'], noDebe: ['DATO'] },
      { nombre: 'frontmatter-discrepa-aviso.md', texto: E, debe: [], noDebe: ['SC'], avisoDebe: ['SC'] },
      { nombre: 'no-leida-sin-marca-v11.md', texto: F, op: v, debe: ['NOLEIDA'], noDebe: ['DATO'] },
      { nombre: 'no-leida-con-marca-v11.md', texto: F2, op: { ...v, tsvTexto: tsvOk(1) }, debe: [], noDebe: ['NOLEIDA', 'DATO', 'SC', 'TSV'] },
      { nombre: 'fuente-sin-sufijo-y-sin-verificado-v11.md', texto: G, op: v, debe: ['LEIDA', 'VER'], noDebe: ['DATO'] },
      { nombre: 'fuente-sin-sufijo-aviso.md', texto: G, debe: [], noDebe: ['LEIDA', 'VER'], avisoDebe: ['LEIDA', 'VER'] },
      { nombre: 'bitacora-no-coincide-v11.md', texto: D, op: { ...v, tsvTexto: tsvOk(2) }, debe: ['TSV'], noDebe: ['SC'] },
      { nombre: 'bitacora-ausente-v11.md', texto: A, op: { ...v, tsvTexto: null }, debe: ['TSV'], noDebe: ['SC'] },
    ];
    for (const d of datos) {
      const ruta = path.join(dir, d.nombre);
      fs.writeFileSync(ruta, d.texto);
      const r = validaTexto(fs.readFileSync(ruta, 'utf8'), d.op || {});
      const codigos = new Set(r.errores.map((e) => e.codigo));
      const avs = new Set(r.avisos.map((e) => e.codigo));
      const faltan = d.debe.filter((c) => !codigos.has(c));
      const sobran = d.noDebe.filter((c) => codigos.has(c));
      const faltanAv = (d.avisoDebe || []).filter((c) => !avs.has(c));
      const marcasMal = d.marcas !== undefined && r.stats.marcas !== d.marcas;
      const ok = faltan.length === 0 && sobran.length === 0 && faltanAv.length === 0 && !marcasMal;
      pruebas.push({ ...d, ok, codigos: [...codigos], faltan: [...faltan, ...faltanAv.map((c) => 'aviso ' + c), ...(marcasMal ? ['conteo de marcas'] : [])], sobran });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (verbose) {
    console.log('Autotest del linter (archivos temporales en $TMPDIR, ya borrados):');
    for (const p of pruebas) {
      const esperado = p.debe.length ? `debe detectar ${p.debe.join('+')}` : (p.avisoDebe ? `debe avisar ${p.avisoDebe.join('+')} (sin --v11)` : 'debe salir limpio');
      console.log(`  ${p.ok ? 'OK ' : 'FALLA'} ${p.nombre}: ${esperado}; detectó [${p.codigos.join(', ') || 'nada'}]` +
        (p.faltan.length ? ` | no detectó: ${p.faltan.join(', ')}` : '') +
        (p.sobran.length ? ` | falsos positivos: ${p.sobran.join(', ')}` : ''));
    }
    console.log(`  Resultado: ${pruebas.filter((p) => p.ok).length}/${pruebas.length}`);
  }
  autotest.resumen = `${pruebas.filter((p) => p.ok).length}/${pruebas.length}`;
  return pruebas.every((p) => p.ok);
}

// ---------------------------------------------------------------- URLs en vivo
async function revisaUrl(url) {
  const opts = { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'validar-conocimiento/1.0 (verificacion de enlaces)' } };
  try {
    let r = await fetch(url, { ...opts, method: 'HEAD' });
    if (r.status >= 400) {
      r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000), method: 'GET' });
    }
    return { url, status: r.status };
  } catch {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000), method: 'GET' });
      return { url, status: r.status };
    } catch (e) {
      return { url, status: 0, error: e?.cause?.code || e?.name || String(e) };
    }
  }
}

async function revisaUrls(urls, concurrencia = 4) {
  const cola = [...urls];
  const res = [];
  const trabajador = async () => {
    while (cola.length) res.push(await revisaUrl(cola.shift()));
  };
  await Promise.all(Array.from({ length: concurrencia }, trabajador));
  return res;
}

// ---------------------------------------------------------------- NBK (E-utilities)
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ultimaPeticion = 0;

// GET con curl (respeta HTTP_PROXY del entorno), máximo 3 peticiones por segundo y timeout de 15 s.
async function getEutils(url) {
  const espera = 340 - (Date.now() - ultimaPeticion);
  if (espera > 0) await dormir(espera);
  ultimaPeticion = Date.now();
  const salida = execFileSync('curl', ['-s', '-S', '-L', '-m', '15', '-A', 'validar-conocimiento/1.1 (verificacion NBK)', url],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(salida);
}

const normTitulo = (t) => normaliza(t).replace(/[^a-z0-9]+/g, ' ').trim();
function bigramas(t) {
  const x = t.replace(/ /g, '');
  const m = new Map();
  for (let i = 0; i < x.length - 1; i++) { const g = x.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); }
  return m;
}

/** Similitud normalizada entre dos títulos: 1 si uno incluye al otro; si no, coeficiente de Dice sobre bigramas de caracteres. */
export function similitudTitulos(a, b) {
  const x = normTitulo(a), y = normTitulo(b);
  if (!x || !y) return 0;
  if (x.includes(y) || y.includes(x)) return 1;
  const ga = bigramas(x), gb = bigramas(y);
  let comun = 0, na = 0, nb = 0;
  for (const [g, n] of ga) { na += n; if (gb.has(g)) comun += Math.min(n, gb.get(g)); }
  for (const n of gb.values()) nb += n;
  return na + nb ? (2 * comun) / (na + nb) : 0;
}

// Respaldo para documentos de Bookshelf que no están indexados en PubMed (p. ej. guías OMS espejadas):
// lista oficial del subconjunto OA de Bookshelf (file_list.csv, ~2 MB), descargada una vez a $TMPDIR.
let listaOA = null;
function tituloEnListaOA(nbk) {
  if (listaOA === null) {
    listaOA = new Map();
    const ruta = path.join(process.env.TMPDIR || os.tmpdir(), 'litarch-file_list.csv');
    try {
      if (!fs.existsSync(ruta)) execFileSync('curl', ['-s', '-S', '-L', '-m', '120', '-A', 'validar-conocimiento/1.1 (verificacion NBK)', '-o', ruta, 'https://ftp.ncbi.nlm.nih.gov/pub/litarch/file_list.csv'], { stdio: 'ignore' });
      for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
        const m = linea.match(/^[^,]*,("(?:[^"]|"")*"|[^,]*),.*?,(NBK\d+)(?:,|$)/);
        if (m) listaOA.set(m[2], m[1].replace(/^"|"$/g, '').replace(/""/g, '"'));
      }
    } catch { /* sin lista: se queda vacía */ }
  }
  return listaOA.get(nbk) || null;
}

async function tituloDeNbk(nbk, cache, guardaCache) {
  if (cache[nbk] && cache[nbk].titulo) return cache[nbk];
  const b = await getEutils(`${EUTILS}esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(nbk)}`);
  const ids = b?.esearchresult?.idlist || [];
  let res;
  if (!ids.length) res = { pmid: null, titulo: null };
  else {
    const r = await getEutils(`${EUTILS}esummary.fcgi?db=pubmed&retmode=json&id=${ids[0]}`);
    const d = r?.result?.[ids[0]] || {};
    // Algunos registros de libro traen el título en booktitle y el campo title vacío.
    res = { pmid: ids[0], titulo: d.title || d.booktitle || null };
  }
  if (!res.titulo) {
    const t = tituloEnListaOA(nbk);
    if (t) res = { pmid: null, titulo: t, origen: 'bookshelf-oa' };
  }
  cache[nbk] = res;
  guardaCache();
  return res;
}

/** items: [{rel, F, nbk, titulo, linea}]. Devuelve las discrepancias. */
async function revisaNbk(items) {
  const rutaCache = path.join(process.env.TMPDIR || os.tmpdir(), 'nbk-cache.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(rutaCache, 'utf8')); } catch { /* sin caché */ }
  const guardaCache = () => { try { fs.writeFileSync(rutaCache, JSON.stringify(cache, null, 1)); } catch { /* sin caché */ } };
  const malas = [];
  let sinRespuesta = 0;
  console.log(`Verificando ${items.length} NBK contra PubMed (E-utilities, 3 peticiones/s, timeout 15 s, caché ${rutaCache})...`);
  for (const it of items) {
    let real;
    try { real = await tituloDeNbk(it.nbk, cache, guardaCache); } catch (e) {
      sinRespuesta++;
      console.log(`  [aviso] ${it.rel} L${it.linea} [F${it.F}] ${it.nbk}: sin respuesta de E-utilities (${String(e.message).split('\n')[0].slice(0, 80)})`);
      continue;
    }
    if (!real.titulo) {
      malas.push(it);
      console.log(`  [ERROR] ${it.rel} L${it.linea} [F${it.F}] ${it.nbk}: ni PubMed ni la lista OA de Bookshelf conocen ese NBK (citado: "${it.titulo}")`);
      continue;
    }
    const sim = similitudTitulos(it.titulo, real.titulo);
    if (sim < 0.6) {
      malas.push(it);
      console.log(`  [ERROR] ${it.rel} L${it.linea} [F${it.F}] ${it.nbk}: título distinto (similitud ${sim.toFixed(2)})\n          citado: ${it.titulo}\n          real:   ${real.titulo} (${real.pmid ? 'PMID ' + real.pmid : 'lista OA de Bookshelf'})`);
    }
  }
  console.log(`NBK: ${items.length} revisados, ${malas.length} con discrepancia, ${sinRespuesta} sin respuesta.\n`);
  return malas;
}

// ---------------------------------------------------------------- CLI
function listaMd(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listaMd(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

async function main() {
  const args = process.argv.slice(2);
  const conUrls = args.includes('--urls');
  const v11 = args.includes('--v11');
  const conNbk = args.includes('--nbk');
  const itemsNbk = [];
  const soloAuto = args.includes('--autotest');
  const pedidos = args.filter((a) => !a.startsWith('--'));
  let errorTotal = 0;

  // El autotest corre siempre (resumido salvo con --autotest).
  const autoOk = autotest(soloAuto);
  if (!soloAuto) console.log(`Autotest del linter: ${autoOk ? `OK (${autotest.resumen})` : 'FALLA (ejecuta con --autotest para ver el detalle)'}${v11 ? ' · modo --v11: las comprobaciones v1.1 son errores' : ' · sin --v11: las comprobaciones v1.1 son avisos'}\n`);
  if (!autoOk) errorTotal++;
  if (soloAuto) process.exit(autoOk ? 0 : 1);

  const objetivos = []; // {rel, abs}
  if (pedidos.length) {
    for (const p of pedidos) {
      let abs = path.resolve(process.cwd(), p);
      if (!fs.existsSync(abs)) abs = path.resolve(RAIZ, p);
      objetivos.push({ rel: path.relative(RAIZ, abs).split(path.sep).join('/'), abs });
    }
  } else {
    const vistos = new Set();
    for (const rel of Object.keys(ARCHIVOS)) {
      objetivos.push({ rel, abs: path.join(RAIZ, rel) });
      vistos.add(rel);
    }
    for (const abs of listaMd(path.join(RAIZ, 'conocimiento')).sort()) {
      const rel = path.relative(RAIZ, abs).split(path.sep).join('/');
      if (vistos.has(rel)) continue;
      if (/\/(INDICE|FORMATO)\.md$/.test(rel)) continue;
      objetivos.push({ rel, abs });
    }
  }

  let validados = 0, ausentes = 0, conErrores = 0;
  const urlsPorArchivo = [];
  for (const o of objetivos) {
    if (/(^|\/)(INDICE|FORMATO)\.md$/.test(o.rel)) {
      console.log(`${o.rel}\n  (se omite: no es un archivo de contenido)\n`);
      continue;
    }
    if (!fs.existsSync(o.abs)) {
      console.log(`${o.rel}\n  [ERROR] no existe\n`);
      ausentes++;
      errorTotal++;
      continue;
    }
    let texto;
    try { texto = fs.readFileSync(o.abs, 'utf8'); } catch (e) {
      console.log(`${o.rel}\n  [ERROR] no se pudo leer: ${e.message}\n`);
      errorTotal++;
      continue;
    }
    validados++;
    let r;
    let tsvTexto;
    if (v11) {
      // La bitácora se busca por el prefijo del frontmatter (en mayúsculas o minúsculas).
      const pref = (texto.match(/^prefijo:\s*([A-Z]+)/m) || [])[1] || ARCHIVOS[o.rel] || '';
      // Búsqueda insensible a mayúsculas real (listando la carpeta), para que funcione igual en macOS y Linux.
      // Nombre canónico: el prefijo en MAYÚSCULAS (p. ej. docs/verificacion/ANAT.tsv).
      const dirV = path.join(RAIZ, 'docs', 'verificacion');
      const nombres = fs.existsSync(dirV) ? fs.readdirSync(dirV) : [];
      const elegido = pref ? nombres.find((n) => n.toLowerCase() === pref.toLowerCase() + '.tsv') : null;
      const hallado = elegido ? path.join(dirV, elegido) : null;
      if (elegido && elegido !== pref.toUpperCase() + '.tsv') console.warn(`  aviso: la bitácora ${elegido} debería llamarse ${pref.toUpperCase()}.tsv`);
      tsvTexto = hallado ? fs.readFileSync(hallado, 'utf8') : null;
    }
    try { r = validaTexto(texto, { rutaRel: o.rel, v11, tsvTexto }); } catch (e) {
      console.log(`${o.rel}\n  [ERROR] fallo interno del linter: ${e.message}\n`);
      errorTotal++;
      continue;
    }
    console.log(o.rel);
    for (const e of r.errores) console.log(`  [ERROR] ${e.codigo} L${e.linea}: ${e.msg}`);
    for (const a of r.avisos) console.log(`  [aviso] ${a.codigo} L${a.linea}: ${a.msg}`);
    const s = r.stats;
    console.log(`  datos sensibles: ${s.sensibles} (${s.sensiblesSinContrastar} sin contrastar) · marcas ⚠: ${s.marcas}`);
    console.log(`  ${r.errores.length ? r.errores.length + ' error(es)' : 'OK'} · ${s.temas} temas · ${s.casos} casos · ${s.kb.toFixed(1)} KB · ${s.fuentes} fuentes\n`);
    if (r.errores.length) conErrores++;
    errorTotal += r.errores.length;
    if (conNbk) {
      for (const [n, f] of r.fuentes) if (f.nbk) itemsNbk.push({ rel: o.rel, F: n, nbk: f.nbk, titulo: f.titulo, linea: f.linea });
    }
    if (conUrls) {
      const urls = [...new Set([...r.fuentes.values()].flatMap((f) => f.urls).filter((u) => u.startsWith('http')))];
      urlsPorArchivo.push({ rel: o.rel, urls });
    }
  }

  if (conUrls) {
    const todas = [...new Set(urlsPorArchivo.flatMap((u) => u.urls))];
    console.log(`Verificando ${todas.length} URL (HEAD, con GET de respaldo; timeout 15 s; concurrencia 4)...`);
    const res = await revisaUrls(todas);
    const porUrl = new Map(res.map((r) => [r.url, r]));
    let malas = 0;
    for (const { rel, urls } of urlsPorArchivo) {
      if (!urls.length) continue;
      console.log(rel);
      for (const u of urls) {
        const r = porUrl.get(u);
        const bloqueo = [401, 403, 429, 999].includes(r.status);
        const ok = r.status >= 200 && r.status < 400;
        const marca = ok ? 'ok   ' : bloqueo ? 'aviso' : 'ERROR';
        console.log(`  [${marca}] ${r.status || 'sin respuesta'}${r.error ? ' (' + r.error + ')' : ''} ${u}`);
        if (!ok && !bloqueo) { malas++; errorTotal++; }
        if (bloqueo) console.log('          el sitio rechaza clientes automáticos: confirma el enlace a mano');
      }
      console.log('');
    }
    console.log(`URL: ${todas.length} revisadas, ${malas} con error.\n`);
  }

  if (conNbk) {
    const malas = await revisaNbk(itemsNbk);
    errorTotal += malas.length;
  }

  console.log(`Resumen: ${validados} archivo(s) validado(s), ${ausentes} ausente(s), ${conErrores} con errores. ` +
    (errorTotal ? 'HAY ERRORES.' : 'Sin errores.'));
  process.exit(errorTotal ? 1 : 0);
}

// Solo corre el CLI si se ejecuta directamente (no al importarlo).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('Error inesperado:', e); process.exit(2); });
}
