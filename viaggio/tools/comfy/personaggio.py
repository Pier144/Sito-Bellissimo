"""Generazione del personaggio (lei) con Qwen Edit e Wan 2.2.

  python personaggio.py sheet --seed 1 --quanti 4
  python personaggio.py posa --base FILE --nome salto_1 --seed 1 --prompt "..."
  python personaggio.py cammina --base FILE --seed 1
  python personaggio.py pulisci --cartella DIR

Le foto originali stanno solo in ComfyUI input/viaggio/ (mai nel repo).
"""
import argparse
from pathlib import Path

import comfy
import grafi

RAW = Path(__file__).resolve().parent.parent / "_raw"
FOTO_DIR = Path("C:/Users/piera/Documents/ComfyUI/input/viaggio")   # fuori dal repo
FOTO = ["lei4.jpg", "lei3.jpg", "lei2.jpg"]

SHEET = ("Turn the woman from the reference photos into a cute anime-style video game character, full body, "
         "side view facing right, walking pose, plain white background. Keep her face recognizable: long "
         "dark-brown curly hair pulled back into a curly ponytail, brown eyes, small nose stud piercing, small "
         "hoop earrings. Outfit: black and white horizontally striped cropped sweater, light blue jeans, white "
         "sneakers. Dark red nail polish. Chibi proportions, 3 heads tall.")

CAMMINA = ("the girl walks in place to the right, side view, steady camera, plain white background, "
           "looping walk cycle")


def _genera(grafo, cartella):
    imgs = comfy.esegui(grafo)
    file = [comfy.scarica(i, cartella) for i in imgs]
    comfy.libera()
    return file


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("modo", choices=["sheet", "posa", "cammina", "pulisci"])
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--quanti", type=int, default=4)
    ap.add_argument("--base")
    ap.add_argument("--nome")
    ap.add_argument("--prompt")
    ap.add_argument("--cartella")
    a = ap.parse_args()

    if a.modo == "sheet":
        for s in range(a.seed, a.seed + a.quanti):
            foto = [comfy.carica(FOTO_DIR / f) for f in FOTO]
            print(_genera(grafi.qwen_edit(f"sheet_s{s}", foto, SHEET, s), RAW / "sheet"))
    elif a.modo == "posa":
        base = comfy.carica(a.base)
        print(_genera(grafi.qwen_edit(a.nome, [base], a.prompt, a.seed), RAW / "pose"))
    elif a.modo == "cammina":
        base = comfy.carica(a.base)
        print(_genera(grafi.wan_cammina("lei", base, CAMMINA, a.seed), RAW / "cammina"))
    else:
        for f in sorted(Path(a.cartella).glob("*.png")):
            nome = comfy.carica(f)
            print(_genera(grafi.rimuovi_sfondo(f.stem, nome), RAW / "pulite" / f.parent.name))


if __name__ == "__main__":
    main()
