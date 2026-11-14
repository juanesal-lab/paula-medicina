# SPEC — Proyecto "Paula"

Versión 1 · 2026-11-13 · Autor: dirección técnica. Este documento es la fuente de verdad. Si un encargo y el SPEC chocan, gana el SPEC; si ves una contradicción, repórtala al terminar y no improvises.

Raíz del proyecto (en adelante `RAIZ`):
`<carpeta del proyecto>/` (la raíz de este repositorio)

Todo va dentro de `RAIZ`. Nada se escribe en `.claude/` (ni en la del proyecto ni en la del workspace). Sin git push, sin cuentas, sin instalaciones globales. Las dependencias npm se instalan solo en carpetas locales y con caché local: `npm install --cache "$TMPDIR/npm-cache" ...` (la caché `~/.npm` de esta máquina tiene permisos rotos; se comprobó).

---

## 1. Qué es

Proyecto autocontenido para una estudiante de medicina en Colombia. Tiene tres piezas:

1. **Skill `/paula`**: tutora de medicina. Responde preguntas, corre casos clínicos, hace quices, resume temas y abre la app de anatomía. Consulta primero la base local y luego busca en vivo en fuentes confiables, citando la fuente.
2. **Base de conocimiento** (`conocimiento/`): 23 archivos markdown por especialidad, con formato fijo y fuentes abiertas.
3. **App de anatomía 3D** (`app/`): web estática con three.js y mallas anatómicas reales de licencia abierta (Z-Anatomy). Funciona sin internet con un servidor estático y en GitHub Pages.

## 2. Árbol de carpetas y dueño de cada archivo

Cada archivo tiene **un solo dueño** (número de encargo). Nadie escribe fuera de lo suyo.

```
paula-medicina/
├── README.md                      (01) qué es, cómo se usa, licencias
├── .gitignore                     (01)
├── LICENSE                        (01) MIT, solo para el código
├── docs/
│   ├── SPEC.md, CHECKLIST-REVISION.md, encargos/   (dirección; no tocar)
│   ├── launch.json.ejemplo        (dirección) config de servidor para el panel de navegador
│   ├── datos/inventario-zanatomy.json  (dirección) inventario medido de las mallas (ver §6.4)
│   ├── INSTALACION.md             (01)
│   └── herramientas/
│       ├── validar_conocimiento.mjs   (01) linter de la base de conocimiento
│       └── generar_indice.mjs         (01) regenera la sección automática de conocimiento/INDICE.md
├── skill/paula/                   (01) todo lo que hay dentro
│   ├── SKILL.md
│   ├── references/*.md
│   └── assets/launch.json
├── conocimiento/
│   ├── INDICE.md                  (01)
│   ├── FORMATO.md                 (01) copia normativa del §5 de este SPEC
│   ├── basicas/anatomia.md, fisiologia.md, bioquimica.md, farmacologia.md      (05)
│   ├── clinica/semiologia.md                                                   (06)
│   ├── interna/cardiologia.md, neumologia.md, nefrologia.md                    (06)
│   ├── interna/gastroenterologia.md, endocrinologia.md, hematologia.md, reumatologia.md (07)
│   ├── interna/infectologia.md                                                 (08)
│   ├── cirugia/cirugia-general.md, trauma.md                                   (08)
│   ├── urgencias/urgencias.md                                                  (08)
│   ├── pediatria/pediatria.md                                                  (09)
│   ├── gineco-obstetricia/ginecologia.md, obstetricia.md                       (09)
│   ├── neurologia/neurologia.md                                                (10)
│   ├── psiquiatria/psiquiatria.md                                              (10)
│   ├── dermatologia/dermatologia.md                                            (10)
│   └── salud-publica/salud-publica.md                                          (10)
├── pipeline-3d/                   (02) todo lo que hay dentro (crudo/ e intermedio/ van en .gitignore)
└── app/
    ├── index.html, css/, js/, fonts/, vendor/three/, dev/          (03)
    ├── LICENSE-CODIGO.txt                                           (03) MIT
    ├── modelos/*.glb                                                (02)
    ├── datos/catalogo.json, datos/sistemas.json                     (02)
    ├── datos/fichas/manifest.json, datos/fichas/<sistema>.json      (04)
    └── ATRIBUCIONES.md                                              (02)
```

### Decisión: la base de conocimiento va en `conocimiento/`, en la raíz del proyecto, fuera de la skill

- La skill se instalará en `.claude/skills/paula/`. Paula abre la sesión en la raíz del proyecto, así que `conocimiento/...` es una ruta relativa estable, sin importar dónde quede instalada la skill.
- La skill queda pequeña y portable (método y plantillas), y el contenido crece o se corrige sin reinstalarla.
- Paula puede abrir y editar los markdown directamente, y la app o futuras herramientas pueden leerlos.
- Si la skill no encuentra `conocimiento/INDICE.md` en el directorio de trabajo, lo busca con Glob (`**/conocimiento/INDICE.md`). Si no aparece, avisa una vez y sigue solo con búsqueda en vivo.

## 3. Skill `/paula` (encargo 01)

- `SKILL.md` de 300 líneas o menos (objetivo: 200 o menos), en español, con frontmatter `name: paula` y una `description` que dispare con: "/paula", "Paula", "caso clínico", "quiz/quiz de medicina", "resúmeme", "anatomía 3D", "explícame [tema médico]".
- Al invocarse sin argumento muestra un menú breve:
  1. Preguntar cualquier cosa
  2. Caso clínico interactivo
  3. Quiz
  4. Resumen de un tema
  5. Abrir la app de anatomía 3D
  6. Repasar lo que fallé
  Debajo va una línea con lo que hay en la base: especialidades disponibles, leídas de `conocimiento/INDICE.md`. Si se invoca con argumento (`/paula qué es el síndrome nefrótico`), responde directamente.
- **Método de respuesta**, en `references/metodo.md`:
  1. Grep en `conocimiento/` por términos y por encabezados `^## \[`, luego Read solo de la sección encontrada.
  2. Si falta o está incompleto, búsqueda en vivo (WebSearch/WebFetch) **solo** en los dominios de `references/fuentes.md`.
  3. Cita siempre (`Fuente: título — URL`), separando lo que salió de la base local de lo que se buscó en vivo.
  4. Marca explícitamente lo incierto ("**Incierto:**") y cuando las guías difieren ("**Las guías difieren:** AHA dice X; ESC dice Y; GPC Colombia dice Z").
  5. Da prioridad al contexto colombiano: GPC de MinSalud/IETS, protocolos INS, PAI y Resolución 3280 cuando aplique.
