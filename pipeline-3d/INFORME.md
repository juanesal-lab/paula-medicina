# INFORME — pipeline de modelos 3D (encargo 02)

Generado por `pipeline-3d/informe.mjs` en cada `npm run todo`. Fuente: Z-Anatomy (commit fijado en el SPEC §6.2), nombres de TA2.csv.

## 1. Paso 0 · R2: orientación y lateralidad (resuelto)

Centroides en coordenadas world del FBX (cm), calculados con el inventario:

| comprobación | valor | meta | resultado |
|---|---|---|---|
| z de `Body_of_sternum` | 9.215 | mayor que z de `Vertebra_T5` (-6.91) | cumple: anterior = +Z |
| x de `Liver` | -2.114 | x < 0 (hígado a la derecha del paciente) | cumple |
| x de `Femurl` / `Femurr` | 9.224 / -9.224 | l en x > 0 | cumple |

**El modelo ya viene orientado como pide el SPEC**: no se rota ni se espeja (`rotY180 = false`, `espejoX = false`). Verificación ampliada con **todas** las estructuras con sufijo r/l y |x| > 0,3 cm: 2677 coherentes y 5 incoherentes (`Vagus_nerve_(X)r x=2.024`, `Lateral_temporomandibular_ligamentr x=5.377`, `Lateral_temporomandibular_ligamentl x=-5.377`, `Eyelashesr x=3.599`, `Eyelashesl x=-3.599`); son errores de nombre del modelo original (p. ej. `Eyelashes`, ligamento temporomandibular lateral, ramo del vago), no una inversión global. El lado del catálogo sigue el sufijo del objeto.

**Transformación final aplicada a todos los sistemas** (idéntica para todos, así encajan entre sí):
1. Matriz world del FBX (cm) aplicada a los vértices (se hornea; ver hallazgo 4 sobre el devanado).
2. Escala ×0.01 (cm → m).
3. Orientación: ninguna.
4. Traslación [0.00000, 0.00038, -0.01137] m: el punto más bajo de la piel (caja de `Regions`) queda en y = 0, la línea media en x = 0 (x del centroide del esternón; la caja de la piel no sirve porque los brazos son asimétricos) y la caja de la piel centrada en z = 0.
Resultado: Y arriba, anterior +Z, izquierda del paciente +X, altura ≈ 1,74 m. Guardada en `intermedio/transformacion.json`.

## 2. Paso 0 · R1: calidad del decimado (resuelto)

Script `prueba-decimado.mjs` + rasterizador propio `raster.mjs` (z-buffer, lambert, PNG con zlib; sin navegador ni dependencias nativas). Cinco encuadres y tres configuraciones de `simplify` (meshoptimizer con `LockBorder`; mallas de menos de 300 triángulos sin tocar y mínimo de 64). Cada montaje es una cuadrícula 2×2: arriba izquierda = original, arriba derecha = A, abajo izquierda = B, abajo derecha = C.

| vista | original (tris) | A 0,35/0,002 | B 0,2/0,005 | C 0,12/0,01 | capturas |
|---|---|---|---|---|---|
| a-cara-craneo | 311035 | 156671 | 82055 | 46489 | [montaje](capturas/r1-a-cara-craneo-montaje.png) |
| b-mano-derecha | 11834 | 8340 | 5718 | 3682 | [montaje](capturas/r1-b-mano-derecha-montaje.png) |
| c-corazon | 121782 | 51536 | 30128 | 18060 | [montaje](capturas/r1-c-corazon-montaje.png) |
| d-plexo-braquial-der | 124704 | 45218 | 26712 | 16778 | [montaje](capturas/r1-d-plexo-braquial-der-montaje.png) |
| e-encefalo-lateral | 689544 | 342857 | 226765 | 144476 | [montaje](capturas/r1-e-encefalo-lateral-montaje.png) |

Lectura (revisión visual de los cinco montajes):
- **(d) plexo braquial derecho, con A, B y C**: troncos, cordones y ramas siguen siendo tubos continuos, sin huecos visibles. C reduce 124 704 a 16 778 triángulos sin romper la continuidad.
- **(c) corazón, con A, B y C**: las coronarias y venas cardíacas siguen continuas; con C la superficie pierde algo de suavidad pero no hay huecos.
- **(e) encéfalo, con A, B y C**: las circunvoluciones se conservan; C las suaviza ligeramente.
- **(a) cara y cráneo**: A y B limpios; C deforma levemente las órbitas y deja una rendija en la línea media del epicráneo.
- **(b) mano derecha (huesos)**: B aceptable; **C degrada los huesos** (cabezas de metacarpianos angulosas y abolladas).

**Decisión de la v1 (histórica, sustituida por la sección 3)**: tubos finos (nervioso, cardiovascular) toleran la configuración C, que es la más agresiva; huesos y músculos se quedan en A/B. En la práctica el ratio de cada sistema lo fija el presupuesto de triángulos del SPEC §6.7 (`convertir.mjs` busca el ratio que da los triángulos objetivo ±10 %) y el **error máximo** viene de esta prueba: óseo 0,003 (ratio resultante 0,37, entre A y B), piel 0,004, articular 0,005, linfático 0,005, vísceras 0,005, muscular 0,006 (ratio 0,17, entre B y C), cardiovascular 0,01 (ratio 0,20) y nervioso 0,01 (ratio 0,13, cerca de C). Con `LockBorder` activo siempre. Capturas de los GLB finales: sección 8.

## 3. Sistemas generados

