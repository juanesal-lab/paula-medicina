# App de anatomía 3D

La app está en `app/` (web estática con three.js y modelos de Z-Anatomy). Esta referencia dice cómo abrirla, leer lo que Paula selecciona y manejarla.

## 1. Abrir la app (en este orden)
**Link en la nube:** https://juanesal-lab.github.io/paula-medicina/app/ (funciona en cualquier navegador y en el celular, sin instalar nada).

0. **Sin proyecto local o sin panel de navegador** (por ejemplo en claude.ai o en el celular): no intentes arrancar servidores. Dale a Paula ese link y pídele que lo abra en otra pestaña. No puedes leer su selección desde ahí: cuando toque una estructura y pulse "Preguntar a mi tutora", la app copia la pregunta y ella la pega en el chat; trabaja con ese texto. Si pide algo como "muéstrame los huesos de la mano separados", explícale los pasos en la app (Explorador → Sistema óseo → Miembro superior → Ver solo esto / Separar esto) en vez de ejecutar `paulaApp`.
1. **Panel con configuración.** Si existe `.claude/launch.json` con una configuración llamada `paula-anatomia`, ábrela con `preview_start` por nombre.
2. **Copiar la configuración.** Si no existe, ofrécele copiarla (con su permiso) desde `assets/launch.json` de esta skill a `.claude/launch.json` del proyecto. Si ya hay un `launch.json`, fusiona la configuración sin borrar las demás. Luego `preview_start`.
3. **Servidor manual.** Si no hay panel de navegador o `preview_start` falla, ejecuta `python3 servidor.py 8765 --directory app` (en segundo plano) y abre `http://localhost:8765`. Si el entorno no deja abrir puertos locales, dilo y pasa al paso 4.
4. **Link en la nube.** Si nada de lo anterior funciona, dale el link de arriba. Si no la trae, dile que puede abrir `app/index.html` mediante un servidor local o publicar la carpeta (ver `docs/INSTALACION.md`).
- Si `app/index.html` no existe, dilo: la app todavía no está instalada.

## 2. Leer lo que seleccionó
Con la herramienta de JavaScript del panel de navegador:
```js
JSON.stringify(window.paulaSelection)
```
Devuelve `null` si no hay selección, o un objeto (si lo lees justo después de `await paulaApp.seleccionar(id)`, `tiene_ficha` ya es fiable: la promesa espera a que carguen las fichas) con `id`, `nombre`, `nombre_la`, `sistema`, `sistema_nombre`, `lado`, `tiene_ficha`, `preguntado`, `pregunta` y `timestamp`. Si `preguntado` es true, Paula pulsó el botón "Preguntar a mi tutora" de la app (Paula es la estudiante; tú eres su tutora y no tienes nombre propio) y el texto en `pregunta` es lo que quiere saber.

## 3. Manejar la app
`window.paulaApp` permite controlar la vista:
- `paulaApp.estado()`: sistemas visibles, profundidad, corte y selección.
- `paulaApp.buscar(texto)`: devuelve hasta 20 resultados `{id, nombre, sistema}`.
- `paulaApp.seleccionar(id)`: promesa; carga el sistema, enfoca y abre la ficha.
- `paulaApp.mostrarSistema(id, visible)`: enciende o apaga un sistema.
- `paulaApp.aislar(id)` y `paulaApp.restaurar()`.
- `paulaApp.vista(nombre)`: `'anterior'`, `'posterior'`, `'derecha'`, `'izquierda'` o `'superior'`.
- `paulaApp.aspecto()`: devuelve el aspecto actual (`'realista'` o `'esquematico'`); `paulaApp.aspecto('realista')` o `paulaApp.aspecto('esquematico')` lo cambia. La app tiene un modo de aspecto **Realista / Esquemático**: el realista usa texturas por tejido (si están instaladas; si no, `aspecto('realista')` devuelve `false` y se queda en esquemático) y el esquemático es el aspecto sin texturas. Si Paula dice que no se ve como un libro o que no distingue estructuras, ofrece cambiar el aspecto.

Ejemplo: "muéstrame el nervio mediano":
1. `JSON.stringify(await paulaApp.buscar('nervio mediano'))` y elige el resultado correcto (si hay lado derecho e izquierdo, pregunta o toma el que ella pida).
2. `await paulaApp.seleccionar('<id>')`.
3. Opcional: `paulaApp.aislar('<id>')` y `paulaApp.vista('anterior')`.
4. Dile lo que ahora ve y explícale la estructura.

