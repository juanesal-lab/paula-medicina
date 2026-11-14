# Informe de contraste de fichas anatomicas (C7)

Generado por `pipeline-3d/contrastar-fichas.mjs` el 2026-11-13. Fuente de contraste: corpus StatPearls (OA, NCBI litarch), capitulos "Anatomy, ...". Diccionario espanol-ingles: TA2.csv. Regenerar sin tocar las fichas: `node pipeline-3d/contrastar-fichas.mjs --solo-informe`.

## Que significa `contrastado`

- `true`: al menos 2 campos evaluados y todos ellos tienen sus terminos anatomicos en el texto del capitulo StatPearls de esa estructura (o fueron confirmados leyendo el pasaje) y el capitulo es propio de la estructura. Los terminos se extraen del texto espanol de la ficha con TA2; es una comprobacion de presencia de nombres, no una lectura linea por linea.
- `false`: cualquier otro caso (sin capitulo propio, capitulo regional, algun campo `parcial`/`no_hallado`, o menos de 2 campos con terminos extraibles: un solo campo no basta para dar por contrastada la ficha). La app muestra el aviso "sin contraste" solo en este caso.
- Las 2 fichas oseas que ya eran `true` por OpenStax (temporal y mandibula) conservan `true` por esa lectura previa.

## Tabla por sistema

| Sistema | Fichas | Con capitulo | Contrastadas `true` | `false` |
|---|---:|---:|---:|---:|
| oseo | 159 | 53 | 3 | 156 |
| muscular | 88 | 44 | 8 | 80 |
| cardiovascular | 74 | 46 | 0 | 74 |
| nervioso | 71 | 31 | 0 | 71 |
| digestivo | 16 | 8 | 3 | 13 |
| respiratorio | 16 | 2 | 0 | 16 |
| urinario | 5 | 1 | 1 | 4 |
| reproductor | 6 | 1 | 1 | 5 |
| endocrino | 7 | 3 | 0 | 7 |
| linfatico | 8 | 2 | 2 | 6 |
| articular | 16 | 4 | 4 | 12 |
| **Total** | **466** | **195** | **22** | **444** |

De las 195 fichas con capitulo, 172 tienen capitulo propio y 23 solo capitulo regional (nervios y arterias; nunca llegan a `true`).

## Tasa por campo (solo fichas con capitulo; el campo cuenta cuando la ficha lo tiene con terminos extraibles)

| Campo | hallado | confirmado (manual) | parcial | no_hallado | sin_terminos | % hallado+confirmado sobre evaluados |
|---|---:|---:|---:|---:|---:|---:|
| inervacion | 63 | 8 | 34 | 6 | 7 | 64 % |
| irrigacion | 68 | 17 | 23 | 4 | 7 | 76 % |
| articulaciones | 5 | 0 | 32 | 16 | 0 | 9 % |
| inserciones | 4 | 0 | 31 | 6 | 10 | 10 % |
| origen | 20 | 0 | 9 | 9 | 6 | 53 % |
| insercion | 17 | 0 | 13 | 10 | 4 | 43 % |

## `true` por tipo de estructura (fichas con capitulo)

| Tipo | Con capitulo | `true` |
|---|---:|---:|
| hueso | 52 | 2 |
| otro | 1 | 0 |
| musculo | 44 | 8 |
| arteria | 38 | 0 |
| vena | 8 | 0 |
| nervio | 30 | 0 |
| organo | 18 | 7 |
| ligamento | 4 | 4 |

## Correcciones de contenido (antes -> despues y fuente)