| sistema | estructuras | tris entrada | tris salida | bytes | tope | ratio / error |
|---|---|---|---|---|---|---|
| oseo | 277 | 701.877 | 701.877 | 4.930.292 (4.93 MB) | 8.00 MB | 1 / 0 |
| piel | 256 | 135.181 | 95.493 | 989.396 (0.99 MB) | 1.50 MB | 0.6 / 0.003 |
| articular | 413 | 358.026 | 231.317 | 2.092.680 (2.09 MB) | 3.50 MB | 0.6 / 0.003 |
| muscular | 683 | 2.323.575 | 915.051 | 6.968.692 (6.97 MB) | 10.00 MB | 0.38 / 0.004 |
| cardiovascular | 676 | 1.575.424 | 621.334 | 5.202.612 (5.20 MB) | 8.00 MB | 0.38 / 0.003 |
| nervioso | 582 | 2.395.504 | 1.001.999 | 7.328.108 (7.33 MB) | 10.00 MB | 0.38 / 0.003 |
| linfatico | 164 | 127.850 | 93.382 | 800.048 (0.80 MB) | 1.50 MB | 0.6 / 0.003 |
| digestivo | 49 | 395.793 | 238.599 | 1.559.856 (1.56 MB) | 3.39 MB | 0.6 / 0.003 |
| respiratorio | 37 | 255.315 | 153.646 | 1.046.300 (1.05 MB) | 2.18 MB | 0.6 / 0.003 |
| urinario | 8 | 19.980 | 12.262 | 92.276 (0.09 MB) | 0.17 MB | 0.6 / 0.003 |
| reproductor | 14 | 19.473 | 12.865 | 104.908 (0.10 MB) | 0.17 MB | 0.6 / 0.003 |
| endocrino | 10 | 11.308 | 7.522 | 65.956 (0.07 MB) | 0.10 MB | 0.6 / 0.003 |
| inserciones | 705 | 931.376 | 572.240 | 4.689.260 (4.69 MB) | 8.00 MB | 0.6 / 0.003 |
| **total** | 3874 | 9.250.682 | 4.657.587 | 35.870.384 (35.87 MB) | 45 MB | |

- **Presupuestos v2 (orden de la dirección, sustituyen al SPEC §6.7)**: óseo sin decimar (ratio 1; solo soldadura de vértices a 10 µm y normales recalculadas); articular, inserciones, vísceras, linfático y piel ratio 0,6 con error 0,003; muscular ratio 0,38 con error 0,004; cardiovascular y nervioso ratio 0,38 con error 0,003 (nunca por debajo de la config A de R1). Siempre con LockBorder. Topes: total ≤ 45 MB, ≤ 4,5 M triángulos con todo visible sin inserciones, carga inicial (óseo + piel) ≤ 9 MB, óseo ≤ 8 MB.
- `oseo` + `piel` = 5.92 MB (tope 9 MB). El óseo cabe en un solo GLB (4.93 MB): no se dividió y `sistemas.json` conserva su esquema.
- Total 35.87 MB (tope 45). Triángulos con todo visible, sin `inserciones` (apagado por defecto): 4.085.347 (tope 4,5 M).
- Las vísceras reparten su tope de bytes en proporción a sus triángulos de entrada.
- Ids, nombres, capas y lados del catálogo no cambian respecto a la versión anterior; solo geometría, bytes, tris, centro y radio.

## 4. Inventario y clasificación

- `inventario.mjs` reproduce el algoritmo del SPEC §6.4 sobre los 8 FBX: 5308 objetos (igual que el inventario de la dirección). **Coincidencia de `ta2` con `docs/datos/inventario-zanatomy.json`: 5306/5308 filas = 99.96 %** (mismo `archivo` y `nombre`). Diferencias: `CardioVascular41:?xr` y `CardioVascular41:?xl`: la referencia les asigna ta2 `""` (cadena vacía, una coincidencia espuria con un término vacío) y aquí quedan sin TA2; son objetos de nombre ilegible (ver sección 6).
- Estructuras en el catálogo: 3874 (descartados: 1 349 etiquetas `i`/`j`, 72 auxiliares o sin triángulos y las anclas sin TA2 de 12 triángulos).
- Capas de músculo (heurística de distancia a la piel). Distancia mediana de los vértices de la malla al punto más cercano de la piel (muestreo de la superficie de `Regions` cada 0,5 cm, rejilla hash de 1 cm; 600 vértices por malla). **Umbral usado: 1,95 cm, no 1,5 cm**, porque con 1,5 cm el recto abdominal (1,82 cm) caía en capa 2; la malla de `Regions` incluye el tejido subcutáneo y por eso toda distancia es ~1 cm mayor de lo esperado. Los grupos `Superficial_*` y `Deep_*` tienen prioridad cuando existen, y las fascias van a capa 1. Revisión de 10 músculos conocidos:

| malla | distancia (cm) | capa | esperada | |
|---|---|---|---|---|
| Acromial_part_of_deltoid_muscler | 0.82 | 1 | 1 | ok |
| Clavicular_head_of_pectoralis_major_muscler | 1.27 | 1 | 1 | ok |
| Descending_part_of_trapezius_muscler | 0.81 | 1 | 1 | ok |
| Rectus_abdominis_muscler | 1.82 | 1 | 1 | ok |
| Supraspinatus_muscler | 2.06 | 2 | 2 | ok |
| Psoas_majorr | 7.46 | 2 | 2 | ok |
| Transversus_abdominis_muscler | 2.74 | 2 | 2 | ok |
| Subscapularis_muscler | 3.84 | 2 | 2 | ok |
| Iliacus_muscler | 5.1 | 2 | 2 | ok |
| Tibialis_anterior_muscler | 0.94 | 1 | 1 | ok |

