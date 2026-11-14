# Proyecto Paula

Proyecto de estudio para una estudiante de medicina en Colombia: una tutora dentro de Claude Code, una base de conocimiento por especialidades y una app de anatomía 3D. Es de **uso educativo y no comercial**.

> Material de estudio: no sustituye el criterio clínico ni la supervisión docente.

## Las tres piezas

1. **Skill `/paula`** (`skill/paula/`): tutora que responde preguntas, corre casos clínicos, hace quices, resume temas, repasa lo que falló y abre la app de anatomía. Consulta primero la base local y luego busca en vivo solo en fuentes confiables, citando siempre.
2. **Base de conocimiento** (`conocimiento/`): 23 archivos markdown por especialidad, con formato fijo (`conocimiento/FORMATO.md`), casos clínicos y fuentes abiertas. El índice está en `conocimiento/INDICE.md`.
3. **App de anatomía 3D** (`app/`): web estática con three.js y mallas anatómicas reales de Z-Anatomy. Funciona sin internet con un servidor estático local, o publicada en GitHub Pages.

## Cómo usar la skill

1. Instálala (pasos en `docs/INSTALACION.md`): copiar `skill/paula/` a `.claude/skills/paula/` dentro de este proyecto.
2. Abre Claude Code en la carpeta `paula-medicina/` (la raíz del proyecto) y escribe:
   - `/paula` a secas: sale un menú con seis opciones (preguntar, caso clínico, quiz, resumen, app 3D, repasar lo que fallé).
   - `/paula qué es el síndrome nefrótico`: responde directo.
   - `/paula quiz de nefrología 3 preguntas`, `/paula caso clínico de cardiología`, `/paula resumen de asma`.
3. Los fallos de quices y casos se anotan en `progreso/registro.md` (la skill pide permiso la primera vez).

## Cómo abrir la app de anatomía

- **Desde la skill**: `/paula abre la anatomía`. Usa la configuración `paula-anatomia` de `.claude/launch.json` (ver `docs/INSTALACION.md`).
- **Servidor local** (desde la raíz del proyecto):
  ```
  python3 servidor.py 8765 --directory app
  ```
  y abre http://localhost:8765 en el navegador.
- **GitHub Pages**: publica la carpeta del repositorio y entra a la subruta `/app/` (por ejemplo `https://<usuario>.github.io/<repositorio>/app/`). La app usa solo rutas relativas, por lo que funciona en cualquier subruta.
- URL de GitHub Pages de esta instalación: **sin configurar** (cuando exista, se escribe aquí y la skill la ofrece).

El modelo 3D es **masculino**: no incluye pelvis femenina, útero, ovarios ni mama. La base de conocimiento cubre esos temas en texto.

## Licencias

- **Código** (skill, herramientas, código de la app): MIT. Ver `LICENSE`.
- **Modelos 3D y datos derivados** (`app/modelos/`, `app/datos/catalogo.json`): CC BY-SA 4.0, derivados de Z-Anatomy y BodyParts3D. **Algunas partes** (oído interno y riñón) vienen con licencia **no comercial** (CC BY-NC-SA 4.0 y CC BY-NC 4.0); por eso el proyecto se declara de uso educativo no comercial. Detalle y atribuciones en `app/ATRIBUCIONES.md`.
- **Contenido de la base de conocimiento y de las fichas**: redactado con palabras propias a partir de fuentes abiertas, que se citan en cada archivo.
- three.js (MIT) y las tipografías (OFL) conservan sus licencias en `app/vendor/` y `app/fonts/`.

## Herramientas

- `node docs/herramientas/validar_conocimiento.mjs [--urls] [archivo...]`: valida el formato de la base (IDs, casos, datos con fuente, URLs). Incluye un autotest.
- `node docs/herramientas/generar_indice.mjs`: regenera la parte automática de `conocimiento/INDICE.md`.

Requieren Node 22 y no tienen dependencias.

## Aviso clínico

Esto es material de estudio. No sustituye el criterio clínico, las guías vigentes de tu institución ni la supervisión docente. Ante una emergencia real, acude a urgencias o llama a la línea 123 (Colombia). No introduzcas datos de pacientes reales identificables.
