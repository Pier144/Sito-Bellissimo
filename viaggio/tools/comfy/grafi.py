"""Grafi ComfyUI in formato API per "Un viaggio inaspettato".

Ogni funzione restituisce un dict {id: {"class_type", "inputs", "_meta"}} pronto per /prompt.
Salvataggi: `Pixel Retro/<nome>` per i grafi pixel, `Viaggio Personaggio/<nome>` per Qwen Edit e Wan
(regola: ogni workflow salva nella sua sottocartella di output).
"""

CHECKPOINT = "waiIllustriousSDXL_v170.safetensors"
LORA_PIXEL = "pixel-art-xl.safetensors"
BIREFNET = "birefnet.safetensors"

POS_SPRITE = "pixel art, 16-bit sprite, side view, full body, simple white background, "
POS_SFONDO = "pixel art, 16-bit game background, side-scrolling parallax layer, wide panorama, "
NEG = ("blurry, jpeg artifacts, gradient shading, photo, 3d render, text, watermark, signature, "
       "multiple characters, cropped, bad anatomy")


class Grafo:
    def __init__(self):
        self.nodi = {}

    def add(self, classe, titolo=None, **inputs):
        k = str(len(self.nodi) + 1)
        self.nodi[k] = {"class_type": classe,
                        "inputs": {n: (v.out(0) if isinstance(v, Nodo) else v) for n, v in inputs.items()}}
        if titolo:
            self.nodi[k]["_meta"] = {"title": titolo}
        return Nodo(k)


class Nodo:
    def __init__(self, k):
        self.k = k

    def out(self, i):
        return [self.k, i]


def _base_sdxl(g):
    ckpt = g.add("CheckpointLoaderSimple", "Checkpoint", ckpt_name=CHECKPOINT)
    lora = g.add("LoraLoader", "LoRA pixel art", model=ckpt.out(0), clip=ckpt.out(1),
                 lora_name=LORA_PIXEL, strength_model=1.0, strength_clip=1.0)
    clip = g.add("CLIPSetLastLayer", stop_at_clip_layer=-2, clip=lora.out(1))
    return ckpt, lora, clip


def _pixel(g, nome, immagine, alt, larg, colori, scala_anteprima, rimuovi_sfondo):
    """Catena comune: [via lo sfondo] -> nearest alla misura vera -> palette -> [anteprima] -> salva."""
    if rimuovi_sfondo:
        rb = g.add("LoadBackgroundRemovalModel", bg_removal_name=BIREFNET)
        maschera = g.add("RemoveBackground", bg_removal_model=rb, image=immagine)
        inv = g.add("InvertMask", mask=maschera)
        immagine = g.add("JoinImageWithAlpha", "Sfondo trasparente", image=immagine, alpha=inv)
    piccola = g.add("ImageScale", "Pixel veri", image=immagine, upscale_method="nearest-exact",
                    width=larg, height=alt, crop="disabled")
    palette = g.add("ImageQuantize", "Palette", image=piccola, colors=colori, dither="none")
    finale = palette
    if scala_anteprima > 1:
        finale = g.add("ImageScaleBy", "Anteprima ingrandita", image=palette,
                       upscale_method="nearest-exact", scale_by=scala_anteprima)
    g.add("SaveImage", "Salva pixel", images=finale, filename_prefix=f"Pixel Retro/{nome}")