Decisiones de capa: coronarias, venas cardíacas, aorta, cavas, tronco pulmonar y todas las arterias y venas pulmonares = 5 (junto al corazón y los pulmones); resto de vasos = 3; sentidos (ojo y oído) = 5; SNC = 5; nervios periféricos y ganglios = 3; linfático = 3; óseo, articular e `inserciones` = 4; piel = 0.

## 5. Estructuras sin TA2 (traducción propia) — 101

Marcadas `nombre_fuente: "traduccion-propia"`, `nombre_la: null`. Traducciones en `traducciones-propias.json` (clave = nombre base del objeto sin letra de lado). Revisar por un anatomista antes de publicar.

| id | objeto FBX | nombre_es | sistema |
|---|---|---|---|
| tendon_sheath_of_tibialis_anterior_i | Tendon_sheath_of_tibialis_anteriorl | Vaina tendinosa del tibial anterior | muscular |
| tendon_sheath_of_tibialis_anterior_d | Tendon_sheath_of_tibialis_anteriorr | Vaina tendinosa del tibial anterior | muscular |
| trochanteric_bursa_of_gluteus_medius_muscle_d | Trochanteric_bursa_of_gluteus_medius_muscler | Bolsa trocantérica del glúteo medio | muscular |
| subfacial_prepatellar_bursa_d | Subfacial_prepatellar_bursar | Bolsa prepatelar subfascial | muscular |
| subfacial_prepatellar_bursa_i | Subfacial_prepatellar_bursal | Bolsa prepatelar subfascial | muscular |
| trochanteric_bursa_of_gluteus_medius_muscle_i | Trochanteric_bursa_of_gluteus_medius_musclel | Bolsa trocantérica del glúteo medio | muscular |
| tendon_sheath_abd_pollicis_longus_ext_pollicis_brevis_i | Tendon_sheath_-_abd_pollicis_longus_-_ext_pollicis_brevisl | Vaina tendinosa de los músculos abductor largo y extensor corto del pulgar | muscular |
| tendon_sheath_of_extensors_carpi_radialis_i | Tendon_sheath_of_extensors_carpi_radialisl | Vaina tendinosa de los extensores radiales del carpo | muscular |
| tendon_sheath_of_extensor_digiti_minimi_manus_i | Tendon_sheath_of_extensor_digiti_minimi_manusl | Vaina tendinosa del extensor del dedo meñique | muscular |
| tendon_sheath_of_extensor_digiti_minimi_manus_d | Tendon_sheath_of_extensor_digiti_minimi_manusr | Vaina tendinosa del extensor del dedo meñique | muscular |
| tendon_sheath_abd_pollicis_longus_ext_pollicis_brevis_d | Tendon_sheath_-_abd_pollicis_longus_-_ext_pollicis_brevisr | Vaina tendinosa de los músculos abductor largo y extensor corto del pulgar | muscular |
| tendon_sheath_of_extensors_carpi_radialis_d | Tendon_sheath_of_extensors_carpi_radialisr | Vaina tendinosa de los extensores radiales del carpo | muscular |
| cruciform_part_of_fibrous_sheath_of_digit_of_hand_d | Cruciform_part_of_fibrous_sheath_of_digit_of_handr | Parte cruciforme de la vaina fibrosa de los dedos de la mano | muscular |
| cruciform_part_of_fibrous_sheath_of_digit_of_hand_i | Cruciform_part_of_fibrous_sheath_of_digit_of_handl | Parte cruciforme de la vaina fibrosa de los dedos de la mano | muscular |
| coracobrachial_bursa_i | Coracobrachial_bursal | Bolsa del coracobraquial | muscular |
| coracobrachial_bursa_d | Coracobrachial_bursar | Bolsa del coracobraquial | muscular |
| subcutaneous_acromial_bursa_d | Subcutaneous_acromial_bursar | Bolsa subcutánea acromial | muscular |
| subcutaneous_acromial_bursa_i | Subcutaneous_acromial_bursal | Bolsa subcutánea acromial | muscular |
| middle_genicular_artery_d | Middle_genicular_arteryr | Arteria genicular media | cardiovascular |
| x_d | ?xr | Arteria craneal sin identificar (nombre ilegible en el modelo) | cardiovascular |
| proximal_lateral_striate_branches_d | Proximal_lateral_striate_branchesr | Ramas estriadas laterales proximales | cardiovascular |
| distal_lateral_striate_branches_d | Distal_lateral_striate_branchesr | Ramas estriadas laterales distales | cardiovascular |
| anterior_temporal_branch_d | Anterior_temporal_branchr | Rama temporal anterior | cardiovascular |
| artery_of_precentral_sulcus_d | Artery_of_precentral_sulcusr | Arteria del surco precentral | cardiovascular |
| artery_of_central_sulcus_d | Artery_of_central_sulcusr | Arteria del surco central | cardiovascular |
| temporo_occipital_branch_d | Temporo-occipital_branchr | Rama temporooccipital | cardiovascular |
| branch_to_angular_gyrus_d | Branch_to_angular_gyrusr | Rama para el giro angular | cardiovascular |
| posterior_parietal_artery_d | Posterior_parietal_arteryr | Arteria parietal posterior | cardiovascular |
| posterior_temporal_branch_d | Posterior_temporal_branchr | Rama temporal posterior | cardiovascular |
| prefrontal_artery_d | Prefrontal_arteryr | Arteria prefrontal | cardiovascular |
| lateral_frontobasal_artery_d | Lateral_frontobasal_arteryr | Arteria frontobasal lateral | cardiovascular |
| middle_genicular_artery_i | Middle_genicular_arteryl | Arteria genicular media | cardiovascular |
| proximal_lateral_striate_branches_i | Proximal_lateral_striate_branchesl | Ramas estriadas laterales proximales | cardiovascular |
| middle_cerebral_artery_m3_segment_i | Middle_cerebral_artery_(M3_segment)l | Arteria cerebral media (segmento M3) | cardiovascular |
| posterior_parietal_artery_i | Posterior_parietal_arteryl | Arteria parietal posterior | cardiovascular |
| posterior_temporal_branch_i | Posterior_temporal_branchl | Rama temporal posterior | cardiovascular |
| temporo_occipital_branch_i | Temporo-occipital_branchl | Rama temporooccipital | cardiovascular |
| branch_to_angular_gyrus_i | Branch_to_angular_gyrusl | Rama para el giro angular | cardiovascular |
| artery_of_central_sulcus_i | Artery_of_central_sulcusl | Arteria del surco central | cardiovascular |
| prefrontal_artery_i | Prefrontal_arteryl | Arteria prefrontal | cardiovascular |
| lateral_frontobasal_artery_i | Lateral_frontobasal_arteryl | Arteria frontobasal lateral | cardiovascular |
| artery_of_precentral_sulcus_i | Artery_of_precentral_sulcusl | Arteria del surco precentral | cardiovascular |
| anterior_temporal_branch_i | Anterior_temporal_branchl | Rama temporal anterior | cardiovascular |
| distal_lateral_striate_branches_i | Distal_lateral_striate_branchesl | Ramas estriadas laterales distales | cardiovascular |
| x_i | ?xl | Arteria craneal sin identificar (nombre ilegible en el modelo) | cardiovascular |
|  | ???????? | Vena cardíaca sin identificar (nombre ilegible en el modelo) | cardiovascular |
| inferior_vein_of_left_ventricle_posterior | Inferior_vein_of_left_ventricle_(Posterior_'') | Vena posterior del ventrículo izquierdo | cardiovascular |
| inferior_occipital_gyrus_and_sulcus_i | Inferior_occipital_gyrus_and_sulcus*l | Giro y surco occipital inferior | nervioso |
| inferior_occipital_gyrus_and_sulcus_d | Inferior_occipital_gyrus_and_sulcus*r | Giro y surco occipital inferior | nervioso |
| lateral_occipital_gyrus_middle_occipital_gyrus_d | Lateral_occipital_gyrus_(Middle_occipital_gyrus*)r | Giro occipital lateral (giro occipital medio) | nervioso |
| lateral_occipital_gyrus_middle_occipital_gyrus_i | Lateral_occipital_gyrus_(Middle_occipital_gyrus*)l | Giro occipital lateral (giro occipital medio) | nervioso |
| lunate_sulcus_d | Lunate_sulcusr | Surco semilunar | nervioso |
| lunate_sulcus_i | Lunate_sulcusl | Surco semilunar | nervioso |
| lat_fis_ant_horizont_i | Lat_Fis-ant-Horizontl | Rama anterior horizontal del surco lateral | nervioso |
| orbital_sulci_h_shaped_orbital_sulci_i | Orbital_sulci_(H-shaped_orbital_sulci*)l | Surcos orbitarios (surco orbitario en H) | nervioso |
| paracentral_gyrus_and_sulcus_i | Paracentral_gyrus_and_sulcus*l | Giro y surco paracentral | nervioso |
| precentral_sulcus_inferior_part_d | Precentral_sulcus_(inferior_part)*r | Surco precentral (parte inferior) | nervioso |
| orbital_sulci_lateral_orbital_sulcus_d | Orbital_sulci_(Lateral_Orbital_sulcus*)r | Surcos orbitarios (surco orbitario lateral) | nervioso |
| orbital_sulci_h_shaped_orbital_sulci_d | Orbital_sulci_(H-shaped_orbital_sulci*)r | Surcos orbitarios (surco orbitario en H) | nervioso |
| precentral_sulcus_superior_part_d | Precentral_sulcus_(Superior_part)*r | Surco precentral (parte superior) | nervioso |
| precentral_sulcus_inferior_part_i | Precentral_sulcus_(inferior_part)*l | Surco precentral (parte inferior) | nervioso |
| straight_gyrus_gyrus_rectus_d | Straight_gyrus_(Gyrus_rectus)r | Giro recto | nervioso |
| lat_fis_ant_vertical_i | Lat_Fis-ant-Verticall | Rama anterior ascendente del surco lateral | nervioso |
| lat_fis_ant_horizont_d | Lat_Fis-ant-Horizontr | Rama anterior horizontal del surco lateral | nervioso |
| paracentral_gyrus_and_sulcus_d | Paracentral_gyrus_and_sulcus*r | Giro y surco paracentral | nervioso |
| orbital_gyri_frontomarginal_gyrus_and_sulcus_i | Orbital_gyri_(Frontomarginal_gyrus_and_sulcus*)l | Giros orbitarios (giro y surco frontomarginal) | nervioso |
| orbital_sulci_lateral_orbital_sulcus_i | Orbital_sulci_(Lateral_Orbital_sulcus*)l | Surcos orbitarios (surco orbitario lateral) | nervioso |
| precentral_sulcus_superior_part_i | Precentral_sulcus_(Superior_part)*l | Surco precentral (parte superior) | nervioso |
| lat_fis_ant_vertical_d | Lat_Fis-ant-Verticalr | Rama anterior ascendente del surco lateral | nervioso |
| orbital_gyri_frontomarginal_gyrus_and_sulcus_d | Orbital_gyri_(Frontomarginal_gyrus_and_sulcus*)r | Giros orbitarios (giro y surco frontomarginal) | nervioso |
| straight_gyrus_gyrus_rectus_i | Straight_gyrus_(Gyrus_rectus)l | Giro recto | nervioso |
| occipitotemporal_sulcus_lateral_part_d | Occipitotemporal_sulcus_(Lateral_part*)r | Surco occipitotemporal (parte lateral) | nervioso |
| medial_occipitotemporal_gyrus_parahippocampal_i | Medial_occipitotemporal_gyrus_(Parahippocampal*)l | Giro occipitotemporal medial (giro parahipocampal) | nervioso |
| occipitotemporal_sulcus_lateral_part_i | Occipitotemporal_sulcus_(Lateral_part*)l | Surco occipitotemporal (parte lateral) | nervioso |
| medial_occipitotemporal_gyrus_parahippocampal_d | Medial_occipitotemporal_gyrus_(Parahippocampal*)r | Giro occipitotemporal medial (giro parahipocampal) | nervioso |
| superior_temporal_gyrus_lateral_part_i | Superior_temporal_gyrus_(Lateral_part)l | Giro temporal superior (parte lateral) | nervioso |
| superior_temporal_gyrus_lateral_part_d | Superior_temporal_gyrus_(Lateral_part)r | Giro temporal superior (parte lateral) | nervioso |
| cingulate_gyrus_and_sulcus_middle_posterior_part_d | Cingulate_gyrus_and_sulcus_(Middle_posterior_part)r | Giro y surco del cíngulo (parte media posterior) | nervioso |
| cingulate_gyrus_and_sulcus_middle_posterior_part_i | Cingulate_gyrus_and_sulcus_(Middle_posterior_part)l | Giro y surco del cíngulo (parte media posterior) | nervioso |
| cingulate_gyrus_posteroventral_part_d | Cingulate_gyrus_(Posteroventral_part*)r | Giro del cíngulo (parte posteroventral) | nervioso |
| cingulate_gyrus_and_sulcus_posterior_dorsal_part_i | Cingulate_gyrus_and_sulcus_(Posterior_dorsal_part)l | Giro y surco del cíngulo (parte posterior dorsal) | nervioso |
| cingulate_gyrus_posteroventral_part_i | Cingulate_gyrus_(Posteroventral_part*)l | Giro del cíngulo (parte posteroventral) | nervioso |
| cingulate_gyrus_and_sulcus_middle_anterior_part_i | Cingulate_gyrus_and_sulcus_(Middle_anterior_part)l | Giro y surco del cíngulo (parte media anterior) | nervioso |
| cingulate_sulcus_marginal_part_d | Cingulate_sulcus_(Marginal_part*)r | Surco del cíngulo (parte marginal) | nervioso |
| cingulate_gyrus_and_sulcus_middle_anterior_part_d | Cingulate_gyrus_and_sulcus_(Middle_anterior_part)r | Giro y surco del cíngulo (parte media anterior) | nervioso |
| cingulate_sulcus_marginal_part_i | Cingulate_sulcus_(Marginal_part*)l | Surco del cíngulo (parte marginal) | nervioso |
| cingulate_gyrus_and_sulcus_posterior_dorsal_part_d | Cingulate_gyrus_and_sulcus_(Posterior_dorsal_part)r | Giro y surco del cíngulo (parte posterior dorsal) | nervioso |
| posterior_transverse_collateral_sulcus_d | _Posterior_transverse_collateral_sulcusr | Surco colateral transverso posterior | nervioso |
| posterior_transverse_collateral_sulcus_i | _Posterior_transverse_collateral_sulcusl | Surco colateral transverso posterior | nervioso |
| anterior_occipital_sulcus_i | Anterior_occipital_sulcus*l | Surco occipital anterior | nervioso |
| sulcus_interm_prim_jensen_i | Sulcus_interm_prim-Jensenl | Surco intermedio primario de Jensen | nervioso |
| lat_fis_post_d | Lat_Fis-postr | Rama posterior del surco lateral | nervioso |
| sulcus_interm_prim_jensen_d | Sulcus_interm_prim-Jensenr | Surco intermedio primario de Jensen | nervioso |
| lat_fis_post_i | Lat_Fis-postl | Rama posterior del surco lateral | nervioso |
| anterior_occipital_sulcus_d | Anterior_occipital_sulcus*r | Surco occipital anterior | nervioso |
| insula_subcentral_gyrus_and_ant_and_post_sulci_d | Insula_(Subcentral_gyrus_and_ant_and_post_sulci*)r | Ínsula (giro subcentral y surcos anterior y posterior) | nervioso |
| insula_subcentral_gyrus_and_ant_and_post_sulci_i | Insula_(Subcentral_gyrus_and_ant_and_post_sulci*)l | Ínsula (giro subcentral y surcos anterior y posterior) | nervioso |
| frenula_capsulae_d | Frenula_capsulaer | Frenillos capsulares de la articulación de la cadera | articular |
| frenula_capsulae_i | Frenula_capsulael | Frenillos capsulares de la articulación de la cadera | articular |
| node_of_ligamentum_arteriosum | Node_of_ligamentum_arteriosum | Ganglio linfático del ligamento arterioso | linfatico |
| node_of_arch_of_azygos_vein | Node_of_arch_of_azygos_vein | Ganglio linfático del arco de la vena ácigos | linfatico |

