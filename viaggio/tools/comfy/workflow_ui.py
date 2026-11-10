"""Prepara il workflow "Pixel Retro" per l'interfaccia di ComfyUI.

Unisce i grafi sprite / immagine->pixel / sfondo di grafi.py in un solo grafo API con
checkpoint, LoRA e negativo condivisi, e pubblica API + layout in user/default/pixelretro_tmp/.
Poi si esegue api_to_ui.js nel frontend (porta 8189) per ottenere "Pixel Retro.json".

  python workflow_ui.py
"""
import json
import urllib.request
from pathlib import Path

import comfy
import grafi

ESEMPIO = Path(__file__).resolve().parent.parent / "_raw" / "prova" / "prova_paperella_hd_00001_.png"


def costruisci(immagine_esempio):
    g = grafi.Grafo()
    gruppi = {"Modelli": [], "1 · Testo → Sprite": [], "2 · Immagine → Pixel": [], "3 · Sfondo panoramico": []}

    def traccia(nome_gruppo, fn):
        prima = set(g.nodi)
        out = fn()
        gruppi[nome_gruppo] += [k for k in g.nodi if k not in prima]
        return out

    ckpt, lora, clip = traccia("Modelli", lambda: grafi._base_sdxl(g))
    neg = traccia("Modelli", lambda: g.add("CLIPTextEncode", "Negativo (qualità)", text=grafi.NEG, clip=clip))

    def ramo(prefisso, prompt, latente, denoise, nome, alt, larg, colori, anteprima, via_sfondo):
        pos = g.add("CLIPTextEncode", "Prompt", text=prefisso + prompt, clip=clip)
        lat = latente()
        ks = g.add("KSampler", model=lora, seed=1, steps=28, cfg=6.0, sampler_name="euler_ancestral",
                   scheduler="normal", positive=pos, negative=neg, latent_image=lat, denoise=denoise)
        dec = g.add("VAEDecode", samples=ks, vae=ckpt.out(2))
        g.add("SaveImage", "Salva HD", images=dec, filename_prefix=f"Pixel Retro/{nome}_hd")
        grafi._pixel(g, nome, dec, alt, larg, colori, anteprima, via_sfondo)

    traccia("1 · Testo → Sprite", lambda: ramo(
        grafi.POS_SPRITE, "a cute girl with a straw hat",
        lambda: g.add("EmptyLatentImage", width=1024, height=1024, batch_size=1),
        1.0, "sprite", 48, 0, 24, 8, True))
    traccia("2 · Immagine → Pixel", lambda: ramo(
        grafi.POS_SPRITE, "a yellow rubber duck",
        lambda: g.add("VAEEncode", pixels=g.add("LoadImage", "Immagine", image=immagine_esempio), vae=ckpt.out(2)),
        0.55, "da_immagine", 48, 0, 24, 8, True))
    traccia("3 · Sfondo panoramico", lambda: ramo(
        grafi.POS_SFONDO, "rolling green fields, farmhouses, blue sky, sunny afternoon",
        lambda: g.add("EmptyLatentImage", width=1536, height=432, batch_size=1),
        1.0, "sfondo", 216, 768, 32, 1, False))

    colori = {"Modelli": "#3f3f3f", "1 · Testo → Sprite": "#335533",
              "2 · Immagine → Pixel": "#334455", "3 · Sfondo panoramico": "#553344"}
    colonne = {"Modelli": 1, "1 · Testo → Sprite": 3, "2 · Immagine → Pixel": 3, "3 · Sfondo panoramico": 3}
    layout = [{"title": t, "color": colori[t], "cols": colonne[t], "nodes": ids, "sotto": t != "1 · Testo → Sprite"
               and t != "Modelli", "bypass": t in ("2 · Immagine → Pixel", "3 · Sfondo panoramico")}
              for t, ids in gruppi.items()]
    return g.nodi, layout


def pubblica(nome, dati):
    url = f"{comfy.BASE}/api/userdata/pixelretro_tmp%2F{nome}?overwrite=true"
    urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(dati, ensure_ascii=False).encode(),
                                                  method="POST"), timeout=30).read()


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    esempio = comfy.carica(ESEMPIO, "pixelretro")
    api, layout = costruisci(esempio)
    pubblica("api.json", api)
    pubblica("layout.json", layout)
    print(f"{len(api)} nodi, gruppi: {[ (l['title'], len(l['nodes'])) for l in layout]}")