def sprite(nome, prompt, seed, larghezza=1024, altezza=1024, lato_px=48, colori=24,
           rimuovi_sfondo=True, immagine=None, denoise=1.0, prefisso=POS_SPRITE, hd_trasparente=False):
    """Testo -> sprite (o, con `immagine`, immagine -> pixel in img2img).

    `hd_trasparente` (solo per genera.py, non nel workflow UI): la versione HD viene salvata già
    scontornata, così pixelize.py può rifare il passaggio a pixel ritagliando il soggetto.
    """
    g = Grafo()
    ckpt, lora, clip = _base_sdxl(g)
    pos = g.add("CLIPTextEncode", "Prompt", text=prefisso + prompt, clip=clip)
    neg = g.add("CLIPTextEncode", "Negativo", text=NEG, clip=clip)
    if immagine:
        img = g.add("LoadImage", "Immagine", image=immagine)
        lat = g.add("VAEEncode", pixels=img, vae=ckpt.out(2))
    else:
        lat = g.add("EmptyLatentImage", width=larghezza, height=altezza, batch_size=1)
    ks = g.add("KSampler", model=lora, seed=seed, steps=28, cfg=6.0, sampler_name="euler_ancestral",
               scheduler="normal", positive=pos, negative=neg, latent_image=lat, denoise=denoise)
    dec = g.add("VAEDecode", samples=ks, vae=ckpt.out(2))
    if hd_trasparente and rimuovi_sfondo:
        rb = g.add("LoadBackgroundRemovalModel", bg_removal_name=BIREFNET)
        inv = g.add("InvertMask", mask=g.add("RemoveBackground", bg_removal_model=rb, image=dec))
        dec = g.add("JoinImageWithAlpha", "Sfondo trasparente", image=dec, alpha=inv)
        rimuovi_sfondo = False
    g.add("SaveImage", "Salva HD", images=dec, filename_prefix=f"Pixel Retro/{nome}_hd")
    _pixel(g, nome, dec, lato_px, 0, colori, 8, rimuovi_sfondo)
    return g.nodi


def img2img(nome, immagine, prompt, seed, denoise=0.55, **kw):
    return sprite(nome, prompt, seed, immagine=immagine, denoise=denoise, **kw)


def sfondo(nome, prompt, seed, larghezza=1536, altezza=432, out=(768, 216), colori=32, rimuovi_sfondo=False,
           hd_trasparente=False):
    g = Grafo()
    ckpt, lora, clip = _base_sdxl(g)
    pos = g.add("CLIPTextEncode", "Prompt", text=POS_SFONDO + prompt, clip=clip)
    neg = g.add("CLIPTextEncode", "Negativo", text=NEG, clip=clip)
    lat = g.add("EmptyLatentImage", width=larghezza, height=altezza, batch_size=1)
    ks = g.add("KSampler", model=lora, seed=seed, steps=28, cfg=6.0, sampler_name="euler_ancestral",
               scheduler="normal", positive=pos, negative=neg, latent_image=lat, denoise=1.0)
    dec = g.add("VAEDecode", samples=ks, vae=ckpt.out(2))
    if hd_trasparente and rimuovi_sfondo:
        rb = g.add("LoadBackgroundRemovalModel", bg_removal_name=BIREFNET)
        inv = g.add("InvertMask", mask=g.add("RemoveBackground", bg_removal_model=rb, image=dec))
        dec = g.add("JoinImageWithAlpha", "Sfondo trasparente", image=dec, alpha=inv)
        rimuovi_sfondo = False
    g.add("SaveImage", "Salva HD", images=dec, filename_prefix=f"Pixel Retro/{nome}_hd")
    _pixel(g, nome, dec, out[1], out[0], colori, 1, rimuovi_sfondo)
    return g.nodi


def qwen_edit(nome, immagini, prompt, seed, larghezza=832, altezza=1248):
    """Qwen Image Edit 2511 + Lightning 4 passi (stessa catena di Character Sheet Lustify)."""
    g = Grafo()
    unet = g.add("UNETLoader", unet_name="qwen_image_edit_2511_int8_convrot.safetensors", weight_dtype="default")
    ms = g.add("ModelSamplingAuraFlow", model=unet, shift=3.1)
    cfgn = g.add("CFGNorm", model=ms, strength=1.0)
    modello = g.add("LoraLoaderModelOnly", model=cfgn,
                    lora_name="Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors", strength_model=1.0)
    clip = g.add("CLIPLoader", clip_name="qwen_2.5_vl_7b_fp8_scaled.safetensors", type="qwen_image", device="default")
    vae = g.add("VAELoader", vae_name="qwen_image_vae.safetensors")
    refs = {}
    for i, nome_img in enumerate(immagini[:3], 1):
        li = g.add("LoadImage", f"Riferimento {i}", image=nome_img)
        refs[f"image{i}"] = g.add("FluxKontextImageScale", image=li)
    tp = g.add("TextEncodeQwenImageEditPlus", "Prompt", clip=clip, prompt=prompt, vae=vae, **refs)
    tn = g.add("TextEncodeQwenImageEditPlus", "Negativo", clip=clip, prompt="", vae=vae, **refs)
    pos = g.add("FluxKontextMultiReferenceLatentMethod", conditioning=tp, reference_latents_method="index_timestep_zero")
    neg = g.add("FluxKontextMultiReferenceLatentMethod", conditioning=tn, reference_latents_method="index_timestep_zero")
    lat = g.add("EmptySD3LatentImage", width=larghezza, height=altezza, batch_size=1)
    ks = g.add("KSampler", model=modello, seed=seed, steps=4, cfg=1.0, sampler_name="euler", scheduler="simple",
               positive=pos, negative=neg, latent_image=lat, denoise=1.0)
    dec = g.add("VAEDecode", samples=ks, vae=vae)
    g.add("SaveImage", images=dec, filename_prefix=f"Viaggio Personaggio/{nome}")
    return g.nodi


