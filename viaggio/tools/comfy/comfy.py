"""Client minimo per l'API di ComfyUI (solo libreria standard).

Di default parla col server di test su 8189 (regola: mai la coda del Desktop su 8188).
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

BASE = os.environ.get("COMFY_URL", "http://127.0.0.1:8189")


def _get(path):
    with urllib.request.urlopen(BASE + path, timeout=60) as r:
        return r.read()


def _post(path, data):
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            corpo = r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{path}: HTTP {e.code} {e.read().decode(errors='replace')[:3000]}") from None
    return json.loads(corpo) if corpo else None


def carica(percorso, sottocartella="viaggio"):
    """Carica un'immagine in input/ e restituisce il nome da usare in LoadImage."""
    p = Path(percorso)
    confine = uuid.uuid4().hex
    corpo = b"".join([
        f"--{confine}\r\nContent-Disposition: form-data; name=\"subfolder\"\r\n\r\n{sottocartella}\r\n".encode(),
        f"--{confine}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n".encode(),
        f"--{confine}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{p.name}\"\r\n"
        f"Content-Type: image/png\r\n\r\n".encode(),
        p.read_bytes(), f"\r\n--{confine}--\r\n".encode()])
    req = urllib.request.Request(BASE + "/upload/image", data=corpo,
                                 headers={"Content-Type": f"multipart/form-data; boundary={confine}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        info = json.loads(r.read())
    return f"{info['subfolder']}/{info['name']}" if info.get("subfolder") else info["name"]


def esegui(grafo, attesa_max=1800):
    """Mette in coda il grafo (formato API), attende e restituisce le immagini prodotte."""
    risposta = _post("/prompt", {"prompt": grafo, "client_id": "viaggio"})
    if risposta.get("node_errors"):
        raise RuntimeError(json.dumps(risposta["node_errors"])[:3000])
    pid = risposta["prompt_id"]
    inizio = time.time()
    while time.time() - inizio < attesa_max:
        storia = json.loads(_get(f"/history/{pid}"))
        if pid in storia:
            stato = storia[pid].get("status", {})
            if stato.get("status_str") == "error":
                raise RuntimeError(json.dumps(stato.get("messages", []))[:3000])
            return [img for out in storia[pid]["outputs"].values() for img in out.get("images", [])]
        time.sleep(1.5)
    raise TimeoutError(pid)


def libera():
    """Scarica i modelli dalla VRAM (evita il rallentamento AMD alla 2a generazione)."""
    _post("/free", {"unload_models": True, "free_memory": True})


def scarica(img, cartella):
    q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img["subfolder"], "type": img["type"]})
    dest = Path(cartella) / img["filename"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(_get(f"/view?{q}"))
    return dest
