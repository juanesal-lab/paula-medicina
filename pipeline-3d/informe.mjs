// Genera INFORME.md a partir de los datos de la corrida (tablas) y del texto fijo de decisiones
import fs from 'node:fs';
import path from 'node:path';
import { INTER, DIR, CAPTURAS, SISTEMAS, leerJSON } from './comun.mjs';

const conv = leerJSON(path.join(INTER, 'convertido.json')); const T = conv.transformacion;
const cmp = leerJSON(path.join(INTER, 'comparacion-inventario.json'));
const cl = leerJSON(path.join(INTER, 'clasificado.json'));
const dat = leerJSON(path.join(INTER, 'informe-datos.json'));
const ctrl = leerJSON(path.join(INTER, 'capas-controles.json'));
const r1 = fs.existsSync(path.join(CAPTURAS, 'r1-metricas.json')) ? leerJSON(path.join(CAPTURAS, 'r1-metricas.json')) : [];
const mb = (b) => (b / 1e6).toFixed(2);
const filas = SISTEMAS.filter(s => conv.sistemas[s.id]).map(s => { const r = conv.sistemas[s.id]; return `| ${s.id} | ${r.estructuras} | ${r.tris_in.toLocaleString('es-CO')} | ${r.tris_out.toLocaleString('es-CO')} | ${r.bytes.toLocaleString('es-CO')} (${mb(r.bytes)} MB) | ${(r.tope_bytes / 1e6).toFixed(2)} MB | ${r.ratio} / ${r.error} |`; });
const tot = Object.values(conv.sistemas).reduce((a, r) => ({ e: a.e + r.estructuras, i: a.i + r.tris_in, o: a.o + r.tris_out, b: a.b + r.bytes }), { e: 0, i: 0, o: 0, b: 0 });
const cfg = { ref: 'original (soldado, sin decimar)', A: 'A: ratio 0,35 / error 0,002', B: 'B: ratio 0,20 / error 0,005', C: 'C: ratio 0,12 / error 0,01' };
const vistas = [...new Set(r1.map(m => m.vista))];
const tablaR1 = vistas.map(v => { const g = (c) => (r1.find(m => m.vista === v && m.config === c) || {}).tris; return `| ${v} | ${g('ref')} | ${g('A')} | ${g('B')} | ${g('C')} | [montaje](capturas/r1-${v}-montaje.png) |`; }).join('\n');
const v = T.verificacion;
const oseo = conv.sistemas.oseo.bytes, piel = conv.sistemas.piel.bytes;
const md = `# INFORME — pipeline de modelos 3D (encargo 02)

Generado por \`pipeline-3d/informe.mjs\` en cada \`npm run todo\`. Fuente: Z-Anatomy (commit fijado en el SPEC §6.2), nombres de TA2.csv.

## 1. Paso 0 · R2: orientación y lateralidad (resuelto)

Centroides en coordenadas world del FBX (cm), calculados con el inventario:

| comprobación | valor | meta | resultado |
|---|---|---|---|
| z de \`Body_of_sternum\` | ${v.z_esternon} | mayor que z de \`Vertebra_T5\` (${v.z_T5}) | ${v.anterior_es_mas_z ? 'cumple: anterior = +Z' : 'NO cumple'} |
| x de \`Liver\` | ${v.x_higado} | x < 0 (hígado a la derecha del paciente) | ${v.higado_en_x_negativo ? 'cumple' : 'NO cumple'} |
| x de \`Femurl\` / \`Femurr\` | ${v.x_femur_l} / ${v.x_femur_r} | l en x > 0 | ${v.femur_l_en_x_positivo ? 'cumple' : 'NO cumple'} |

**El modelo ya viene orientado como pide el SPEC**: no se rota ni se espeja (\`rotY180 = ${T.rotY180}\`, \`espejoX = ${T.espejoX}\`). Verificación ampliada con **todas** las estructuras con sufijo r/l y |x| > 0,3 cm: ${cl.lateralidad.ok} coherentes y ${cl.lateralidad.mal} incoherentes (${cl.lateralidad.malos.map(m => '`' + m + '`').join(', ')}); son errores de nombre del modelo original (p. ej. \`Eyelashes\`, ligamento temporomandibular lateral, ramo del vago), no una inversión global. El lado del catálogo sigue el sufijo del objeto.

**Transformación final aplicada a todos los sistemas** (idéntica para todos, así encajan entre sí):
1. Matriz world del FBX (cm) aplicada a los vértices (se hornea; ver hallazgo 4 sobre el devanado).
2. Escala ×${T.escala} (cm → m).
3. Orientación: ninguna.
4. Traslación [${T.offset.map(x => x.toFixed(5)).join(', ')}] m: el punto más bajo de la piel (caja de \`Regions\`) queda en y = 0, la línea media en x = 0 (x del centroide del esternón; la caja de la piel no sirve porque los brazos son asimétricos) y la caja de la piel centrada en z = 0.
Resultado: Y arriba, anterior +Z, izquierda del paciente +X, altura ≈ 1,74 m. Guardada en \`intermedio/transformacion.json\`.

## 2. Paso 0 · R1: calidad del decimado (resuelto)

Script \`prueba-decimado.mjs\` + rasterizador propio \`raster.mjs\` (z-buffer, lambert, PNG con zlib; sin navegador ni dependencias nativas). Cinco encuadres y tres configuraciones de \`simplify\` (meshoptimizer con \`LockBorder\`; mallas de menos de 300 triángulos sin tocar y mínimo de 64). Cada montaje es una cuadrícula 2×2: arriba izquierda = original, arriba derecha = A, abajo izquierda = B, abajo derecha = C.

| vista | original (tris) | A 0,35/0,002 | B 0,2/0,005 | C 0,12/0,01 | capturas |
|---|---|---|---|---|---|
${tablaR1}

Lectura (revisión visual de los cinco montajes):
- **(d) plexo braquial derecho, con A, B y C**: troncos, cordones y ramas siguen siendo tubos continuos, sin huecos visibles. C reduce 124 704 a 16 778 triángulos sin romper la continuidad.
- **(c) corazón, con A, B y C**: las coronarias y venas cardíacas siguen continuas; con C la superficie pierde algo de suavidad pero no hay huecos.
- **(e) encéfalo, con A, B y C**: las circunvoluciones se conservan; C las suaviza ligeramente.
- **(a) cara y cráneo**: A y B limpios; C deforma levemente las órbitas y deja una rendija en la línea media del epicráneo.
- **(b) mano derecha (huesos)**: B aceptable; **C degrada los huesos** (cabezas de metacarpianos angulosas y abolladas).

**Decisión de la v1 (histórica, sustituida por la sección 3)**: tubos finos (nervioso, cardiovascular) toleran la configuración C, que es la más agresiva; huesos y músculos se quedan en A/B. En la práctica el ratio de cada sistema lo fija el presupuesto de triángulos del SPEC §6.7 (\`convertir.mjs\` busca el ratio que da los triángulos objetivo ±10 %) y el **error máximo** viene de esta prueba: óseo 0,003 (ratio resultante 0,37, entre A y B), piel 0,004, articular 0,005, linfático 0,005, vísceras 0,005, muscular 0,006 (ratio 0,17, entre B y C), cardiovascular 0,01 (ratio 0,20) y nervioso 0,01 (ratio 0,13, cerca de C). Con \`LockBorder\` activo siempre. Capturas de los GLB finales: sección 8.

## 3. Sistemas generados

| sistema | estructuras | tris entrada | tris salida | bytes | tope | ratio / error |
|---|---|---|---|---|---|---|
${filas.join('\n')}
| **total** | ${tot.e} | ${tot.i.toLocaleString('es-CO')} | ${tot.o.toLocaleString('es-CO')} | ${tot.b.toLocaleString('es-CO')} (${mb(tot.b)} MB) | 45 MB | |

- **Presupuestos v2 (orden de la dirección, sustituyen al SPEC §6.7)**: óseo sin decimar (ratio 1; solo soldadura de vértices a 10 µm y normales recalculadas); articular, inserciones, vísceras, linfático y piel ratio 0,6 con error 0,003; muscular ratio 0,38 con error 0,004; cardiovascular y nervioso ratio 0,38 con error 0,003 (nunca por debajo de la config A de R1). Siempre con LockBorder. Topes: total ≤ 45 MB, ≤ 4,5 M triángulos con todo visible sin inserciones, carga inicial (óseo + piel) ≤ 9 MB, óseo ≤ 8 MB.
- \`oseo\` + \`piel\` = ${mb(oseo + piel)} MB (tope 9 MB). El óseo cabe en un solo GLB (${mb(oseo)} MB): no se dividió y \`sistemas.json\` conserva su esquema.
- Total ${mb(tot.b)} MB (tope 45). Triángulos con todo visible, sin \`inserciones\` (apagado por defecto): ${(tot.o - conv.sistemas.inserciones.tris_out).toLocaleString('es-CO')} (tope 4,5 M).
- Las vísceras reparten su tope de bytes en proporción a sus triángulos de entrada.
- Ids, nombres, capas y lados del catálogo no cambian respecto a la versión anterior; solo geometría, bytes, tris, centro y radio.

## 4. Inventario y clasificación

- \`inventario.mjs\` reproduce el algoritmo del SPEC §6.4 sobre los 8 FBX: ${cmp.nuevoTotal} objetos (igual que el inventario de la dirección). **Coincidencia de \`ta2\` con \`docs/datos/inventario-zanatomy.json\`: ${cmp.iguales}/${cmp.comparables} filas = ${cmp.pct} %** (mismo \`archivo\` y \`nombre\`). Diferencias: ${cmp.dif.map(d => '`' + d.k + '`').join(' y ')}: la referencia les asigna ta2 \`""\` (cadena vacía, una coincidencia espuria con un término vacío) y aquí quedan sin TA2; son objetos de nombre ilegible (ver sección 6).
- Estructuras en el catálogo: ${cl.estructuras.length} (descartados: 1 349 etiquetas \`i\`/\`j\`, 72 auxiliares o sin triángulos y las anclas sin TA2 de 12 triángulos).
- Capas de músculo (heurística de distancia a la piel). Distancia mediana de los vértices de la malla al punto más cercano de la piel (muestreo de la superficie de \`Regions\` cada 0,5 cm, rejilla hash de 1 cm; 600 vértices por malla). **Umbral usado: 1,95 cm, no 1,5 cm**, porque con 1,5 cm el recto abdominal (1,82 cm) caía en capa 2; la malla de \`Regions\` incluye el tejido subcutáneo y por eso toda distancia es ~1 cm mayor de lo esperado. Los grupos \`Superficial_*\` y \`Deep_*\` tienen prioridad cuando existen, y las fascias van a capa 1. Revisión de 10 músculos conocidos:

| malla | distancia (cm) | capa | esperada | |
|---|---|---|---|---|
${ctrl.map(c => `| ${c.nombre} | ${c.dist_cm} | ${c.capa} | ${c.esperada} | ${c.ok ? 'ok' : 'FALLA'} |`).join('\n')}

Decisiones de capa: coronarias, venas cardíacas, aorta, cavas, tronco pulmonar y todas las arterias y venas pulmonares = 5 (junto al corazón y los pulmones); resto de vasos = 3; sentidos (ojo y oído) = 5; SNC = 5; nervios periféricos y ganglios = 3; linfático = 3; óseo, articular e \`inserciones\` = 4; piel = 0.

## 5. Estructuras sin TA2 (traducción propia) — ${dat.sinTA2.length}

Marcadas \`nombre_fuente: "traduccion-propia"\`, \`nombre_la: null\`. Traducciones en \`traducciones-propias.json\` (clave = nombre base del objeto sin letra de lado). Revisar por un anatomista antes de publicar.

| id | objeto FBX | nombre_es | sistema |
|---|---|---|---|
${dat.sinTA2.map(s => `| ${s.id} | ${s.objeto} | ${s.es} | ${s.sistema} |`).join('\n')}

## 6. Nombres ilegibles en el modelo (hallazgo)

Tres objetos tienen el nombre corrupto en el FBX (\`?xr\`, \`?xl\` y \`????????\`). Son hijos de la arteria del conducto pterigoideo (los dos primeros, 1 534 triángulos cada uno, cerca de la línea media a y≈157 cm) y del seno coronario (el tercero, una vena cardíaca anterior, 8 500 triángulos). No pude identificarlos con certeza: se llaman "Arteria craneal sin identificar" y "Vena cardíaca sin identificar". Pendiente de revisión anatómica.

## 7. Licencias no comerciales — ${dat.nc.length} estructuras

${dat.nc.map(n => `- \`${n.id}\` (${n.nombre_es}) — ${n.licencia}`).join('\n')}