- **Aviso clínico una sola vez** por sesión, en el menú: "Material de estudio: no sustituye el criterio clínico ni la supervisión docente." No se repite salvo que pregunte por un paciente real o por automedicación; en ese caso se recuerda en una línea.
- Tono: tutora colombiana, didáctica y directa, de tú. Explica el porqué fisiopatológico y cierra con una pregunta de verificación cuando tiene sentido. Nada de sermones.
- `references/` (divulgación progresiva; SKILL.md dice cuándo leer cada uno): `metodo.md`, `fuentes.md`, `caso-clinico.md`, `quiz.md`, `resumen.md`, `anatomia-3d.md`, `estilo.md`, `progreso.md`.
- **Progreso**: los quices y casos fallados se anotan en `progreso/registro.md` en la raíz del proyecto (lo crea la skill en el primer uso, con permiso). "Repasar lo que fallé" lee ese archivo.
- **App 3D desde la skill** (`references/anatomia-3d.md`):
  1. Si existe `.claude/launch.json` con la configuración `paula-anatomia`, abre con `preview_start` por nombre.
  2. Si no existe, ofrece copiarlo desde `assets/launch.json`, con permiso de Paula.
  3. Si no hay panel o falla, intenta `python3 -m http.server 8765 --directory app` y abre `http://localhost:8765`.
  4. Si nada de eso sirve, da la URL de GitHub Pages si está configurada en `README.md`.
  Lee la selección con la herramienta de JavaScript del panel (`JSON.stringify(window.paulaSelection)`) y puede manejar la app con `window.paulaApp` (§7.6).

## 4. Base de conocimiento — contenido y reparto

| Archivo | Prefijo | Encargo |
|---|---|---|
| basicas/anatomia.md | ANAT | 05 |
| basicas/fisiologia.md | FISIO | 05 |
| basicas/bioquimica.md | BIOQ | 05 |
| basicas/farmacologia.md | FARMA | 05 |
| clinica/semiologia.md | SEMIO | 06 |
| interna/cardiologia.md | CARD | 06 |
| interna/neumologia.md | NEUMO | 06 |
| interna/nefrologia.md | NEFRO | 06 |
| interna/gastroenterologia.md | GASTRO | 07 |
| interna/endocrinologia.md | ENDO | 07 |
| interna/hematologia.md | HEMATO | 07 |
| interna/reumatologia.md | REUMA | 07 |
| interna/infectologia.md | INFECTO | 08 |
| cirugia/cirugia-general.md | CIRUG | 08 |
| cirugia/trauma.md | TRAUMA | 08 |
| urgencias/urgencias.md | URG | 08 |
| pediatria/pediatria.md | PEDIA | 09 |
| gineco-obstetricia/ginecologia.md | GINE | 09 |
| gineco-obstetricia/obstetricia.md | OBST | 09 |
| neurologia/neurologia.md | NEURO | 10 |
| psiquiatria/psiquiatria.md | PSIQ | 10 |
| dermatologia/dermatologia.md | DERMA | 10 |
| salud-publica/salud-publica.md | SALUDP | 10 |

Agrupación: seis constructores de investigación (05–10) con 3 o 4 archivos cada uno, por afinidad y equilibrio de carga. Infectología va con urgencias y cirugía (08) por su peso en el trópico (dengue, malaria, sepsis).

Mínimos por archivo: **10 temas y 4 casos** (objetivo: 12 y 5). En ciencias básicas, los casos son de correlación básico-clínica. Tamaño entre 20 y 70 KB.

### Fuentes permitidas (lista blanca)

Valen para la base y para la búsqueda en vivo de la skill:

- `ncbi.nlm.nih.gov` (StatPearls/Bookshelf, PMC open access), `pubmed.ncbi.nlm.nih.gov` (solo para identificar el artículo)
- `who.int`, `iris.who.int`, `paho.org`, `iris.paho.org`
- `cdc.gov`, `nice.org.uk`, `msdmanuals.com` (versión profesional, preferible en español)
- `minsalud.gov.co`, `gpc.minsalud.gov.co`, `iets.org.co`, `ins.gov.co`
- `openstax.org`, `medlineplus.gov`, `cochranelibrary.com` (resúmenes)
- Guías de sociedades de acceso abierto: `kdigo.org`, `goldcopd.org`, `ginasthma.org`, `diabetesjournals.org` (ADA Standards of Care), `ahajournals.org`, `escardio.org`, `idsociety.org`, `rcog.org.uk`, `figo.org`, `aap.org`, `acog.org` (solo lo que sea abierto), `surgicalcriticalcare.net`, `sccm.org` (Surviving Sepsis), `facs.org`, `who.int` (IMCI/AIEPI)

Wikipedia, blogs, UpToDate, Medscape, Amboss y Kenhub **no** se citan. Se pueden usar para orientarse, nunca como fuente.

Derechos de autor: todo se redacta con palabras propias. Prohibido copiar párrafos. Como máximo una cita textual de menos de 15 palabras por archivo, y solo si es imprescindible (por ejemplo, un criterio con nombre propio). Las tablas de criterios se reescriben y se citan.

## 5. Formato normativo de los archivos de conocimiento

Este bloque se copia a `conocimiento/FORMATO.md` (encargo 01). El linter (`docs/herramientas/validar_conocimiento.mjs`) lo hace cumplir.

````markdown
---
area: Cardiología
archivo: conocimiento/interna/cardiologia.md
prefijo: CARD
actualizado: 2026-11-13
temas: [Insuficiencia cardiaca, Síndrome coronario agudo, ...]   # lista de títulos de temas
casos: [Dolor torácico en el posoperatorio, ...]                  # lista de títulos de casos
---
# Cardiología

## Índice
- [CARD-T01] Insuficiencia cardiaca
- [CARD-C01] Caso: Dolor torácico en el posoperatorio

## [CARD-T01] Insuficiencia cardiaca
**Palabras clave:** ICFEr, FEVI, NT-proBNP, ...
**Lo esencial:**
- viñetas de alto rendimiento (fisiopatología → clínica → diagnóstico → manejo)
**Diagnóstico:** ... criterios y puntos de corte, cada uno con [Fn] en la misma línea
**Manejo:** ... dosis con [Fn] en la misma línea
**En Colombia:** (si aplica: GPC MinSalud/IETS, INS, PAI, Res. 3280) ... [Fn]
**Las guías difieren:** (si aplica) ... [Fn][Fm]
**Incierto:** (si aplica) ...
**Perlas de examen:** ...
**Errores típicos:** ...

