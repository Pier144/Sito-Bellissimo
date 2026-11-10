"""Post-produzione pixel art per "Un viaggio inaspettato".

Rifà in modo deterministico il passaggio a pixel delle immagini generate con
ComfyUI: alpha netta, ridimensionamento nearest, palette comune, contorno,
sfondi ripetibili e sprite sheet.

Uso:
  python -I pixelize.py sprite --in DIR_O_FILE --out FILE --altezza 48 --colori 24 [--contorno]
  python -I pixelize.py sheet  --in DIR --out FILE --altezza 48 --colori 24 [--contorno]
  python -I pixelize.py sfondo --in FILE --out FILE --larghezza 768 --altezza 216 --colori 32 [--banda 48] [--palette-da FILE]
"""
import argparse
import json
from pathlib import Path

from PIL import Image

CONTORNO = (24, 16, 24)


def _dati(img):
    """Pixel in lista piatta (getdata è deprecato da Pillow 12)."""
    return img.get_flattened_data() if hasattr(img, "get_flattened_data") else img.getdata()


def soglia_alpha(img, soglia=128):
    """Alpha a 0 o 255: niente semitrasparenze."""
    img = img.convert("RGBA")
    a = img.getchannel("A").point(lambda v: 255 if v >= soglia else 0)
    img.putalpha(a)
    return img


def pixellizza(img, altezza=None, dimensioni=None, scala=None):
    """Ritaglia al contenuto opaco e riduce con BOX (media di ogni blocco), poi alpha netta.

    BOX invece di NEAREST: con riduzioni forti (~13-25x) NEAREST prende un pixel a caso per blocco e
    il viso si riempie di rumore; la media tiene occhi e righe leggibili (provato il 2026-11-10).
    Con `altezza` mantiene le proporzioni; con `dimensioni=(w, h)` forza la misura (sfondi);
    con `scala` usa un fattore fisso (fotogrammi di un'animazione: tutti alla stessa scala).
    """
    img = img.convert("RGBA")
    if dimensioni:
        return soglia_alpha(img.resize(dimensioni, Image.BOX), 110)
    box = soglia_alpha(img).getchannel("A").getbbox()
    if box:
        img = img.crop(box)
    f = scala if scala else altezza / img.height
    misura = (max(1, round(img.width * f)), max(1, round(img.height * f)))
    return soglia_alpha(img.resize(misura, Image.BOX), 110)


def scala_comune(immagini, altezza):
    """Fattore unico: il fotogramma più alto (contenuto opaco) diventa alto `altezza`."""
    alte = [soglia_alpha(i.convert("RGBA")).getchannel("A").getbbox() for i in immagini]
    return altezza / max(b[3] - b[1] for b in alte if b)


def _pixel_opachi(immagini):
    px = []
    for im in immagini:
        im = im.convert("RGBA")
        px.extend(p[:3] for p in _dati(im) if p[3] > 0)
    return px