## 6. Nombres ilegibles en el modelo (hallazgo)

Tres objetos tienen el nombre corrupto en el FBX (`?xr`, `?xl` y `????????`). Son hijos de la arteria del conducto pterigoideo (los dos primeros, 1 534 triángulos cada uno, cerca de la línea media a y≈157 cm) y del seno coronario (el tercero, una vena cardíaca anterior, 8 500 triángulos). No pude identificarlos con certeza: se llaman "Arteria craneal sin identificar" y "Vena cardíaca sin identificar". Pendiente de revisión anatómica.

## 7. Licencias no comerciales — 8 estructuras

- `cochlea_i` (Cóclea) — CC-BY-NC-SA-4.0
- `cochlea_d` (Cóclea) — CC-BY-NC-SA-4.0
- `vestibule_d` (Vestíbulo) — CC-BY-NC-SA-4.0
- `vestibule_i` (Vestíbulo) — CC-BY-NC-SA-4.0
- `renal_pelvis_d` (Pelvis renal) — CC-BY-NC-4.0
- `kidney_d` (Riñón) — CC-BY-NC-4.0
- `renal_pelvis_i` (Pelvis renal) — CC-BY-NC-4.0
- `kidney_i` (Riñón) — CC-BY-NC-4.0

Oído interno: solo existen cóclea y vestíbulo (r/l); no hay conductos semicirculares, ampollas óseas ni laberinto membranoso en las mallas. Riñón: `Kidney` y `Renal_pelvis` (r/l); los vasos intrarrenales no se marcan. Lista y texto en `app/ATRIBUCIONES.md`.

