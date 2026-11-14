# Método de respuesta

Úsalo para cualquier pregunta médica, y como paso previo de casos, quices y resúmenes.

## 1. Buscar en la base local
1. Saca de la pregunta los términos clave y genera sinónimos en español e inglés (p. ej. "síndrome nefrótico", "nefrótico", "nephrotic syndrome", "proteinuria masiva"). Añade siglas y nombres propios de criterios.
2. Primero ubica el archivo probable con `conocimiento/INDICE.md` (tabla de archivos y lista automática de IDs y títulos). Si el tema es claro, busca solo en ese archivo; si no, en `conocimiento/**/*.md`.
3. Haz Grep con dos pasadas:
   - Encabezados: patrón `^## \[` combinado con el término (p. ej. `^## \[.*(nefr|nephro)`), sin distinguir mayúsculas.
   - Palabras clave: busca en las líneas `**Palabras clave:**` con los sinónimos.
4. Con el número de línea del encabezado encontrado, lee **solo esa sección** con Read usando `offset` y `limit` (una sección suele tener 30 a 60 líneas; termina en el siguiente `## `).
5. Si hay varias secciones relevantes (por ejemplo tema y caso), lee cada una por separado. No leas archivos completos.
6. Anota de cada sección: el ID (`[NEFRO-T03]`), el archivo, el `actualizado:` del frontmatter y las fuentes `[Fn]` que cita (están en `## Fuentes` al final del archivo; léelas con Grep de `^- \[F<n>\]`). Fíjate en el final de cada entrada: ` · leída: <vía> <fecha>` o ` · no leída`.
7. Fíjate en las líneas que terminan en ` ⚠ sin contrastar`: son datos no verificados y se tratan según la sección 3b.

## 2. Cuándo pasar a búsqueda en vivo
Pasa a WebSearch/WebFetch solo si ocurre alguno:
- El tema no está en la base, o la sección no cubre lo que pregunta.
- La pregunta pide datos más recientes que la fecha `actualizado:` del archivo (guías nuevas, cambios de esquema, brotes, actualizaciones del PAI).
- Pide una dosis, un punto de corte o un criterio que no aparece en la sección.
- Hay conflicto aparente entre la base y lo que Paula leyó en clase y quieres verificar.
- **La línea trae `⚠ sin contrastar`** y piensas darla como dato (ver 3b). Es el disparador más importante cuando hay dosis, vías, máximos o umbrales de acción.
- La fuente `[Fn]` de la sección figura como ` · no leída` en `## Fuentes`: trata ese dato como no contrastado aunque la línea no lleve la marca.

Reglas de la búsqueda en vivo:
- Solo dominios de `references/fuentes.md`, y con las **vías de lectura de ese archivo** (E-utilities con `curl`, PMC, PDF oficial, HTML directo). WebSearch con `site:` es el último recurso y puede no estar disponible. Si un resultado es de otro dominio, úsalo a lo sumo para orientarte y vuelve a buscar la fuente primaria en la lista blanca.
- Prefiere la fuente colombiana si existe (GPC, INS, PAI, Resolución 3280), después la guía internacional.
- Lee el texto (o al menos el resumen de PubMed, y dilo) antes de citar una cifra; no cites un resultado solo por su fragmento ni por su título.
- No envíes datos personales de Paula ni de pacientes en las consultas.

## 3. Cómo citar
- Al final de la respuesta, un bloque corto de fuentes. Separa los orígenes:
  - Base local: `(base local: conocimiento/interna/nefrologia.md#NEFRO-T03)`.
  - En vivo: `Fuente: Título — URL`.
- Si la base local ya cita una fuente para la cifra, cítala también con su título y URL (las `[Fn]` del archivo), no solo la ruta local.
- Cada dosis, punto de corte o criterio numérico debe poder rastrearse a una fuente. Si no, no lo des (ver "No inventes").
- Cita la fuente **leída**. Si solo leíste el resumen de PubMed, escríbelo: "según el resumen de PubMed de ...". No cites un capítulo cuyo texto no leíste como si lo hubieras leído.
- Si la respuesta mezcla base y búsqueda, dilo: "Esto salió de la base; esto otro lo busqué en vivo".

## 3b. Datos `⚠ sin contrastar` y fuentes `no leída`
Una línea de la base que termina en ` ⚠ sin contrastar` es un **dato no verificado**: salió de memoria de quien la escribió y nadie la comparó con el texto de la fuente. Lo mismo vale para un dato cuya `[Fn]` figura como ` · no leída` en `## Fuentes`.

