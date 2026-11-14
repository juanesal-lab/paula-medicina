"""Posprocesado sin IA. Uso: procesar.py <texturas-paula> id [id ...]
Toma la última versión cruda de cada id (o la indicada con ELEGIDO=id=archivo.png,id2=...) y escribe
<id>/albedo.webp, normal.webp, rugosidad.webp, _control/<id>-mosaico.jpg y actualiza manifest.json."""
import datetime, json, os, sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

N_FINAL = 1024
SOLAPE = 128                                        # px (a 2048) del solape para cerrar la costura
FIBRAS = {"musculo", "tendon", "nervio", "cerebelo"}  # deben quedar verticales (manifest: fibras)
FUNDIDO_V = FIBRAS | {"diente"}                     # estrías verticales: cierre arriba-abajo con fundido largo
RUG = {"musculo": .38, "tendon": .45, "fascia": .55, "hueso": .78, "cartilago": .28, "grasa": .45,
       "piel": .70, "nervio": .50, "arteria": .42, "vena": .40, "linfatico": .45, "miocardio": .38,
       "pulmon": .55, "higado": .26, "rinon": .32, "bazo": .32, "estomago": .34, "mucosa": .30,
       "glandula": .45, "cerebro": .42, "cerebelo": .45, "medula": .45, "ojo": .30, "diente": .40}
DETALLE = {"hueso": dict(nitidez=0.6, estrias=0.008)}
SIN_MEDIO = {"hueso"}                               # aprobado tal cual: no se le aplanan las manchas medianas


def lum(a):
    return a[..., 0] * .2126 + a[..., 1] * .7152 + a[..., 2] * .0722


def costura(a):
    """Salto en la costura del mosaico ÷ salto típico entre vecinos. ~1 = invisible."""
    L = lum(a)
    interior = (np.abs(np.diff(L, axis=1)).mean() + np.abs(np.diff(L, axis=0)).mean()) / 2
    borde = (np.abs(L[:, 0] - L[:, -1]).mean() + np.abs(L[0, :] - L[-1, :]).mean()) / 2
    return float(borde / max(interior, 1e-6))


def igualar_luz(a, medio=0.75):
    """Quita gradientes grandes (N/6) y, en parte, las manchas medianas (N/14) que delatan la repetición.
    Comprime los brillos puntuales."""
    # «reflect» y no «wrap»: la imagen cruda todavía no se repite, y en anillo el borde oscuro y el claro se
    # promedian, así que un degradado de lado a lado quedaba sin corregir en los extremos.
    L = lum(a)
    base = ndi.gaussian_filter(L, a.shape[0] / 6, mode="reflect") + 1e-4
    a = a * (L.mean() / base)[..., None]
    if medio:
        L = lum(a)
        base = ndi.gaussian_filter(L, a.shape[0] / 14, mode="reflect") + 1e-4
        a = a * ((L.mean() / base) ** medio)[..., None]
        for c in range(3):
            ch = a[..., c]; bc = ndi.gaussian_filter(ch, a.shape[0] / 14, mode="reflect")
            a[..., c] = ch - medio * (bc - ch.mean())
    L = lum(a); techo = np.percentile(L, 99.3)
    a = a - (np.clip(L - techo, 0, None) * 0.8)[..., None]
    return np.clip(a, 0, 1)


