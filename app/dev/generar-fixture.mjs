// Genera app/dev/fixture/: datos de prueba para la app (maniquí geométrico de 1,7 m).
// Uso: cd app/dev && npm install --cache "$TMPDIR/npm-cache" && node generar-fixture.mjs
// Mismo formato que la salida real: un GLB por sistema, meshopt + quantize, node.name = id.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup, prune, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(AQUI, 'fixture');

// ---------- geometría mínima ----------
// Cada primitiva devuelve {pos:number[], nor:number[], idx:number[]} en coordenadas locales.
function caja(sx, sy, sz) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const caras = [
    [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]],
    [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
    [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]],
    [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
    [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
    [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]],
  ];
  const pos = [], nor = [], idx = [];
  for (const [n, vs] of caras) {
    const b = pos.length / 3;
    for (const v of vs) { pos.push(...v); nor.push(...n); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { pos, nor, idx };
}

function esfera(r, seg = 20, anillos = 14) {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= anillos; i++) {
    const v = i / anillos, th = v * Math.PI;
    for (let j = 0; j <= seg; j++) {
      const u = j / seg, ph = u * Math.PI * 2;
      const x = -Math.cos(ph) * Math.sin(th), y = Math.cos(th), z = Math.sin(ph) * Math.sin(th);
      pos.push(x * r, y * r, z * r); nor.push(x, y, z);
    }
  }
  for (let i = 0; i < anillos; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    if (i !== 0) idx.push(a, b, a + 1);
    if (i !== anillos - 1) idx.push(b, b + 1, a + 1);
  }
  return { pos, nor, idx };
}

function cilindro(r, h, seg = 16) {
  const pos = [], nor = [], idx = [];
  for (let j = 0; j <= seg; j++) {
    const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * r, -h / 2, s * r); nor.push(c, 0, s);
    pos.push(c * r, h / 2, s * r); nor.push(c, 0, s);
  }
  for (let j = 0; j < seg; j++) {
    const a = j * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  for (const [y, ny] of [[h / 2, 1], [-h / 2, -1]]) {
    const c0 = pos.length / 3;
    pos.push(0, y, 0); nor.push(0, ny, 0);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r); nor.push(0, ny, 0);
    }
    for (let j = 0; j < seg; j++) {
      if (ny > 0) idx.push(c0, c0 + j + 2, c0 + j + 1); else idx.push(c0, c0 + j + 1, c0 + j + 2);
    }
  }
  return { pos, nor, idx };
}

// Transformación: escala, rotación (Euler X, Y, Z en radianes) y traslación.
function transformar(g, { esc = [1, 1, 1], rot = [0, 0, 0], t = [0, 0, 0] }) {
  const [rx, ry, rz] = rot;
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  const rotar = (x, y, z) => {
    let y1 = y * cx - z * sx, z1 = y * sx + z * cx; y = y1; z = z1;
    let x2 = x * cy + z * sy, z2 = -x * sy + z * cy; x = x2; z = z2;
    let x3 = x * cz - y * sz, y3 = x * sz + y * cz; x = x3; y = y3;
    return [x, y, z];
  };
  const pos = [], nor = [];
  for (let i = 0; i < g.pos.length; i += 3) {
    const [x, y, z] = rotar(g.pos[i] * esc[0], g.pos[i + 1] * esc[1], g.pos[i + 2] * esc[2]);
    pos.push(x + t[0], y + t[1], z + t[2]);
    const [nx, ny, nz] = rotar(g.nor[i] / esc[0], g.nor[i + 1] / esc[1], g.nor[i + 2] / esc[2]);
    const l = Math.hypot(nx, ny, nz) || 1;
    nor.push(nx / l, ny / l, nz / l);
  }
  return { pos, nor, idx: g.idx };
}

function medir(g) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.pos.length; i += 3) for (let k = 0; k < 3; k++) {
    mn[k] = Math.min(mn[k], g.pos[i + k]); mx[k] = Math.max(mx[k], g.pos[i + k]);
  }
  const centro = mn.map((v, k) => (v + mx[k]) / 2);
  const radio = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2;
  return { centro, radio };
}

