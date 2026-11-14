# Caso clínico interactivo

Un caso por etapas, con Paula respondiendo en cada una. No avances a la siguiente etapa sin su respuesta.

## Preparación
1. Tema o especialidad: úsalo si ya lo dijo; pregúntalo solo si falta (o decide tú si dice "sorpréndeme"). Nivel (ciencias básicas, internado, residencia): si no lo dijo, **no preguntes**: asume internado, dilo en una frase al empezar y ofrece ajustarlo.
2. Busca en la base los casos `[XX-Cnn]` de esa especialidad: Grep de `^## \[[A-Z]+-C` en el archivo y Read de uno (con offset y limit). Úsalo como esqueleto y **varía datos** (edad, sexo, contexto, valores, orden de síntomas) para que no se repita. Si no hay caso, construye uno a partir del tema `[XX-Tnn]`.
3. Las dosis, criterios y conductas del caso deben salir de la base o de una fuente de la lista blanca (ver `metodo.md`). El paciente es ficticio.
   **Nunca bases la conducta "correcta" del caso (diagnóstico, estudio, dosis, umbral de actuar) en un dato `⚠ sin contrastar`**, salvo que lo hayas verificado en vivo en esta sesión. Si no puedes, cambia el caso o el punto que se evalúa: que la decisión descanse en datos sin marca y deja lo no contrastado fuera o como contexto sin calificar. Si un dato así aparece en la retroalimentación, rotúlalo "(sin contrastar)".
4. No reveles el diagnóstico ni los estudios hasta su etapa.

## Etapas
1. **Viñeta inicial.** Edad, sexo, contexto, motivo de consulta, tiempo de evolución y signos vitales. Máximo 6 líneas.
2. **Pregunta.** "¿Qué más preguntarías o examinarías?". Espera su respuesta.
3. **Examen dirigido.** Revela solo los hallazgos de lo que pidió, más los que un buen examen daría. Si olvidó algo clave, dilo con suavidad al final, no ahora.
4. **Diferenciales.** "¿Cuáles son tus diferenciales, del más al menos probable y por qué?".
5. **Estudios.** "¿Qué pedirías y en qué orden?". Luego entrega resultados de lo que pidió, con valores coherentes con el caso.
6. **Diagnóstico.** "¿Cuál es tu diagnóstico y en qué te apoyas?". Confirma o corrige con el porqué.
7. **Manejo.** "¿Cuál sería tu manejo inicial?". Con dosis solo si hay fuente, y la vía y frecuencia.
8. **Retroalimentación.** Resume: lo que hizo bien, perlas del caso, errores típicos (los propios de ella y los comunes), y qué concepto repasar. Cita fuentes y la sección de la base.

## Reglas
- Una pregunta a la vez. Respuestas tuyas cortas entre etapas ("Bien. Veamos el examen.").
- Si pide una pista, da una pista, no la respuesta.
- Si se salta una etapa o pide saltar al final, permítelo y dilo en la retroalimentación.
- No incluyas datos que identifiquen a una persona real.
- Si dice que se rinde, resuelve el caso y marca el tema como "a repasar".

## Al terminar
Registra el caso en `progreso/registro.md` (tipo `caso`) como indica `references/progreso.md`: aciertos y fallos por etapa, con el concepto a repasar y la fuente. La primera vez, pide permiso para crear el archivo. Termina ofreciendo: otro caso, un quiz del mismo tema o un resumen.
