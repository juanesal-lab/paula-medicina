# Instalación (pasos para Juan)

Todo se hace dentro de la carpeta del proyecto, `paula-medicina/`. Llamaremos `<proyecto>` a esa carpeta. Si lo obtienes con `git clone`, `<proyecto>` es la carpeta clonada: el repositorio ya trae `.claude/launch.json` y la skill instalada en `.claude/skills/paula/` (copia de `skill/paula/`); el paso 1 solo hace falta si editas `skill/paula/` y quieres reinstalarla. No hace falta ningún paso de build ni `npm install` para usar la skill o la app; `pipeline-3d/` solo se usa para regenerar los modelos.

## 1. Instalar la skill
Copia la carpeta de la skill dentro del proyecto:

```
mkdir -p <proyecto>/.claude/skills
cp -R <proyecto>/skill/paula <proyecto>/.claude/skills/paula
```

Debe quedar `<proyecto>/.claude/skills/paula/SKILL.md`. Si cambias algo en `skill/paula/`, vuelve a copiarla.

## 2. Configuración del servidor de la app (opcional, para abrir la anatomía en el panel)
Si clonaste el repositorio, `<proyecto>/.claude/launch.json` ya existe con la configuración `paula-anatomia` (`python3 servidor.py 8765 --directory app`): no hagas nada más. Si no existe, copia `skill/paula/assets/launch.json` a `<proyecto>/.claude/launch.json`:

```
cp <proyecto>/skill/paula/assets/launch.json <proyecto>/.claude/launch.json
```

Si `<proyecto>/.claude/launch.json` ya existe, **no lo sobrescribas**: agrega la configuración `paula-anatomia` a su lista `configurations`. La configuración sirve la carpeta `app` en `127.0.0.1:8765` con `python3 servidor.py`.

Si el entorno no deja abrir puertos locales, usa la alternativa del paso 4 (GitHub Pages) o habilita el enlace local en la configuración del sandbox.

## 3. Usarla
Abre Claude Code en `<proyecto>` (esa carpeta debe ser el directorio de trabajo) y escribe `/paula`. Debe salir el menú de seis opciones con la lista de especialidades disponibles. Prueba también `/paula qué es el síndrome nefrótico`.

## 4. Publicar en GitHub Pages (opcional)
1. Sube el proyecto a un repositorio de GitHub (la skill no hace push; hazlo tú).
2. En el repositorio: Settings > Pages > Source: rama principal, carpeta raíz.
3. La app queda en `https://<usuario>.github.io/<repositorio>/app/`.
4. Escribe esa URL en `README.md` (línea "URL de GitHub Pages") para que la skill la ofrezca cuando no pueda abrir el servidor local.

La app usa solo rutas relativas, así que funciona en cualquier subruta. Revisa antes de publicar las licencias: algunas piezas 3D son no comerciales (ver `app/ATRIBUCIONES.md`).

## 5. Si la skill no encuentra la base
Síntomas: la skill dice "No encontré la base de conocimiento" y responde solo con búsqueda en vivo.
- Comprueba que existe `conocimiento/INDICE.md` y que abriste Claude Code en la raíz del proyecto (`<proyecto>`), no en una subcarpeta ni en otra ruta.
- La skill busca primero `conocimiento/INDICE.md` y, si no está, `**/conocimiento/INDICE.md`. Si abriste la sesión en una carpeta que no contiene el proyecto, ábrela en `<proyecto>`.
- Si el índice existe pero la línea "Disponibles" está vacía, regenera la parte automática:
  ```
  node docs/herramientas/generar_indice.mjs
  ```
- Para revisar que los archivos de la base cumplen el formato:
  ```
  node docs/herramientas/validar_conocimiento.mjs
  ```
  (`--urls` además comprueba los enlaces de las fuentes; necesita internet.)

## Registro de progreso
La primera vez que un quiz o un caso tenga fallos, la tutora le pregunta a Paula si puede crear `progreso/registro.md`. Con un sí, queda en la raíz del proyecto y se usa en "Repasar lo que fallé".

## 6. Comprobar que quedó bien
```
ls <proyecto>/.claude/skills/paula/SKILL.md      # la skill instalada
grep -c paula-anatomia <proyecto>/.claude/launch.json   # 1
python3 servidor.py 8765 --directory app       # desde <proyecto>; abrir http://localhost:8765
```
La app descarga unos 6 MB al abrir (huesos y piel) y hasta unos 36 MB si se encienden todos los sistemas.