def rimuovi_sfondo(nome, immagine):
    g = Grafo()
    li = g.add("LoadImage", image=immagine)
    rb = g.add("LoadBackgroundRemovalModel", bg_removal_name=BIREFNET)
    maschera = g.add("RemoveBackground", bg_removal_model=rb, image=li)
    inv = g.add("InvertMask", mask=maschera)
    out = g.add("JoinImageWithAlpha", image=li, alpha=inv)
    g.add("SaveImage", images=out, filename_prefix=f"Viaggio Personaggio/pulite/{nome}")
    return g.nodi


def wan_cammina(nome, immagine, prompt, seed, frame=33, larghezza=480, altezza=480):
    """Wan 2.2 i2v 14B + lightx2v 4 passi (come il template ufficiale); salva i frame come PNG."""
    g = Grafo()
    alto = g.add("UNETLoader", unet_name="wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", weight_dtype="default")
    basso = g.add("UNETLoader", unet_name="wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors", weight_dtype="default")
    alto = g.add("LoraLoaderModelOnly", model=alto,
                 lora_name="wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", strength_model=1.0)
    basso = g.add("LoraLoaderModelOnly", model=basso,
                  lora_name="wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", strength_model=1.0)
    alto = g.add("ModelSamplingSD3", model=alto, shift=5.0)
    basso = g.add("ModelSamplingSD3", model=basso, shift=5.0)
    clip = g.add("CLIPLoader", clip_name="umt5_xxl_fp8_e4m3fn_scaled.safetensors", type="wan", device="default")
    vae = g.add("VAELoader", vae_name="wan_2.1_vae.safetensors")
    pos = g.add("CLIPTextEncode", "Prompt", text=prompt, clip=clip)
    neg = g.add("CLIPTextEncode", "Negativo",
                text="blurry, static, camera movement, flicker, deformed, extra limbs, bad hands", clip=clip)
    img = g.add("LoadImage", "Immagine di partenza", image=immagine)
    wan = g.add("WanImageToVideo", positive=pos, negative=neg, vae=vae, start_image=img,
                width=larghezza, height=altezza, length=frame, batch_size=1)
    k1 = g.add("KSamplerAdvanced", model=alto, add_noise="enable", noise_seed=seed, steps=4, cfg=1.0,
               sampler_name="euler", scheduler="simple", positive=wan.out(0), negative=wan.out(1),
               latent_image=wan.out(2), start_at_step=0, end_at_step=2, return_with_leftover_noise="enable")
    k2 = g.add("KSamplerAdvanced", model=basso, add_noise="disable", noise_seed=0, steps=4, cfg=1.0,
               sampler_name="euler", scheduler="simple", positive=wan.out(0), negative=wan.out(1),
               latent_image=k1, start_at_step=2, end_at_step=10000, return_with_leftover_noise="disable")
    dec = g.add("VAEDecode", samples=k2, vae=vae)
    g.add("SaveImage", images=dec, filename_prefix=f"Viaggio Personaggio/cammina/{nome}")
    return g.nodi
