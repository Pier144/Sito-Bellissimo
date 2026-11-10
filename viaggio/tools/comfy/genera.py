"""Genera in batch gli asset del gioco con ComfyUI (server di test 8189) e li ripulisce con pixelize.py.

  python genera.py --tipo sprite [--solo gallina,mucca] [--seed 1]
  python genera.py --tipo sfondi [--solo campi] [--seed 1]
  python genera.py --tipo contact      # foglio di controllo di tutti gli sprite e sfondi in _raw/

Rigenerare un asset non tocca gli altri; manifest.json viene aggiornato voce per voce.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

import comfy
import grafi

QUI = Path(__file__).resolve().parent
RAW = QUI.parent / "_raw"
ASSETS = QUI.parents[1] / "assets"
PIXELIZE = QUI.parent / "pixelize.py"
MANIFEST = ASSETS / "manifest.json"


def pixelize(*args):
    out = subprocess.run([sys.executable, "-I", str(PIXELIZE), *map(str, args)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out.strip().splitlines()[-1])


def aggiorna_manifest(sezione, chiave, valore):
    m = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    m.setdefault("sprites", {}); m.setdefault("sfondi", {}); m.setdefault("illustrazioni", {})
    m[sezione][chiave] = valore
    MANIFEST.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _hd(grafo, cartella):
    imgs = comfy.esegui(grafo)
    file = comfy.scarica([i for i in imgs if "_hd_" in i["filename"]][0], cartella)
    comfy.libera()
    return file


def genera_sprite(voce, seed, prefisso=grafi.POS_SPRITE):
    nome = voce["nome"]
    hd = _hd(grafi.sprite(nome, voce["prompt"], seed, lato_px=voce["altezza"] * 4, colori=voce["colori"],
                          hd_trasparente=True, prefisso=prefisso), RAW / "sprite" / nome)
    out = ASSETS / "sprites" / f"{nome}.png"
    meta = pixelize("sprite", "--in", hd, "--out", out, "--altezza", voce["altezza"],
                    "--colori", voce["colori"], "--contorno")
    aggiorna_manifest("sprites", nome, {"file": f"sprites/{nome}.png", "w": meta["w"], "h": meta["h"]})
    print(nome, meta)


def genera_sfondo(bioma, voce, conf, seed=None):
    """Uno strato per bioma: scena intera, mezza risoluzione, foschia (terreno e primo piano li disegna il gioco)."""
    nome = f"{bioma}_lontano"
    hd = _hd(grafi.sfondo(nome, voce["prompt"], seed or voce.get("seed", 1)), RAW / "sfondi" / nome)
    out = ASSETS / "bg" / f"{nome}.png"
    pixelize("sfondo", "--in", hd, "--out", out, "--larghezza", conf["larghezza_sfondo_px"],
             "--altezza", conf["altezza_sfondo_px"], "--colori", conf["colori_sfondo"],
             "--banda", conf["banda_sfondo_px"], "--pixel", conf["pixel_sfondo"], "--foschia", conf["foschia_sfondo"])
    aggiorna_manifest("sfondi", bioma, {"lontano": f"bg/{nome}.png"})
    print(nome)


def genera_illustrazione(nome, voce, seed=None):
    """Qwen Edit dalla base di lei -> ripasso pixel d25 -> 640x360, 32 colori."""
    seed = seed or voce.get("seed", 1)
    base = comfy.carica(RAW / "base_lei.png")
    scena = _qwen(grafi.qwen_edit(f"illustrazione_{nome}", [base], voce["prompt"], seed, larghezza=1280, altezza=720),
                  RAW / "illustrazioni" / nome)
    img = comfy.carica(scena, "viaggio_illus")
    hd = _hd(grafi.img2img(f"illustrazione_{nome}_pixel", img, "scenery, cozy, " + voce["prompt"][:300], seed,
                           denoise=0.25, rimuovi_sfondo=False, lato_px=360, colori=32), RAW / "illustrazioni" / nome)
    out = ASSETS / "illustrazioni" / f"{nome}.png"
    pixelize("sfondo", "--in", hd, "--out", out, "--larghezza", 640, "--altezza", 360, "--colori", 32, "--banda", 0)
    aggiorna_manifest("illustrazioni", nome, f"illustrazioni/{nome}.png")
    print(nome)


def _qwen(grafo, cartella):
    imgs = comfy.esegui(grafo)
    f = comfy.scarica(imgs[0], cartella)
    comfy.libera()
    return f


def contact():
    """Un PNG per tipo con tutti gli asset affiancati e ingranditi, per la revisione."""
    for tipo, cartella, scala in (("sprite", ASSETS / "sprites", 4), ("sfondi", ASSETS / "bg", 1)):
        imgs = [(f.stem, Image.open(f).convert("RGBA")) for f in sorted(cartella.glob("*.png")) if f.stem != "lei"]
        if not imgs:
            continue
        colonne = 6 if tipo == "sprite" else 1
        cw = max(i.width for _, i in imgs) * scala + 8
        ch = max(i.height for _, i in imgs) * scala + 8
        righe = (len(imgs) + colonne - 1) // colonne
        foglio = Image.new("RGBA", (cw * colonne, ch * righe), (200, 220, 200, 255))
        for k, (_, im) in enumerate(imgs):
            im = im.resize((im.width * scala, im.height * scala), Image.NEAREST)
            foglio.alpha_composite(im, ((k % colonne) * cw + 4, (k // colonne) * ch + 4))
        dest = RAW / f"contact_{tipo}.png"
        foglio.save(dest)
        print(dest)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--tipo", choices=["sprite", "sfondi", "illustrazioni", "contact"], required=True)
    ap.add_argument("--solo", default="")
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    conf = json.loads((QUI / "assets.json").read_text(encoding="utf-8"))
    solo = {s for s in a.solo.split(",") if s}
    if a.tipo == "sprite":
        for voce in conf["sprite"]:
            if not solo or voce["nome"] in solo:
                genera_sprite(voce, a.seed, conf.get("prefisso_sprite", grafi.POS_SPRITE))
    elif a.tipo == "sfondi":
        for bioma, voce in conf["sfondi"].items():
            if not solo or bioma in solo:
                genera_sfondo(bioma, dict(voce, prompt=conf["prefisso_sfondo"] + voce["prompt"]), conf,
                              a.seed if a.seed != 1 else None)
    elif a.tipo == "illustrazioni":
        for nome, voce in conf["illustrazioni"].items():
            if not solo or nome in solo:
                genera_illustrazione(nome, voce, a.seed if a.seed != 1 else None)
    else:
        contact()


if __name__ == "__main__":
    main()
