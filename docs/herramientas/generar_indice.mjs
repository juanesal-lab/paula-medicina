#!/usr/bin/env node
// Regenera la parte automática de conocimiento/INDICE.md (entre <!-- AUTO:INICIO --> y <!-- AUTO:FIN -->)
// con los IDs y títulos de cada archivo de conocimiento que exista. Idempotente: si no cambia nada, no escribe.
// v1.1: por archivo cuenta los datos marcados " ⚠ sin contrastar" y añade la línea global
// "**Datos pendientes de verificar:** N" (la skill la lee para el menú).
// Uso: node docs/herramientas/generar_indice.mjs
// Node 22, sin dependencias.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INDICE = path.join(RAIZ, 'conocimiento', 'INDICE.md');
const INICIO = '<!-- AUTO:INICIO -->';
const FIN = '<!-- AUTO:FIN -->';

// Orden y área de los 23 archivos del SPEC (§4). Los demás .md se añaden al final por orden alfabético.
const ARCHIVOS = [
  ['conocimiento/basicas/anatomia.md', 'Anatomía'],
  ['conocimiento/basicas/fisiologia.md', 'Fisiología'],
  ['conocimiento/basicas/bioquimica.md', 'Bioquímica'],
  ['conocimiento/basicas/farmacologia.md', 'Farmacología'],
  ['conocimiento/clinica/semiologia.md', 'Semiología'],
  ['conocimiento/interna/cardiologia.md', 'Cardiología'],
  ['conocimiento/interna/neumologia.md', 'Neumología'],
  ['conocimiento/interna/nefrologia.md', 'Nefrología'],
  ['conocimiento/interna/gastroenterologia.md', 'Gastroenterología'],
  ['conocimiento/interna/endocrinologia.md', 'Endocrinología'],
  ['conocimiento/interna/hematologia.md', 'Hematología'],
  ['conocimiento/interna/reumatologia.md', 'Reumatología'],
  ['conocimiento/interna/infectologia.md', 'Infectología'],
  ['conocimiento/cirugia/cirugia-general.md', 'Cirugía general'],
  ['conocimiento/cirugia/trauma.md', 'Trauma'],
  ['conocimiento/urgencias/urgencias.md', 'Urgencias'],
  ['conocimiento/pediatria/pediatria.md', 'Pediatría'],
  ['conocimiento/gineco-obstetricia/ginecologia.md', 'Ginecología'],
  ['conocimiento/gineco-obstetricia/obstetricia.md', 'Obstetricia'],
  ['conocimiento/neurologia/neurologia.md', 'Neurología'],
  ['conocimiento/psiquiatria/psiquiatria.md', 'Psiquiatría'],
  ['conocimiento/dermatologia/dermatologia.md', 'Dermatología'],
  ['conocimiento/salud-publica/salud-publica.md', 'Salud pública'],
];