// ---------- definición del maniquí ----------
// Convención: Y arriba, anterior +Z, izquierda del paciente +X (derecha = -X).
const D = -1, I = 1;
const defs = [];
let contadorTA2 = 9000;
function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// par: crea estructura derecha e izquierda reflejando X.
function par(base, fn) {
  const ta2 = base.ta2 === undefined ? String(++contadorTA2) : base.ta2;
  for (const lado of [D, I]) {
    const g = fn(lado);
    defs.push({ ...base, ta2, lado: lado === D ? 'derecho' : 'izquierdo', g, id: slug(base.en) + (lado === D ? '_d' : '_i') });
  }
}
function una(base, g) {
  const ta2 = base.ta2 === undefined ? String(++contadorTA2) : base.ta2;
  defs.push({ ...base, ta2, lado: null, g, id: slug(base.en) });
}

const OSEO = { sistema: 'oseo' };
una({ ...OSEO, subsistema: 'axial', capa: 4, region: 'cabeza', grupo: 'Huesos del cráneo', es: 'Cráneo', la: 'Cranium', en: 'Skull' },
  transformar(esfera(0.095), { esc: [1, 1.15, 1.1], t: [0, 1.6, 0] }));
una({ ...OSEO, subsistema: 'axial', capa: 4, region: 'cabeza', grupo: 'Huesos de la cara', es: 'Mandíbula', la: 'Mandibula', en: 'Mandible' },
  transformar(caja(0.1, 0.04, 0.08), { t: [0, 1.495, 0.045] }));
una({ ...OSEO, subsistema: 'axial', capa: 4, region: 'dorso', grupo: 'Columna vertebral', es: 'Columna vertebral', la: 'Columna vertebralis', en: 'Vertebral column' },
  transformar(cilindro(0.018, 0.66), { t: [0, 1.17, -0.06] }));
una({ ...OSEO, subsistema: 'axial', capa: 4, region: 'tórax', grupo: 'Tórax óseo', es: 'Esternón', la: 'Sternum', en: 'Sternum' },
  transformar(caja(0.035, 0.18, 0.015), { t: [0, 1.3, 0.098] }));
par({ ...OSEO, subsistema: 'axial', capa: 4, region: 'tórax', grupo: 'Tórax óseo', es: 'Costillas', la: 'Costae', en: 'Ribs' },
  (l) => transformar(caja(0.1, 0.2, 0.012), { rot: [0, -l * 0.55, 0], t: [l * 0.075, 1.25, 0.05] }));
par({ ...OSEO, subsistema: 'apendicular', capa: 4, region: 'miembro superior', grupo: 'Cintura escapular', es: 'Clavícula', la: 'Clavicula', en: 'Clavicle' },
  (l) => transformar(cilindro(0.007, 0.15), { rot: [0, 0, Math.PI / 2], t: [l * 0.09, 1.38, 0.07] }));
par({ ...OSEO, subsistema: 'apendicular', capa: 4, region: 'miembro superior', grupo: 'Huesos del brazo', es: 'Húmero', la: 'Humerus', en: 'Humerus' },
  (l) => transformar(cilindro(0.018, 0.3), { t: [l * 0.2, 1.2, 0] }));
par({ ...OSEO, subsistema: 'apendicular', capa: 4, region: 'miembro inferior', grupo: 'Huesos del muslo', es: 'Fémur', la: 'Femur', en: 'Femur' },
  (l) => transformar(cilindro(0.02, 0.43), { t: [l * 0.09, 0.7, 0] }));
par({ ...OSEO, subsistema: 'apendicular', capa: 4, region: 'miembro inferior', grupo: 'Huesos de la pierna', es: 'Tibia', la: 'Tibia', en: 'Tibia' },
  (l) => transformar(cilindro(0.017, 0.4), { t: [l * 0.09, 0.27, 0.01] }));