## 8. Correcciones de nombres (TA2.csv) — 49

Hay dos clases: rarezas del español (p. ej. "Hueso Fémur") y erratas evidentes (p. ej. "múculo", "ulmonar"). Archivo `correcciones-nombres.json` (clave = TA2ID). El latín no se cambió.

| TA2ID | inglés | TA2.csv | corregido |
|---|---|---|---|
| 222 | Philtrum | Philtrum | Filtrum (surco subnasal) |
| 256 | Hypochondriac region | Region hipocondriaca | Región hipocondriaca |
| 345 | Metatarsal region | Region metatarsiana | Región metatarsiana |
| 881 | Malleus | Malleus | Martillo |
| 888 | Incus | Incus | Yunque |
| 895 | Stapes | Estapedio | Estribo |
| 1071 | Sacrum | Hueso sacro | Sacro |
| 1230 | Ulna | Ulna | Cúbito |
| 1252 | Lunate bone | Hueso lunado | Semilunar |
| 1253 | Triquetrum bone | Hueso triquetral | Piramidal |
| 1259 | Hamate bone | Hueso hamatal | Ganchoso |
| 1360 | Femur | Hueso Fémur | Fémur |
| 1390 | Patella | Patela | Rótula |
| 1427 | Fibula | Fíbula | Peroné |
| 1448 | Talus | Hueso Talo | Astrágalo |
| 1742 | Inferior transverse scapular ligament | Ligamento transverso inferior de la escáupula | Ligamento transverso inferior de la escápula |
| 1771 | Transverse humeral ligament | Ligamento transverso del humero | Ligamento transverso del húmero |
| 1910 | Anterior ligament of fibular head | Ligamento anterior de la cabeza de la fibula | Ligamento anterior de la cabeza del peroné |
| 1911 | Posterior ligament of fibular head | Ligamento posterior de la cabeza de la fibula | Ligamento posterior de la cabeza del peroné |
| 2067 | Palpebral part of orbicularis oculi | Parte palpebral del múculo orbicular del ojo | Parte palpebral del músculo orbicular del ojo |
| 2265 | Longissimus colli muscle | Músculo longísmo del cuello | Músculo longísimo del cuello |
| 2377 | Linea alba | Linea alba | Línea alba |
| 2790 | Gingiva | Gingiva | Encía |
| 2879 | Laryngopharynx | Porción laríngea de la farínge | Porción laríngea de la faringe |
| 3985 | Inferior leaflet of right atrioventricular valve | Válvula posterior de la valva atrioventricular derecha | Valva inferior de la válvula tricúspide |
| 3990 | Posterior leaflet of left atrioventricular valve | Válvula posterior de la valva atrioventricular izquierda | Valva posterior de la válvula mitral |
| 3995 | Right coronary leaflet | Válvula coronaria aórtica derecha | Valva coronaria derecha de la válvula aórtica |
| 4010 | Right semilunar leaflet of pulmonary valve | Válvula semilunar derecha de la valva pulmonar | Valva semilunar derecha de la válvula pulmonar |
| 4108 | Right superior pulmonary vein | Vena ulmonar superior derecha | Vena pulmonar superior derecha |
| 4512 | Insular branches of middle cerebral artery (M2) | Ramas insulares de la arteria cerebra media (M2) | Ramas insulares de la arteria cerebral media (M2) |
| 4758 | Accessory hemi-azygos vein | Vena hemiácigos accessoria | Vena hemiácigos accesoria |
| 4887 | Superior ophthalmic vein | Vena oftalmica superior | Vena oftálmica superior |
| 5122 | Middle colic vein | Vena cólico media | Vena cólica media |
| 5272 | Pre-aortic nodes | Nodi prae-aortici | Nodos preaórticos |
| 5326 | Medial external iliac nodes | Nodos iliacos externos mediales | Nodos ilíacos externos mediales |
| 5375 | Tentorium cerebelli | Tienda del cerebello | Tienda del cerebelo |
| 5479 | Precuneus | Precuneus | Precúneo |
| 5485 | Cuneus | Cuneus | Cúneo |
| 5592 | Stria terminalis | Stria terminalis | Estría terminal |
| 5633 | Fornix | Fornix | Fórnix |
| 5647 | Septum pellucidum | Septum pellucidum | Septo pelúcido |
| 5818 | Flocculus | Flocculus | Flóculo |
| 6163 | Cauda equina | Cauda equina | Cola de caballo |
| 6283 | Abducens nerve (VI) | Nervio abducens (VI) | Nervio abducente (VI) |
| 6456 | Proper palmar digital branches of ulnar nerve | Ramos digitales palmares propias del nervio ulnar | Ramos digitales palmares propios del nervio ulnar |
| 6457 | Deep branch of ulnar nerve | Ramo profunda del nervio ulnar | Ramo profundo del nervio ulnar |
| 6856 | Ampulla of lacrimal canaliculus | Ampulla del canalículo lacrimal | Ampolla del canalículo lagrimal |
| 7071 | Perionyx | Perionyx | Periniquio |
| 7138 | Articular capsule of glenohumeral joint | Capsula articular de la articulacion glenohumeral | Cápsula articular de la articulación glenohumeral |

