#!/usr/bin/env python3
"""Servidor local de la app de anatomía.

Igual que `python3 -m http.server`, pero pide al navegador que revalide cada
archivo (Cache-Control: no-cache). Sin esto, tras actualizar la app el navegador
puede seguir usando la versión anterior de los módulos.

Uso: python3 servidor.py [puerto] [--directory app]
"""
import argparse
import functools
import http.server


class Manejador(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("puerto", nargs="?", type=int, default=8765)
    p.add_argument("--directory", default="app")
    a = p.parse_args()
    manejador = functools.partial(Manejador, directory=a.directory)
    with http.server.ThreadingHTTPServer(("127.0.0.1", a.puerto), manejador) as s:
        print(f"Anatomía en http://localhost:{a.puerto}/ (carpeta: {a.directory})")
        s.serve_forever()
