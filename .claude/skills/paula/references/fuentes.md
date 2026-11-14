# Fuentes permitidas (lista blanca)

Valen para la base de conocimiento y para la búsqueda en vivo. Si un dominio no está aquí, no se cita.

## Generales y de revisión
| Dominio | Para qué sirve |
|---|---|
| `ncbi.nlm.nih.gov` | StatPearls (Bookshelf, `/books/`) para fisiopatología, clínica y manejo; PMC de acceso abierto para artículos y guías. El **HTML** de Bookshelf no se puede leer desde aquí (ver "Qué no funciona"): se cita como dominio, se lee por otra vía |
| `pubmed.ncbi.nlm.nih.gov` | Para identificar un artículo y leer su **resumen** (vía E-utilities). Si solo leíste el resumen, dilo al citar; para cifras finas prefiere el texto completo en PMC |
| `msdmanuals.com` | Manual MSD, versión profesional; preferible la versión en español |
| `openstax.org` | Anatomía y Fisiología 2e y otros textos abiertos de ciencias básicas |
| `medlineplus.gov` | Explicaciones claras para pacientes; sirve para lenguaje sencillo |
| `cochranelibrary.com` | Resúmenes de revisiones sistemáticas |

## Organismos y salud pública
| Dominio | Para qué sirve |
|---|---|
| `who.int`, `iris.who.int` | Guías y fichas OMS; AIEPI/IMCI |
| `paho.org`, `iris.paho.org` | OPS: guías regionales, dengue, malaria, inmunización |
| `cdc.gov` | Vigilancia, vacunas, infecciosas (se puede citar, pero no se puede leer desde aquí) |
| `nice.org.uk` | Guías NICE |

## Colombia
| Dominio | Para qué sirve |
|---|---|
| `minsalud.gov.co`, `gpc.minsalud.gov.co` | Guías de práctica clínica, Resolución 3280, PAI, normas técnicas |
| `iets.org.co` | Evaluaciones de tecnologías y GPC del IETS |
| `ins.gov.co` | Protocolos de vigilancia en salud pública, boletines epidemiológicos |

## Sociedades y guías de acceso abierto
`kdigo.org` (riñón), `goldcopd.org` (EPOC), `ginasthma.org` (asma), `diabetesjournals.org` (ADA Standards of Care; se lee en PMC), `ahajournals.org` (AHA; se lee en PMC si está), `escardio.org` (ESC), `idsociety.org` (IDSA), `rcog.org.uk`, `figo.org`, `aap.org` (pediatría), `acog.org` (solo lo abierto), `surgicalcriticalcare.net`, `sccm.org` (Surviving Sepsis), `facs.org` (cirugía y trauma).

## Prohibido citar
Wikipedia, UpToDate, Medscape, Amboss, Kenhub, blogs, foros, redes sociales y páginas comerciales. Puedes usarlos para orientarte sobre qué buscar, pero la respuesta debe apoyarse en la lista blanca.

## Cómo leer una fuente (vías que funcionan)
Probadas el 2026-11-13 desde este entorno. Prueba en este orden y quédate con la primera que te dé el texto del dato que buscas.

| # | Vía | Cómo | Sirve para |
|---|---|---|---|
| 1 | **NBK → PubMed → resumen** | Si la base cita un `NBKnnnn`: `esearch` en PubMed con el NBK da el PMID y `efetch rettype=abstract` da el resumen | Confirmar que el NBK es el capítulo correcto y leer su **resumen** (StatPearls y otros). No trae dosis finas |
| 2 | **PMC** | HTML de `https://pmc.ncbi.nlm.nih.gov/articles/PMCnnnn/` (cuerpo completo, sin captcha) y búsqueda con `esearch db=pmc` | Texto completo de artículos y guías de acceso abierto: ADA Standards of Care, muchas guías de sociedades y capítulos que estén en PMC. `efetch db=pmc` solo trae cuerpo en revistas OA |
| 3 | **PDF oficiales colombianos** | `curl -L` del PDF de `minsalud.gov.co`, `ins.gov.co` o `gpc.minsalud.gov.co` y `pdftotext` (suele estar en `/opt/homebrew/bin/pdftotext`). Si no existe en la máquina, WebFetch del PDF | Resolución 3280, GPC, protocolos del INS |
| 4 | **HTML directo** | `curl -L <url>` y quitar etiquetas (o WebFetch de la página) | NICE, MSD profesional en español, who.int y paho.org (fichas y temas, **no** IRIS), KDIGO, GOLD, GINA, ESC y OpenStax |
| 5 | **WebSearch con `site:`** | Solo como último recurso, para encontrar la URL; puede no estar disponible | Localizar el documento. Después lo lees por la vía 2, 3 o 4 |