## 9. Capturas de los GLB finales

Decodificadas desde `app/modelos/*.glb` (no de los FBX): [cara y cráneo](capturas/final-a-cara-craneo.png), [mano derecha](capturas/final-b-mano-derecha.png), [corazón](capturas/final-c-corazon.png), [plexo braquial derecho](capturas/final-d-plexo-braquial-der.png), [encéfalo lateral](capturas/final-e-encefalo-lateral.png) y [cráneo (solo hueso)](capturas/final-a2-craneo-oseo.png), [pie derecho](capturas/final-f-pie-derecho.png), [columna cervical e hioides](capturas/final-g-columna-cervical.png), [cuerpo, hueso + músculo superficial](capturas/final-cuerpo-oseo-muscular.png). Se generan con `npm run capturas`.

## 10. Decisiones y hallazgos que matizan el SPEC

1. **Orientación**: ya correcta; no hizo falta rotar ni espejar (ver sección 1).
2. **Umbral de capa de músculo 1,95 cm en lugar de 1,5 cm** (sección 4).
3. **Sufijos**: coinciden con el SPEC §6.4. Matices: (a) hay 36 parches de inserción/origen sin TA2 porque su sufijo tiene dos cifras (`Longissimus_thoracis_musclee17r`, `Levatores_longi_costarume10l`); se reconocen aparte con una expresión regular y van a `inserciones`. (b) Algunos nombres sin TA2 son erratas con la letra de lado pegada (`...(M3_segment)l`); se rescata el lado por la letra final después de un paréntesis. (c) Dos nombres con apóstrofo (`Central_canal'`) son estructuras de línea media, no "otro".
4. **Devanado de los triángulos**: el FBX trae matrices con determinante negativo en los objetos del lado izquierdo (espejados en el origen). three.js lo compensa al dibujar, pero al hornear la matriz hay que **invertir el orden de los índices** en esos objetos; si no, las normales de todo el lado izquierdo salen invertidas (se vio en las capturas: media cara oscura). `geom.mjs` lo hace.
5. **Normales**: se sueldan los vértices por posición, se simplifica y las normales suaves se recalculan después de decimar (no se usan las del FBX).
6. **Lado en el catálogo**: el lado sale del sufijo r/l; cuando el objeto no lo trae pero el nombre inglés de TA2 empieza por Right/Left y la posición concuerda (x < 0 derecha), se rellena `lado` (125 casos) y se quita la palabra "derecho/izquierdo" final de `nombre_es`. Quedan 15 estructuras sin lado con la palabra dentro del nombre propio TA2 (p. ej. segmentos hepáticos "izquierdo", que no son laterales del paciente).
7. **Inserciones** (`inserciones.glb`, opcional): incluido (705 parches, 4.69 MB, apagado por defecto). Subsistema `origen` o `insercion`; el nombre es "Origen: <músculo>" / "Inserción: <músculo> (n)" y la clave `ta2` es la del músculo.
8. **Piel**: el sistema `piel` son las 256 regiones de `Regions of human body` (no hay una malla de piel única). `sistemas.json` lleva además `opacidad: 0.35` para la piel y `colores_subsistema` para cardiovascular (venas) e `inserciones`; son campos extra que el SPEC no prohíbe.
9. **Descarga**: `descargar.mjs` usa `curl` (el `fetch` de Node no respeta el proxy del sandbox). ~10 minutos desde el sandbox.
10. **Atribución de autores**: el README de Z-Anatomy en el commit fijado no nombra autores ni las partes NC; la información NC viene del SPEC y queda sin verificar en origen.

