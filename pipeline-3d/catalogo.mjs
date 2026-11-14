// Paso 5: catalogo.json, sistemas.json y ATRIBUCIONES.md
import fs from 'node:fs';
import path from 'node:path';
import { INTER, DATOS, APP, RAIZ, DIR, SISTEMAS, COMMIT_Z, COMMIT_TA2, leerJSON, escribirJSON, norm } from './comun.mjs';
import { leerTA2 } from './fbx.mjs';

const cls = leerJSON(path.join(INTER, 'clasificado.json')).estructuras;
const conv = leerJSON(path.join(INTER, 'convertido.json'));
const propias = leerJSON(path.join(DIR, 'traducciones-propias.json'));
const correc = leerJSON(path.join(DIR, 'correcciones-nombres.json'));
const { mapa: TA2 } = leerTA2();
const humano = (s) => s.replace(/_/g, ' ').replace(/\*/g, '').trim();
// Fichas oseas publicadas por el encargo 04: su nombre_es manda en el sistema oseo (misma clave ta2:<id>)
const rutaFichas = path.join(RAIZ, 'app', 'datos', 'fichas', 'oseo.json');
const fichasOseo = fs.existsSync(rutaFichas) ? leerJSON(rutaFichas).fichas : {};
const corrLatin = {}, deFicha = {}, discrepLa = [];
const noUsadas = new Set(Object.keys(propias)); const corrAplicadas = {};

