# Texturas del aspecto realista

Esta carpeta está vacía a propósito. La app funciona sin ella (colores planos por sistema); cuando aparece
`manifest.json` aquí, el aspecto **Realista** se activa solo y pasa a ser el modo por defecto.

## Dónde copiar el paquete

Copia el contenido de `texturas-paula/` (el que genera `docs/PROMPT-TEXTURAS-APIMART.md`) **dentro de esta carpeta**,
de modo que queden estas rutas:

```
app/texturas/manifest.json
app/texturas/musculo/albedo.webp
app/texturas/musculo/normal.webp
app/texturas/musculo/rugosidad.webp
app/texturas/hueso/...            (igual para los 24 tejidos)
```

No hace falta tocar código ni reiniciar nada: recarga la página.

- **No copies `_control/`** (los mosaicos 2×2 de revisión). Las carpetas que empiezan por `_` las ignora GitHub Pages
  (Jekyll) y `app/dev/verificar-estatico.mjs` falla si hay alguna.
- Si falta un tejido en el `manifest.json`, las estructuras de ese tejido se dibujan con el color plano de su sistema.
  Si no hay `manifest.json`, toda la app usa el aspecto esquemático y el interruptor "Realista" queda desactivado.
- Las texturas de un tejido se descargan solo cuando se muestra un sistema que lo usa (unos 100 a 300 KB por tejido).

## Contrato

- Ids: musculo, tendon, fascia, hueso, cartilago, grasa, piel, nervio, arteria, vena, linfatico, miocardio, pulmon,
  higado, rinon, bazo, estomago, mucosa, glandula, cerebro, cerebelo, medula, ojo, diente.
- Por tejido: `albedo.webp` (sRGB), `normal.webp` (convención OpenGL, verde hacia arriba) y `rugosidad.webp`
  (blanco = mate). Cuadradas y repetibles en mosaico (1024 px recomendado).
- `manifest.json`: `{ "version": 1, "tejidos": { "musculo": { "fibras": "vertical", "px": 1024, ... } } }`.
  `fibras: "vertical"` en musculo, tendon, nervio y cerebelo: la app orienta esas fibras a lo largo del eje más largo de cada malla.
- Qué tejido le toca a cada estructura y cuánto mide una repetición de la textura (en metros del modelo) está en
  `app/datos/tejidos.json`.

## Probar sin texturas reales

```
cd app/dev && npm install --cache "$TMPDIR/npm-cache" && node generar-texturas-prueba.mjs
```

Genera texturas procedurales en `app/dev/fixture/texturas/`. Se ven con `http://localhost:8765/?datos=dev/fixture/`:
en ese modo la app lee **todo** desde la carpeta de datos indicada, incluidas las texturas
(`<datos>/texturas/`). Las reglas de asignación (`datos/tejidos.json`) se leen siempre de la app.

## Memoria de vídeo

Cada tejido cargado ocupa unos 16 MB de memoria gráfica (3 imágenes de 1024² con mipmaps). Con ocho o diez tejidos
visibles son unos 150 MB; si hiciera falta bajar el consumo en móviles, entrega las imágenes a 512 px (el contrato lo permite
cambiando `px` en el manifest).

## Ajustes visuales

- `?aspecto=esquematico` abre la app en colores planos aunque haya texturas. `paulaApp.aspecto('realista' | 'esquematico')`
  cambia el aspecto desde la consola.
- Exposición y luces del modo realista: `ESTILO_LUZ` al principio de `app/js/escena.js`. Los valores vigentes salen de
  `app/dev/calcular-luz.mjs` (estimación por cálculo, sin navegador: hueso marfil ~76 %, músculo ~31 % de luminancia de salida,
  sin recorte). Para probar otros: `cd app/dev && node --no-warnings --import ./registrar-importmap.mjs calcular-luz.mjs --exposicion=0.8 --entorno=0.3 --hemisferica=0.15 --camara=1.15 --contraluz=0.3`.
- Equilibrio entre tejidos: `brillo` (opcional, 1 por defecto) en `app/datos/tejidos.json` multiplica el albedo de un tejido.
- Tamaño del mosaico por tejido: `escala_m` en `app/datos/tejidos.json`. `app/dev/analizar-escala.mjs` estima qué parte del detalle de cada
  textura se lee a distancia de cuerpo entero, a plano medio o se pierde (por debajo de ~3 px de pantalla).
- Fascias de revestimiento (las "Fascia …" que envuelven grupos musculares): en realista se dibujan como película translúcida
  (bloque `pelicula` de `app/datos/tejidos.json`: opacidad 0,15, sin escribir profundidad, después de los músculos). La casilla
  «Mostrar fascias de revestimiento» (panel, grupo Aspecto) las muestra u oculta; en esquemático no hace nada. Retináculos, septos,
  aponeurosis, vainas y tendones siguen opacos. Si falta un tejido en el `manifest.json` (hoy bazo, cerebelo y médula) sus estructuras
  se dibujan con el color plano del sistema y no se piden imágenes.