## [CARD-C01] Caso: Dolor torácico en el posoperatorio
**Presentación:** viñeta con edad, sexo, contexto, signos vitales, examen físico
**Diagnóstico diferencial:** 3–6 opciones con el porqué de cada una
**Estudios:** qué pedir, en qué orden y qué esperar
**Manejo:** pasos concretos [Fn]
**Perlas:** ...
**Errores típicos:** ...
**Fuente:** [Fn]

## Fuentes
- [F1] Título del documento — Organización o autores, año. https://... (consultado 2026-11-13)
````

Reglas duras (las verifica el linter):

1. IDs `[PREFIJO-Tnn]` y `[PREFIJO-Cnn]` únicos, de dos dígitos, consecutivos. Cada uno aparece en el Índice y como encabezado `## `.
2. Cada caso tiene, en este orden, las 7 etiquetas: Presentación, Diagnóstico diferencial, Estudios, Manejo, Perlas, Errores típicos, Fuente.
3. **Dato sensible = cifra con unidad o punto de corte.** Patrón: número seguido de `mg|mcg|µg|g|UI|U/|mEq|mmol|mmHg|%|kg|mL|L/|lpm|/min|h\b|días|semanas|años|cm|mm|°C|puntos|x10`, o los operadores `≥ ≤ > <` junto a un número. Toda línea con un dato sensible lleva `[Fn]` **en la misma línea**. Excepción: líneas con la marca literal `(ejercicio)` (datos inventados de ejercicios de cálculo, p. ej. salud pública). Las cifras dentro de la **Presentación** de un caso (signos vitales, laboratorios del paciente ficticio) también están exentas; el linter ignora las líneas que empiezan por `**Presentación:**`.
4. Cada `[Fn]` citado existe en `## Fuentes`, y cada fuente tiene URL `https://` de la lista blanca. Las URL las verificó el constructor (HTTP 200 o redirección válida) el día que escribió.
5. Las dosis se dan en adulto salvo que se diga otra cosa, con vía y frecuencia. En pediatría, por kg y con dosis máxima.
6. Sin datos personales y sin pacientes reales.

## 6. Modelos 3D — decisión de fuente, evidencia y pipeline

### 6.1 Decisión

**Fuente principal: Z-Anatomy, exportaciones FBX por sistema del repositorio `LluisV/Z-Anatomy` (rama `PC-Version`, commit `6c7f9016bd5899ac8edafd31b9900c151df42ed6`, 2024-12-25).** Licencia CC BY-SA 4.0, derivada de BodyParts3D (DBCLS).
**Nombres en latín y español: `TA2.csv` de `Z-Anatomy/Models-of-human-anatomy`** (commit `dd72c25bb57e47f8baf0333c3a926fb4ec8172fd`), con columnas TA2ID; English; Latin; Français; Español; ...
**Respaldo, solo si Z-Anatomy falla: BodyParts3D 4.0** (OBJ, CC BY 4.0), descrito en §6.6.

### 6.2 Evidencia (comprobado el 2026-11-13 desde esta máquina)

| Archivo (Resources/Models/FBX/) | Bytes | SHA-256 | Mallas útiles | Triángulos útiles |
|---|---|---|---|---|
| SkeletalSystem100.fbx | 41 339 660 | 294a649765cd060a62a4095da52b9c8ef2d97769aa447e196448aa5f7d596dea | 321 (+669 parches de origen/inserción, +958 etiquetas) | 0,72 M (+0,92 M parches) |
| MuscularSystem100.fbx | 37 343 180 | 4c19df534d5d84aabbce08604306aa0485b43e8a2483c72a95b569e1dfea2279 | 683 | 2,32 M |
| CardioVascular41.fbx | 64 889 388 | ed7d049117cc944a8c47a416b16ade642cbd1392bbcce3c677450d3234dbf680 | 676 | 1,57 M |
| NervousSystem100.fbx | 53 887 724 | 3ea1aad64956cad27348a27b8fb50494b7cc307c6bc77bee0810ec2a67dff2b1 | 581 (≈285 nervios periféricos y craneales) | 2,40 M |
| VisceralSystem100.fbx | 18 401 708 | 22b301c93327929c9a14ee582d1848b550a950376e221a6d1078c7256bb83d0e | 120 | 0,70 M |
| Joints100.fbx | 9 804 796 | f4ba7a910cdaef99e31530f368628780d9f06b5d77853f8b721f47f67137e823 | 413 | 0,36 M |
| LymphoidOrgans100.fbx | 2 130 876 | 310ff82f502f4f3a79e85f99ddc2009bba9514338119af9edff87b20cf1b3609 | 165 | 0,13 M |
| Regions of human body100.fbx | 4 433 260 | 9d8da01d4719f9a61ee6ccfcaef85f788c4c67e9bcd74f5725c6946ab8b44199 | 256 | 0,14 M |
| TA2.csv (otro repo) | 1 510 396 | 0f9092a328b27dcd15d696d9f9a4087deb229a1aad21b75876657622de835974 | 7 314 términos | — |

URL de descarga (funcionan con curl desde el sandbox, en menos de un minuto por archivo):
`https://raw.githubusercontent.com/LluisV/Z-Anatomy/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/<archivo>` (el espacio del nombre va codificado como `%20`)
`https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/dd72c25bb57e47f8baf0333c3a926fb4ec8172fd/TA2.csv`

Pruebas hechas:
- Los FBX son binarios 7.4. `FBXLoader` de three@0.170.0 los parsea **en Node** sin DOM: NervousSystem en 1,8 s, con 712 objetos. Las unidades son centímetros, el eje Y apunta arriba y la altura es de unos 171 cm.
- Se probó el pipeline completo FBX → `@gltf-transform` (weld, simplify con meshoptimizer, quantize, EXT_meshopt_compression) sobre NervousSystem (2,40 M triángulos): con ratio 0,15 y error 0,01 salen 426 k triángulos y **3,87 MB**; con ratio 0,25 y error 0,005, 690 k y 5,58 MB. Eso da unos 9 bytes por triángulo.
- **No se verificó visualmente** la calidad del decimado, porque el sandbox impide abrir puertos locales. Es un riesgo abierto (R1) y el primer control de calidad del encargo 02.
- Nombres: 5 130 de 5 308 objetos casan exactamente con TA2.csv (algoritmo §6.4), y todos los que casan tienen latín y español. Unos 147 objetos con geometría no casan y necesitan traducción propia.
- Inventario medido objeto por objeto: `docs/datos/inventario-zanatomy.json`, con los campos archivo, nombre, tris, tipo, sufijo, ta2, en, la y es.