const MUS = { sistema: 'muscular', subsistema: 'musculos' };
par({ ...MUS, capa: 1, region: 'tórax', grupo: 'Músculos del tórax', es: 'Pectoral mayor', la: 'Musculus pectoralis major', en: 'Pectoralis major' },
  (l) => transformar(caja(0.14, 0.1, 0.025), { rot: [0, -l * 0.25, 0], t: [l * 0.08, 1.28, 0.105] }));
par({ ...MUS, capa: 1, region: 'miembro superior', grupo: 'Músculos del hombro', es: 'Deltoides', la: 'Musculus deltoideus', en: 'Deltoid' },
  (l) => transformar(esfera(0.05), { esc: [1, 1.3, 1], t: [l * 0.2, 1.34, 0] }));
par({ ...MUS, capa: 1, region: 'miembro superior', grupo: 'Músculos del brazo', es: 'Bíceps braquial', la: 'Musculus biceps brachii', en: 'Biceps brachii' },
  (l) => transformar(cilindro(0.027, 0.26), { t: [l * 0.2, 1.17, 0.03] }));
par({ ...MUS, capa: 1, region: 'abdomen', grupo: 'Músculos del abdomen', es: 'Recto del abdomen', la: 'Musculus rectus abdominis', en: 'Rectus abdominis' },
  (l) => transformar(caja(0.07, 0.3, 0.03), { t: [l * 0.04, 1.05, 0.1] }));
par({ ...MUS, capa: 1, region: 'miembro inferior', grupo: 'Músculos del muslo', es: 'Cuádriceps femoral', la: 'Musculus quadriceps femoris', en: 'Quadriceps femoris' },
  (l) => transformar(cilindro(0.045, 0.4), { t: [l * 0.095, 0.7, 0.04] }));
// Fascia de revestimiento: una funda algo más ancha que el cuádriceps (en realista se dibuja como película translúcida).
par({ ...MUS, subsistema: 'fascias', capa: 1, region: 'miembro inferior', grupo: 'Fascias del miembro inferior', es: 'Fascia lata', la: 'Fascia lata', en: 'Fascia lata' },
  (l) => transformar(cilindro(0.05, 0.42), { t: [l * 0.095, 0.7, 0.04] }));
par({ ...MUS, capa: 2, region: 'abdomen', grupo: 'Músculos del abdomen', es: 'Psoas mayor', la: null, en: 'Psoas major', ta2: null, fuente: 'traduccion-propia' },
  (l) => transformar(cilindro(0.025, 0.25), { t: [l * 0.05, 1.04, -0.02] }));

const NER = { sistema: 'nervioso' };
una({ ...NER, subsistema: 'central', capa: 5, region: 'cabeza', grupo: 'Sistema nervioso central', es: 'Encéfalo', la: 'Encephalon', en: 'Brain' },
  transformar(esfera(0.08), { esc: [1, 1.05, 1.1], t: [0, 1.6, 0] }));
una({ ...NER, subsistema: 'central', capa: 5, region: 'dorso', grupo: 'Sistema nervioso central', es: 'Médula espinal', la: 'Medulla spinalis', en: 'Spinal cord' },
  transformar(cilindro(0.007, 0.62), { t: [0, 1.17, -0.06] }));
par({ ...NER, subsistema: 'periferico', capa: 3, region: 'miembro inferior', grupo: 'Nervios del miembro inferior', es: 'Nervio ciático', la: 'Nervus ischiadicus', en: 'Sciatic nerve' },
  (l) => transformar(cilindro(0.006, 0.45), { t: [l * 0.09, 0.72, -0.04] }));
par({ ...NER, subsistema: 'periferico', capa: 3, region: 'miembro superior', grupo: 'Nervios del miembro superior', es: 'Nervio mediano', la: 'Nervus medianus', en: 'Median nerve' },
  (l) => transformar(cilindro(0.005, 0.28), { t: [l * 0.215, 1.17, 0.035] }));