def estrai_palette(immagini, n):
    """Palette comune (lista di tuple (r, g, b), lunghezza <= n) dai pixel opachi."""
    px = _pixel_opachi(immagini)
    if not px:
        return []
    tela = Image.new("RGB", (len(px), 1))
    tela.putdata(px)
    q = tela.quantize(colors=n, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    return [c for _, c in q.getcolors(maxcolors=len(px))]


def _vicino(c, palette, cache):
    if c not in cache:
        cache[c] = min(palette, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
    return cache[c]


def applica_palette(img, palette):
    """Ogni pixel opaco al colore più vicino della palette; i trasparenti restano tali."""
    img = img.convert("RGBA")
    cache = {}
    dati = [(*_vicino(p[:3], palette, cache), 255) if p[3] > 0 else (0, 0, 0, 0) for p in _dati(img)]
    out = Image.new("RGBA", img.size)
    out.putdata(dati)
    return out


def contorno(img, colore=CONTORNO):
    """I pixel trasparenti confinanti (4-vicini) con un pixel opaco diventano `colore`."""
    img = img.convert("RGBA")
    w, h = img.size
    src = img.load()
    out = img.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3]:
                    dst[x, y] = (*colore, 255)
                    break
    return out


def ripetibile(img, banda=48):
    """Immagine larga W - banda, ripetibile in orizzontale.

    out[i] = img[W-banda+i] * (1 - i/banda) + img[i] * (i/banda) per i < banda,
    out[i] = img[i] altrimenti: out[0] riparte da dove finirebbe out[W-banda-1].
    """
    w, h = img.size
    out = img.crop((0, 0, w - banda, h))
    src = img.load()
    dst = out.load()
    for i in range(banda):
        t = i / banda
        for y in range(h):
            a, b = src[w - banda + i, y], src[i, y]
            if isinstance(a, int):
                dst[i, y] = round(a * (1 - t) + b * t)
            else:
                dst[i, y] = tuple(round(ca * (1 - t) + cb * t) for ca, cb in zip(a, b))
    return out


def monta_sheet(righe):
    """Una riga per animazione, celle uguali (max w, max h), figura allineata in basso al centro."""
    frames = [f for lista in righe.values() for f in lista]
    fw = max(f.width for f in frames)
    fh = max(f.height for f in frames)
    sheet = Image.new("RGBA", (fw * max(len(l) for l in righe.values()), fh * len(righe)), (0, 0, 0, 0))
    meta = {"fw": fw, "fh": fh, "righe": {}}
    for r, (nome, lista) in enumerate(righe.items()):
        meta["righe"][nome] = [r, len(lista)]
        for c, f in enumerate(lista):
            f = f.convert("RGBA")
            sheet.alpha_composite(f, (c * fw + (fw - f.width) // 2, r * fh + fh - f.height))
    return sheet, meta


def _immagini(percorso):
    p = Path(percorso)
    file = sorted(x for x in p.iterdir() if x.suffix.lower() in (".png", ".webp", ".jpg")) if p.is_dir() else [p]
    return [Image.open(f) for f in file]


def _finisci(img, palette, con_contorno):
    img = applica_palette(img, palette)
    if not con_contorno:
        return img
    largo = Image.new("RGBA", (img.width + 2, img.height + 2), (0, 0, 0, 0))
    largo.alpha_composite(img, (1, 1))       # 1 px di margine, se no il contorno sui bordi sparisce
    return contorno(largo)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("modo", choices=["sprite", "sheet", "sfondo"])
    ap.add_argument("--in", dest="ingresso", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--altezza", type=int, required=True)
    ap.add_argument("--larghezza", type=int)
    ap.add_argument("--colori", type=int, default=24)
    ap.add_argument("--banda", type=int, default=48)
    ap.add_argument("--contorno", action="store_true")
    ap.add_argument("--palette-da", help="riusa la palette di questa immagine (sfondi dello stesso bioma)")
    ap.add_argument("--riferimento", help="sheet: la scala comune si calcola solo su questa animazione (es. cammina)")
    ap.add_argument("--altezze", default="", help="sheet: altezza del fotogramma più alto per animazione, "
                    "es. 'stanca=62,pisolino=24' (pose generate con inquadrature diverse)")
    a = ap.parse_args(argv)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    if a.modo == "sprite":
        imgs = [pixellizza(i, a.altezza) for i in _immagini(a.ingresso)]
        pal = estrai_palette(imgs, a.colori)
        _finisci(imgs[0], pal, a.contorno).save(out)
        print(json.dumps({"file": out.name, "w": imgs[0].width + 2 * a.contorno, "h": imgs[0].height + 2 * a.contorno}))
    elif a.modo == "sheet":
        cartelle = sorted(d for d in Path(a.ingresso).iterdir() if d.is_dir())
        sorgenti = {d.name: _immagini(d) for d in cartelle}
        base = sorgenti[a.riferimento] if a.riferimento else [i for l in sorgenti.values() for i in l]
        f = scala_comune(base, a.altezza)   # una scala per tutti: niente "pulsazioni" tra i fotogrammi
        alt = dict((k, int(v)) for k, v in (x.split("=") for x in a.altezze.split(",") if x))
        righe = {k: [pixellizza(i, scala=scala_comune(l, alt[k]) if k in alt else f) for i in l]
                 for k, l in sorgenti.items()}
        pal = estrai_palette([f for l in righe.values() for f in l], a.colori)
        righe = {k: [_finisci(f, pal, a.contorno) for f in l] for k, l in righe.items()}
        sheet, meta = monta_sheet(righe)
        sheet.save(out)
        meta["file"] = out.name
        print(json.dumps(meta))
    else:
        img = _immagini(a.ingresso)[0].convert("RGBA")
        img = img.resize((a.larghezza + a.banda, a.altezza), Image.BOX)
        img = ripetibile(img, a.banda)
        img = soglia_alpha(img)
        pal = estrai_palette([Image.open(a.palette_da)] if a.palette_da else [img], a.colori)
        applica_palette(img, pal).save(out)
        print(json.dumps({"file": out.name, "w": a.larghezza, "h": a.altezza}))


if __name__ == "__main__":
    main()