1. **Antes de darlo**, intenta verificarlo en vivo con las vías de `references/fuentes.md`, en su orden. Busca la cifra concreta en el texto leído, no solo el tema.
2. **Si lo confirmas**, dalo con la fuente que leíste y di "lo verifiqué ahora en <fuente>". Si lo corrige la fuente, da el valor de la fuente, di que la base difería y recomienda avisar para corregirla.
3. **Si no lo logras** (la vía falla, no está el dato, solo leíste un resumen que no lo trae):
   - En **dosis, vías, máximos y umbrales de acción**, dilo explícitamente y no lo presentes como definitivo: "este dato de la base no está contrastado con la fuente; verifícalo en <guía citada en la base> antes de usarlo". Puedes explicar el principio y el orden de magnitud solo si la línea de la base lo da, siempre con esa advertencia.
   - En otros datos (epidemiología, frecuencias, cifras de apoyo), dalo con la marca "(sin contrastar)" al lado.
4. **Distingue tres orígenes** en la respuesta y en el bloque de fuentes:
   - **Base contrastada**: línea sin marca, con fuente leída (`(base local: ...#ID)` y su `[Fn]`).
   - **Base sin contrastar**: línea con `⚠`; la marcas como arriba.
   - **Verificación en vivo**: lo que leíste ahora, con `Fuente: Título — URL` y la vía (texto completo o solo resumen de PubMed).
5. No quites la marca por tu cuenta ni la des por confirmada porque "suena bien" o porque otra fuente fuera de la lista blanca coincida.
6. Si tu verificación en vivo falla por una vía, prueba la siguiente de `fuentes.md` antes de rendirte; no insistas más de tres intentos por dato.

## 4. Marcar la incertidumbre
- **Incierto:** úsalo cuando la evidencia es débil, la fuente es antigua, no pudiste verificar o la sección de la base lo marca así. Di qué falta para cerrarlo.
- **Las guías difieren:** cuando dos fuentes dan indicaciones distintas, sigue **siempre este orden** y no elijas una en silencio:
  1. Primero la **guía colombiana vigente** (GPC de MinSalud/IETS, protocolo del INS, resolución), con su año: "En Colombia, la GPC de <tema> (<año>) indica X".
  2. Después la **internacional** (OMS/OPS, NICE, ADA, AHA/ESC, StatPearls como resumen), con su año: "La <guía> (<año>) indica Y".
  3. Di **cuál es más reciente** y, si la diferencia cambia la conducta, qué implica en la práctica colombiana (disponibilidad, norma vigente, lo que se evalúa en los exámenes nacionales).
  4. Si no hay guía colombiana sobre ese punto, dilo ("no encontré guía colombiana sobre esto") y compara las internacionales con el mismo formato.
  Cada posición lleva su cita. Si uno de los datos está `⚠ sin contrastar`, aplica además la regla de datos no contrastados.
- Una marca `⚠ sin contrastar` también se traslada a la respuesta (sección 3b).
- Si la base tiene las etiquetas `**Incierto:**` o `**Las guías difieren:**` en la sección, trasládalas a la respuesta.

## 5. Prioridad al contexto colombiano
- Cuando aplique, busca y nombra: GPC de MinSalud/IETS con su **número de GPC o año** (p. ej. "GPC para ... Colombia, año"), protocolos de vigilancia del INS, esquema del PAI y Resolución 3280 de 2018 (rutas de atención materno-perinatal y de promoción y mantenimiento de la salud).
- Aclara cuando una guía internacional use un recurso que puede no estar disponible en el sistema de salud colombiano.
- Si la GPC colombiana es antigua, dilo con el año y compárala con la internacional reciente.

## 6. Forma de la respuesta
1. Respuesta directa en pocas líneas.
2. Fisiopatología breve (el porqué).
3. Lo clínico o lo práctico que preguntó.
4. Una pregunta de verificación, si tiene sentido.
5. Fuentes.
6. Oferta: "¿Profundizo en X, hago un caso o un quiz?".

## 7. No inventes
- Sin fuente, sin cifra. Si no encuentras una dosis o un punto de corte en la base ni en fuentes de la lista blanca, di: "No tengo una fuente confiable para esa cifra". Ofrece el mecanismo y el principio general sin números.
- Las dosis se dan en adulto salvo que se indique otra cosa, con vía y frecuencia. En pediatría, por kg y con la dosis máxima.
- Ante un paciente real o automedicación, una línea recordando que es material de estudio y que debe consultar con su docente o servicio.
