# Atribuciones y licencias

Declaración: **Modelos y datos derivados: CC BY-SA 4.0; proyecto educativo no comercial.**

## Modelos 3D

- **Z-Anatomy — The libre 3D atlas of anatomy — CC BY-SA 4.0** (https://github.com/LluisV/Z-Anatomy). Mallas FBX de `Resources/Models/FBX/`, rama `PC-Version`, commit `6c7f9016bd5899ac8edafd31b9900c151df42ed6`. Los autores son los del proyecto Z-Anatomy (repositorio LluisV/Z-Anatomy); los GLB de `app/modelos/` son obras derivadas (reorientadas, escaladas, simplificadas y recomprimidas) y se redistribuyen bajo CC BY-SA 4.0. Los nombres de autor individuales no figuran en el README de ese commit; la dirección debe completarlos si desea listarlos.
- **BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International** (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Z-Anatomy se deriva de BodyParts3D. Nota: la página de licencia actual indica CC BY 4.0 (actualizada el 2025-02-27), pero las cabeceras de los OBJ y Z-Anatomy citan CC BY-SA 2.1 JP; distribuir como BY-SA 4.0 cumple con ambas.

## Nombres en latín y español

- **TA2.csv de Z-Anatomy / Models-of-human-anatomy** (https://github.com/Z-Anatomy/Models-of-human-anatomy), commit `dd72c25bb57e47f8baf0333c3a926fb4ec8172fd`, basado en la Terminologia Anatomica 2. Se usa para los campos `nombre_la`, `nombre_es` y `ta2` de `app/datos/catalogo.json`. Las correcciones propias de español están en `pipeline-3d/correcciones-nombres.json` y las traducciones de estructuras sin entrada en `pipeline-3d/traducciones-propias.json` (marcadas `nombre_fuente: "traduccion-propia"`).

## Partes con licencia no comercial (NC)

Según la información de procedencia de Z-Anatomy que recoge el SPEC del proyecto (sin verificar en el README del commit fijado, que no la contiene), el oído interno proviene de la University of Dundee (CC BY-NC-SA 4.0) y el riñón de Lissie Cowley (CC BY-NC 4.0). Estas estructuras están marcadas con el campo `licencia` en el catálogo y **no deben usarse comercialmente**; el proyecto se declara no comercial.

Oído interno (CC BY-NC-SA 4.0):
- `cochlea_i` (Cóclea)
- `cochlea_d` (Cóclea)
- `vestibule_d` (Vestíbulo)
- `vestibule_i` (Vestíbulo)

Riñón y pelvis renal (CC BY-NC 4.0):
- `renal_pelvis_d` (Pelvis renal)
- `kidney_d` (Riñón)
- `renal_pelvis_i` (Pelvis renal)
- `kidney_i` (Riñón)

## Código y bibliotecas

- three.js (MIT), © los autores de three.js (https://threejs.org). Su LICENSE se copia en `app/vendor/three/`.
- Herramientas de `pipeline-3d/`: @gltf-transform (MIT), meshoptimizer (MIT).
- Código propio de la app y del pipeline: MIT (ver `LICENSE`).

## Fuentes tipográficas

Fraunces e Inter (SIL Open Font License 1.1). **[Pendiente: el encargo 03 confirma en su informe qué fuentes se incluyeron en `app/fonts/` y que cada una lleva su OFL.txt.]**
