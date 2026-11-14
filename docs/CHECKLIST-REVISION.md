# Checklist de revisión (dirección técnica)

Se ejecuta cuando vuelvan los 10 constructores. Cada punto se marca como ✅, ⚠️ (corrección menor) o ❌ (se devuelve el trabajo). Los comandos se corren desde `RAIZ`.

## 0. Higiene global (todos)
- [ ] Ningún archivo fuera de `RAIZ`, y nada escrito en `.claude/`: `ls -la ../.claude` sin cambios.
- [ ] Cada constructor tocó solo sus archivos (comparar con SPEC §2): `find . -newer docs/SPEC.md -type f | sort` y cotejar el dueño de cada uno.
- [ ] Sin rutas absolutas de la máquina en entregables: `grep -rn "/Users/" skill conocimiento app --include=*.{md,js,json,html,css}` vacío. Excepción permitida: ninguna.
- [ ] Sin datos personales ni secretos: `grep -rniE "<usuario del equipo>|password|api[_-]?key|token" skill conocimiento app pipeline-3d --exclude-dir=node_modules` revisado.
- [ ] `.gitignore` cubre `crudo/`, `intermedio/` y `node_modules/`; `du -sh app` sin `dev/node_modules` debe ser de 25 MB o menos.

## 1. Skill (01)
- [ ] `wc -l skill/paula/SKILL.md` da 300 o menos; frontmatter con `name: paula` y `description` en español con disparadores.
- [ ] El menú tiene las 6 opciones y el aviso clínico aparece una sola vez, sin sermón.
- [ ] Divulgación progresiva: SKILL.md dice qué `references/*.md` leer y cuándo, y cada archivo existe y tiene contenido sustantivo.
- [ ] `metodo.md`: base local primero (Grep y Read parcial), búsqueda en vivo solo con la lista blanca, citas, "Incierto" y "Las guías difieren", y prioridad Colombia.
- [ ] `anatomia-3d.md`: flujo launch.json → copia con permiso → http.server → Pages; lectura de `window.paulaSelection` y uso de `paulaApp`.
- [ ] Linter: `node docs/herramientas/validar_conocimiento.mjs` corre sobre los 23 archivos y su autotest pasa; `--urls` corre sin colgarse.
- [ ] `node docs/herramientas/generar_indice.mjs` es idempotente y el INDICE lista los 23 archivos.
- [ ] **Prueba real**: instalar una copia de la skill en una carpeta temporal y simular `/paula`, `/paula quiz de nefrología 3 preguntas` y `/paula caso clínico de dengue`. Debe leer la base, citar y no inventar dosis.

## 2. Base de conocimiento (05–10)
- [ ] Los 23 archivos existen en las rutas del SPEC §4.
- [ ] `node docs/herramientas/validar_conocimiento.mjs` da 0 errores. Si hay advertencias, revisar una por una.
- [ ] Mínimos: al menos 10 temas y 4 casos por archivo, de 20 a 70 KB (`ls -l conocimiento/**/*.md`).
- [ ] `node docs/herramientas/validar_conocimiento.mjs --urls`: tasa de URLs con 200 de al menos el 95 %; las rotas se corrigen.
- [ ] **Muestreo de exactitud** (3 datos sensibles por archivo, 69 en total): abrir la fuente citada y confirmar el valor. Prioridad máxima:
  - dosis de dengue (líquidos por grupo), malaria (esquema Colombia), sulfato de magnesio, ácido tranexámico, adrenalina en anafilaxia, Parkland, NAC en acetaminofén, atropina en organofosforados, hiperkalemia, CAD;
  - puntos de corte: HTA, DM (ADA), LRA y ERC (KDIGO), sepsis, preeclampsia, tamizaje cervical en Colombia, esquema PAI.