- `ta2:978` (inervacion): "Nervio laríngeo recurrente." -> "Cartílago sin inervación propia. El nervio laríngeo superior (rama del vago) pasa por encima e inerva el músculo cricotiroideo.". Fuente: StatPearls: Anatomy, Head and Neck, Cricoid Cartilage, sección "Nerves" ("The cricoid cartilage is aneural"). La ficha atribuía la inervación del cartílago al recurrente; la fuente dice que el cartílago es aneural.
- `ta2:978` (irrigacion): "Arteria tiroidea inferior." -> "Cartílago avascular: se nutre por difusión desde los tejidos vecinos. Cerca pasan ramas de la arteria tiroidea superior.". Fuente: StatPearls: Anatomy, Head and Neck, Cricoid Cartilage, sección "Blood Supply and Lymphatics". La fuente cita la tiroidea superior (no la inferior) y describe el cartílago como avascular.
- `ta2:1885` (inervacion): "Nervio tibial y obturador (periferia)." -> "Rama fibular recurrente del nervio fibular común, que sigue a los vasos hacia la periferia y los cuernos del menisco.". Fuente: StatPearls: Anatomy, Bony Pelvis and Lower Limb, Knee Lateral Meniscus, sección "Nerves". El texto era el del menisco medial; el lateral se inerva por el fibular común (el tibial y el obturador corresponden al medial).

## Revision manual

Campos confirmados leyendo el pasaje: 26 (en 22 fichas).

### Muestra de `hallado` revisados al azar

| Ficha | Campo | Veredicto | Nota |
|---|---|---|---|
| ta2:2635 | irrigacion | correcto | Gracilis: "deep femoral artery" entre las ramas que lo irrigan. |
| ta2:2045 | inervacion | correcto | Recto lateral: "supplied by cranial nerve VI, the abducens nerve". |
| ta2:2650 | inervacion | correcto | Nervio fibular profundo confirmado; las raices L5-S1 no se verificaron una a una. |
| ta2:2666 | irrigacion | correcto | Arteria tibial posterior y fibular (peroneal) citadas. |
| ta2:2052 | inervacion | correcto | "CN III innervates the levator palpebrae superioris"; rama superior ("superior branch"). |
| ta2:1059*5 | irrigacion | correcto | Arterias intercostales posteriores (seccion Blood Supply de vertebras toracicas). |
| ta2:1068*1 | irrigacion | correcto | "lumbar arteries, typically L1 through L4". |
| ta2:2666 | origen | correcto | Membrana interosea y caras posteriores de tibia y peroné (fibula). |
| ta2:2650 | origen | correcto | Cara anterior del peroné y membrana interosea. |
| ta2:3081 | irrigacion | correcto | Arteria cistica, rama de la hepatica derecha. |
| ta2:2976 | irrigacion | correcto | Arteria apendicular, rama de la ileocolica. |
| ta2:1360 | inervacion | debil | Los nombres (femoral, obturador, ciatico) aparecen en el capitulo del femur como relaciones y vasos, no como inervacion del hueso; el campo debia leerse "hallado" solo con reserva. Caso tipico de sobreestimacion para huesos. |
| ta2:2635 | inervacion | correcto | Rama anterior del nervio obturador. |
| ta2:2469 | inervacion | correcto | Musculocutaneo (principal) y radial (lateral). |
| ta2:1500 | inervacion | parcial | Plantares medial y lateral y fibular profundo estan en el capitulo; la extraccion solo conto "fibular profundo" (cobertura 0,5). |
| ta2:1210 | articulaciones | correcto | Escafoides, semilunar, cubito citados como articulaciones del radio. |
| ta2:2382 | insercion | correcto | 12.a costilla y apofisis transversas L1-L4. |
| ta2:3114 | inervacion | correcto | Plexo celiaco y esplacnicos T6-T10; el vago no se evaluo. |
| ta2:1068*5 | irrigacion | correcto | Lumbares e iliolumbar para L5. |
| ta2:2165 | origen | correcto | Origen en la mandibula (la "linea milohioidea" aparece en el capitulo). |
| ta2:2044 | irrigacion | correcto | Rama inferior de la arteria oftalmica. |
| ta2:2644 | insercion | correcto | Cuneiforme medial y base del primer metatarsiano. |
| ta2:2666 | inervacion | correcto | Tibial; raices L4-S3 del ciatico, mas amplias que L4-L5 de la ficha. |
| ta2:2051 | irrigacion | correcto | Rama muscular medial de la oftalmica (y la infraorbitaria). |
| ta2:1068*2 | irrigacion | correcto | Igual que L1. |
| ta2:2650 | irrigacion | correcto | Arteria tibial anterior. |
| ta2:3081 | inervacion | correcto | Plexo celiaco y vago; dolor referido al hombro por el frenico. |
| ta2:2976 | inervacion | correcto | Plexo mesenterico superior; aferentes a T10. |

