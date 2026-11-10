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


def genera_sfondo(bioma, strati, conf, seed):
    larg, alt, colori = conf["larghezza_sfondo_px"], conf["altezza_sfondo_px"], conf["colori_sfondo"]
    file = {}
    for strato in ("lontano", "medio", "vicino"):
        trasparente = strato != "lontano"
        prompt = strati[strato] + (", " + conf["strato_trasparente"] if trasparente else "")
        nome = f"{bioma}_{strato}"
        hd = _hd(grafi.sfondo(nome, prompt, seed, out=(larg, alt), colori=colori, rimuovi_sfondo=trasparente,
                              hd_trasparente=trasparente),
                 RAW / "sfondi" / nome)
        out = ASSETS / "bg" / f"{nome}.png"
        args = ["sfondo", "--in", hd, "--out", out, "--larghezza", larg, "--altezza", alt, "--colori", colori,
                "--banda", conf["banda_sfondo_px"]]
        if trasparente:
            args += ["--palette-da", ASSETS / "bg" / f"{bioma}_lontano.png"]
        pixelize(*args)
        file[strato] = f"bg/{nome}.png"
        print(nome)
    aggiorna_manifest("sfondi", bioma, file)


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
    ap.add_argument("--tipo", choices=["sprite", "sfondi", "contact"], required=True)
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
        for bioma, strati in conf["sfondi"].items():
            if not solo or bioma in solo:
                genera_sfondo(bioma, strati, conf, a.seed)
    else:
        contact()


if __name__ == "__main__":
    main()
