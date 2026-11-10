// Converte pixelretro_tmp/api.json nel workflow UI "Pixel Retro.json", dentro il frontend di ComfyUI
// (stesso approccio di comfyui-genera-3d/tools/api_to_ui.js).
// Uso: `python workflow_ui.py`, poi eseguire questo script nella pagina ComfyUI su 8189 (javascript_tool).
// Restituisce le differenze tra graphToPrompt() del workflow e l'API (prima del bypass dei gruppi 2 e 3).
(async () => {
  const app = window.app;
  const get = async (name) => (await fetch(`/api/userdata/${encodeURIComponent("pixelretro_tmp/" + name)}`)).json();
  const api = await get("api.json");
  const layout = await get("layout.json");

  await app.loadApiJson(api, "Pixel Retro");
  await new Promise((r) => setTimeout(r, 1000));  // i collegamenti si assestano dopo il load
  const graph = app.graph;
  for (const g of [...graph._groups]) graph.remove(g);

  for (const [id, n] of Object.entries(api)) {
    const node = graph.getNodeById(Number(id));
    if (!node) continue;
    if (n._meta?.title) node.title = n._meta.title;
    for (const w of node.widgets ?? []) if (w.name === "control_after_generate") w.value = "randomize";
  }

  // Verifica prima del bypass: il prompt del workflow UI deve coincidere con l'API
  const p = (await app.graphToPrompt()).output;
  const diffs = [];
  for (const [id, n] of Object.entries(api)) {
    const q = p[id];
    if (!q) { diffs.push(`manca ${id} ${n.class_type}`); continue; }
    for (const [k, v] of Object.entries(n.inputs)) {
      if (k === "seed") continue;
      if (JSON.stringify(q.inputs[k]) !== JSON.stringify(v)) diffs.push(`${id}.${k}: ${JSON.stringify(q.inputs[k])} != ${JSON.stringify(v)}`);
    }
  }
  for (const id of Object.keys(p)) if (!api[id]) diffs.push(`in più ${id} ${p[id].class_type}`);

  // Nota con le istruzioni, nel gruppo Modelli
  const nota = LiteGraph.createNode("Note");
  nota.title = "Come si usa";
  nota.widgets[0].value = [
    "PIXEL RETRO — immagini pixel art con WAI Illustrious + LoRA pixel-art-xl.",
    "",
    "1 · Testo → Sprite: scrivi il soggetto nel Prompt. Toglie lo sfondo, riduce a 'Pixel veri'",
    "   (height = altezza in pixel dell'immagine finale, width 0 = proporzionale),",
    "   limita i colori in 'Palette' (colors) e salva anche un'anteprima ingrandita ×8.",
    "2 · Immagine → Pixel: carica un'immagine in 'Immagine'; denoise del KSampler = quanto cambiarla.",
    "3 · Sfondo panoramico: striscia larga per scrolling, ridotta a 768×216 senza togliere lo sfondo.",
    "",
    "I gruppi 2 e 3 sono disattivati (bypass): selezionali e premi Ctrl+B per attivarli.",
    "Ogni gruppo salva in output\\Pixel Retro\\ (versione HD + versione pixel).",
  ].join("\n");
  nota.size = [520, 230];
  graph.add(nota);
  layout[0].nodes.unshift(String(nota.id));

  // Gruppi: colonne con le dimensioni reali dei nodi; "sotto" = sotto il gruppo precedente
  const PAD = 40, GAP = 50, TITLE = 50;
  let right = 0, prev = null;
  for (const g of layout) {
    const nodes = g.nodes.map((id) => graph.getNodeById(Number(id))).filter(Boolean);
    const colW = Math.max(...nodes.map((n) => n.size[0])) + GAP;
    const x0 = g.sotto && prev ? prev.x : right + (prev ? 120 : 0);
    const y0 = g.sotto && prev ? prev.y + prev.h + 80 : 0;
    const colY = Array(g.cols).fill(y0 + TITLE + PAD);
    for (const n of nodes) {
      const c = colY.indexOf(Math.min(...colY));
      n.pos = [x0 + PAD + c * colW, colY[c]];
      colY[c] += n.size[1] + GAP + 30;
      if (g.bypass) n.mode = 4;
    }
    const w = PAD * 2 + g.cols * colW - GAP, h = Math.max(...colY) - y0;
    const group = new LiteGraph.LGraphGroup(g.title);
    graph.add(group);
    group.color = g.color;
    group.pos = [x0, y0];
    group.size = [w, h];
    prev = { x: x0, y: y0, h };
    right = Math.max(right, x0 + w);
  }
  app.canvas.setDirty(true, true);

  const wf = graph.serialize();
  const r = await fetch(`/api/userdata/${encodeURIComponent("workflows/Pixel Retro.json")}?overwrite=true`,
    { method: "POST", body: JSON.stringify(wf) });
  const attivi = Object.keys((await app.graphToPrompt()).output).length;
  return { salvato: r.status, nodi_api: Object.keys(api).length, nodi_attivi_dopo_bypass: attivi,
           differenze: diffs.slice(0, 40), n_diff: diffs.length };
})();
