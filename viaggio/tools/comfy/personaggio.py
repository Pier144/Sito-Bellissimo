"""Generazione del personaggio (lei) con Qwen Edit e Wan 2.2.

  python personaggio.py sheet --seed 1 --quanti 4
  python personaggio.py posa --base FILE --nome salto_1 --seed 1 --prompt "..."
  python personaggio.py pose --base FILE --seed 1 [--nome salto,bacino]
  python personaggio.py cammina --base FILE --seed 1
  python personaggio.py pulisci --cartella DIR
  python personaggio.py ripassa --cartella DIR --nome cammina [--prompt "walking pose"]

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

# Ripasso pixel scelto dall'utente: d25 sulla variante 1 (vedi spec, "Decisioni successive")
RIPASSO = ("girl with long very dark brown curly hair in a ponytail, small hoop earrings, black and white striped "
           "cropped sweater, light blue jeans, white sneakers")
RIPASSO_DENOISE = 0.25
RIPASSO_SEED = 7

POSA_BASE = ("Same girl, same face, same hairstyle, same outfit and same art style as the reference image, "
             "full body, plain white background. ")
POSE = {
    "salto": ["Side view facing right. She is jumping up in mid-air: knees bent and tucked, arms raised up, happy.",
              "Side view facing right. She is coming down from a jump in mid-air: legs stretched down, arms up."],
    "colpita": ["Side view facing right, nothing else in the image. She stumbles backwards after tripping: body "
                "leaning back, both arms thrown up and back for balance, one foot lifted, eyes squeezed shut, "
                "comic 'ouch' face."],
    "stanca": ["Side view facing right. She sits on the ground exhausted, legs stretched forward, leaning back on "
               "her hands, puffing her cheeks, tired face.",
               "Side view facing right. She sits on the ground exhausted, legs stretched forward, leaning back on "
               "her hands, blowing out air with a sigh, eyes half closed."],
    "pisolino": ["She is lying on her side on the ground taking a nap, eyes closed, peaceful smile, seen from the side.",
                 "She is lying on her side on the ground sleeping deeply, eyes closed, mouth slightly open, "
                 "seen from the side."],
    "bacino": ["She faces the viewer, making a duck-face kiss with pursed lips, one hand on her hip.",
               "She faces the viewer, making a duck-face kiss with pursed lips and winking one eye, one hand on her hip."],
}

CAMMINA = ("the girl walks in place to the right, side view, steady camera, plain white background, "
           "looping walk cycle")


def _genera(grafo, cartella):
    imgs = comfy.esegui(grafo)
    file = [comfy.scarica(i, cartella) for i in imgs]
    comfy.libera()
    return file


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("modo", choices=["sheet", "posa", "pose", "cammina", "pulisci", "ripassa"])
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
    elif a.modo == "pose":
        # tutte le pose di POSE dalla base -> _raw/pose/<anim>/<n>.png (--solo per rifarne alcune)
        base = comfy.carica(a.base)
        for anim, testi in POSE.items():
            if a.nome and anim not in a.nome.split(","):
                continue
            for n, testo in enumerate(testi, 1):
                f = _genera(grafi.qwen_edit(f"posa_{anim}_{n}", [base], POSA_BASE + testo, a.seed), RAW / "pose" / anim)[0]
                f.replace(f.with_name(f"{n}.png"))
                print(anim, n)
    elif a.modo == "cammina":
        base = comfy.carica(a.base)
        print(_genera(grafi.wan_cammina("lei", base, CAMMINA, a.seed, larghezza=480, altezza=720), RAW / "cammina"))
    elif a.modo == "ripassa":
        # ogni fotogramma di --cartella -> ripasso d25 + scontorno -> _raw/ripassati/<--nome>/
        for f in sorted(Path(a.cartella).glob("*.png")):
            img = comfy.carica(f, "viaggio_frame")
            grafo = grafi.img2img(f"ripasso_{a.nome}_{f.stem}", img, RIPASSO + (", " + a.prompt if a.prompt else ""),
                                  RIPASSO_SEED, denoise=RIPASSO_DENOISE, lato_px=96, colori=32, hd_trasparente=True)
            imgs = comfy.esegui(grafo)
            hd = [i for i in imgs if "_hd_" in i["filename"]][0]
            dest = comfy.scarica(hd, RAW / "ripassati" / a.nome)
            dest.replace(dest.with_name(f.stem + ".png"))   # replace: su Windows rename fallisce se esiste
            comfy.libera()
            print(f.name)
    else:
        for f in sorted(Path(a.cartella).glob("*.png")):
            nome = comfy.carica(f)
            print(_genera(grafi.rimuovi_sfondo(f.stem, nome), RAW / "pulite" / f.parent.name))


if __name__ == "__main__":
    main()