// ---------- sistemas ----------
const SISTEMAS = [
  { id: 'oseo', nombre: 'Sistema óseo', color: '#E8DCC4', orden: 1, visible_inicio: true, opcional: false },
  { id: 'muscular', nombre: 'Sistema muscular', color: '#B5523B', orden: 2, visible_inicio: false, opcional: false },
  { id: 'nervioso', nombre: 'Sistema nervioso', color: '#E8C547', orden: 3, visible_inicio: false, opcional: false },
];

// ---------- construcción ----------
async function construirGLB(sistema, estructuras) {
  const doc = new Document();
  const buf = doc.createBuffer();
  const mat = doc.createMaterial('base').setBaseColorFactor([0.8, 0.8, 0.8, 1]).setRoughnessFactor(0.6).setMetallicFactor(0);
  const escena = doc.createScene(sistema);
  for (const e of estructuras) {
    const g = e.g;
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.pos)).setBuffer(buf);
    const nor = doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.nor)).setBuffer(buf);
    const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(g.idx)).setBuffer(buf);
    const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('NORMAL', nor).setIndices(idx).setMaterial(mat);
    const mesh = doc.createMesh(e.id).addPrimitive(prim);
    escena.addChild(doc.createNode(e.id).setMesh(mesh));
  }
  await MeshoptEncoder.ready;
  await doc.transform(weld(), dedup(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const ruta = path.join(SALIDA, 'modelos', sistema + '.glb');
  await io.write(ruta, doc);
  return fs.statSync(ruta).size;
}

function triangulos(g) { return g.idx.length / 3; }

const escribir = (rel, obj) => {
  const ruta = path.join(SALIDA, rel);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(obj, null, 1) + '\n');
};

// Solo se regeneran datos y modelos: las texturas de prueba (fixture/texturas) las genera generar-texturas-prueba.mjs.
for (const sub of ['datos', 'modelos']) fs.rmSync(path.join(SALIDA, sub), { recursive: true, force: true });
fs.mkdirSync(path.join(SALIDA, 'modelos'), { recursive: true });

const sistemasOut = [];
for (const s of SISTEMAS) {
  const ests = defs.filter((d) => d.sistema === s.id);
  const bytes = await construirGLB(s.id, ests);
  sistemasOut.push({
    id: s.id, nombre: s.nombre, color: s.color, glb: `modelos/${s.id}.glb`, bytes,
    tris: ests.reduce((a, e) => a + triangulos(e.g), 0), estructuras: ests.length,
    visible_inicio: s.visible_inicio, orden: s.orden, opcional: s.opcional,
  });
}
escribir('datos/sistemas.json', { version: 1, sistemas: sistemasOut });

const r = (n) => Math.round(n * 1000) / 1000;
escribir('datos/catalogo.json', {
  version: 1, generado: '2026-11-13T00:00:00Z', unidades: 'm',
  orientacion: 'Y arriba; anterior +Z; izquierda del paciente +X',
  estructuras: defs.map((d) => {
    const m = medir(d.g);
    return {
      id: d.id, nombre_es: d.es, nombre_la: d.la ?? (d.fuente ? null : d.en), nombre_en: d.en, lado: d.lado,
      sistema: d.sistema, subsistema: d.subsistema, capa: d.capa, region: d.region, grupo_es: d.grupo,
      ta2: d.ta2 ?? null, nombre_fuente: d.fuente ?? 'TA2', licencia: 'CC-BY-SA-4.0',
      tris: triangulos(d.g), centro: m.centro.map(r), radio: r(m.radio),
    };
  }),
});