### Qué no funciona (no insistas)
- **HTML de NCBI Bookshelf** (`ncbi.nlm.nih.gov/books/NBK...`): reCAPTCHA. WebFetch devuelve el reto, no el capítulo.
- **cdc.gov**: 403.
- **ahajournals.org y cpr.heart.org**: 403. Para una guía AHA busca la misma guía en PMC (vía 2); si no está, el dato queda sin contrastar.
- **iris.who.int e iris.paho.org**: reto de JavaScript. Usa las páginas de who.int o paho.org, o PMC.
- **diabetesjournals.org**: sin respuesta; la ADA se lee en PMC.
- `site:ncbi.nlm.nih.gov/books` con WebFetch: no lo uses.

### Reglas de las peticiones a NCBI (E-utilities)
- Con Bash y `curl` hacia `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`.
- Como máximo **3 peticiones por segundo** (deja `sleep 0.4` entre una y otra).
- **Sin datos personales** de Paula ni de pacientes en la consulta: solo el NBK, el PMID o el término médico.
- Si el entorno bloquea la red, dilo y sigue con la base marcando el dato como no verificado.

### Tres comandos de ejemplo (ejecutados el 2026-11-13)
1. **NBK → PMID → resumen** (StatPearls "Type 2 Diabetes", NBK513253):
```bash
B=https://eutils.ncbi.nlm.nih.gov/entrez/eutils
curl -s -m 20 "$B/esearch.fcgi?db=pubmed&term=NBK513253&retmode=json" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['esearchresult']['idlist'])"   # ['30020625']
sleep 0.4
curl -s -m 20 "$B/efetch.fcgi?db=pubmed&id=30020625&rettype=abstract&retmode=text" | head -40
```
Devuelve el título ("Type 2 Diabetes.", StatPearls 2023) y el resumen. Si el título no coincide con el que cita la base, el NBK está mal: dilo.

2. **Texto completo en PMC** (ADA Standards of Care 2026, sección 9, PMC12690185):
```bash
curl -s -m 30 -L "https://pmc.ncbi.nlm.nih.gov/articles/PMC12690185/" -o "$TMPDIR/pmc.html"
python3 -c "import re,html,os;t=open(os.environ['TMPDIR']+'/pmc.html',encoding='utf8',errors='replace').read();t=re.sub(r'(?s)<(script|style)[^>]*>.*?</\1>','',t);x=re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',t)));i=x.find('metformin');print(x[i-200:i+800])"
```
Devuelve HTTP 200 y unos 600 KB de HTML con el cuerpo completo; se busca la cifra con `find` o `grep`.

3. **PDF de MinSalud** (Resolución 3280 de 2018):
```bash
curl -s -m 60 -L "https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-3280-de-2018.pdf" -o "$TMPDIR/r3280.pdf"
/opt/homebrew/bin/pdftotext -layout "$TMPDIR/r3280.pdf" "$TMPDIR/r3280.txt"; grep -n -i "hierro" "$TMPDIR/r3280.txt" | head
```
Devuelve HTTP 200, un PDF de 348 páginas (unos 4,7 MB) y 21 700 líneas de texto buscable.

### El corpus local de StatPearls no es parte de la skill
Durante la ronda de verificación de la base se usó un corpus de StatPearls extraído en `$TMPDIR/fuentes/statpearls`. Es una herramienta de esa ronda: **no estará en la máquina de Paula** y la skill no debe depender de él. Si no existe, usa las vías 1 a 4.

### Qué citar
- Cita siempre la fuente **leída**, con título, organización o autores, año y URL.
- Si solo leíste el resumen de PubMed, dilo: "según el resumen de PubMed de <título> (el texto completo no lo leí)".
- Si el dato no apareció en lo que leíste, no lo des como confirmado. Ver `metodo.md` (3b).

## Pasos para una verificación
1. Con el NBK o el título de la base, localiza el documento por la vía 1 y busca si hay versión en PMC (vía 2).
2. Si la base cita una guía colombiana u oficial, ve a la vía 3 o 4.
3. Busca en el texto leído la **cifra concreta** (con `grep`), no solo el tema.
4. Anota título, organización, año, URL y qué leíste (texto completo o resumen).
5. Si la GPC es de años atrás, anota el año y mira si hay una guía internacional más reciente.
6. Si no hay fuente en la lista blanca, dilo y no cites otra.


## Si la red no responde
Distingue dos casos y dile a Paula cuál es: (a) **el entorno bloquea la salida** (error de red o de permisos antes de llegar al sitio): pide permiso para ese dominio o dile que no pudiste salir a internet; (b) **el sitio rechaza o no trae el dato**: la fuente queda como no leída y el dato como no contrastado. En ningún caso te identifiques como navegador ni intentes saltar un captcha.

## Carpetas que se crean a demanda
`progreso/` y `resumenes/` no existen hasta que Paula acepta crearlas (ver `progreso.md` y `resumen.md`). Que falten no es un error.