- [ ] **Normas colombianas** citadas (número, año y URL de MinSalud/INS/IETS) existen y están vigentes: Res. 3280/2018, Ley 1751/2015, Res. 8430/1993, GPC de dengue, protocolo de sífilis gestacional, lineamiento de desnutrición, triaje.
- [ ] **Anti-copia**: 3 frases por archivo buscadas entre comillas en la web, sin coincidencias literales largas.
- [ ] Casos: formato de 7 etiquetas, plausibles en Colombia, sin pacientes reales; diferencial razonado (no una lista suelta).
- [ ] Las líneas "Las guías difieren" e "Incierto" existen donde corresponde (HTA, metas de LDL, tamizajes, umbrales de transfusión).

## 3. Pipeline 3D (02)
- [ ] `pipeline-3d/INFORME.md` existe con la tabla por sistema, la transformación de orientación y los números del paso 0 (esternón frente a T5 en z, hígado en x, un objeto con sufijo `l` en x > 0).
- [ ] **R1 cerrado**: capturas en `pipeline-3d/capturas/` (cara, mano, corazón, plexo braquial, encéfalo) con 3 configuraciones; la elegida no rompe tubos finos. Las reviso con Read.
- [ ] `cd pipeline-3d && node verificar.mjs` pasa: ids GLB ↔ catálogo 1:1, sin duplicados, nombres no vacíos, capas entre 0 y 5, topes de bytes.
- [ ] Presupuesto: `ls -l app/modelos/` con el total de 22 MB o menos, `oseo` + `piel` de 4,5 MB o menos y cada sistema bajo su tope del SPEC §6.7.
- [ ] Reproducibilidad: borrar `crudo/` e `intermedio/` y correr `npm run todo` en un clon temporal; el resultado tiene los mismos ids.
- [ ] `catalogo.json` y `sistemas.json` siguen el esquema exacto del SPEC §7.3 (validar con un script de 20 líneas).
- [ ] Muestreo de nombres: 30 estructuras al azar con `nombre_es` y `nombre_la` correctos (en especial las `traduccion-propia`), y el lado en el campo `lado`, no en el nombre.
- [ ] Clasificación: deltoides, pectoral mayor y trapecio en capa 1; supraespinoso y psoas en capa 2; corazón y aorta en capa 5; encéfalo en 5; plexo braquial en 3.
- [ ] Licencias: `ATRIBUCIONES.md` con la línea de crédito exacta de BodyParts3D, Z-Anatomy con commit, TA2.csv, las partes NC listadas con su `licencia` correcta en el catálogo, three.js MIT y las fuentes OFL.

## 4. App (03) e integración con 02 y 04
- [ ] `node app/dev/verificar-estatico.mjs` pasa; `node --check` sobre todos los js.
- [ ] Sin CDN: `grep -rnE "https?://(cdn|unpkg|jsdelivr|fonts.googleapis)" app/index.html app/js app/css` vacío. Sin rutas que empiecen por `/` ni carpetas con `_`.
- [ ] Vendor: three 0.170.0 con LICENSE e imports relativos resueltos; fuentes OFL con OFL.txt.
- [ ] **Prueba en navegador** (requiere `.claude/launch.json` del usuario, ver D1), primero con `?datos=dev/fixture/` y luego con datos reales:
  - [ ] Carga inicial con `oseo` y `piel`, sin errores en consola; medir bytes transferidos (≤ 6 MB).
  - [ ] Activar cada sistema: carga diferida con progreso y colores correctos (arterias rojas, venas azules).
  - [ ] Clic → resaltado + ficha (con ficha real y sin ficha: "Ficha en preparación").
  - [ ] Ocultar, aislar, transparente, deshacer y restaurar.
  - [ ] Profundidad 0 → 5 progresiva y coherente (piel, músculos, vasos, hueso, vísceras).
  - [ ] Corte sagital, coronal y transversal, invertir; las caras internas se ven oscuras.
  - [ ] Buscador: "mediano", "nervio mediano", "n. medianus" (latín), "femur" sin tilde → resultados correctos; Enter enfoca.
  - [ ] "Preguntar a Paula": `JSON.stringify(window.paulaSelection)` trae id, nombre, nombre_la, sistema, lado, preguntado y pregunta; la pregunta usa la plantilla exacta del SPEC §7.6.
  - [ ] `await paulaApp.seleccionar('<id real>')` devuelve true; con un id inventado, false sin excepción; `paulaApp.buscar`, `vista('posterior')` y `estado()` funcionan.
  - [ ] `?debug=1`: FPS y triángulos con todo encendido (anotar cifras).
  - [ ] Móvil 375×812: panel inferior, cajón de sistemas, táctil y sin desbordes.
  - [ ] Diseño: cumple el SPEC §7.5 (no genérico), español en toda la interfaz, contraste AA y teclado (Tab, `/`, Esc).
