# Resumen de un tema

Un resumen de una página (unas 350 a 450 palabras) para estudiar. Con palabras propias.

## Antes
1. Aclara el tema y el nivel si hace falta (una línea).
2. Busca la sección en la base según `metodo.md`; complementa con búsqueda en vivo solo si falta algo. Anota las fuentes.

## Plantilla
```
# <Tema>
**Definición:** 1 a 2 líneas.
**Epidemiología:** frecuencia y factores de riesgo; dato de Colombia si hay (con fuente).
**Fisiopatología:** el mecanismo en pocas líneas, en cadena causal.
**Clínica:** síntomas y signos clave; qué es típico y qué es de alarma.
**Diagnóstico:** criterios, estudios y qué esperar; puntos de corte con fuente.
**Manejo:** medidas, fármacos de elección y escalamiento; dosis solo con fuente, vía y frecuencia.
**Complicaciones:** las que importan en el examen y en la práctica.
**Perlas:** 3 a 5 viñetas.
**3 preguntas para comprobar:** 3 preguntas de repaso, sin respuestas (las das si las pide).
**Fuentes:** lista (`Fuente: Título — URL`) y las secciones de la base (`base local: ...`).
```

## Reglas
- Si una parte no tiene fuente, dilo ("sin dato confiable") en vez de rellenar.
- Los datos de la base que terminan en `⚠ sin contrastar` se tratan según `metodo.md` (3b): verifícalos en vivo antes de ponerlos; si no puedes, ponlos con la marca `(sin contrastar)` y, en dosis y umbrales, con la advertencia de verificarlos en la guía citada.
- Marca **Incierto:** y **Las guías difieren:** donde corresponda.
- Incluye el contexto colombiano cuando aplique (GPC, INS, PAI, Res. 3280).
- Tablas solo si comparan (por ejemplo, diagnósticos diferenciales).

## Exportar
Al final pregunta: "¿Lo guardo en `resumenes/<tema>.md`?". Solo si dice que sí:
- Crea la carpeta `resumenes/` en la raíz del proyecto si no existe.
- Nombre en minúsculas, sin tildes y con guiones (`sindrome-nefrotico.md`).
- Incluye la fecha de hoy, el resumen y las fuentes.
- No sobrescribas un archivo existente sin preguntar.
- **Conserva la marca `(sin contrastar)`** en cada dato que no verificaste, también en el archivo exportado, y añade al final una línea: "Los datos marcados (sin contrastar) no están verificados con la fuente; compruébalos antes de estudiarlos como definitivos". Indica en las fuentes cuáles leíste y cuáles solo en resumen de PubMed.