Si `window.paulaApp` no existe, la app no cargó bien: recarga y, si persiste, dile que la app tiene un problema y sigue con la base de conocimiento.

## 4. Combinar con la base
Cuando explique una estructura:
1. Busca en `conocimiento/basicas/anatomia.md` (Grep del nombre en español y en latín, luego Read de la sección; ver `metodo.md`).
2. Usa también la ficha de la app (`tiene_ficha`: función, irrigación, inervación, relevancia clínica y fuentes) leyendo la selección en el panel o, si no hay panel, el archivo `app/datos/fichas/<sistema>.json` (clave `ta2:<id>`; el `ta2` está en `app/datos/catalogo.json`).
   - **Fichas no contrastadas.** Cada ficha puede traer `contrastado: true|false`. Si es `false` o el campo no existe, trata su contenido igual que un dato `⚠ sin contrastar` de la base (regla 8 de SKILL.md y sección 3b de `metodo.md`): intenta confirmarlo en una fuente leída (OpenStax Anatomy and Physiology 2e se deja leer completo) y, lo que no logres confirmar, dilo con la marca "(sin contrastar)" junto al dato, no en un párrafo aparte al final. Nunca uses un dato no contrastado como respuesta correcta de una pregunta de repaso.
3. Completa con relevancia clínica de la especialidad correspondiente.
4. Termina con 3 preguntas de repaso, como pide el texto de ese botón. No des las respuestas: espera a que Paula conteste y corrige después.
5. Si el mensaje entró con "Estoy en la app de anatomía viendo: ...", ese texto ya trae la estructura; igual lee `paulaSelection` si hay panel, por si cambió.

## 5. Límites del modelo: lo que NO trae como pieza seleccionable
El modelo 3D es **masculino** y no incluye lo siguiente como pieza que se pueda seleccionar. Si Paula pregunta por algo de esta lista, **dilo antes de explicar**, no lo busques con `paulaApp.buscar` (no lo va a encontrar) y explícalo en texto, apoyándote en la base de conocimiento y en fuentes de la lista blanca:
- **Anatomía femenina:** útero, ovarios, trompas uterinas, vagina y mama (y la pelvis y el periné femeninos como tales).
- **Corazón entero y pericardio como pieza única.** Sí hay **cámaras, valvas y vasos** del corazón por separado.
- **Sistema de conducción cardíaco** (nodo sinusal, nodo AV, haz de His, ramas y fibras de Purkinje).
- **Nervio frénico.**
- **Plexos lumbar y sacro como unidad** (se pueden encontrar nervios sueltos, no el plexo completo).
- **Conducto torácico.**
- **Recto y ano.**
- **Lóbulos cerebrales como unidad.** Sí hay **giros**.
- **Conductos semicirculares.**

Cuando una estructura de la lista sea el tema, puedes mostrar en la app las vecinas que sí existen (por ejemplo, las cámaras y vasos cuando pregunta por el sistema de conducción) y decir con claridad que lo demás va en texto. Si dudas de si algo está, haz `paulaApp.buscar` y, si no devuelve nada, dilo así.

## Separar y explorar
La app puede separar las piezas ("vista explosionada") y tiene un Explorador en árbol (Sistema → Región o subsistema → Estructura, con filtro y botones D/I). Desde el panel: `paulaApp.separar(pct, { alcance })` (alcance `'visible'`, un id de sistema como `'oseo'`, `'region'` para la de la pieza seleccionada, o `{ sistemas, region, subsistema }`), `paulaApp.verSolo({ sistema, region, subsistema })` para apagar lo demás y encuadrar, y `paulaApp.restablecerVista()`. `paulaApp.estado()` incluye `separacion` (0–100) y `alcanceSeparacion`. Para estudiar los huesos de la mano, el cráneo o la columna: `verSolo({sistema:'oseo', region:'miembro superior'})` y luego `separar(100, {alcance:{sistemas:['oseo'], region:'miembro superior'}})`.

Gestos del visor que puedes explicarle a Paula: botón Girar/Mover (tecla M), Mayús + arrastre, botón derecho o dos dedos para desplazar, y flechas con el foco en el visor. Los nervios y vasos son muy finos: que se acerque, o que los elija con el buscador o el Explorador (tecla E).