def _camino(costo, ciclico=False):
    """Corte de costo mínimo de arriba abajo (programación dinámica, pasos -1/0/+1).
    Si ciclico, el corte termina en la columna donde empieza (para no romper la otra dirección)."""
    h, w = costo.shape

    def dp(inicio=None):
        acc = np.full((h, w), np.inf); paso = np.zeros((h, w), np.int8)
        if inicio is None:
            acc[0] = costo[0]
        else:
            acc[0, inicio] = costo[0, inicio]
        for i in range(1, h):
            prev = acc[i - 1]
            opc = np.stack([np.r_[np.inf, prev[:-1]], prev, np.r_[prev[1:], np.inf]]); k = opc.argmin(0)
            acc[i] = costo[i] + opc[k, np.arange(w)]; paso[i] = k - 1
        return acc, paso

    def rastrear(paso, fin):
        c = np.empty(h, int); c[-1] = fin
        for i in range(h - 1, 0, -1):
            c[i - 1] = c[i] + paso[i, c[i]]
        return c

    if not ciclico:
        acc, paso = dp()
        return rastrear(paso, int(acc[-1].argmin()))
    mejor = None
    for s in range(4, w - 4, max(1, w // 24)):
        acc, paso = dp(s)
        if mejor is None or acc[-1, s] < mejor[0]:
            mejor = (acc[-1, s], rastrear(paso, s))
    return mejor[1]


def cerrar_horizontal(a, w, ciclico=False, suave=False):
    """Une el borde derecho con el izquierdo (image quilting) y devuelve una imagen w px más angosta que se
    repite sin costura de izquierda a derecha. `suave`: fundido largo (para fibras que cruzan la costura)."""
    W = a.shape[1]
    L = a[:, :w]; R = a[:, W - w:]
    if suave:
        t = np.linspace(0, 1, w)[None, :]
        m = np.repeat(t * t * (3 - 2 * t), a.shape[0], 0)
    else:
        err = ndi.gaussian_filter(((L - R) ** 2).sum(-1), 2)
        corte = _camino(err, ciclico)
        m = (np.arange(w)[None, :] >= corte[:, None]).astype(float)   # 0 = R, 1 = L
        m = ndi.gaussian_filter(m, (0, 3))
        m[:, 0] = 0; m[:, -1] = 1
    franja = R * (1 - m[..., None]) + L * m[..., None]
    return np.concatenate([franja, a[:, w:W - w]], axis=1)


def hacer_repetible(a, fundido_v=False):
    w = int(SOLAPE * a.shape[0] / 2048)
    a = cerrar_horizontal(a, w)                                                       # izquierda-derecha
    wv = int(384 * a.shape[0] / 2048) if fundido_v else w
    a = cerrar_horizontal(a.transpose(1, 0, 2), wv, ciclico=True, suave=fundido_v).transpose(1, 0, 2)
    return a   # algo más baja que ancha: el paso a 1024×1024 la vuelve cuadrada sin romper la repetición


def fibras_verticales(a):
    """Tensor de estructura: True si las fibras corren de arriba abajo (gradiente sobre todo horizontal)."""
    L = ndi.gaussian_filter(lum(a), 6)     # escala de la fibra/lámina, no de la rayita fina que lleva dentro
    return (ndi.sobel(L, 1) ** 2).mean() >= (ndi.sobel(L, 0) ** 2).mean()


def microdetalle(a, nitidez=0.7, estrias=0.025, semilla=7):
    """Realza poros finos (enfoque a 1 px, en modo wrap) y suma estrías longitudinales muy leves
    (ruido periódico estirado en vertical, así que no rompe la repetición)."""
    L = lum(a)
    a = a + nitidez * (L - ndi.gaussian_filter(L, 1.2, mode="wrap"))[..., None]
    h, w = L.shape
    F = np.fft.fft2(np.random.default_rng(semilla).standard_normal((h, w)))
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    filtro = np.exp(-(fy / 0.004) ** 2 - (fx / 0.08) ** 2) * (np.abs(fx) > 0.01)
    est = np.real(np.fft.ifft2(F * filtro)); est /= est.std() + 1e-9
    return np.clip(a * (1 + estrias * est)[..., None], 0, 1)


def normal_de(a, fuerza=3.0):
    """Altura = luminancia (paso alto) → Sobel. OpenGL: verde hacia arriba."""
    h = lum(a)
    h = h - ndi.gaussian_filter(h, 40, mode="wrap")
    h = ndi.gaussian_filter(h, 1.6, mode="wrap")
    h = h / (np.abs(h).std() * 4 + 1e-6)
    dx = ndi.sobel(h, 1, mode="wrap") / 8; dy = ndi.sobel(h, 0, mode="wrap") / 8
    n = np.stack([-dx * fuerza, dy * fuerza, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return (n + 1) / 2


def rugosidad_de(a, media):
    """Blanco = mate. Lo más claro del detalle (reflejo) se hace algo más brillante."""
    L = lum(a)
    det = L - ndi.gaussian_filter(L, 12, mode="wrap")
    r = media - 0.08 * det / (det.std() + 1e-6)
    return np.clip(r - r.mean() + media, 0, 1)


def a_img(x):
    return Image.fromarray((np.clip(x, 0, 1) * 255 + .5).astype(np.uint8))


def procesar(raiz: Path, tid: str, crudo: Path):
    a = np.asarray(Image.open(crudo).convert("RGB"), dtype=np.float64) / 255
    antes = costura(a)
    a = igualar_luz(a, medio=0.0 if tid in SIN_MEDIO else 0.75)
    girada = False
    if tid in FIBRAS and not fibras_verticales(a):     # se gira ANTES de cerrar: el fundido va con la fibra
        a = np.rot90(a).copy(); girada = True
    a = hacer_repetible(a, fundido_v=tid in FUNDIDO_V)
    if tid in DETALLE:
        a = microdetalle(a, **DETALLE[tid])
    alb = a_img(a).resize((N_FINAL, N_FINAL), Image.LANCZOS)
    A = np.asarray(alb, dtype=np.float64) / 255
    d = raiz / tid; d.mkdir(parents=True, exist_ok=True)
    alb.save(d / "albedo.webp", "WEBP", quality=72, method=6)
    a_img(normal_de(A)).save(d / "normal.webp", "WEBP", quality=60, method=6)
    (a_img(rugosidad_de(A, RUG[tid])).convert("L").resize((512, 512), Image.LANCZOS)
     .resize((N_FINAL, N_FINAL), Image.BICUBIC).save(d / "rugosidad.webp", "WEBP", quality=65, method=6))
    c = raiz / "_control"; c.mkdir(exist_ok=True)
    m = Image.new("RGB", (N_FINAL * 2, N_FINAL * 2))
    for x in (0, N_FINAL):
        for y in (0, N_FINAL):
            m.paste(alb, (x, y))
    m.resize((768, 768), Image.LANCZOS).save(c / f"{tid}-mosaico.jpg", quality=68)
    return {"costura_antes": round(antes, 2), "costura_despues": round(costura(A), 2),
            "girada": girada, "crudo": crudo.name}


def main():
    raiz = Path(sys.argv[1]); ids = sys.argv[2:]
    reg = json.loads((raiz / "_crudo" / "registro.json").read_text())
    mf_f = raiz / "manifest.json"
    mf = json.loads(mf_f.read_text()) if mf_f.exists() else {"version": 1, "generado": "", "tejidos": {}}
    mf["generado"] = datetime.date.today().isoformat()
    elegidos = dict(x.split("=", 1) for x in os.environ.get("ELEGIDO", "").split(",") if "=" in x)
    for tid in ids:
        filas = [r for r in reg if r["id"] == tid and r.get("archivo")]
        if not filas:
            print(tid, "sin crudo"); continue
        fila = next((r for r in filas if Path(r["archivo"]).name == elegidos.get(tid)), filas[-1])
        print(tid, procesar(raiz, tid, Path(fila["archivo"])), flush=True)
        mf["tejidos"][tid] = {"modelo": fila["modelo"], "prompt": fila["prompt"],
                              "fibras": "vertical" if tid in FIBRAS else None, "px": N_FINAL}
    orden = list(dict.fromkeys(r["id"] for r in reg))
    mf["tejidos"] = dict(sorted(mf["tejidos"].items(), key=lambda kv: orden.index(kv[0])))
    mf_f.write_text(json.dumps(mf, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
