#!/usr/bin/env python3
"""
Comprueba que cada URL citada en `evidence` dentro de src/data/additives.json
responde de verdad. No valida contenido: sólo que la fuente existe y no da
error, para que "cité un enlace" no se convierta en "cité un enlace muerto".

Uso:  python3 scripts/verificar-fuentes.py
"""

import json
import pathlib
import sys
import urllib.error
import urllib.request

RUTA = pathlib.Path(__file__).resolve().parent.parent / "src/data/additives.json"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def comprobar(url: str, timeout: float = 20.0) -> tuple[bool, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            codigo = resp.status
            return (200 <= codigo < 300, f"HTTP {codigo}")
    except urllib.error.HTTPError as e:
        return (False, f"HTTP {e.code}")
    except urllib.error.URLError as e:
        return (False, f"error de red: {e.reason}")
    except TimeoutError:
        return (False, "timeout")


def main() -> int:
    db = json.loads(RUTA.read_text(encoding="utf-8"))
    aditivos = db["additives"]

    # Dedupe: la misma URL se repite en varias entradas (dictámenes de grupo).
    urls_por_codigo: dict[str, list[str]] = {}
    for codigo, entrada in aditivos.items():
        for e in entrada.get("evidence", []):
            urls_por_codigo.setdefault(e["url"], []).append(codigo)

    if not urls_por_codigo:
        print("No hay ninguna URL de evidencia que comprobar.")
        return 0

    print(f"Comprobando {len(urls_por_codigo)} URL únicas de evidencia...\n")

    fallos = []
    for i, (url, codigos) in enumerate(sorted(urls_por_codigo.items()), start=1):
        ok, detalle = comprobar(url)
        marca = "OK   " if ok else "FALLA"
        print(f"[{i}/{len(urls_por_codigo)}] {marca} {detalle:20s} {url}")
        print(f"          usada en: {', '.join(codigos)}")
        if not ok:
            fallos.append((url, codigos, detalle))

    print()
    if fallos:
        print(f"FALLARON {len(fallos)} de {len(urls_por_codigo)} URLs:\n")
        for url, codigos, detalle in fallos:
            print(f"  - {url}  ({detalle})")
            print(f"    usada en: {', '.join(codigos)}")
        return 1

    print(f"Todas las {len(urls_por_codigo)} URLs de evidencia responden correctamente.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