## Falsos negativos tipicos de la extraccion

- Nombres que el diccionario TA2 escribe distinto del texto de la ficha o de StatPearls: circunfleja escapular (TA2: "de la escápula"), toracoacromial/thoracoacromial, "ramos posteriores" = "dorsal rami", "peroneo" = "fibular". Se añadieron sinónimos (fibular/peroneal, coeliac/celiac, vermiform appendix/appendix, ductus/vas deferens, calcaneal/Achilles).
- Raíces nerviosas C5-C8, L4-S2: StatPearls suele dar el rango del plexo o del ciático, no el del músculo; la ficha puede ser correcta y quedar sin confirmar (p. ej. extensor largo del pulgar C7-C8, esternocleidomastoideo C2-C3).
- Estructuras citadas por su rama en vez de por el tronco ("nervio plantar lateral" frente a "LPN" del capítulo; "arteria femoral profunda" frente a "profunda femoris" o "deep artery of the thigh") y abreviaturas del capítulo (EPL, PIN, AIA, LPN).
- Frases calificativas dentro del campo ("periostio y médula ósea", "(rama muscular)", "zona roja"): no son términos TA2, bajan la cobertura y el campo pasa a parcial aunque el núcleo del dato esté en la fuente.
- Huesos: los campos articulaciones e inserciones mezclan nombres propios con descripciones ("Cara plantar", "Base de la cara dorsal"); TA2 casi no los reconoce, de modo que casi ningún hueso llega a true.
- Capítulos de familia (Ribs, Metatarsal Bones, Cervical/Thoracic/Lumbar Vertebrae): el texto cubre toda la familia, no cada pieza; los términos se hallan aunque no se hable de esa costilla o vértebra en particular (riesgo de falso positivo).
- Capítulo equivocado por nombre parcial: "Hueso coxal" cayó en "Hip" (región) y se descartó a mano; "Arteria coronaria derecha/izquierda" comparten el capítulo general "Heart Coronary Arteries (Archived)".
- Falsos positivos de coincidencia: un nombre puede aparecer en el capítulo como relación o complicación (fémur: nervios femoral/obturador/ciático) sin ser la inervación del hueso; la muestra revisada encontró 1 caso débil en 28.

## Notas

- Corpus: StatPearls OA de NCBI litarch (9 536 artículos, 673 "Anatomy, ..."). Las fichas sin capítulo (la mayoría de huesos de mano y pie, vértebras sueltas, cartílagos, sub-porciones musculares, vías del SNC, ramas segmentarias) no tienen capítulo "Anatomy, ..." con su nombre en el corpus: `contrastado` es false y no llevan `contraste`.
- Las fichas con capítulo regional (nervios craneales y arterias sin capítulo propio) quedan siempre en false: que el nombre aparezca en un capítulo general no contrasta los datos de esa estructura.
- Discrepancia no corregida: redondo mayor, nervio subescapular inferior: la ficha dice C5-C6; StatPearls dice C5, C6 y C7. No se cambió porque ambas cifras circulan en los textos; queda para decisión humana.
- Extensor largo del pulgar: la ficha da la arteria interósea posterior; la introducción del capítulo cita interósea anterior y posterior, radial y cubital (ficha correcta pero incompleta).
- Correcciones de contenido: 3 campos de 2 fichas (cartílago cricoides; menisco lateral). Detalle arriba.