### 6.3 Licencias (lo que se distribuye)

- Mallas derivadas (GLB) y `catalogo.json`: **CC BY-SA 4.0**, con atribución a Z-Anatomy, a BodyParts3D (DBCLS) y a TA2.csv/Z-Anatomy. Atribución exigida:
  - "Z-Anatomy — The libre 3D atlas of anatomy — CC BY-SA 4.0" (https://github.com/LluisV/Z-Anatomy)
  - "BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International" (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Nota: la página de licencia actual dice CC BY 4.0 (actualizada el 2025-02-27), pero las cabeceras de los OBJ y Z-Anatomy citan CC BY-SA 2.1 JP. Distribuir como BY-SA 4.0 cumple con ambas.
- **Partes con NC (no comercial)**. Según el README de Z-Anatomy, el oído interno viene de la University of Dundee (CC BY-NC-SA 4.0) y "Kidney" de Lissie Cowley (CC BY-NC 4.0). El encargo 02 marca con `licencia` NC las estructuras del laberinto (cóclea, vestíbulo, conductos semicirculares) y del riñón (riñón y pelvis renal), y las lista en ATRIBUCIONES. El proyecto se declara no comercial. **Pendiente de decisión del usuario (D2).**
- Código de la app y de las herramientas: MIT. three.js: MIT, con su LICENSE copiado en `app/vendor/three/`.
- Fuentes tipográficas: OFL, con su OFL.txt al lado.

### 6.4 Reglas de lectura de nombres (contrato entre 02 y 04)

Algoritmo (el mismo que generó el inventario):
```
norm(s)   = s.replace('_',' ').replace('*','') → colapsar espacios → trim → minúsculas
TA2       = mapa norm(English) → fila; si un término se repite, gana la PRIMERA fila del CSV
nombre0   = nombre del objeto sin sufijo Blender `\.\d+$`
para k en 0,1,2,3: base = nombre0 sin sus últimos k caracteres; si norm(base) ∈ TA2 → acepta (base, sufijo = lo quitado)
si ninguno casa → sin TA2
```
Clasificación por sufijo (medida en el inventario):

| sufijo | significado | qué hacer |
|---|---|---|
| `r` / `l` | lado derecho / izquierdo del paciente | estructura (lado = "derecho"/"izquierdo") |
| `''` | impar o de línea media | estructura (lado = null) |
| `j`, `i` | etiquetas o anclas (≈13 triángulos de media) | descartar |
| `o`,`o1`…`o4` + lado | área de origen muscular sobre el hueso | sistema opcional `inserciones` |
| `e`,`e1`…`e4` + lado | área de inserción muscular | sistema opcional `inserciones` |
| `Cross_Section_*`, 0 triángulos | auxiliares | descartar |
| sin TA2, con triángulos | estructura | nombre por traducción propia (`nombre_fuente: "traduccion-propia"`) |

`id` de estructura = `slug(base)` + (`_d` | `_i` | ``), donde `slug` = NFD → quitar diacríticos → minúsculas → `[^a-z0-9]+` → `_` → recortar `_`. Si hay colisión se agrega `_2`, `_3`. El `id` es también el **nombre del nodo** en el GLB.
Clave de ficha: `ta2:<TA2ID>`. La comparten ambos lados de la misma estructura. **TA2ID es texto, no entero**: hay IDs como `1059*5` (Vértebra T5). Se guarda tal cual, como string, en `ta2` del catálogo y en la clave.

### 6.5 Pipeline (encargo 02), en Node y sin Blender

Dependencias fijas en `pipeline-3d/package.json`: `three@0.170.0`, `@gltf-transform/core@4.4.1`, `@gltf-transform/functions@4.4.1`, `@gltf-transform/extensions@4.4.1`, `meshoptimizer@0.25.0`.

1. `descargar.mjs`: baja los 8 FBX y TA2.csv a `pipeline-3d/crudo/` y verifica los SHA-256 de §6.2.
2. `inventario.mjs`: parsea con `FBXLoader` y escribe `pipeline-3d/intermedio/inventario.json`. Debe coincidir en al menos el 99 % de los `ta2` con `docs/datos/inventario-zanatomy.json`.
3. `clasificar.mjs`: asigna `sistema`, `subsistema`, `capa` y `region` con reglas declarativas en `pipeline-3d/reglas.json` (grupos padre del FBX, que terminan en `g`, más patrones de nombre).
4. `convertir.mjs`: aplica a cada estructura su matriz world, escala ×0,01 (cm → m), orienta (anterior = +Z; lado izquierdo del paciente = +X visto de frente; pies en y≈0) y construye un documento por sistema con un nodo por estructura (`node.name = id`). Luego: `weld` → `simplify` (presupuesto §6.7; mallas de menos de 300 triángulos sin tocar) → `dedup` → `prune` → `quantize` → `meshopt`. Escribe `app/modelos/<sistema>.glb`.
5. `catalogo.mjs`: escribe `app/datos/catalogo.json` y `app/datos/sistemas.json` (§7.3), más `pipeline-3d/INFORME.md` con triángulos, bytes y capturas.

### 6.6 Respaldo: BodyParts3D 4.0

Solo si Z-Anatomy no se puede usar.
- Fuente: `https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip`, 142 903 898 bytes, comprobado con HEAD. Trae 2 234 OBJ (FJxxxx.obj), cada uno con cabecera "Concept ID: FMAxxxx" y "English name". Unidades en mm, Z arriba. Son 480 MB sin comprimir, unos 7 M de triángulos.
- Licencia: CC BY 4.0.
- Problemas comprobados:
  - curl del sistema falla por la cadena TLS; funciona con `--cacert /opt/homebrew/etc/ca-certificates/cert.pem`.
  - El servidor baja a unos 50 KB/s, así que la descarga tarda unos 45 minutos.
  - **Solo 26 nervios.**
  - Sin español ni latín.

### 6.7 Presupuesto de peso y rendimiento

| sistema (`id`) | origen | tris objetivo | tope GLB |
|---|---|---|---|
| `piel` | Regions of human body | 80 k | 0,8 MB |
| `oseo` | Skeletal (solo estructuras) | 300 k | 3,0 MB |
| `articular` | Joints | 100 k | 1,0 MB |
| `muscular` | Muscular | 400 k | 4,0 MB |
| `cardiovascular` | CardioVascular | 330 k | 3,5 MB |
| `nervioso` | Nervous | 380 k | 4,0 MB |
| `linfatico` | LymphoidOrgans | 50 k | 0,6 MB |
| `digestivo`, `respiratorio`, `urinario`, `reproductor`, `endocrino` | Visceral, separado por grupos | 220 k en total | 2,5 MB en total |
| `inserciones` (opcional, apagado por defecto) | parches o/e de Skeletal | 120 k | 1,2 MB |

- **Carga inicial: 6 MB o menos** (app, three.js, `oseo` y `piel`).
- **Total: 22 MB o menos**, con unos 2,0 M de triángulos como máximo con todo visible.
- Cada sistema se carga diferido al encenderlo.
- Con `?debug=1` se muestran FPS, draw calls y triángulos (`renderer.info`).

## 7. App de anatomía 3D

### 7.1 Requisitos funcionales

- Cuerpo completo; ver por **sistemas** (interruptores con color y peso en MB) y por **capas**.
- Control "Profundidad" de 0 a 5. Con nivel N se ocultan todas las capas menores que N:
  - 0: piel
  - 1: músculos superficiales y fascias
  - 2: músculos profundos
  - 3: vasos y nervios periféricos, linfático
  - 4: esqueleto y articulaciones
  - 5: vísceras, sistema nervioso central (encéfalo, médula, meninges), corazón y grandes vasos
- **Disecar**: sobre la estructura seleccionada, ocultar, aislar (las demás quedan ocultas o como contexto translúcido al 10 %), volver transparente al 25 % y restaurar todo. Deshacer las últimas 20 acciones. **Plano de corte** sagital, coronal o transversal con deslizador, botón de invertir y caras internas en tono oscuro.
- Órbita, zoom y paneo (OrbitControls, con zoom hacia el cursor) hasta el detalle, más vistas rápidas: anterior, posterior, lateral derecha e izquierda, superior. Doble clic enfoca la estructura.
- Al tocar una estructura se resalta y se abre la ficha: nombre en español, término latino, sistema, lado; y si hay ficha, función, irrigación, drenaje venoso, inervación, origen/inserción/acción (en músculos), relevancia clínica, perla y fuentes. Sin ficha muestra lo mínimo (nombre, latín si existe, sistema y lado) y la nota "Ficha en preparación".
- **Buscador** sin distinguir tildes ni mayúsculas, en español, latín e inglés, con resultados por relevancia. Al elegir uno carga el sistema si hace falta, enfoca y selecciona.
- **"Preguntar a Paula"**: ver §7.6.
- Interfaz 100 % en español. Funciona en escritorio y en móvil (táctil, panel inferior deslizable).
- Créditos visibles con enlace a `ATRIBUCIONES.md`.

### 7.2 Técnicas

- Sin paso de build. Módulos ES con `<script type="importmap">`:
  `"three": "./vendor/three/three.module.js"`, `"three/addons/": "./vendor/three/addons/"`.
- three.js 0.170.0 local. Se copian `build/three.module.js`, `examples/jsm/{controls/OrbitControls.js, loaders/GLTFLoader.js, libs/meshopt_decoder.module.js, utils/BufferGeometryUtils.js}` y `LICENSE`, respetando las rutas relativas que importan los addons.
- **Solo rutas relativas** (nada que empiece por `/`), para que funcione en cualquier subruta de GitHub Pages. Sin CDN ni Google Fonts en tiempo de ejecución. Nada de carpetas que empiecen por `_` (Jekyll).
- `GLTFLoader` con `setMeshoptDecoder(MeshoptDecoder)`.
- Selección por raycast **en clic o tap**, nunca en hover continuo. Materiales compartidos por sistema; se clona el material solo de las estructuras con estado propio (resaltada o transparente).
- Corte con `renderer.localClippingEnabled = true` y `clippingPlanes` en los materiales.

### 7.3 Esquemas de datos (generados por 02)

`app/datos/sistemas.json`
```json
{ "version": 1,
  "sistemas": [
    { "id": "oseo", "nombre": "Sistema óseo", "color": "#E8DCC4", "glb": "modelos/oseo.glb",
      "bytes": 2900000, "tris": 300000, "estructuras": 321, "visible_inicio": true, "orden": 1,
      "opcional": false }
  ] }
```
Colores por defecto:

| sistema | color |
|---|---|
| oseo | #E8DCC4 |
| muscular | #B5523B |
| cardiovascular | #C8323C (venas #3B5BA9 por subsistema) |
| nervioso | #E8C547 |
| linfatico | #7FB77E |
| digestivo | #D99A6C |
| respiratorio | #E3A0A8 |
| urinario | #C9B458 |
| reproductor | #B07AA1 |
| endocrino | #8E6CC0 |
| piel | #D8B49A (translúcida al 35 %) |
| articular | #9FB8C9 |
| inserciones | origen #D24B4B, inserción #4B7BD2 |

`app/datos/catalogo.json`
```json
{ "version": 1, "generado": "2026-11-13T00:00:00Z", "unidades": "m",
  "orientacion": "Y arriba; anterior +Z; izquierda del paciente +X",
  "estructuras": [
    { "id": "femoral_artery_d", "nombre_es": "Arteria femoral", "nombre_la": "Arteria femoralis",
      "nombre_en": "Femoral artery", "lado": "derecho",
      "sistema": "cardiovascular", "subsistema": "arterias", "capa": 3,
      "region": "miembro inferior", "grupo_es": "Arterias sistémicas",
      "ta2": "4674", "nombre_fuente": "TA2", "licencia": "CC-BY-SA-4.0",
      "tris": 812, "centro": [0.08, 0.72, 0.03], "radio": 0.21 }
  ] }
```
Valores permitidos:
- `lado`: `"derecho"`, `"izquierdo"` o `null`
- `nombre_fuente`: `"TA2"` o `"traduccion-propia"`
- `licencia`: `"CC-BY-SA-4.0"`, `"CC-BY-NC-SA-4.0"` o `"CC-BY-NC-4.0"`
- `capa`: entero de 0 a 5
- `centro` y `radio`: en metros, en coordenadas de escena

`nombre_es` y `nombre_la` **nunca vacíos** en estructuras con TA2. Las que no tienen TA2 llevan `nombre_es` como mínimo y `nombre_la: null`. Ninguna estructura se queda sin `nombre_es` y `sistema`.

### 7.4 Fichas (generadas por 04)

`app/datos/fichas/manifest.json` → `{ "version": 1, "archivos": ["oseo.json", ...], "total": 466 }` (suma real de las fichas de todos los archivos; con la ampliación ósea son 159 fichas óseas)

`app/datos/fichas/<sistema>.json` → `{ "version": 1, "sistema": "oseo", "fichas": { "ta2:1234": FICHA } }`

```json
FICHA = {
  "clave": "ta2:1234", "ta2": "1234", "nombre_es": "...", "nombre_la": "...",
  "tipo": "hueso|musculo|arteria|vena|nervio|organo|articulacion|ligamento|ganglio|region|otro",
  "resumen": "1–2 frases",
  "funcion": "texto",
  "irrigacion": "texto|null", "drenaje_venoso": "texto|null", "inervacion": "texto|null",
  "drenaje_linfatico": "texto|null",
  "musculo": { "origen": "...", "insercion": "...", "accion": "..." } | null,
  "relaciones": "texto|null",
  "relevancia_clinica": ["...", "..."],
  "perla": "texto|null",
  "fuentes": [ { "titulo": "...", "url": "https://..." } ],
  "revisado": "2026-11-13"
}
```

**Campos opcionales de las fichas óseas** (`oseo.json`; se añaden al final de la ficha, en este orden). Todos son opcionales: si faltan o están vacíos, la app no muestra la sección. Las fichas de otros sistemas no los llevan.

```json
{
  "accidentes": [ { "nombre": "Tuberosidad deltoidea", "nombre_la": "Tuberositas deltoidea" | null, "nota": "qué pasa o se inserta ahí, en una frase" } ],
  "articulaciones": [ { "con": "hueso o huesos que se articulan", "tipo": "p. ej. sinovial en silla de montar", "nombre": "Articulación carpometacarpiana del pulgar" } ],
  "inserciones": [ { "musculo": "Deltoides", "tipo": "origen" | "insercion", "donde": "accidente óseo" } ],
  "osificacion": "texto breve" | null,
  "contrastado": true | false
}
```
- `accidentes`: tubérculos, fosas, apófisis, forámenes, surcos y caras articulares. La app los muestra como "Accidentes óseos" (nombre, nombre latino en cursiva y nota).
- `articulaciones`: se muestran como "Articulaciones".
- `inserciones`: las principales (en huesos grandes, las de mayor rendimiento para examen). Se muestran como "Músculos que se insertan", con una etiqueta Origen o Inserción.
- `osificacion`: dato clásico de examen (centros, cierres de fisis) o `null`. Se muestra como "Osificación".
- `contrastado` (en las fichas de TODOS los sistemas desde la ronda C7; `contraste` guarda el detalle por campo cuando hubo capítulo de StatPearls): `true` solo si el contenido de esa ficha (accidentes, articulaciones, inserciones) se cotejó con texto de la fuente efectivamente leído (OpenStax Anatomy & Physiology 2e); `false` si se escribió desde conocimiento general. Con `false` la app muestra un aviso discreto. No se pone `true` por defecto.
- Cobertura: toda clave `ta2:` del sistema `oseo` del catálogo tiene ficha (huesos, cartílagos costales, cartílagos nasales y laríngeos, senos, celdillas etmoidales, huesecillos, sesamoideos y dientes). En `nombre_es` se usan las denominaciones usuales en Colombia (Semilunar, Piramidal, Ganchoso, Astrágalo, Martillo, Yunque, Estribo; Rótula y Peroné, con Patela y Fíbula mencionados en el resumen).
La app carga **todas** las fichas del manifest en segundo plano tras el primer render (1 MB o menos en total) y las busca por `"ta2:" + estructura.ta2`. Si falta el manifest o un archivo, la app sigue funcionando.

**Cómo se llenan**:
- 04 escoge unas 320 estructuras de alto rendimiento de `docs/datos/inventario-zanatomy.json` (solo `tipo: "estructura"` con `ta2`) y redacta con palabras propias, citando StatPearls, OpenStax Anatomy & Physiology 2e o MSD Manual.
- El resto de estructuras queda sin ficha y la app muestra lo mínimo.
- Más adelante se pueden añadir fichas editando el JSON a mano o pidiéndoselo a Paula con la skill. Basta con mantener el esquema y la clave `ta2:`.

### 7.5 Diseño visual (dirección de arte)

- Idea: **"mesa de disección y atlas clásico"**. Fondo grafito profundo (#14161A → #1E2228, degradado radial suave como una lámpara cenital) para que las estructuras resalten.
- Paneles como papel de atlas: marfil cálido #F3EEE4 sobre el lienzo oscuro, con borde fino y sombra discreta.
- Tipografía: serif con carácter para nombres y latín (Fraunces, OFL, cursiva para el latín) y sans legible para la interfaz (Inter, OFL). Ambas van locales en `app/fonts/`; si no se consiguen, se usa la pila del sistema (`ui-serif` / `system-ui`).
- Acento único: rojo lacre #B3261E para la selección y la acción principal. Los colores de sistema solo aparecen en chips y leyendas.
- Iconos SVG en línea, de trazo fino. Micro-movimientos de 150–250 ms; respeta `prefers-reduced-motion`. Contraste AA. Navegable con teclado (Tab, Enter, Esc cierra la ficha, `/` enfoca el buscador).
- Nada de plantilla genérica: nada de gradientes morados, emojis ni tarjetas idénticas en rejilla.

### 7.6 Integración con Claude (contrato)

```js
window.paulaSelection = {            // se actualiza en cada selección; null si no hay
  id, nombre, nombre_la, sistema, sistema_nombre, lado, tiene_ficha,
  preguntado: false,                 // true tras pulsar "Preguntar a Paula"
  pregunta: "...",                   // texto armado (ver abajo)
  timestamp: "ISO-8601" }
window.dispatchEvent(new CustomEvent('paula:seleccion', { detail: window.paulaSelection }))
window.paulaApp = {
  version: 1,
  estado(),                 // {sistemasVisibles, profundidad, corte, seleccion}
  buscar(texto),            // → [{id, nombre, sistema}] (máx. 20)
  seleccionar(id),          // Promise<boolean>; carga sistema, enfoca, abre ficha
  mostrarSistema(id, visible), // Promise
  aislar(id), restaurar(),
  vista(nombre)             // 'anterior'|'posterior'|'derecha'|'izquierda'|'superior'
}
```
Texto copiado al portapapeles (y también en `pregunta`):
`/paula Estoy en la app de anatomía viendo: {nombre} ({nombre_la}) — {sistema_nombre}{, lado derecho/izquierdo}. Explícame su anatomía, función, irrigación e inervación y su relevancia clínica, y hazme 3 preguntas de repaso.`
Si el Clipboard API falla, se usa un textarea con `execCommand('copy')`. Si eso también falla, la app muestra el texto seleccionado para copiarlo a mano. En todos los casos aparece el aviso "Pregunta copiada: pégala en Claude".

### 7.7 Vista separada, explorador y gestos (ampliación)

- **Separar** (`js/separar.js`): deslizador 0–100 % con botón "Juntar todo". Cada pieza se desplaza de forma jerárquica (cuerpo → región → lado → grupo del sistema → conglomerado vecino → pieza) según su `centro` del catálogo; los factores (`FACTORES`, `UMBRAL_VECINDAD`) están documentados en el código y se ajustan con `app/dev/ajustar-separacion.mjs` midiendo el solapamiento de cajas con las mallas reales. Alcance: todo lo visible, un sistema, o la región de la pieza seleccionada; lo que no se separa puede quedar atenuado (material de contexto). Animación de 300 ms a demanda; la geometría y los materiales no se duplican y a 0 % las matrices son idénticas a las originales. Con piezas desplazadas, el raycast, la etiqueta, el enfoque y el plano de corte usan la posición **mostrada** (el rango del corte incluye lo desplazado).
- **Explorador** (pestaña del panel izquierdo, botón de la barra o tecla E): árbol ARIA Sistema → Región (o subsistema en cardiovascular, nervioso, muscular, inserciones, linfático, respiratorio y digestivo) → Estructura, con recuentos, filtro sin tildes (español/latín/inglés), pares derecha/izquierda en una fila (D / I), indicador de ficha, "Ver solo esto", "Separar esto", visibilidad y "Restablecer vista". Carga los sistemas bajo demanda y pinta hasta 150 estructuras por rama ("Mostrar más").
- **Gestos**: conmutador Girar / Mover (tecla M), Mayús + arrastre, botón derecho o dos dedos para desplazar, flechas del teclado con el foco en el visor; el punto de mira se limita a la caja del cuerpo más 0,5 m. Puntería con tolerancia (6 px ratón, 12 px táctil) para nervios y vasos finos.
- **API**: `paulaApp.separar(pct, { alcance, atenuar })` devuelve `Promise<number>` (alcance: `'visible'`, id de sistema, `'region'`, o `{ sistemas, region, subsistema }`); `paulaApp.verSolo({ sistema, region, subsistema })` devuelve `Promise<boolean>`; `paulaApp.restablecerVista()`; `paulaApp.estado()` añade `separacion` (0–100) y `alcanceSeparacion`.

## 8. Entorno de pruebas (importante para todos)

- **El sandbox de Bash no deja abrir puertos locales** (`python3 -m http.server` da `PermissionError: Operation not permitted`; se comprobó).
- Las pruebas visuales en navegador se hacen con `preview_start` del panel de navegador y la configuración `paula-anatomia`, solo **si existe** `<workspace>/.claude/launch.json` (la crea el usuario a partir de `docs/launch.json.ejemplo`). Si no existe, el constructor no la crea: hace las verificaciones que no necesitan navegador y anota "prueba visual pendiente".
- curl a GitHub (`raw.githubusercontent.com`, `api.github.com`) y a `registry.npmjs.org` funciona. Si el sandbox bloquea un dominio, se reintenta declarando ese dominio en `allowed_domains`.

## 9. Riesgos

| # | Riesgo | Estado | Mitigación o primer paso |
|---|---|---|---|
| R1 | La calidad visual del decimado (nervios finos y vasos pequeños) no se ha verificado | **Abierto** | Primer control del encargo 02: capturas de cara, mano, corazón, plexo braquial y encéfalo con tres ratios; elegir la menor que no rompa tubos. Mallas de menos de 300 triángulos no se tocan |
| R2 | Orientación y lateralidad del FBX (izquierda/derecha invertida o modelo de espaldas) | Abierto | Paso de verificación en 02: el centro de `Body_of_sternum` debe tener z mayor que el de `Vertebra_T5`; el hígado (`Liver`) debe tener x < 0 |
| R3 | Modelo **solo masculino**: no hay pelvis, útero, ovarios ni mama femeninos, que importan para GO | Confirmado | Se dice en la interfaz y en la skill. Opción futura: buscar modelos femeninos CC BY. **Decisión D3** |
| R4 | Partes NC (oído interno, riñón) en un proyecto que podría publicarse | Confirmado | Marcadas por estructura y en ATRIBUCIONES; proyecto no comercial. **Decisión D2** |
| R5 | El puerto local bloqueado impide la prueba visual automática | Confirmado | `docs/launch.json.ejemplo`; el usuario lo copia antes de lanzar 03. **Decisión D1** |
| R6 | URLs de fuentes que cambian o se rompen, y GPC colombianas desactualizadas | Abierto | Cada constructor verifica sus URL; el linter y el checklist las vuelven a probar. Se anota el año de cada GPC |
| R7 | Rendimiento con unas 3 200 mallas y unos 2 M de triángulos en portátiles modestos | Abierto | Presupuesto §6.7, carga diferida, raycast solo en clic, `?debug=1` para medir |
| R8 | Copia accidental de texto con copyright en la base o las fichas | Abierto | Regla de redacción propia; el checklist hace muestreo con búsqueda de frases exactas |
| R9 | Unas 147 estructuras sin TA2 con traducción propia, más rarezas del español de TA2.csv (p. ej. "Hueso Fémur" para Femur) | Abierto | Las sin TA2 se marcan `traduccion-propia`; 02 corrige las rarezas evidentes en `pipeline-3d/correcciones-nombres.json` (con lista en INFORME) y 04 usa el nombre final |
| R10 | Mantenimiento: Z-Anatomy parece inactivo | Bajo | Commits fijados, SHA-256 y respaldo BodyParts3D documentado |

## 10. Orden y dependencias

- Todos los encargos pueden **arrancar en paralelo**.
- 03 trabaja con datos de prueba propios (`app/dev/fixture/`) hasta que existan los de 02.
- 04 trabaja contra `docs/datos/inventario-zanatomy.json` y no necesita a 02.
- 01 define rutas que los encargos 05–10 ya conocen por este SPEC.
- La integración final (app con modelos reales, más linter sobre los 23 archivos) la hace la dirección en la revisión.

## 11. Decisiones pendientes del usuario

- **D1 — Prueba visual de la app.** El sandbox bloquea los puertos locales. ¿El usuario copia `docs/launch.json.ejemplo` a `<workspace>/.claude/launch.json` antes de lanzar 03 (recomendado), o habilita `sandbox.network.allowLocalBinding: true`? Si no hace ninguna de las dos, 03 entrega sin prueba visual y la hace la dirección en la revisión.
- **D2 — Partes con licencia NC** (oído interno de Dundee, riñón de L. Cowley). La opción por defecto es incluirlas, marcadas, con el proyecto declarado no comercial. La alternativa es excluirlas del GLB y que la app muestre esas estructuras como ausentes.
- **D3 — Anatomía femenina.** El modelo es solo masculino. La opción por defecto es aceptarlo en la v1 (la base de conocimiento cubre pelvis y periné femenino en texto, y la skill lo advierte). La alternativa es una v2 que busque y valide mallas femeninas CC BY/CC BY-SA, con un encargo aparte.

## 12. Ronda de verificación de la base (v1.1, 2026-11-13)

Contexto: en la primera ronda los constructores no pudieron leer las fuentes. NCBI Bookshelf devuelve reCAPTCHA, CDC y ahajournals dan 403 e IRIS de OMS/OPS pide JavaScript. Por eso los datos sensibles salieron de memoria. Desde v1.1 rige esto:

1. **Estados de un dato sensible** (toda línea que dispara la regla 3 del §5):
   - (a) **confirmado** contra texto leído de la fuente: queda igual, con su `[Fn]`.
   - (b) **corregido** con la fuente leída: se reescribe con su `[Fn]`.
   - (c) **no contrastado**: la línea termina con la etiqueta literal ` ⚠ sin contrastar` (espacio, U+26A0, espacio, "sin contrastar"). El validador la cuenta y la skill la trata como no verificada.
2. **Fuentes**: cada entrada de `## Fuentes` termina con ` · leída: <vía> <fecha>` o ` · no leída`. Las vías válidas son `statpearls-oa`, `pubmed-resumen`, `pmc-efetch`, `bookshelf-oa`, `pdf`, `html`. Una fuente `no leída` no puede sostener un dato en estado (a) o (b).
3. **Bitácora**: por cada archivo, `docs/verificacion/<PREFIJO>.tsv (prefijo en mayúsculas, p. ej. `ANAT.tsv`)` con las columnas `id_seccion, linea, dato, estado, fuente(Fn), via, ubicacion_en_fuente` (la sección o el párrafo de la fuente, no texto copiado). Es la evidencia de la revisión.
4. **Frontmatter**: se añaden `verificado: <fecha>` y `sin_contrastar: <n>`.
5. **NBK**: todo `NBKnnnn` citado debe corresponder al título citado, según PubMed vía E-utilities (§12.6). Si no corresponde, se corrige el NBK o el título.
6. **Vías de lectura que funcionan desde este entorno** (probadas el 2026-11-13):

| Vía | Cómo | Funciona para |
|---|---|---|
| `statpearls-oa` | Corpus completo de StatPearls (OA, NCBI litarch) extraído en `$TMPDIR/fuentes/statpearls/` (un `.nxml` por capítulo y un `indice.tsv` con archivo y título). Se busca por título con grep | Texto completo de StatPearls |
| `pubmed-resumen` | `efetch.fcgi?db=pubmed&id=<PMID>&rettype=abstract&retmode=text`, con el PMID sacado de `esearch.fcgi?db=pubmed&term=NBKnnnn` | Resumen de un capítulo StatPearls o de un artículo; también confirma NBK ↔ título |
| `pmc-efetch` | HTML de `https://pmc.ncbi.nlm.nih.gov/articles/PMCnnnn/`, sin captcha y con el cuerpo completo; `efetch db=pmc` solo trae el cuerpo de los artículos OA, y en revistas como Diabetes Care trae solo metadatos | ADA Standards of Care 2026 (PMC12690185 y otros), artículos OA y muchas guías de sociedades |
| `bookshelf-oa` | Tarball por documento desde `https://ftp.ncbi.nlm.nih.gov/pub/litarch/<ruta>`, con la ruta tomada de `file_list.csv` | Unas 300 guías de **OMS/OPS** espejadas en Bookshelf (HPP, preeclampsia, TB, VIH y más) |
| `pdf` | `curl` + `pdftotext` (`/opt/homebrew/bin/pdftotext`) | MinSalud (p. ej. la Resolución 3280 completa), INS (protocolos) y gpc.minsalud.gov.co |
| `html` | `curl -L -A "Mozilla/5.0"` y quitar etiquetas | NICE (recomendaciones completas), MSD Manual profesional en español, who.int y paho.org (fichas y temas, **no** IRIS), KDIGO, GOLD, GINA, ESC y openstax.org |
| **No funcionan** | — | Páginas HTML de NCBI Bookshelf (reCAPTCHA), cdc.gov (403), ahajournals.org y cpr.heart.org (403), iris.who.int e iris.paho.org (reto JS) y diabetesjournals.org (sin respuesta). Para AHA, buscar la misma guía en PMC (`pmc-efetch`); si no está, el dato queda `⚠ sin contrastar` |

E-utilities: base `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`, como máximo 3 peticiones por segundo y sin datos personales en las consultas.

### 12.7 Reglas añadidas al cierre (2026-11-13)
- **User-Agent honesto, sin excepción.** Toda lectura automática se identifica como lector automático (`material-de-estudio-medicina/1.0 …`, `validar-conocimiento/1.1 …`). Nunca se usa un UA de navegador. Las lecturas que C2, C3 y C4 hicieron antes con UA de navegador se repitieron con UA honesto: las 82 URL web citadas respondieron.
- **Cifras pediátricas y neonatales de alto riesgo** que no aparecen en ninguna fuente leída se **retiran** (se deja la conducta sin cifra, y la línea conserva `⚠`). En adultos, las cifras de alto riesgo no contrastadas se **mantienen marcadas**: la skill no las da como definitivas y las verifica en vivo.
- **Cuando las guías difieren**, la skill presenta primero la guía colombiana vigente con su año, luego la internacional con su año, y dice cuál es más reciente.
- **Bitácoras**: `docs/verificacion/<PREFIJO>.tsv` con el prefijo en mayúsculas. El validador las busca sin distinguir mayúsculas, listando la carpeta.
- **`--nbk`**: compara con PubMed (`title` o `booktitle`) y, si PubMed no conoce el NBK, con la lista OA de Bookshelf (`file_list.csv`). Así se reconocen las guías OMS espejadas.
- **Presupuesto 3D (decisión del usuario)**: los modelos pasaron a alta definición, con 36 MB en total, 4,1 M de triángulos, el sistema óseo sin decimar y una carga inicial de unos 6 MB. El §6.7 queda como referencia histórica.
