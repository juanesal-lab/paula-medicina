# Progreso de Paula

(Paula es la usuaria; la tutora no tiene nombre propio.)

Los quices y los casos con fallos se anotan en `progreso/registro.md`, en la raíz del proyecto. Sirve para "Repasar lo que fallé".

## Crear el archivo
La primera vez que haya algo que registrar:
1. Comprueba si existe `progreso/registro.md` (Glob).
2. Si no existe, pregunta: "¿Creo `progreso/registro.md` para ir anotando tus fallos y repasarlos después?". Solo con un sí, crea la carpeta y el archivo con el encabezado de abajo.
3. Si dice que no, no insistas en la sesión; ofrece al final una lista de lo que falló, en el chat.

## Formato
Archivo markdown, una entrada por pregunta o etapa fallada (también puedes anotar aciertos importantes si ella lo pide). Encabezado:

```
# Registro de progreso
Formato: una entrada por fallo. Estado: pendiente | repasado (con fecha).
```

Cada entrada:

```
## 2026-11-13 · quiz · Síndrome nefrótico
- **Fecha:** 2026-11-13
- **Tipo:** quiz | caso | pregunta
- **Tema:** Síndrome nefrótico
- **Pregunta o caso:** resumen de la pregunta o de la etapa del caso (una línea; sin datos de pacientes reales)
- **Respuesta de Paula:** lo que contestó
- **Correcta:** lo correcto y por qué (una línea)
- **Concepto a repasar:** el concepto concreto
- **Fuente:** Título — URL, o (base local: conocimiento/interna/nefrologia.md#NEFRO-T03)
- **Estado:** pendiente
```

Agrega entradas al final con Edit o Write (leyendo antes el archivo). No borres entradas.

## Repasar lo que fallé (opción 6)
1. Lee `progreso/registro.md`. Si no existe o está vacío, dilo y ofrece un quiz o un caso para empezar.
2. Ordena los fallos con **repetición espaciada simple**:
   - Primero los más recientes con estado `pendiente`.
   - Luego los pendientes de más de 3 días que no se han repasado.
   - Después los ya repasados hace 7 o más días (refresco).
3. Ofrece un bloque de 3 a 5 conceptos. Para cada uno: pregunta de nuevo (distinta a la original, sobre el mismo concepto) y espera su respuesta antes de explicar.
4. Si acierta, marca la entrada como `repasado` con la fecha de hoy. Si falla de nuevo, explica con otro enfoque, deja `pendiente` y añade una línea con la fecha del nuevo fallo.
5. Al final: resumen de lo repasado, lo que sigue pendiente y cuándo volver a verlo (en 2, 4 o 7 días según le fue).
6. Para actualizar estados, edita las entradas con Edit; no reescribas todo el archivo.

## Privacidad
El registro es de Paula. No incluyas datos personales de pacientes ni nada que no sea académico.