let ladoInferido = 0;
const estructuras = [];
const sinTA2 = [];
for (const c of cls) {
  const o = conv.estructuras[c.id]; if (!o) throw new Error('Sin geometria convertida: ' + c.id);
  const parche = c.tipoMalla !== 'estructura';
  let es, la, ta2 = null, fuente, en;
  // fila TA2 (de la estructura, o del musculo al que pertenece el parche)
  let fila = c.conTA2 ? { ta2: c.ta2, en: c.en, la: c.la, es: c.es } : null;
  if (!fila && parche) { const f = TA2.get(norm(c.baseNombre)); if (f) fila = f; }
  if (fila) {
    ta2 = String(fila.ta2); en = fila.en; fuente = 'TA2';
    es = fila.es; la = fila.la;
    if (correc[ta2] && correc[ta2].es) { if (es !== correc[ta2].es) corrAplicadas[ta2] = { de: es, a: correc[ta2].es, en: fila.en }; es = correc[ta2].es; }
    if (correc[ta2] && correc[ta2].la && la !== correc[ta2].la) { corrLatin[ta2] = { de: la, a: correc[ta2].la }; la = correc[ta2].la; }
  } else {
    const p = propias[c.baseNombre]; if (!p) throw new Error('Falta traduccion propia: ' + c.baseNombre + ' (' + c.id + ')');
    noUsadas.delete(c.baseNombre); es = p.es; la = p.la || null; en = humano(c.baseNombre); fuente = 'traduccion-propia';
    sinTA2.push({ id: c.id, objeto: c.nombre, es, sistema: c.sistema });
  }
  if (c.sistema === 'oseo' && ta2 && fichasOseo['ta2:' + ta2]) {
    const f = fichasOseo['ta2:' + ta2];
    if (f.nombre_es && f.nombre_es !== es) { deFicha[ta2] = { de: es, a: f.nombre_es }; es = f.nombre_es; }
    if (f.nombre_la && f.nombre_la !== la) discrepLa.push({ ta2, catalogo: la, ficha: f.nombre_la });
  }
  let subsistema = c.subsistema;
  if (parche) {
    const n = (c.nombre.match(/[eo](\d+)[lr]$/) || [])[1];
    es = (c.tipoMalla === 'origen' ? 'Origen: ' : 'Inserción: ') + es + (n ? ' (' + n + ')' : '');
    if (la) la = (c.tipoMalla === 'origen' ? 'Origo: ' : 'Insertio: ') + la;
    else if (ta2) la = (c.tipoMalla === 'origen' ? 'Origo' : 'Insertio');
    subsistema = c.tipoMalla === 'origen' ? 'origen' : 'insercion';
  }
  if (c.lado) es = es.replace(/\s+(derech[oa]s?|izquierd[oa]s?)$/i, '');   // el lado va en el campo lado, nunca dentro de nombre_es
  // lado desde el nombre ingles (Right/Left) cuando el objeto no trae r/l y la posicion concuerda (x<0 = derecha del paciente)
  let lado = c.lado;
  if (!lado && !parche && en) { const m = en.match(/\b(right|left)\b/i); if (m && Math.abs(o.centro[0]) > 0.005) { const d = m[1].toLowerCase() === 'right'; if (d === (o.centro[0] < 0)) { lado = d ? 'derecho' : 'izquierdo'; ladoInferido++; es = es.replace(/\s+(derech[oa]s?|izquierd[oa]s?)$/i, ''); } } }
  estructuras.push({
    id: c.id, nombre_es: es, nombre_la: la, nombre_en: en, lado, sistema: c.sistema, subsistema, capa: c.capa,
    region: c.region, grupo_es: c.grupo_es, ta2, nombre_fuente: fuente, licencia: c.licencia,
    tris: o.tris, centro: o.centro, radio: o.radio,
  });
}
if (noUsadas.size) console.warn('Traducciones propias sin usar:', [...noUsadas]);
const catalogo = { version: 1, generado: process.env.SOURCE_DATE || '2026-11-13T00:00:00Z', unidades: 'm', orientacion: 'Y arriba; anterior +Z; izquierda del paciente +X', estructuras };
// una estructura por linea (grep -c cuenta estructuras)
fs.mkdirSync(DATOS, { recursive: true });
const cab = JSON.stringify({ ...catalogo, estructuras: undefined }).slice(0, -1);
fs.writeFileSync(path.join(DATOS, 'catalogo.json'), cab + ',"estructuras":[\n' + estructuras.map(e => JSON.stringify(e)).join(',\n') + '\n]}\n');
const ladoEnNombre = estructuras.filter(e => !e.lado && /\b(derech|izquierd)[oa]s?\b/i.test(e.nombre_es)).length;
console.log('nombre_es tomado de la ficha osea:', Object.keys(deFicha).length, 'TA2; latin corregido:', Object.keys(corrLatin).length, 'TA2; discrepancias de latin con ficha:', discrepLa.length);
console.log('lado inferido del nombre ingles + posicion:', ladoInferido);
console.log('Estructuras sin lado con derecho/izquierdo en el nombre (nombres propios TA2):', ladoEnNombre);

// sistemas.json
const sistemas = [];
for (const s of SISTEMAS) {
  const r = conv.sistemas[s.id]; if (!r) continue;
  const e = { id: s.id, nombre: s.nombre, color: s.color, glb: `modelos/${s.id}.glb`, bytes: r.bytes, tris: r.tris_out, estructuras: r.estructuras, visible_inicio: s.visible_inicio, orden: s.orden, opcional: s.opcional };
  if (s.id === 'cardiovascular') e.colores_subsistema = { arterias: '#C8323C', venas: '#3B5BA9', corazon: '#C8323C' };
  if (s.id === 'inserciones') e.colores_subsistema = { origen: '#D24B4B', insercion: '#4B7BD2' };
  if (s.id === 'piel') e.opacidad = 0.35;
  sistemas.push(e);
}
escribirJSON(path.join(DATOS, 'sistemas.json'), { version: 1, sistemas }, 2);

// listas para INFORME y ATRIBUCIONES
const nc = estructuras.filter(e => e.licencia !== 'CC-BY-SA-4.0');
escribirJSON(path.join(INTER, 'informe-datos.json'), { sinTA2, nc: nc.map(e => ({ id: e.id, nombre_es: e.nombre_es, licencia: e.licencia, sistema: e.sistema })), correcciones: corrAplicadas, correccionesLatin: corrLatin, deFicha, discrepLa, totalPropias: estructuras.filter(e => e.nombre_fuente === 'traduccion-propia').length }, 1);