- [ ] GitHub Pages simulado: servir la carpeta **padre** de `app/` y entrar por `/app/` para comprobar que las rutas relativas funcionan en subruta.

## 5. Fichas (04)
- [ ] Al menos 280 fichas; `manifest.total` es igual a la suma real; tamaño total de 1 MB o menos.
- [ ] Todas las claves existen en `catalogo.json` de 02 (cruce real, no solo con el inventario). Reportar el porcentaje de cruce.
- [ ] Esquema exacto del SPEC §7.4 (`ta2` como string), `musculo` presente en músculos, `nombre_la` igual al catálogo y las correcciones de `nombre_es` de 04 cruzadas con `correcciones-nombres.json` de 02.
- [ ] Muestreo de 15 fichas: exactitud (inervación e irrigación), relevancia clínica concreta, fuentes 200 y sin copia literal.

## 6. Integración skill ↔ app
- [ ] Con la app abierta, pedir a la skill "¿qué estoy viendo?": lee `window.paulaSelection` y responde combinando la ficha y `conocimiento/basicas/anatomia.md`.
- [ ] "Muéstrame el nervio cubital derecho" → la skill usa `paulaApp.buscar` y `paulaApp.seleccionar`.

## 7. Órdenes de corrección
Por cada ❌ o ⚠️ escribir `docs/correcciones/NN-<constructor>-rK.md` con: hallazgo, evidencia (comando o salida), criterio incumplido y archivo. Cada corrección se dirige solo al dueño del archivo.

## 8. Ronda de verificación v1.1 (encargos C1–C6)
- [ ] `node docs/herramientas/validar_conocimiento.mjs --v11` da 0 errores en los 23 archivos.
- [ ] `--nbk` da 0 discrepancias. Comparar con `docs/verificacion/nbk-inicial.json`, que tenía 7 citas erróneas en 5 archivos.
- [ ] Bitácoras `docs/verificacion/<PREFIJO>.tsv` para los 23 prefijos; `sin_contrastar` del TSV es igual a las marcas `⚠` del archivo y al frontmatter.
- [ ] P1 sin contrastar ≤ 10 % por archivo. Auditoría: 5 filas `confirmado` al azar por archivo, releyendo la fuente con `docs/verificacion/herramientas/fuentes.py`.
- [ ] Correcciones esperadas, revisadas una por una: primaquina en falciparum (`infectologia.md`), esquema PAI (`pediatria.md`), máximos pediátricos, RCP 2025 y los 5 temas nuevos de urgencias, ≥ 3 líneas "En Colombia" en trauma y en cirugía general, y ADA 2026 vía PMC en endocrinología.
- [ ] `fuentes.py copia` vacío por archivo (lo repito en 3 archivos al azar).
- [ ] Skill: los dos diálogos de C1 son coherentes; `fuentes.md` no recomienda rutas bloqueadas; la regla `⚠` aparece en SKILL, metodo, quiz y caso.
- [ ] Al final: `node docs/herramientas/generar_indice.mjs`, y el INDICE muestra "Datos pendientes de verificar: N".
