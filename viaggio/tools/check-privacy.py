"""Controlla che in viaggio/ (pubblicato su GitHub Pages) non finisca nessuna foto originale.

Errore se trova: file .jpg/.jpeg/.heic, immagini più grandi di 300 KB, immagini con dati EXIF.
Esclude viaggio/tools/_raw (ignorata da git).

  python -I viaggio/tools/check-privacy.py
"""
import sys
from pathlib import Path

from PIL import Image

RADICE = Path(__file__).resolve().parents[1]
RAW = RADICE / "tools" / "_raw"
IMMAGINI = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".bmp"}
LIMITE = 300 * 1024


def problemi():
    for f in sorted(RADICE.rglob("*")):
        if not f.is_file() or RAW in f.parents or f.suffix.lower() not in IMMAGINI:
            continue
        nome = f.relative_to(RADICE)
        if f.suffix.lower() in (".jpg", ".jpeg", ".heic"):
            yield f"{nome}: formato da foto ({f.suffix})"
        if f.stat().st_size > LIMITE:
            yield f"{nome}: {f.stat().st_size // 1024} KB (> 300 KB)"
        try:
            with Image.open(f) as im:
                if im.getexif():
                    yield f"{nome}: contiene dati EXIF"
        except Exception as e:  # file illeggibile: meglio segnalarlo
            yield f"{nome}: non leggibile ({e})"


if __name__ == "__main__":
    trovati = list(problemi())
    for p in trovati:
        print("ERRORE", p)
    print("ok" if not trovati else f"{len(trovati)} problemi")
    sys.exit(1 if trovati else 0)