const ncOido = nc.filter(e => e.licencia === 'CC-BY-NC-SA-4.0'), ncRinon = nc.filter(e => e.licencia === 'CC-BY-NC-4.0');
const lista = (a) => a.map(e => `- \`${e.id}\` (${e.nombre_es})`).join('\n');
const att = `# Atribuciones y licencias

Declaración: **Modelos y datos derivados: CC BY-SA 4.0; proyecto educativo no comercial.**

## Modelos 3D

- **Z-Anatomy — The libre 3D atlas of anatomy — CC BY-SA 4.0** (https://github.com/LluisV/Z-Anatomy). Mallas FBX de \`Resources/Models/FBX/\`, rama \`PC-Version\`, commit \`${COMMIT_Z}\`. Los autores son los del proyecto Z-Anatomy (repositorio LluisV/Z-Anatomy); los GLB de \`app/modelos/\` son obras derivadas (reorientadas, escaladas, simplificadas y recomprimidas) y se redistribuyen bajo CC BY-SA 4.0. Los nombres de autor individuales no figuran en el README de ese commit; la dirección debe completarlos si desea listarlos.
- **BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International** (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Z-Anatomy se deriva de BodyParts3D. Nota: la página de licencia actual indica CC BY 4.0 (actualizada el 2025-02-27), pero las cabeceras de los OBJ y Z-Anatomy citan CC BY-SA 2.1 JP; distribuir como BY-SA 4.0 cumple con ambas.

## Nombres en latín y español

- **TA2.csv de Z-Anatomy / Models-of-human-anatomy** (https://github.com/Z-Anatomy/Models-of-human-anatomy), commit \`${COMMIT_TA2}\`, basado en la Terminologia Anatomica 2. Se usa para los campos \`nombre_la\`, \`nombre_es\` y \`ta2\` de \`app/datos/catalogo.json\`. Las correcciones propias de español están en \`pipeline-3d/correcciones-nombres.json\` y las traducciones de estructuras sin entrada en \`pipeline-3d/traducciones-propias.json\` (marcadas \`nombre_fuente: "traduccion-propia"\`).

## Partes con licencia no comercial (NC)

Según la información de procedencia de Z-Anatomy que recoge el SPEC del proyecto (sin verificar en el README del commit fijado, que no la contiene), el oído interno proviene de la University of Dundee (CC BY-NC-SA 4.0) y el riñón de Lissie Cowley (CC BY-NC 4.0). Estas estructuras están marcadas con el campo \`licencia\` en el catálogo y **no deben usarse comercialmente**; el proyecto se declara no comercial.

Oído interno (CC BY-NC-SA 4.0):
${lista(ncOido)}

Riñón y pelvis renal (CC BY-NC 4.0):
${lista(ncRinon)}

## Código y bibliotecas

- three.js (MIT), © los autores de three.js (https://threejs.org). Su LICENSE se copia en \`app/vendor/three/\`.
- Herramientas de \`pipeline-3d/\`: @gltf-transform (MIT), meshoptimizer (MIT).
- Código propio de la app y del pipeline: MIT (ver \`LICENSE\`).

## Fuentes tipográficas

Fraunces e Inter (SIL Open Font License 1.1). **[Pendiente: el encargo 03 confirma en su informe qué fuentes se incluyeron en \`app/fonts/\` y que cada una lleva su OFL.txt.]**
`;
fs.writeFileSync(path.join(APP, 'ATRIBUCIONES.md'), att);
console.log(`catalogo.json: ${estructuras.length} estructuras; sistemas.json: ${sistemas.length} sistemas; propias: ${sinTA2.length}; NC: ${nc.length}; correcciones: ${Object.keys(corrAplicadas).length}`);