Oído interno: solo existen cóclea y vestíbulo (r/l); no hay conductos semicirculares, ampollas óseas ni laberinto membranoso en las mallas. Riñón: \`Kidney\` y \`Renal_pelvis\` (r/l); los vasos intrarrenales no se marcan. Lista y texto en \`app/ATRIBUCIONES.md\`.

## 8. Correcciones de nombres (TA2.csv) — ${Object.keys(dat.correcciones).length}

Hay dos clases: rarezas del español (p. ej. "Hueso Fémur") y erratas evidentes (p. ej. "múculo", "ulmonar"). Archivo \`correcciones-nombres.json\` (clave = TA2ID). El latín no se cambió.

| TA2ID | inglés | TA2.csv | corregido |
|---|---|---|---|
${Object.entries(dat.correcciones).map(([k, c]) => `| ${k} | ${c.en} | ${c.de} | ${c.a} |`).join('\n')}

## 9. Capturas de los GLB finales

Decodificadas desde \`app/modelos/*.glb\` (no de los FBX): [cara y cráneo](capturas/final-a-cara-craneo.png), [mano derecha](capturas/final-b-mano-derecha.png), [corazón](capturas/final-c-corazon.png), [plexo braquial derecho](capturas/final-d-plexo-braquial-der.png), [encéfalo lateral](capturas/final-e-encefalo-lateral.png) y [cráneo (solo hueso)](capturas/final-a2-craneo-oseo.png), [pie derecho](capturas/final-f-pie-derecho.png), [columna cervical e hioides](capturas/final-g-columna-cervical.png), [cuerpo, hueso + músculo superficial](capturas/final-cuerpo-oseo-muscular.png). Se generan con \`npm run capturas\`.

## 10. Decisiones y hallazgos que matizan el SPEC

1. **Orientación**: ya correcta; no hizo falta rotar ni espejar (ver sección 1).
2. **Umbral de capa de músculo 1,95 cm en lugar de 1,5 cm** (sección 4).
3. **Sufijos**: coinciden con el SPEC §6.4. Matices: (a) hay 36 parches de inserción/origen sin TA2 porque su sufijo tiene dos cifras (\`Longissimus_thoracis_musclee17r\`, \`Levatores_longi_costarume10l\`); se reconocen aparte con una expresión regular y van a \`inserciones\`. (b) Algunos nombres sin TA2 son erratas con la letra de lado pegada (\`...(M3_segment)l\`); se rescata el lado por la letra final después de un paréntesis. (c) Dos nombres con apóstrofo (\`Central_canal'\`) son estructuras de línea media, no "otro".
4. **Devanado de los triángulos**: el FBX trae matrices con determinante negativo en los objetos del lado izquierdo (espejados en el origen). three.js lo compensa al dibujar, pero al hornear la matriz hay que **invertir el orden de los índices** en esos objetos; si no, las normales de todo el lado izquierdo salen invertidas (se vio en las capturas: media cara oscura). \`geom.mjs\` lo hace.
5. **Normales**: se sueldan los vértices por posición, se simplifica y las normales suaves se recalculan después de decimar (no se usan las del FBX).
6. **Lado en el catálogo**: el lado sale del sufijo r/l; cuando el objeto no lo trae pero el nombre inglés de TA2 empieza por Right/Left y la posición concuerda (x < 0 derecha), se rellena \`lado\` (125 casos) y se quita la palabra "derecho/izquierdo" final de \`nombre_es\`. Quedan ${'15'} estructuras sin lado con la palabra dentro del nombre propio TA2 (p. ej. segmentos hepáticos "izquierdo", que no son laterales del paciente).
7. **Inserciones** (\`inserciones.glb\`, opcional): incluido (705 parches, ${mb(conv.sistemas.inserciones.bytes)} MB, apagado por defecto). Subsistema \`origen\` o \`insercion\`; el nombre es "Origen: <músculo>" / "Inserción: <músculo> (n)" y la clave \`ta2\` es la del músculo.
8. **Piel**: el sistema \`piel\` son las 256 regiones de \`Regions of human body\` (no hay una malla de piel única). \`sistemas.json\` lleva además \`opacidad: 0.35\` para la piel y \`colores_subsistema\` para cardiovascular (venas) e \`inserciones\`; son campos extra que el SPEC no prohíbe.
9. **Descarga**: \`descargar.mjs\` usa \`curl\` (el \`fetch\` de Node no respeta el proxy del sandbox). ~10 minutos desde el sandbox.
10. **Atribución de autores**: el README de Z-Anatomy en el commit fijado no nombra autores ni las partes NC; la información NC viene del SPEC y queda sin verificar en origen.

## 10b. Correcciones de lado y de término TA2 (v3)

Ids cambiados (id viejo → id nuevo); solo cambian estos 10, el resto del catálogo es idéntico:

| id viejo | id nuevo | causa |
|---|---|---|
| tibial | tibia_i | el objeto \`Tibial\` (tibia izquierda) casaba con el término TA2 "Tibial" (41); ahora Tibia (1397), lado izquierdo |
| fibular | fibula_d | \`Fibular\` (peroné derecho) casaba con "Fibular" (40); ahora Fibula (1427), derecho |
| ulnar | ulna_d | \`Ulnar\` (cúbito derecho) casaba con "Ulnar" (39); ahora Ulna (1230), derecho |
| insular_branches_of_middle_cerebral_artery_m2_segment_i | insular_branches_of_middle_cerebral_artery_m2_i | errata del modelo ("(M2-segment)l"); alias de su gemelo derecho, ahora con su TA2 (4512) |
| iliocostalis_colli_muscle | iliocostalis_colli_muscle_i | objeto sin letra de lado; el gemelo derecho existe; x > 0 |
| descending_branch_of_lateral_circumflex_femoral_artery | descending_branch_of_lateral_circumflex_femoral_artery_d | idem; x < 0 |
| cochlear_nerve | cochlear_nerve_d | idem; x < 0 |
| common_plantar_digital_branches_of_medial_plantar_nerve | common_plantar_digital_branches_of_medial_plantar_nerve_d | idem; x < 0 |
| ulnopisiform_ligament | ulnopisiform_ligament_d | idem; x < 0 |
| intra_articular_ligament_of_head_of_rib | intra_articular_ligament_of_head_of_rib_i | idem; x > 0 |

Regla general (reglas.json: \`preferir_lado_si_hay_pareja\`, \`alias_objeto\`): (1) objeto = término TA2 + r/l con gemelo contralateral y el nombre sin la letra es término TA2 → manda el lado; (2) objeto sin letra de lado cuyo gemelo (mismo TA2 y archivo) sí la lleva → el lado que falta se deduce de la posición (|x| > 0,5 cm). Búsqueda sistemática sobre todo el catálogo: verificar.mjs comprueba ahora que toda estructura par (id _d/_i, salvo \`inserciones\`) tiene d e i (1 358 pares, 0 huérfanas). Excluidas a propósito: bronquio intermedio y lobar medio (solo existen a la derecha), arteria testicular (nombres Right/Left distintos) e \`inserciones\`, donde el modelo original tiene huecos en un lado (p. ej. interóseos plantares, serrato, pectíneo). Sin dudosos pendientes.

## 11b. Hasta dónde llega la malla original (límite del modelo)

Medido con tosquedad.mjs (arista media del triángulo de la malla ORIGINAL; datos en capturas/tosquedad-oseo.json). Con el óseo sin decimar, lo que se ve es lo que trae Z-Anatomy:
${(() => { const t = leerJSON(path.join(CAPTURAS, 'tosquedad-oseo.json')); return '| subsistema óseo | huesos | triángulos | arista mediana (mm) | arista máxima (mm) | tris por hueso (mediana) |\n|---|---|---|---|---|---|\n' + t.resumen.map(r => `| ${r.subsistema} | ${r.huesos} | ${r.tris_total.toLocaleString('es-CO')} | ${r.arista_mediana_mm} | ${r.arista_max_mm} | ${r.tris_mediano} |`).join('\n') + '\n\nHuesos con la arista media mayor: ' + t.mas_toscos.slice(0, 10).map(x => `${x.id} (${x.arista_media_mm} mm, ${x.tris} tris)`).join('; ') + '.\n\nHuesos con menos triángulos: ' + t.menos_triangulos.slice(0, 10).map(x => `${x.id} (${x.tris} tris, ${x.tamano_cm} cm)`).join('; ') + '.'; })()}

Lectura: los huesos largos (tibia, fémur, radio, hueso coxal) y los de manos y pies son de baja resolución (aristas de 2 a 8 mm; 130 a 800 triángulos en falanges y carpianos). Las superficies se ven suaves pero sin detalle fino (rugosidades, líneas de inserción, forámenes pequeños). Vértebras, cráneo, costillas y esternón tienen más triángulos pero tampoco son escaneos. Capturas: final-f-pie-derecho.png, final-g-columna-cervical.png y final-b-mano-derecha.png. Subir el ratio no inventa detalle que la fuente no tiene.

## 11. Pendiente o sin verificar

- Prueba visual en navegador (decisión D1 de la dirección): hecha solo con el rasterizador por software; no se probó el GLTFLoader de three.js sobre los GLB (sí se verificó que cargan con \`@gltf-transform/core\` y el decodificador meshopt).
- Carga inicial (óseo + piel, tope 9 MB): solo está medida la parte de modelos.
- Las traducciones propias y los nombres de las 3 estructuras ilegibles no los ha revisado un anatomista.
- Modelo solo masculino (D3, aceptado en v1).
`;
fs.writeFileSync(path.join(DIR, 'INFORME.md'), md);
console.log('INFORME.md escrito');