// ---------- fichas de prueba (las del sistema óseo y muscular que tienen TA2) ----------
const FUENTES = [{ titulo: 'Anatomy and Physiology 2e — OpenStax (dato de prueba)', url: 'https://openstax.org/books/anatomy-and-physiology-2e' }];
function ficha(d, extra) {
  return {
    clave: 'ta2:' + d.ta2, ta2: d.ta2, nombre_es: d.es, nombre_la: d.la ?? d.en, tipo: extra.tipo,
    resumen: extra.resumen, funcion: extra.funcion,
    irrigacion: extra.irrigacion ?? null, drenaje_venoso: extra.drenaje_venoso ?? null,
    inervacion: extra.inervacion ?? null, drenaje_linfatico: extra.drenaje_linfatico ?? null,
    musculo: extra.musculo ?? null, relaciones: extra.relaciones ?? null,
    relevancia_clinica: extra.relevancia_clinica ?? [], perla: extra.perla ?? null,
    fuentes: FUENTES, revisado: '2026-11-13',
    // campos óseos opcionales (SPEC §7.4): solo si la ficha de prueba los trae
    ...(extra.accidentes ? { accidentes: extra.accidentes } : {}),
    ...(extra.articulaciones ? { articulaciones: extra.articulaciones } : {}),
    ...(extra.inserciones ? { inserciones: extra.inserciones } : {}),
    ...('osificacion' in extra ? { osificacion: extra.osificacion } : {}),
    ...('contrastado' in extra ? { contrastado: extra.contrastado } : {}),
  };
}
const porEn = (en) => defs.find((d) => d.en === en);
const fichasOseo = {}, fichasMus = {};
const addO = (en, extra) => { const d = porEn(en); fichasOseo['ta2:' + d.ta2] = ficha(d, { tipo: 'hueso', ...extra }); };
const addM = (en, extra) => { const d = porEn(en); fichasMus['ta2:' + d.ta2] = ficha(d, { tipo: 'musculo', ...extra }); };
addO('Skull', { resumen: 'Conjunto óseo de la cabeza (dato de prueba).', funcion: 'Protege el encéfalo y sostiene los órganos de los sentidos.', irrigacion: 'Ramas de las arterias meníngeas y temporal superficial.', relevancia_clinica: ['Las fracturas de la base del cráneo pueden lesionar pares craneales.', 'El pterion es una zona delgada sobre la arteria meníngea media.'], perla: 'Pterion: cuatro huesos confluyen en un punto frágil.' });
addO('Mandible', { resumen: 'Único hueso móvil de la cara (dato de prueba).', funcion: 'Permite la masticación y aloja las piezas dentales inferiores.', inervacion: 'Nervio alveolar inferior (rama de V3).', relevancia_clinica: ['Las fracturas suelen ser dobles por su forma de arco.'] });
addO('Vertebral column', { resumen: 'Eje óseo del tronco (dato de prueba).', funcion: 'Sostiene el tronco y protege la médula espinal.', relevancia_clinica: ['La estenosis del canal puede comprimir raíces nerviosas.'], perla: 'Cuenta 7 cervicales, 12 torácicas y 5 lumbares.' });
addO('Sternum', { resumen: 'Hueso plano de la pared torácica anterior (dato de prueba).', funcion: 'Une las costillas y protege el mediastino.', relevancia_clinica: ['Es sitio de punción de médula ósea y de esternotomía.'] });
addO('Humerus', { resumen: 'Hueso del brazo (dato de prueba).', funcion: 'Soporta el brazo y articula hombro y codo.', irrigacion: 'Arterias circunflejas y braquial profunda.', inervacion: 'Nervio radial en el surco espiral.', relevancia_clinica: ['La fractura de diáfisis media puede lesionar el nervio radial.'], perla: 'Nervio radial = surco espiral del húmero.' });
addO('Femur', { resumen: 'Hueso más largo y fuerte del cuerpo (dato de prueba).', funcion: 'Transmite el peso del tronco a la pierna.', irrigacion: 'Arterias circunflejas femorales y perforantes.', relevancia_clinica: ['La fractura de cuello femoral compromete la irrigación de la cabeza.'],
  accidentes: [{ nombre: 'Trocánter mayor', nombre_la: 'Trochanter major', nota: 'Inserción de los glúteos medio y menor (dato de prueba).' }, { nombre: 'Línea áspera', nombre_la: null, nota: 'Inserción de los aductores (dato de prueba).' }],
  articulaciones: [{ con: 'Coxal', tipo: 'sinovial esferoidea', nombre: 'Articulación de la cadera' }],
  inserciones: [{ musculo: 'Glúteo medio', tipo: 'insercion', donde: 'Trocánter mayor' }, { musculo: 'Vasto lateral', tipo: 'origen', donde: 'Línea áspera' }],
  osificacion: 'Epífisis distal presente hacia el nacimiento (dato de prueba).', contrastado: false });
