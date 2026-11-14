# pipeline-3d

Convierte las mallas reales de Z-Anatomy (FBX) en GLB livianos por sistema y genera el catálogo JSON que consume la app. Todo en Node, sin Blender. Licencias y atribuciones: `../app/ATRIBUCIONES.md`.

## Requisitos
- Node 22 o superior y `curl` (la descarga usa `curl`).
- Conexión a `raw.githubusercontent.com` (≈ 285 MB) y a `registry.npmjs.org` la primera vez.
- Unos 1,5 GB de RAM libre.

## Instalación y uso
```bash
cd pipeline-3d
npm install --cache "$TMPDIR/npm-cache"   # la caché global de esta máquina tiene permisos rotos
npm run todo      # descargar, inventario, clasificar, convertir, catalogo, informe, verificar
```
Pasos sueltos: `npm run descargar | inventario | clasificar | convertir | catalogo | informe | verificar | capturas`.

| paso | qué hace | tiempo aproximado |
|---|---|---|
| `descargar` | 8 FBX + TA2.csv a `crudo/` con commits fijados y SHA-256 (si el archivo ya está con el hash correcto, no lo baja) | 10 min con `crudo/` vacío (depende de la red) |
| `inventario` | parsea los FBX, aplica el algoritmo del SPEC §6.4, compara con `docs/datos/inventario-zanatomy.json` (≥ 99 %) → `intermedio/inventario.json` | 10 s |
| `clasificar` | sistema, subsistema, capa, región, grupo, id, lado y licencia con `reglas.json` → `intermedio/clasificado.json` | 25 s |
| `convertir` | FBX → GLB por sistema con presupuesto (SPEC §6.7) → `../app/modelos/*.glb` | 20 s |
| `catalogo` | `../app/datos/catalogo.json`, `sistemas.json` y `../app/ATRIBUCIONES.md` | 3 s |
| `informe` | regenera `INFORME.md` | 1 s |
| `verificar` | comprueba GLB, catálogo, pesos y orientación (sale con código 1 si algo falla) | 15 s |
| `capturas` | renderiza en software 6 vistas de los GLB finales → `capturas/final-*.png` | 30 s |

`node prueba-decimado.mjs` repite la prueba R1 del decimado (`capturas/r1-*`). Necesita `intermedio/inventario.json`.

## Archivos
- `reglas.json`: reglas declarativas (sistema por archivo y grupo del FBX, capas, regiones, licencias NC, presupuesto y error de decimado).
- `traducciones-propias.json` (estructuras sin TA2) y `correcciones-nombres.json` (rarezas y erratas del español de TA2, clave = TA2ID).
- `comun.mjs`, `fbx.mjs`, `geom.mjs`, `orient.mjs`, `raster.mjs`: utilidades compartidas.
- `crudo/`, `intermedio/` y `node_modules/` no se versionan (deben ir en el `.gitignore` de la raíz). `capturas/` sí.

## Cómo funciona (resumen)
1. Cada malla del FBX se lleva a coordenadas world, escala ×0,01 (cm → m), traslación para pies en y = 0 y cuerpo centrado (`orient.mjs`; el modelo ya viene con anterior = +Z e izquierda = +X). Las matrices con determinante negativo invierten el orden de los triángulos.
2. Se sueldan los vértices, se simplifica con meshoptimizer (mallas de menos de 300 triángulos intactas, mínimo 64, `LockBorder`), se recalculan normales y se escribe un nodo por estructura (`node.name = id`).
3. `prune → quantize → EXT_meshopt_compression`. Sin materiales ni texturas: la app pone los colores.
