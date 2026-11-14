# Encargo: texturas realistas de tejidos para una app de anatomía 3D

Necesito que generes, con la API de imágenes de APIMart, un paquete de texturas
fotorrealistas de tejidos humanos. Se van a aplicar sobre modelos 3D de anatomía
(músculos, huesos, órganos) en una app web con three.js. La app las repite en
mosaico sobre cada malla (mapeo triplanar), así que **lo más importante es que
cada imagen sea una textura continua y repetible, no una ilustración de un órgano**.

## Antes de generar
1. Revisa qué modelos de imagen ofrece mi cuenta de APIMart y usa el de mayor
   fidelidad fotográfica disponible. Lee la clave de API de la variable de
   entorno que ya tenga configurada; no la escribas en ningún archivo.
2. Genera primero SOLO `musculo` y `hueso`, enséñamelas y espera mi visto bueno
   antes de gastar créditos en el resto.

## Reglas para TODAS las imágenes
- Cuadradas, 2048×2048 (o el máximo cuadrado del modelo), luego reducidas a 1024×1024.
- Vista perpendicular a la superficie (cenital, macro), el tejido llena el 100 % del encuadre.
- Luz difusa y pareja: sin sombras marcadas, sin brillos quemados, sin viñeta, sin desenfoque.
- Sin bordes, sin fondo, sin instrumentos, sin manos, sin texto, sin etiquetas, sin marcas de agua.
- Sin forma de órgano reconocible: solo la superficie del tejido.
- Aspecto de atlas anatómico / espécimen de disección limpio y didáctico, sin sangre ni escenas quirúrgicas.
- Repetible sin costuras: si el modelo tiene opción "seamless/tileable", actívala.

Plantilla de prompt (en inglés, que rinde mejor), cambiando solo `{DESCRIPCIÓN}`:

> Seamless tileable texture, top-down macro photograph of {DESCRIPCIÓN}, filling
> the entire frame edge to edge, flat even diffuse lighting, no shadows, no
> specular hotspots, no vignette, sharp focus everywhere, anatomical atlas
> specimen quality, photorealistic, highly detailed surface, no text, no labels,
> no borders, no background, no instruments.

## Lista de tejidos (id → descripción para la plantilla)
| id | {DESCRIPCIÓN} |
|---|---|
| `musculo` | skeletal muscle tissue, deep red parallel muscle fiber bundles (fascicles) running vertically, thin translucent perimysium between bundles, slightly moist |
| `tendon` | tendon and aponeurosis, pearly white-silver dense parallel collagen fibers running vertically, subtle silky sheen |
| `fascia` | deep fascia and ligament, off-white fibrous connective tissue with criss-crossing collagen fibers, semi-translucent |
| `hueso` | dry cortical bone surface, ivory to warm off-white, fine porous texture with tiny vascular foramina and faint longitudinal striations |
| `cartilago` | hyaline articular cartilage, smooth glossy bluish-white pearl surface with very subtle mottling |
| `grasa` | subcutaneous adipose tissue, pale yellow lobules separated by thin fibrous septa |
| `piel` | human skin, neutral medium tone, fine pores and micro-wrinkles, no hair, no moles |
| `nervio` | peripheral nerve, pale yellowish-white cord surface with fine longitudinal fascicles and tiny red vasa nervorum |
| `arteria` | artery wall exterior, light red-pink thick elastic tunica with faint circumferential fibers and vasa vasorum |
| `vena` | vein wall exterior, dark bluish-purple thin wall with subtle translucency and faint longitudinal fibers |
| `linfatico` | lymph node and lymphatic tissue, pale greenish-tan smooth capsule with fine vessels |
| `miocardio` | heart muscle epicardial surface, dark red-brown myocardium with patches of yellow epicardial fat and fine branching coronary vessels |
| `pulmon` | lung pleural surface, pinkish-grey spongy tissue with fine polygonal lobule pattern and faint dark anthracotic speckles |
| `higado` | liver surface, smooth dark reddish-brown glossy capsule with very fine lobular mottling |
| `rinon` | kidney surface, smooth reddish-brown capsule with fine stellate veins |
| `bazo` | spleen surface, dark purple-maroon smooth capsule, slightly mottled |
| `estomago` | stomach and intestine serosa exterior, pale pinkish-tan smooth moist wall with fine branching blood vessels |
| `mucosa` | intestinal mucosa, pink velvety surface with fine folds and villi texture |
| `glandula` | glandular tissue such as pancreas or thyroid, tan-pink finely lobulated surface with thin connective septa |
| `cerebro` | cerebral cortex surface, pinkish-beige grey matter with thin pia mater and fine branching surface vessels, no gyri shapes, flat tissue surface |
| `cerebelo` | cerebellar cortex, tightly packed fine parallel folia, pinkish-grey |
| `medula` | spinal cord and white matter, creamy white smooth surface with fine longitudinal vessels |
| `ojo` | sclera of the eyeball, white with very fine red vessels |
| `diente` | tooth enamel, glossy ivory-white smooth surface with very faint vertical striations |

## Posprocesado (con un script, sin IA)
Por cada tejido, a partir de la imagen aprobada:
1. **Hacerla repetible**: comprueba la costura duplicándola en mosaico 2×2. Si se
   nota, corrígela (desplazar la imagen 50 % en X e Y y difuminar/mezclar la cruz
   central, o mezcla de bordes en espejo). Vuelve a comprobar en 2×2.
2. **Igualar la luz**: quita gradientes grandes de iluminación (filtro paso alto
   de radio grande o dividir por una versión muy desenfocada) para que el mosaico
   no muestre manchas repetidas.
3. `albedo.webp` — color, 1024×1024, WebP calidad ~85, sRGB.
4. `normal.webp` — mapa de normales calculado desde la luminancia de la albedo
   (altura → Sobel), convención OpenGL (verde hacia arriba), intensidad moderada, 1024×1024.
5. `rugosidad.webp` — escala de grises 1024×1024 derivada de la albedo: blanco =
   mate, negro = brillante. Tejidos húmedos (hígado, cartílago, mucosa, músculo)
   con media oscura-media; secos (hueso, piel, diente menos) con media clara.
6. Para `musculo`, `tendon`, `nervio` y `cerebelo` las fibras deben quedar
   **verticales** en la imagen final (gírala si hace falta).

## Entrega
Carpeta `texturas-paula/` con esta estructura exacta:

```
texturas-paula/
  manifest.json
  musculo/albedo.webp
  musculo/normal.webp
  musculo/rugosidad.webp
  hueso/...            (igual para los 24 ids)
  _control/<id>-mosaico.jpg   (el mosaico 2×2 de cada uno, para revisar costuras)
```

`manifest.json`:
```json
{
  "version": 1,
  "generado": "AAAA-MM-DD",
  "tejidos": {
    "musculo": { "modelo": "<modelo usado>", "prompt": "<prompt exacto>", "fibras": "vertical", "px": 1024 }
  }
}
```
(`fibras` es `"vertical"` para musculo, tendon, nervio y cerebelo; `null` en el resto.)

Peso total objetivo: menos de 10 MB. Al final comprímela en `texturas-paula.zip`
y dime la ruta, cuántas imágenes generaste, cuáles tuviste que repetir y cuánto
crédito gastó.

## Qué NO hacer
- No generes ilustraciones de órganos completos, cortes con etiquetas ni láminas.
- No uses fotos reales de internet ni imágenes con derechos; solo lo generado.
- No inventes un id fuera de la lista ni cambies los nombres de archivo: la app los busca tal cual.
