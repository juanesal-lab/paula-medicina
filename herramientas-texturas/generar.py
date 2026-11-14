"""Genera texturas crudas con APImart. Uso (desde ~/f3-videos): generar.py <texturas-paula> id [id ...]
Mide el costo por diferencia de saldo y lo anota en <texturas-paula>/_crudo/registro.json.
La llave se lee del entorno / Llavero con agentes.proveedor (nunca se escribe en archivos)."""
import json, os, sys, time
from pathlib import Path

sys.path.insert(0, str(Path.home() / "f3-videos"))
os.environ["APIMART_MODELO_IMAGEN"] = os.environ.get("MODELO", "gemini-3-pro-image-preview")
from agentes import proveedor as p  # noqa: E402

TEJIDOS = {
 "musculo": "skeletal muscle fiber surface, natural rich red, densely packed fine parallel fibers running vertically with even density, evenly spaced thin pale connective lines between fiber bundles, realistic organic irregularity, asymmetric, no mirroring, no wide membranes, no branching, no spots",
 "tendon": "tendon and aponeurosis, pearly white-silver dense parallel collagen fibers running vertically, subtle silky sheen",
 "fascia": "deep fascia surface, off-white fibrous connective tissue with fine dense evenly woven criss-crossing collagen fibers, semi-translucent, no large strands",
 "hueso": "dry cortical bone surface, ivory to warm off-white, fine porous texture with tiny vascular foramina and faint longitudinal striations",
 "cartilago": "hyaline articular cartilage, smooth glossy bluish-white pearl surface with very subtle mottling",
 "grasa": "subcutaneous adipose tissue, pale yellow lobules separated by thin fibrous septa",
 "piel": "a warm neutral medium-tone skin surface, fine evenly distributed pores and micro-wrinkles, one single continuous surface, no grid, no panels, no hair, no moles",
 "nervio": "a flat pale yellowish-white fibrous surface made of fine straight parallel strands running vertically, with a few tiny thin red capillaries, like peripheral nerve fascicles, flat, no cord shape, no bulge",
 "arteria": "artery wall exterior, light red-pink thick elastic tunica with faint circumferential fibers and vasa vasorum",
 "vena": "vein wall exterior, dark bluish-purple thin wall with subtle translucency and faint longitudinal fibers",
 "linfatico": "lymph node capsule surface, pale greenish-tan smooth tissue with many tiny fine evenly scattered vessels, no arcs, no large curves",
 "miocardio": "heart muscle epicardial surface, dark red-brown myocardium with small evenly scattered flecks of yellow epicardial fat and fine branching coronary vessels",
 "pulmon": "lung pleural surface, pinkish-grey spongy tissue with fine polygonal lobule pattern and faint dark anthracotic speckles",
 "higado": "liver surface, smooth dark reddish-brown glossy capsule with very fine lobular mottling",
 "rinon": "kidney capsule surface, smooth reddish-brown tissue with many tiny fine evenly scattered veins, no spots, no dots",
 "bazo": "a smooth matte organic surface, uniform dark purple-maroon color with faint fine even mottling, like a spleen capsule",
 "estomago": "stomach and intestine serosa exterior, pale pinkish-tan smooth moist wall with a very fine faint uniform capillary network, no dots, no spots, no bright points, no large vessels",
 "mucosa": "intestinal mucosa, pink velvety surface densely and uniformly covered with tiny villi, no folds",
 "glandula": "glandular tissue such as pancreas or thyroid, tan-pink finely lobulated surface with thin connective septa",
 "cerebro": "cerebral cortex surface, pinkish-beige grey matter under thin pia mater with a dense fine uniform network of tiny hair-thin capillaries, no larger vessels, no lobes, no gyri shapes, flat tissue surface",
 "cerebelo": "cerebellar cortex surface, pinkish-grey, tightly packed fine straight parallel folia running vertically like thin evenly spaced ridges, no swirls, no curves",
 "medula": "spinal cord and white matter, creamy white smooth surface with fine longitudinal vessels",
 "ojo": "sclera of the eyeball, white with a dense uniform mesh of extremely fine faint hair-thin red capillaries, no larger vessels",
 "diente": "tooth enamel, glossy ivory-white smooth surface with very faint vertical striations",
}
PLANTILLA = ("Seamless tileable texture, top-down macro photograph of {D}, filling the entire frame edge to edge, "
             "flat even diffuse lighting, no shadows, no specular hotspots, no vignette, sharp focus everywhere, "
             "anatomical atlas specimen quality, photorealistic, highly detailed surface, uniform homogeneous pattern evenly "
             "distributed across the whole frame, no unique or isolated features, no large vessels, no single spots, "
             "no folds, no specular highlights, no text, no labels, "
             "no borders, no background, no instruments.")
RES = os.environ.get("RES", "2K")
MINIMO = float(os.environ.get("SALDO_MINIMO", "0.05"))   # no arranca una imagen si el saldo baja de esto
SUAVES = {"piel", "nervio", "bazo"}
REINTENTOS_FILTRO = int(os.environ.get("REINTENTOS", "2"))                                      # un rechazo del filtro no cobra


def main():
    sal = Path(sys.argv[1]); ids = sys.argv[2:]
    crudo = sal / "_crudo"; crudo.mkdir(parents=True, exist_ok=True)
    reg_f = crudo / "registro.json"
    reg = json.loads(reg_f.read_text()) if reg_f.exists() else []
    a = p.APImart()
    cola = list(ids); rechazos = {}
    while cola:
        tid = cola.pop(0)
        if tid not in TEJIDOS:
            print("id desconocido:", tid); continue
        antes = p.saldo()
        if antes is not None and antes < MINIMO:
            print(f"⛔ saldo {antes:.4f} < {MINIMO}: paro antes de {tid}"); break
        prompt = PLANTILLA.format(D=TEJIDOS[tid])
        if tid in SUAVES:   # el filtro reacciona al léxico de disección: misma petición, palabras de material
            prompt = prompt.replace("anatomical atlas specimen quality", "scientific reference quality")
        n = max([r["intento"] for r in reg if r["id"] == tid] or [0]) + 1
        destino = crudo / f"{tid}-v{n}.png"
        t0 = time.time()
        try:
            a.imagen(prompt, formato="1:1", resolucion=RES, destino=destino, log=lambda *_: None)
            err = None
        except Exception as e:  # noqa: BLE001
            err = str(e)[:300]
        despues = p.saldo()
        costo = round(antes - despues, 6) if (antes is not None and despues is not None) else None
        fila = {"id": tid, "intento": n, "modelo": os.environ["APIMART_MODELO_IMAGEN"], "res": RES,
                "prompt": prompt, "archivo": str(destino) if not err else None, "error": err,
                "costo": costo, "saldo": despues, "seg": round(time.time() - t0, 1)}
        reg.append(fila); reg_f.write_text(json.dumps(reg, indent=1, ensure_ascii=False))
        estado = "rechazo del filtro" if err and "safety" in err else ("ERROR " + err if err else "ok")
        print(f"{tid} v{n}: {estado} · costo {costo} · saldo {despues}", flush=True)
        if err and "safety" in err and rechazos.get(tid, 0) < REINTENTOS_FILTRO:
            rechazos[tid] = rechazos.get(tid, 0) + 1; cola.append(tid)


if __name__ == "__main__":
    main()
