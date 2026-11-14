# Formato de los archivos de conocimiento

Este documento es la norma para cada archivo de `conocimiento/<área>/*.md`: la plantilla y las reglas duras de abajo son copia literal del SPEC del proyecto (§5).
El linter `docs/herramientas/validar_conocimiento.mjs` hace cumplir las reglas 1 a 4, las de la ronda v1.1 (al final) y los mínimos de tamaño; `docs/herramientas/generar_indice.mjs` actualiza la parte automática de `INDICE.md`.
Si este documento y el SPEC difieren, gana el SPEC.

````markdown
---
area: Cardiología
archivo: conocimiento/interna/cardiologia.md
prefijo: CARD
actualizado: 2026-11-13
verificado: 2026-11-13                                            # v1.1: fecha de la revisión contra las fuentes
sin_contrastar: 1                                                 # v1.1: número de líneas con la marca ⚠ sin contrastar
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
- [F1] Título del documento — Organización o autores, año. https://... (consultado 2026-11-13) · leída: pubmed-resumen 2026-11-13
- [F2] Otro documento — Organización, año. https://... (consultado 2026-11-13) · no leída
````

Reglas duras (las verifica el linter):

1. IDs `[PREFIJO-Tnn]` y `[PREFIJO-Cnn]` únicos, de dos dígitos, consecutivos. Cada uno aparece en el Índice y como encabezado `## `.
2. Cada caso tiene, en este orden, las 7 etiquetas: Presentación, Diagnóstico diferencial, Estudios, Manejo, Perlas, Errores típicos, Fuente.
3. **Dato sensible = cifra con unidad o punto de corte.** Patrón: número seguido de `mg|mcg|µg|g|UI|U/|mEq|mmol|mmHg|%|kg|mL|L/|lpm|/min|h\b|días|semanas|años|cm|mm|°C|puntos|x10`, o los operadores `≥ ≤ > <` junto a un número. Toda línea con un dato sensible lleva `[Fn]` **en la misma línea**. Excepción: líneas con la marca literal `(ejercicio)` (datos inventados de ejercicios de cálculo, p. ej. salud pública). Las cifras dentro de la **Presentación** de un caso (signos vitales, laboratorios del paciente ficticio) también están exentas; el linter ignora las líneas que empiezan por `**Presentación:**`.
4. Cada `[Fn]` citado existe en `## Fuentes`, y cada fuente tiene URL `https://` de la lista blanca. Las URL las verificó el constructor (HTTP 200 o redirección válida) el día que escribió.
5. Las dosis se dan en adulto salvo que se diga otra cosa, con vía y frecuencia. En pediatría, por kg y con dosis máxima.
6. Sin datos personales y sin pacientes reales.

## Reglas de la ronda de verificación (v1.1, SPEC §12)

1. **Estados de un dato sensible** (toda línea que dispara la regla 3):
   - (a) **confirmado** contra texto leído de la fuente: queda igual, con su `[Fn]`.
   - (b) **corregido** con la fuente leída: se reescribe con su `[Fn]`.
   - (c) **no contrastado**: la línea termina con la etiqueta literal ` ⚠ sin contrastar` (espacio, U+26A0, espacio, "sin contrastar"). **Sigue necesitando `[Fn]`** (dónde buscar). El validador la cuenta y la skill la trata como no verificada: antes de darla intenta verificarla en vivo y, si no puede, avisa.

   Ejemplo de línea marcada:
   ```
   - Sulfato de magnesio: carga de 4 g IV en 20 min y mantenimiento de 1 g/h [F3] ⚠ sin contrastar
   ```
2. **Fuentes**: cada entrada de `## Fuentes` termina con ` · leída: <vía> <AAAA-MM-DD>` o ` · no leída`. Vías válidas: `statpearls-oa`, `pubmed-resumen`, `pmc-efetch`, `bookshelf-oa`, `pdf`, `html`. Una fuente `no leída` no puede sostener un dato en estado (a) o (b): una línea con dato sensible que cite solo fuentes `no leída` debe llevar `⚠ sin contrastar`.

   Ejemplos de entrada:
   ```
   - [F3] Hypertension in Pregnancy — StatPearls, NCBI Bookshelf. https://www.ncbi.nlm.nih.gov/books/NBK430810/ (consultado 2026-11-13) · leída: statpearls-oa 2026-11-13
   - [F4] Guía de práctica clínica — MinSalud. https://www.minsalud.gov.co/... (consultado 2026-11-13) · no leída
   ```
3. **Bitácora**: por cada archivo, `docs/verificacion/<PREFIJO>.tsv (prefijo en mayúsculas, p. ej. `ANAT.tsv`)` (separado por tabuladores) con las columnas `id_seccion, linea, dato, estado, fuente(Fn), via, ubicacion_en_fuente`. `estado` es `confirmado`, `corregido` o `sin_contrastar`; `ubicacion_en_fuente` es la sección o el párrafo de la fuente, no texto copiado. El número de filas `sin_contrastar` debe coincidir con las marcas `⚠` del archivo.
4. **Frontmatter**: `verificado: <AAAA-MM-DD>` y `sin_contrastar: <n>` (igual al número de líneas con la marca).
5. **NBK**: todo `NBKnnnn` citado debe corresponder al título citado, según PubMed vía E-utilities. `node docs/herramientas/validar_conocimiento.mjs --nbk <archivo>` lo comprueba.

El linter reporta por archivo los datos sensibles totales y los no contrastados. Sin `--v11`, las reglas 2 y 4 de esta sección y la bitácora se informan como avisos; con `--v11` son errores. `generar_indice.mjs` suma las marcas en `INDICE.md` (**Datos pendientes de verificar: N**), que la skill muestra en su menú.