## 10b. Correcciones de lado y de término TA2 (v3)

Ids cambiados (id viejo → id nuevo); solo cambian estos 10, el resto del catálogo es idéntico:

| id viejo | id nuevo | causa |
|---|---|---|
| tibial | tibia_i | el objeto `Tibial` (tibia izquierda) casaba con el término TA2 "Tibial" (41); ahora Tibia (1397), lado izquierdo |
| fibular | fibula_d | `Fibular` (peroné derecho) casaba con "Fibular" (40); ahora Fibula (1427), derecho |
| ulnar | ulna_d | `Ulnar` (cúbito derecho) casaba con "Ulnar" (39); ahora Ulna (1230), derecho |
| insular_branches_of_middle_cerebral_artery_m2_segment_i | insular_branches_of_middle_cerebral_artery_m2_i | errata del modelo ("(M2-segment)l"); alias de su gemelo derecho, ahora con su TA2 (4512) |
| iliocostalis_colli_muscle | iliocostalis_colli_muscle_i | objeto sin letra de lado; el gemelo derecho existe; x > 0 |
| descending_branch_of_lateral_circumflex_femoral_artery | descending_branch_of_lateral_circumflex_femoral_artery_d | idem; x < 0 |
| cochlear_nerve | cochlear_nerve_d | idem; x < 0 |
| common_plantar_digital_branches_of_medial_plantar_nerve | common_plantar_digital_branches_of_medial_plantar_nerve_d | idem; x < 0 |
| ulnopisiform_ligament | ulnopisiform_ligament_d | idem; x < 0 |
| intra_articular_ligament_of_head_of_rib | intra_articular_ligament_of_head_of_rib_i | idem; x > 0 |

