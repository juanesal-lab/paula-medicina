"""mosaico4.py <texturas-paula> <salida> id...  → <salida>/<id>-4x4.jpg y, si hay varios, <salida>/_hoja.jpg
(4×4 de la albedo final para buscar rasgos repetidos)."""
import sys
from pathlib import Path
from PIL import Image

raiz, sal = Path(sys.argv[1]), Path(sys.argv[2]); sal.mkdir(parents=True, exist_ok=True)
ids = sys.argv[3:]
for t in ids:
    a = Image.open(raiz / t / "albedo.webp").convert("RGB").resize((256, 256), Image.LANCZOS)
    m = Image.new("RGB", (1024, 1024))
    for x in range(4):
        for y in range(4):
            m.paste(a, (256 * x, 256 * y))
    m.save(sal / f"{t}-4x4.jpg", quality=80)
if len(ids) > 1:
    cols = min(4, len(ids)); filas = (len(ids) + cols - 1) // cols
    h = Image.new("RGB", (512 * cols, 512 * filas), "white")
    for i, t in enumerate(ids):
        h.paste(Image.open(sal / f"{t}-4x4.jpg").resize((512, 512)), (512 * (i % cols), 512 * (i // cols)))
    h.save(sal / "_hoja.jpg", quality=82)
