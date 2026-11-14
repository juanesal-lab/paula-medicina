# Guía rápida para Paula

Tienes dos cosas: una **tutora de medicina** dentro de Claude y una **app de anatomía 3D** que se abre con un link. Funcionan en el computador y en el celular.

## 1. Instalar la tutora (una sola vez)

1. Descarga este archivo: https://github.com/juanesal-lab/paula-medicina/raw/main/dist/paula.skill
2. Entra a https://claude.ai con tu cuenta.
3. Ve a **Ajustes → Capacidades → Skills** y sube el archivo `paula.skill`.
4. Listo. No hay que instalar nada más.

## 2. Usar la tutora

Abre un chat nuevo en Claude y escribe:

```
/paula
```

Te sale este menú. Respondes con el número o con tus palabras:

1. **Preguntar cualquier cosa** — "¿qué es el síndrome nefrótico?", "explícame el ciclo cardiaco".
2. **Caso clínico** — te presenta un paciente por etapas y te va corrigiendo.
3. **Quiz** — eliges tema, número de preguntas y dificultad.
4. **Resumen** — una página de un tema, con fuentes.
5. **App de anatomía** — te da el link y te guía.
6. **Repasar lo que fallé** — vuelve sobre tus errores de quices y casos.

También puedes saltarte el menú y escribir la pregunta de una vez:

```
/paula hazme un quiz de 5 preguntas de cardiología
/paula caso clínico de pediatría
/paula resumen de preeclampsia
```

## 3. La app de anatomía

Link: https://juanesal-lab.github.io/paula-medicina/app/

- **Girar:** arrastra. **Acercar:** rueda del ratón o pellizco.
- **Mover la vista:** botón **Mover** (abajo), o Mayús + arrastrar.
- **Tocar una estructura:** sale su nombre y su ficha (función, irrigación, inervación, relevancia clínica).
- **Buscar:** escribe arriba "fémur", "nervio mediano", "hígado". Para nervios y vasos, que son muy finos, es más fácil buscar que tocar.
- **Sistemas:** en el panel izquierdo enciendes huesos, músculos, nervios, vasos, órganos.
- **Explorador:** botón arriba a la derecha. Lista todo por sistema y región; en cada fila puedes "ver solo esto" o "separar esto".
- **Separar:** el deslizador aleja las piezas entre sí, para ver cada hueso de la mano o del cráneo por separado.
- **Corte y profundidad:** para ver por dentro o quitar capas.
- **Aspecto:** Realista (con textura de tejido) o Esquemático (colores planos).

### Preguntarle a la tutora por lo que estás viendo

1. Toca una estructura en la app.
2. Pulsa **Preguntar a mi tutora**. Se copia una pregunta lista.
3. Pégala en el chat de Claude. Te explica la estructura y te hace 3 preguntas de repaso.

## 4. Lo que debes saber

- **Es material de estudio.** No reemplaza tus libros, tus docentes ni el criterio clínico.
- **Datos sin contrastar.** Algunas dosis y cifras no se pudieron confirmar contra su fuente. La tutora te avisa cuando usa una; confírmala en tu guía o libro antes de darla por buena. Quedan muy pocas (10 en toda la base).
- **Fichas con aviso.** Muchas fichas de la app dicen que no están contrastadas: úsalas para orientarte y verifica en tu atlas.
- **El modelo 3D es masculino.** No trae útero, ovarios, mama ni pelvis femenina; la tutora te los explica en texto.
- **No todo es una pieza tocable.** El corazón entero, el nervio frénico o el recto no existen como pieza única en el modelo.
- **Si algo se ve raro en la app,** recarga la página.