addO('Tibia', { resumen: 'Hueso medial de la pierna (dato de prueba).', funcion: 'Soporta el peso del cuerpo.', relevancia_clinica: ['Su cara anteromedial es subcutánea, por lo que las fracturas son a menudo abiertas.'] });
addM('Biceps brachii', { resumen: 'Músculo anterior del brazo (dato de prueba).', funcion: 'Flexiona el codo y supina el antebrazo.', irrigacion: 'Arteria braquial.', inervacion: 'Nervio musculocutáneo (C5–C6).', musculo: { origen: 'Cabeza larga: tubérculo supraglenoideo. Cabeza corta: apófisis coracoides.', insercion: 'Tuberosidad del radio y aponeurosis bicipital.', accion: 'Flexión del codo y supinación del antebrazo.' }, relevancia_clinica: ['La rotura de la cabeza larga produce el signo de Popeye.'], perla: 'Supina con el codo flexionado: el "sacacorchos".' });
addM('Deltoid', { resumen: 'Músculo que da el contorno redondeado del hombro (dato de prueba).', funcion: 'Abduce el brazo.', inervacion: 'Nervio axilar (C5–C6).', musculo: { origen: 'Tercio lateral de la clavícula, acromion y espina de la escápula.', insercion: 'Tuberosidad deltoidea del húmero.', accion: 'Abducción del brazo; fibras anteriores flexionan, posteriores extienden.' }, relevancia_clinica: ['Sitio frecuente de inyección intramuscular; se evita el nervio axilar.'] });
addM('Pectoralis major', { resumen: 'Músculo grande de la pared torácica anterior (dato de prueba).', funcion: 'Aduce y rota medialmente el brazo.', inervacion: 'Nervios pectorales medial y lateral.', musculo: { origen: 'Clavícula, esternón y cartílagos costales.', insercion: 'Labio lateral del surco intertubercular.', accion: 'Aducción y rotación medial del brazo.' } });
addM('Rectus abdominis', { resumen: 'Músculo en cinta de la pared abdominal anterior (dato de prueba).', funcion: 'Flexiona el tronco y comprime el abdomen.', inervacion: 'Nervios intercostales T7–T12.', musculo: { origen: 'Sínfisis y cresta del pubis.', insercion: 'Apófisis xifoides y cartílagos costales 5–7.', accion: 'Flexión del tronco.' }, relevancia_clinica: ['La diástasis de los rectos es frecuente tras el embarazo.'] });
addM('Quadriceps femoris', { resumen: 'Grupo extensor del muslo (dato de prueba).', funcion: 'Extiende la rodilla.', inervacion: 'Nervio femoral (L2–L4).', musculo: { origen: 'Espina ilíaca anteroinferior y diáfisis femoral.', insercion: 'Tuberosidad tibial por el ligamento patelar.', accion: 'Extensión de la rodilla.' }, perla: 'El reflejo rotuliano evalúa L3–L4.' });
escribir('datos/fichas/oseo.json', { version: 1, sistema: 'oseo', fichas: fichasOseo });
escribir('datos/fichas/muscular.json', { version: 1, sistema: 'muscular', fichas: fichasMus });
escribir('datos/fichas/manifest.json', {
  version: 1, archivos: ['oseo.json', 'muscular.json'],
  total: Object.keys(fichasOseo).length + Object.keys(fichasMus).length,
});

console.log('Fixture generado en', SALIDA);
for (const s of sistemasOut) console.log(` ${s.id}: ${s.estructuras} estructuras, ${s.tris} tris, ${s.bytes} bytes`);