Regla general (reglas.json: `preferir_lado_si_hay_pareja`, `alias_objeto`): (1) objeto = término TA2 + r/l con gemelo contralateral y el nombre sin la letra es término TA2 → manda el lado; (2) objeto sin letra de lado cuyo gemelo (mismo TA2 y archivo) sí la lleva → el lado que falta se deduce de la posición (|x| > 0,5 cm). Búsqueda sistemática sobre todo el catálogo: verificar.mjs comprueba ahora que toda estructura par (id _d/_i, salvo `inserciones`) tiene d e i (1 358 pares, 0 huérfanas). Excluidas a propósito: bronquio intermedio y lobar medio (solo existen a la derecha), arteria testicular (nombres Right/Left distintos) e `inserciones`, donde el modelo original tiene huecos en un lado (p. ej. interóseos plantares, serrato, pectíneo). Sin dudosos pendientes.

## 11b. Hasta dónde llega la malla original (límite del modelo)

Medido con tosquedad.mjs (arista media del triángulo de la malla ORIGINAL; datos en capturas/tosquedad-oseo.json). Con el óseo sin decimar, lo que se ve es lo que trae Z-Anatomy:
| subsistema óseo | huesos | triángulos | arista mediana (mm) | arista máxima (mm) | tris por hueso (mediana) |
|---|---|---|---|---|---|
| miembro-inferior | 64 | 54.756 | 2.56 | 7.65 | 532 |
| dientes | 28 | 46.860 | 0.91 | 0.94 | 1470 |
| columna-vertebral | 26 | 72.927 | 2.87 | 3.72 | 2336 |
| craneo | 37 | 142.999 | 1.76 | 3.56 | 1460 |
| cartilagos | 11 | 15.942 | 1.38 | 3.33 | 347 |
| torax-oseo | 47 | 274.707 | 1.74 | 2.66 | 5364 |
| miembro-superior | 64 | 93.686 | 2.39 | 6.21 | 472 |

Huesos con la arista media mayor: tibia_d (7.65 mm, 1670 tris); tibia_i (7.65 mm, 1670 tris); radius_i (6.21 mm, 784 tris); radius_d (6.21 mm, 784 tris); femur_i (6.2 mm, 3794 tris); femur_d (6.2 mm, 3794 tris); hip_bone_d (5.88 mm, 3788 tris); hip_bone_i (5.88 mm, 3788 tris); ulna_i (5.76 mm, 904 tris); ulna_d (5.76 mm, 904 tris).

Huesos con menos triángulos: distal_phalanx_of_fourth_finger_of_hand_i (134 tris, 2.1 cm); distal_phalanx_of_fourth_finger_of_hand_d (134 tris, 2.1 cm); corniculate_cartilage_d (136 tris, 0.3 cm); corniculate_cartilage_i (136 tris, 0.3 cm); triquetrum_bone_d (176 tris, 2.4 cm); triquetrum_bone_i (176 tris, 2.4 cm); distal_phalanx_of_fifth_finger_of_hand_i (192 tris, 2.2 cm); distal_phalanx_of_third_finger_of_hand_i (192 tris, 2.5 cm); distal_phalanx_of_fifth_finger_of_hand_d (192 tris, 2.2 cm); distal_phalanx_of_third_finger_of_hand_d (192 tris, 2.5 cm).

Lectura: los huesos largos (tibia, fémur, radio, hueso coxal) y los de manos y pies son de baja resolución (aristas de 2 a 8 mm; 130 a 800 triángulos en falanges y carpianos). Las superficies se ven suaves pero sin detalle fino (rugosidades, líneas de inserción, forámenes pequeños). Vértebras, cráneo, costillas y esternón tienen más triángulos pero tampoco son escaneos. Capturas: final-f-pie-derecho.png, final-g-columna-cervical.png y final-b-mano-derecha.png. Subir el ratio no inventa detalle que la fuente no tiene.

## 11. Pendiente o sin verificar

- Prueba visual en navegador (decisión D1 de la dirección): hecha solo con el rasterizador por software; no se probó el GLTFLoader de three.js sobre los GLB (sí se verificó que cargan con `@gltf-transform/core` y el decodificador meshopt).
- Carga inicial (óseo + piel, tope 9 MB): solo está medida la parte de modelos.
- Las traducciones propias y los nombres de las 3 estructuras ilegibles no los ha revisado un anatomista.
- Modelo solo masculino (D3, aceptado en v1).