function listaMd(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listaMd(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function leeArchivo(abs) {
  const texto = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
  const lineas = texto.split('\n');
  let area = null, actualizado = null;
  if (lineas[0].trim() === '---') {
    for (let k = 1; k < lineas.length && lineas[k].trim() !== '---'; k++) {
      let m;
      if ((m = lineas[k].match(/^area:\s*(.+)$/))) area = m[1].trim();
      if ((m = lineas[k].match(/^actualizado:\s*(.+)$/))) actualizado = m[1].trim();
    }
  }
  const temas = [], casos = [];
  // Marcas " ⚠ sin contrastar" al final de línea, fuera de las secciones Índice y Fuentes.
  let sinContrastar = 0, zonaIgnorada = false;
  for (const l of lineas) {
    if (/^## /.test(l)) zonaIgnorada = /^## (Índice|Indice|Fuentes)\s*$/i.test(l.trim());
    else if (!zonaIgnorada && /\s⚠ sin contrastar\s*$/.test(l)) sinContrastar++;
  }
  for (const l of lineas) {
    const m = l.match(/^## \[([A-Z]+-([TC])\d+)\]\s*(.*)$/);
    if (!m) continue;
    (m[2] === 'T' ? temas : casos).push(`${m[1]}|${m[3].trim()}`);
  }
  return { area, actualizado, temas, casos, sinContrastar };
}

function construyeAuto() {
  const existentes = [];
  const conocidos = new Set(ARCHIVOS.map((a) => a[0]));
  for (const [rel, areaDef] of ARCHIVOS) {
    const abs = path.join(RAIZ, rel);
    if (fs.existsSync(abs)) existentes.push({ rel, abs, areaDef });
  }
  const extras = listaMd(path.join(RAIZ, 'conocimiento'))
    .map((abs) => ({ abs, rel: path.relative(RAIZ, abs).split(path.sep).join('/') }))
    .filter((o) => !conocidos.has(o.rel) && !/\/(INDICE|FORMATO)\.md$/.test(o.rel))
    .sort((a, b) => a.rel.localeCompare(b.rel));
  for (const o of extras) existentes.push({ ...o, areaDef: null });

  const partes = [];
  const datos = existentes.map((o) => ({ ...o, ...leeArchivo(o.abs) }));
  const nombres = datos.map((d) => d.area || d.areaDef || path.basename(d.rel, '.md'));
  partes.push(`**Disponibles (${datos.length} de ${ARCHIVOS.length}):** ${nombres.length ? nombres.join(', ') : 'ninguna todavía'}.`);
  const pendientes = datos.reduce((n, d) => n + d.sinContrastar, 0);
  partes.push('');
  partes.push(`**Datos pendientes de verificar:** ${pendientes}`);
  for (const d of datos) {
    partes.push('');
    const nombre = d.area || d.areaDef || path.basename(d.rel, '.md');
    partes.push(`### ${nombre}`);
    partes.push(`Archivo: \`${d.rel}\`${d.actualizado ? ` · actualizado: ${d.actualizado}` : ''} · datos sin contrastar: ${d.sinContrastar}`);
    partes.push('');
    if (d.temas.length) {
      partes.push('Temas:');
      for (const t of d.temas) { const [id, titulo] = t.split('|'); partes.push(`- [${id}] ${titulo}`); }
    } else partes.push('Temas: (ninguno)');
    partes.push('');
    if (d.casos.length) {
      partes.push('Casos:');
      for (const c of d.casos) { const [id, titulo] = c.split('|'); partes.push(`- [${id}] ${titulo}`); }
    } else partes.push('Casos: (ninguno)');
  }
  return { texto: partes.join('\n'), archivos: datos.length, temas: datos.reduce((n, d) => n + d.temas.length, 0), casos: datos.reduce((n, d) => n + d.casos.length, 0) };
}

function main() {
  if (!fs.existsSync(INDICE)) {
    console.error('No existe conocimiento/INDICE.md; créalo con la parte fija y los marcadores AUTO antes de generar.');
    process.exit(1);
  }
  const actual = fs.readFileSync(INDICE, 'utf8');
  const a = actual.indexOf(INICIO), b = actual.indexOf(FIN);
  if (a < 0 || b < 0 || b < a) {
    console.error(`INDICE.md no tiene los marcadores ${INICIO} ... ${FIN} en ese orden.`);
    process.exit(1);
  }
  const auto = construyeAuto();
  const nuevo = actual.slice(0, a + INICIO.length) + '\n' + auto.texto + '\n' + actual.slice(b);
  if (nuevo === actual) {
    console.log(`INDICE.md sin cambios (${auto.archivos} archivos, ${auto.temas} temas, ${auto.casos} casos).`);
  } else {
    fs.writeFileSync(INDICE, nuevo);
    console.log(`INDICE.md actualizado: ${auto.archivos} archivos, ${auto.temas} temas, ${auto.casos} casos.`);
  }
}

main();
