# Un viaggio inaspettato — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sotto-sito `viaggio/`: runner pixel-art per telefono in orizzontale (6 giorni dalle terme a casa) + workflow ComfyUI "Pixel Retro" e pipeline per generarne la grafica.

**Architecture:** Script classici senza build, un namespace globale `VIAGGIO`. La logica pura (config, giocatrice, regole, giorni, mondo) non tocca DOM né canvas ed è testata con `node --test`; disegno, audio e motore stanno in file separati e si verificano nel browser. La grafica si genera con ComfyUI locale via API (script Python senza dipendenze) e si ripulisce con Pillow; il gioco funziona anche senza grafica grazie ai segnaposto colorati.

**Tech Stack:** HTML5 canvas, JavaScript ES2020, WebAudio, Node 24 (`node --test`), Python 3.13 + Pillow 12, ComfyUI 0.44 (Desktop su 8188, server di test su 8189).

**Spec:** `docs/superpowers/specs/2026-11-10-viaggio-inaspettato-design.md`

**Scostamenti dalla spec (decisi qui, coerenti con essa):**
- In `days.js` il campo `t` è il secondo in cui l'evento **arriva davanti a lei** (non quando compare a destra): rende i dati più facili da scrivere. Buchi e fango usano `larghezza` in px invece di `durata`.
- Valori di fisica tarati perché i numeri tornino: gravità 500, v0 250, `DISTANZA_MIN` 140 px (la spec diceva "valori iniziali da bilanciare"). Il salto lungo copre ~106 px al giorno 4: i crepacci in `days.js` arrivano al massimo a 85 px.
- Sassi, cespugli e scoiattolo sono ostacoli fermi: il "rotolare" e il vento sono solo animazione (rotazione, ondeggiamento) in render.js; lo scoiattolo ladro di snack resta una gag del diario.
- Scala del canvas intera quando possibile, frazionaria se l'intera lascerebbe più del 30% di schermo vuoto.
- La finestra per l'azione contestuale è in px (150 px ≈ 1.2-1.7 s a seconda del giorno) invece che 1.5 s fissi.
- Durata: 6.4 min di cammino + intro e falò ≈ 7-8 min.
- Il tipo `cartello` della spec diventa `decoro` (copre anche la porta di casa).

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `viaggio/js/config.js` | Costanti: dimensioni, fisica, Relax, hitbox entità, velocità per giorno |
| `viaggio/js/player.js` | Stato e fisica della giocatrice, animazioni (puro) |
| `viaggio/js/rules.js` | Simulazione salto, collisioni rettangoli, validazione giorni, variazione casuale, statistiche (puro) |
| `viaggio/js/days.js` | Solo dati: 6 giorni, diario, frase finale |
| `viaggio/js/world.js` | Avanzamento del percorso, entità, collisioni, azioni (puro, notifica via callback) |
| `viaggio/js/render.js` | Disegno su canvas: sfondi, entità, giocatrice, HUD, effetti, segnaposto |
| `viaggio/js/audio.js` | Effetti 8-bit e musica chiptune |
| `viaggio/js/engine.js` | Stati di gioco, loop, input, orientamento, schermate DOM, scorciatoie hash |
| `viaggio/index.html` | Canvas + schermate (titolo, intro, falò, finale, gira telefono, pausa) |
| `viaggio/assets/manifest.json` | Elenco sprite/sfondi con dimensioni e frame (generato) |
| `viaggio/tests/*.test.js` | Test Node della logica pura |
| `viaggio/tools/check-days.js` | Controllo da riga di comando della giocabilità dei giorni |
| `viaggio/tools/pixelize.py` + `test_pixelize.py` | Post-produzione pixel e sprite sheet |
| `viaggio/tools/comfy/comfy.py` | Client minimo API ComfyUI |
| `viaggio/tools/comfy/grafi.py` | Grafi API: sprite, img2img, sfondo, Qwen Edit, Wan i2v |
| `viaggio/tools/comfy/workflow_ui.py` | Converte i grafi in "Pixel Retro.json" per l'interfaccia di ComfyUI |
| `viaggio/tools/comfy/assets.json` + `genera.py` | Elenco asset con prompt e generazione in batch |
| `viaggio/tools/check-privacy.py` | Nessuna foto originale in `viaggio/` |

Ordine di caricamento script in `index.html`: config, player, rules, days, world, render, audio, engine.

Ogni file JS ha la forma:

```js
(function (V) {
  // ...
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
```

così funziona sia nel browser sia con `require` in Node.

---

## Chunk 1: Binario codice

### Task C1: Config e giocatrice

**Files:**
- Create: `viaggio/js/config.js`
- Create: `viaggio/js/player.js`
- Create: `viaggio/js/rules.js` (solo `simulaSalto` per ora)
- Test: `viaggio/tests/fisica.test.js`

- [ ] **Step 1: Scrivi `config.js`**

```js
(function (V) {
  V.W = 384; V.H = 216;
  V.SUOLO = 184;                       // y schermo della linea del terreno
  V.PX = 72;                           // x schermo del bordo sinistro della hitbox di lei
  V.GIOCATRICE = { w: 14, h: 40 };     // hitbox (lo sprite è ~32x48)
  V.FISICA = { gravita: 500, v0: 250, taglio: 0.4, dt: 1 / 60 };
  V.RELAX = { max: 100, caloAlSecondo: 0.5, colpo: 20, buco: 20, invulnerabile: 1 };
  V.RICARICHE = { snack: 10, grappolo: 10, cane: 10, panchina: 25, fonte: 40 };
  V.DISTANZA_MIN = 140;                // px liberi tra due cose da saltare
  V.FANGO = 0.6;                       // moltiplicatore velocità sul fango
  V.OMBRELLO = 8;                      // secondi di immunità ai fulmini
  V.FINESTRA_AZIONE = 150;             // px davanti a lei in cui l'azione è possibile (~1.5 s)
  V.FRAMES = { cammina: 6, salto: 2, colpita: 1, stanca: 2, pisolino: 2, bacino: 2 };
  V.ENTITA = {                         // hitbox; y = altezza da terra del bordo inferiore
    gallina: { w: 14, h: 14 }, pozzanghera: { w: 24, h: 4 }, mucca: { w: 36, h: 22 },
    trattore: { w: 40, h: 24 }, cane: { w: 20, h: 16 }, scoiattolo: { w: 12, h: 12 },
    radice: { w: 20, h: 8 }, fungo: { w: 10, h: 12 }, capra: { w: 22, h: 20 },
    sasso: { w: 14, h: 14 }, cespuglio: { w: 16, h: 16 }, fulmine: { w: 16, h: 6 },
    monopattino: { w: 24, h: 18 }, piccione: { w: 14, h: 10 }, bus: { w: 60, h: 24 },
    snack: { w: 12, h: 12 }, grappolo: { w: 12, h: 12 }, panchina: { w: 30, h: 14 },
    fonte: { w: 18, h: 14 }, ombrello: { w: 14, h: 14 },
    paperella: { w: 12, h: 12 }, cuffia: { w: 12, h: 12 }, accappatoio: { w: 12, h: 12 },
    ciabatta: { w: 12, h: 12 }, telo: { w: 12, h: 12 }, braccialetto: { w: 12, h: 12 },
    cartello: { w: 16, h: 30 }, porta: { w: 30, h: 50 }
  };
  V.RICORDI = ['paperella', 'cuffia', 'accappatoio', 'ciabatta', 'telo', 'braccialetto'];
  V.velocitaGiorno = n => 90 + (n - 1) * 6;   // px/s, giorno 1..6 -> 90..120
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
```

- [ ] **Step 2: Scrivi il test che fallisce `viaggio/tests/fisica.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
require('../js/config.js'); require('../js/player.js'); require('../js/rules.js');
const V = globalThis.VIAGGIO;

test('salto breve tra 20 e 40 px', () => {
  const s = V.simulaSalto(0.08);
  assert.ok(s.altezza >= 20 && s.altezza <= 40, `altezza ${s.altezza}`);
});
test('salto lungo tra 50 e 65 px', () => {
  const s = V.simulaSalto(Infinity);
  assert.ok(s.altezza >= 50 && s.altezza <= 65, `altezza ${s.altezza}`);
});
test('salto lungo supera un crepaccio di 85 px dal giorno 4', () => {
  const s = V.simulaSalto(Infinity);
  assert.ok(s.volo * V.velocitaGiorno(4) >= 85 + 16, `percorre ${s.volo * V.velocitaGiorno(4)}`);
});
test('non si salta in aria e si riatterra', () => {
  const p = V.creaGiocatrice();
  assert.strictEqual(V.premiSalto(p), true);
  assert.strictEqual(V.premiSalto(p), false);
  for (let i = 0; i < 200; i++) V.aggiornaGiocatrice(p, 1 / 60);
  assert.strictEqual(p.aTerra, true); assert.strictEqual(p.y, 0);
});
test('colpita: invulnerabile per 1 s', () => {
  const p = V.creaGiocatrice();
  assert.strictEqual(V.colpisci(p), true);
  assert.strictEqual(V.colpisci(p), false);
  for (let i = 0; i < 61; i++) V.aggiornaGiocatrice(p, 1 / 60);
  assert.strictEqual(V.colpisci(p), true);
});
test('durante il pisolino non salta', () => {
  const p = V.creaGiocatrice(); V.posa(p, 'pisolino', 2);
  assert.strictEqual(V.premiSalto(p), false);
});
test('frame della camminata ciclico', () => {
  const p = V.creaGiocatrice(); p.tAnim = 0.65;
  assert.deepStrictEqual(V.frameGiocatrice(p), { anim: 'cammina', i: 0 });
});
```

- [ ] **Step 3: Esegui e verifica che fallisca**

Run: `node --test "viaggio/tests/*.test.js"`
Expected: FAIL (`Cannot find module '../js/player.js'`)

- [ ] **Step 4: Scrivi `player.js`**

```js
(function (V) {
  V.creaGiocatrice = () => ({ y: 0, vy: 0, aTerra: true, tenendo: false, inv: 0, anim: 'cammina', tAnim: 0, tStato: 0 });

  V.premiSalto = p => {
    if (!p.aTerra || p.anim === 'stanca' || p.anim === 'pisolino') return false;
    p.vy = V.FISICA.v0; p.aTerra = false; p.tenendo = true;
    return true;
  };

  V.rilasciaSalto = p => {
    p.tenendo = false;
    const lim = V.FISICA.v0 * V.FISICA.taglio;
    if (!p.aTerra && p.vy > lim) p.vy = lim;
  };

  V.aggiornaGiocatrice = (p, dt) => {
    p.tAnim += dt;
    if (p.inv > 0) p.inv = Math.max(0, p.inv - dt);
    if (p.tStato > 0) {
      p.tStato -= dt;
      if (p.tStato <= 0) { p.tStato = 0; p.anim = 'cammina'; }
    }
    if (!p.aTerra) {
      p.vy -= V.FISICA.gravita * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.aTerra = true; p.tenendo = false; }
    }
  };

  V.colpisci = p => {
    if (p.inv > 0) return false;
    p.inv = V.RELAX.invulnerabile; p.anim = 'colpita'; p.tStato = 0.3;
    return true;
  };

  V.posa = (p, anim, durata) => { p.anim = anim; p.tStato = durata; p.tAnim = 0; };

  const FPS = { cammina: 10, stanca: 2, pisolino: 2, bacino: 3, colpita: 1 };
  V.frameGiocatrice = p => {
    if (!p.aTerra) return { anim: 'salto', i: p.vy > 0 ? 0 : 1 };
    return { anim: p.anim, i: Math.floor(p.tAnim * FPS[p.anim]) % V.FRAMES[p.anim] };
  };

  V.hitboxGiocatrice = p => ({ x: V.PX, y: p.y, w: V.GIOCATRICE.w, h: V.GIOCATRICE.h });
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
```

- [ ] **Step 5: Scrivi `rules.js` con `simulaSalto`**

```js
(function (V) {
  // Simula un salto premuto per `tenuto` secondi usando la stessa fisica di player.js
  V.simulaSalto = (tenuto, dt = V.FISICA.dt) => {
    const p = V.creaGiocatrice(); V.premiSalto(p);
    let t = 0, altezza = 0; const quote = [];
    do {
      if (p.tenendo && t >= tenuto) V.rilasciaSalto(p);
      V.aggiornaGiocatrice(p, dt); t += dt;
      quote.push(p.y); altezza = Math.max(altezza, p.y);
    } while (!p.aTerra);
    return { altezza, volo: t, quote, dt };
  };
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
```

- [ ] **Step 6: Esegui i test**

Run: `node --test "viaggio/tests/*.test.js"`
Expected: 7 PASS. Se le altezze escono dai range, ritocca solo `V.FISICA` (non i test).

- [ ] **Step 7: Commit**

```bash
git add viaggio/js/config.js viaggio/js/player.js viaggio/js/rules.js viaggio/tests/fisica.test.js
git commit -m "Viaggio: config e fisica della giocatrice con test"
```

### Task C2: Regole (collisioni, validazione, variazione, statistiche)

**Files:**
- Modify: `viaggio/js/rules.js`
- Test: `viaggio/tests/regole.test.js`

- [ ] **Step 1: Scrivi il test che fallisce `viaggio/tests/regole.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
for (const f of ['config', 'player', 'rules']) require(`../js/${f}.js`);
const V = globalThis.VIAGGIO;

const base = eventi => ({ bioma: 'campi', durata: 30, diario: 'x', eventi });
const ricordi = [10, 14, 18].map(t => ({ t, tipo: 'ricordo', nome: 'paperella', y: 46 }));
const ok = altri => base([...altri, ...ricordi, { t: 20, tipo: 'ricarica', nome: 'snack' }].sort((a, b) => a.t - b.t));

test('sovrapposti', () => {
  assert.strictEqual(V.sovrapposti({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 }), true);
  assert.strictEqual(V.sovrapposti({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }), false);
});
test('giorno valido non ha errori', () => {
  assert.deepStrictEqual(V.validaGiorno(ok([{ t: 3, tipo: 'ostacolo', nome: 'gallina' }]), 1), []);
});
test('ostacoli troppo vicini', () => {
  const g = ok([{ t: 3, tipo: 'ostacolo', nome: 'gallina' }, { t: 4, tipo: 'ostacolo', nome: 'gallina' }]);
  assert.match(V.validaGiorno(g, 1).join(), /troppo vicino/);
});
test('crepaccio vietato prima del giorno 4', () => {
  const g = ok([{ t: 3, tipo: 'buco', larghezza: 60 }]);
  assert.match(V.validaGiorno(g, 2).join(), /crepaccio/);
  assert.deepStrictEqual(V.validaGiorno(g, 4), []);
});
test('crepaccio troppo largo', () => {
  assert.match(V.validaGiorno(ok([{ t: 3, tipo: 'buco', larghezza: 150 }]), 6).join(), /troppo largo/);
});
test('ostacolo in aria troppo basso', () => {
  assert.match(V.validaGiorno(ok([{ t: 3, tipo: 'ostacolo', nome: 'piccione', y: 20 }]), 6).join(), /in aria/);
});
test('servono 3 ricordi', () => {
  const g = base([{ t: 3, tipo: 'ricarica', nome: 'snack' }]);
  assert.match(V.validaGiorno(g, 1).join(), /3 ricordi/);
});
test('nome sconosciuto', () => {
  assert.match(V.validaGiorno(ok([{ t: 3, tipo: 'ostacolo', nome: 'drago' }]), 1).join(), /sconosciuto/);
});
test('variazione: deterministica e sempre valida', () => {
  const g = ok([{ t: 3, tipo: 'ostacolo', nome: 'gallina' }, { t: 5, tipo: 'ostacolo', nome: 'gallina' }]);
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const a = V.applicaVariazione(g, 1, rng(7)), b = V.applicaVariazione(g, 1, rng(7));
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(V.validaGiorno({ ...g, eventi: a }, 1), []);
  assert.strictEqual(g.eventi[0].t, 3); // non modifica l'originale
});
test('statistiche: copia indipendente', () => {
  const s = V.nuoveStats(); s.ricordi.push('telo');
  const c = V.copiaStats(s); c.ricordi.push('cuffia'); c.ostacoliPresi = 3;
  assert.deepStrictEqual(s, { ostacoliPresi: 0, ricordi: ['telo'] });
});
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `node --test "viaggio/tests/*.test.js"`
Expected: FAIL (`V.sovrapposti is not a function`)

- [ ] **Step 3: Aggiungi a `rules.js` (dentro la stessa IIFE, dopo `simulaSalto`)**

```js
  // secondi consecutivi più lunghi sopra quota h
  V.tempoSopra = (h, tenuto = Infinity) => {
    const s = V.simulaSalto(tenuto); let best = 0, cur = 0;
    for (const q of s.quote) { cur = q > h ? cur + s.dt : 0; best = Math.max(best, cur); }
    return best;
  };

  V.sovrapposti = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  // cose da saltare (contano per DISTANZA_MIN)
  V.daSaltare = ev =>
    (ev.tipo === 'ostacolo' && !(ev.y > 0)) || ev.tipo === 'buco' || ev.tipo === 'fulmine' ||
    (ev.tipo === 'interattivo' && ev.nome === 'cane');

  V.larghezzaEvento = ev => ev.larghezza || (V.ENTITA[ev.nome] || { w: 0 }).w;

  const TIPI = ['ostacolo', 'buco', 'fango', 'fulmine', 'ricarica', 'ricordo', 'interattivo', 'decoro'];

  V.validaGiorno = (g, n) => {
    const err = [], v = V.velocitaGiorno(n), lungo = V.simulaSalto(Infinity);
    const G = V.GIOCATRICE;
    let tPrec = -Infinity, saltoPrec = null, fangoFine = -Infinity;
    for (const ev of g.eventi) {
      const id = `${ev.tipo}:${ev.nome || ''}@${ev.t}`;
      if (!TIPI.includes(ev.tipo)) { err.push(`${id}: tipo sconosciuto`); continue; }
      if (!['buco', 'fango'].includes(ev.tipo) && !V.ENTITA[ev.nome]) { err.push(`${id}: nome sconosciuto`); continue; }
      if (ev.t < tPrec) err.push(`${id}: eventi non in ordine`);
      if (ev.t < 0 || ev.t > g.durata) err.push(`${id}: fuori dalla durata`);
      tPrec = ev.t;
      const x = ev.t * v, w = V.larghezzaEvento(ev), h = (V.ENTITA[ev.nome] || { h: 0 }).h;
      if (ev.tipo === 'ostacolo' && ev.y > 0 && ev.y < G.h + 2) err.push(`${id}: ostacolo in aria troppo basso`);
      if (V.daSaltare(ev) && ev.tipo !== 'buco' && V.tempoSopra(h) * v < w + G.w) err.push(`${id}: insuperabile`);
      if (ev.tipo === 'buco') {
        if (n < 4) err.push(`${id}: crepaccio prima del giorno 4`);
        if (w + 16 > lungo.volo * v) err.push(`${id}: crepaccio troppo largo`);
        if (x - fangoFine < 100) err.push(`${id}: crepaccio subito dopo il fango`);
      }
      if (ev.tipo === 'fango') fangoFine = x + w;
      if ((ev.tipo === 'ricordo' || ev.tipo === 'ricarica') && (ev.y || 0) > lungo.altezza + G.h - 4) err.push(`${id}: irraggiungibile`);
      if (V.daSaltare(ev)) {
        if (saltoPrec && x - (saltoPrec.x + saltoPrec.w) < V.DISTANZA_MIN) err.push(`${id}: troppo vicino al precedente`);
        saltoPrec = { x, w };
      }
    }
    const nRicordi = g.eventi.filter(e => e.tipo === 'ricordo').length;
    if (nRicordi !== 3) err.push(`servono 3 ricordi, trovati ${nRicordi}`);
    if (!g.eventi.some(e => e.tipo === 'ricarica')) err.push('manca almeno una ricarica');
    if (!g.diario) err.push('manca il diario');
    return err;
  };

  // sposta ogni evento di ±0.3 s; se il risultato non è valido restituisce gli eventi originali
  V.applicaVariazione = (g, n, rng) => {
    const eventi = g.eventi.map(e => ({ ...e }));
    for (let i = 0; i < eventi.length; i++) {
      const lo = i ? eventi[i - 1].t : 0, hi = i < eventi.length - 1 ? g.eventi[i + 1].t : g.durata;
      eventi[i].t = Math.min(hi, Math.max(lo, +(eventi[i].t + (rng() * 0.6 - 0.3)).toFixed(2)));
    }
    return V.validaGiorno({ ...g, eventi }, n).length ? g.eventi.map(e => ({ ...e })) : eventi;
  };

  V.nuoveStats = () => ({ ostacoliPresi: 0, ricordi: [] });
  V.copiaStats = s => ({ ostacoliPresi: s.ostacoliPresi, ricordi: s.ricordi.slice() });
```

- [ ] **Step 4: Esegui i test**

Run: `node --test "viaggio/tests/*.test.js"`
Expected: tutti PASS (17).

- [ ] **Step 5: Commit**

```bash
git add viaggio/js/rules.js viaggio/tests/regole.test.js
git commit -m "Viaggio: regole, validazione dei giorni e variazione casuale"
```

### Task C3: I sei giorni (dati) + check-days

**Files:**
- Create: `viaggio/js/days.js`
- Create: `viaggio/tools/check-days.js`
- Test: `viaggio/tests/giorni.test.js`

- [ ] **Step 1: Scrivi il test che fallisce `viaggio/tests/giorni.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
for (const f of ['config', 'player', 'rules', 'days']) require(`../js/${f}.js`);
const V = globalThis.VIAGGIO;

test('6 giorni', () => assert.strictEqual(V.GIORNI.length, 6));
V.GIORNI.forEach((g, i) => test(`giorno ${i + 1} giocabile`, () => assert.deepStrictEqual(V.validaGiorno(g, i + 1), [])));
test('18 ricordi in tutto', () => {
  assert.strictEqual(V.GIORNI.flatMap(g => g.eventi).filter(e => e.tipo === 'ricordo').length, 18);
});
test('durata totale tra 6 e 7 minuti', () => {
  const s = V.GIORNI.reduce((a, g) => a + g.durata, 0);
  assert.ok(s >= 360 && s <= 420, `${s} s`);
});
test('ultimo giorno finisce con la porta', () => {
  assert.ok(V.GIORNI[5].eventi.some(e => e.nome === 'porta'));
});
test('frase finale presente', () => assert.ok(V.FRASE_FINALE.length > 10));
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `node --test "viaggio/tests/*.test.js"`
Expected: FAIL (`V.GIORNI` undefined)

- [ ] **Step 3: Scrivi `days.js`**

Regola di scrittura: tra due cose da saltare almeno 2.5 s; ricordi a `y` 44-56 (serve saltare); ricariche a terra. `t` = secondo in cui l'evento arriva davanti a lei.

```js
(function (V) {
  const o = (t, nome, extra) => ({ t, tipo: 'ostacolo', nome, ...extra });
  const r = (t, nome, y) => ({ t, tipo: 'ricordo', nome, y });
  const ric = (t, nome) => ({ t, tipo: 'ricarica', nome });
  const cart = (t, testo) => ({ t, tipo: 'decoro', nome: 'cartello', testo });

  V.GIORNI = [
    { bioma: 'campi', durata: 64, diario: 'Giorno 1: le galline mi guardano male. Mi manca l\'idromassaggio.', eventi: [
      cart(1, 'Terme 0 km ←'), o(4, 'pozzanghera'), ric(7, 'snack'), o(9, 'gallina'), r(12, 'paperella', 46),
      o(15, 'pozzanghera'), o(18, 'gallina'), cart(21, 'Casa ??? km →'), o(23, 'mucca'), ric(27, 'panchina'),
      o(30, 'gallina'), o(32.5, 'gallina'), r(36, 'cuffia', 48), o(39, 'pozzanghera'), ric(42, 'snack'),
      o(45, 'mucca'), o(49, 'gallina'), r(52, 'ciabatta', 52), o(55, 'pozzanghera'), o(58, 'gallina'),
      cart(61, 'Terme 3 km ←') ] },
    { bioma: 'vigneti', durata: 64, diario: 'Giorno 2: un cane mi ha adottata. Il trattore no.', eventi: [
      o(4, 'pozzanghera'), ric(7, 'grappolo'), o(9, 'gallina'), { t: 13, tipo: 'interattivo', nome: 'cane' },
      r(16, 'telo', 46), o(19, 'trattore'), ric(23, 'grappolo'), o(26, 'pozzanghera'), cart(29, 'Casa ??? km →'),
      o(31, 'gallina'), r(34, 'braccialetto', 50), o(37, 'trattore'), ric(41, 'panchina'),
      { t: 44, tipo: 'interattivo', nome: 'cane' }, o(48, 'pozzanghera'), r(51, 'accappatoio', 52),
      o(54, 'trattore'), ric(58, 'grappolo'), o(60, 'gallina') ] },
    { bioma: 'bosco', durata: 64, diario: 'Giorno 3: uno scoiattolo mi ha rubato i biscotti. Lo perdono. Forse.', eventi: [
      o(4, 'radice'), ric(7, 'snack'), o(9, 'scoiattolo'), o(12, 'fungo'), r(15, 'paperella', 48),
      o(18, 'radice'), o(21, 'sasso'), ric(24, 'fonte'), o(27, 'scoiattolo'), cart(30, 'Terme ??? km ←'),
      o(32, 'fungo'), r(35, 'telo', 52), o(38, 'radice'), o(41, 'scoiattolo'), ric(44, 'snack'),
      o(47, 'sasso'), o(50, 'fungo'), r(53, 'cuffia', 54), o(56, 'radice'), ric(59, 'panchina') ] },
    { bioma: 'montagna', durata: 64, diario: 'Giorno 4: le capre vanno in montagna per scelta. Io no.', eventi: [
      o(4, 'sasso'), ric(7, 'snack'), o(9, 'capra'), { t: 13, tipo: 'buco', larghezza: 60 }, r(16, 'braccialetto', 48),
      o(19, 'cespuglio'), o(22, 'capra'), ric(25, 'panchina'), { t: 28, tipo: 'buco', larghezza: 75 },
      o(31, 'sasso'), r(34, 'ciabatta', 52), o(37, 'cespuglio'), { t: 40, tipo: 'buco', larghezza: 85 },
      ric(43, 'snack'), o(46, 'capra'), o(49, 'sasso'), r(52, 'accappatoio', 54), o(55, 'cespuglio'),
      { t: 58, tipo: 'buco', larghezza: 80 }, ric(61, 'fonte') ] },
    { bioma: 'temporale', durata: 64, diario: 'Giorno 5: ho visto un fulmine da vicino. Ora ho i ricci elettrici.', eventi: [
      { t: 3, tipo: 'interattivo', nome: 'ombrello' }, { t: 6, tipo: 'fulmine', nome: 'fulmine' }, ric(9, 'snack'),
      { t: 11, tipo: 'fango', larghezza: 120 }, o(15, 'sasso'), r(18, 'paperella', 50), { t: 21, tipo: 'fulmine', nome: 'fulmine' },
      o(24, 'cespuglio'), ric(27, 'panchina'), { t: 30, tipo: 'fango', larghezza: 150 }, { t: 34, tipo: 'fulmine', nome: 'fulmine' },
      r(37, 'cuffia', 52), { t: 40, tipo: 'interattivo', nome: 'ombrello' }, { t: 42, tipo: 'fulmine', nome: 'fulmine' },
      o(45, 'sasso'), ric(48, 'snack'), { t: 50, tipo: 'fulmine', nome: 'fulmine' }, r(53, 'telo', 54),
      o(56, 'cespuglio'), { t: 59, tipo: 'fulmine', nome: 'fulmine' }, ric(62, 'fonte') ] },
    { bioma: 'periferia', durata: 64, diario: 'Giorno 6: vedo casa. Non ci credo.', eventi: [
      o(4, 'pozzanghera'), ric(7, 'snack'), o(9, 'monopattino'), o(12, 'piccione', { y: 44 }), r(14, 'ciabatta', 48),
      o(17, 'bus'), ric(21, 'panchina'), o(24, 'pozzanghera'), o(27, 'monopattino'), o(29, 'piccione', { y: 46 }),
      r(32, 'braccialetto', 52), o(35, 'bus'), ric(39, 'snack'), o(42, 'monopattino'), o(45, 'pozzanghera'),
      r(48, 'accappatoio', 54), o(51, 'bus'), o(55, 'monopattino'), cart(58, 'Casa 0 km!'),
      { t: 62, tipo: 'decoro', nome: 'porta' } ] }
  ];

  V.FRASE_FINALE = 'Bentornata a casa! La prossima volta: terme sotto casa.';
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
```

- [ ] **Step 4: Scrivi `viaggio/tools/check-days.js`**

```js
// Uso: node viaggio/tools/check-days.js  -> elenca i problemi di giocabilità, exit 1 se ce ne sono
for (const f of ['config', 'player', 'rules', 'days']) require(`../js/${f}.js`);
const V = globalThis.VIAGGIO;
let tot = 0;
V.GIORNI.forEach((g, i) => {
  const err = V.validaGiorno(g, i + 1);
  tot += err.length;
  console.log(`Giorno ${i + 1} (${g.bioma}): ${err.length ? err.length + ' problemi' : 'ok'}`);
  err.forEach(e => console.log('  - ' + e));
});
process.exit(tot ? 1 : 0);
```

- [ ] **Step 5: Esegui test e check**

Run: `node --test "viaggio/tests/*.test.js"` poi `node viaggio/tools/check-days.js`
Expected: test tutti PASS; check stampa 6 righe "ok". Se un giorno ha errori, sposta i `t` degli eventi indicati (non cambiare le regole).

- [ ] **Step 6: Commit**

```bash
git add viaggio/js/days.js viaggio/tools/check-days.js viaggio/tests/giorni.test.js
git commit -m "Viaggio: dati dei sei giorni e controllo di giocabilità"
```

### Task C4: Il mondo (percorso, entità, collisioni, azioni)

**Files:**
- Create: `viaggio/js/world.js`
- Test: `viaggio/tests/mondo.test.js`

Interfaccia:
- `V.creaMondo(giorno, n, rng)` → `{ n, giorno, velocita, lunghezza, dist, entita[], ombrello, finito, icona }`. Ogni entità: `{ ev, tipo, nome, d, y, w, h, x, preso, stato, tAmico }`, dove `d = ev.t * velocita` e ogni frame `x = PX + d - dist`.
- `V.aggiornaMondo(m, p, dt, avvisa)`; `avvisa(nome, dati)` con nome in `colpo | caduta | ricarica | ricordo | ombrello | fine`.
- `V.azioneMondo(m, p, avvisa)` → `true` se ha fatto qualcosa.

- [ ] **Step 1: Scrivi il test che fallisce `viaggio/tests/mondo.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
for (const f of ['config', 'player', 'rules', 'world']) require(`../js/${f}.js`);
const V = globalThis.VIAGGIO;
const fisso = () => 0.5; // rng che non sposta nulla
const giorno = eventi => ({ bioma: 'campi', durata: 10, diario: 'x', eventi });

function gioca(g, { saltaA, tenuto = Infinity, azioneA } = {}) {
  const m = V.creaMondo(g, 6, fisso), p = V.creaGiocatrice(), log = [];
  const avvisa = (n, d) => log.push(n);
  for (let t = 0; t < g.durata + 1; t += 1 / 60) {
    if (saltaA !== undefined && Math.abs(t - saltaA) < 1 / 120) V.premiSalto(p);
    if (p.tenendo && t - saltaA >= tenuto) V.rilasciaSalto(p);
    if (azioneA !== undefined && Math.abs(t - azioneA) < 1 / 120) V.azioneMondo(m, p, avvisa);
    V.aggiornaGiocatrice(p, 1 / 60); V.aggiornaMondo(m, p, 1 / 60, avvisa);
  }
  return { m, p, log };
}

test('senza saltare la gallina la colpisce', () => {
  assert.ok(gioca(giorno([{ t: 2, tipo: 'ostacolo', nome: 'gallina' }])).log.includes('colpo'));
});
test('saltando in tempo non la colpisce', () => {
  assert.ok(!gioca(giorno([{ t: 2, tipo: 'ostacolo', nome: 'gallina' }]), { saltaA: 1.75 }).log.includes('colpo'));
});
test('ricordo in alto solo saltando', () => {
  const g = giorno([{ t: 2, tipo: 'ricordo', nome: 'telo', y: 46 }]);
  assert.ok(!gioca(g).log.includes('ricordo'));
  assert.ok(gioca(g, { saltaA: 1.7 }).log.includes('ricordo'));
});
test('cade nel crepaccio se non salta, e lo supera saltando', () => {
  const g = giorno([{ t: 2, tipo: 'buco', larghezza: 80 }]);
  assert.ok(gioca(g).log.includes('caduta'));
  assert.ok(!gioca(g, { saltaA: 1.85 }).log.includes('caduta'));
});
test('accarezzare il cane: niente colpo, ricarica', () => {
  const r = gioca(giorno([{ t: 2, tipo: 'interattivo', nome: 'cane' }]), { azioneA: 1.8 });
  assert.ok(!r.log.includes('colpo')); assert.ok(r.log.includes('ricarica'));
});
test('ombrello protegge dai fulmini', () => {
  const g = giorno([{ t: 1, tipo: 'interattivo', nome: 'ombrello' }, { t: 4, tipo: 'fulmine', nome: 'fulmine' }]);
  assert.ok(gioca(g).log.includes('colpo'));
  assert.ok(!gioca(g, { azioneA: 0.85 }).log.includes('colpo'));
});
test('panchina: pisolino e ricarica', () => {
  const r = gioca(giorno([{ t: 2, tipo: 'ricarica', nome: 'panchina' }]));
  assert.ok(r.log.includes('ricarica'));
});
test('fine del giorno avvisata una volta', () => {
  const r = gioca(giorno([]));
  assert.strictEqual(r.log.filter(n => n === 'fine').length, 1);
  assert.strictEqual(r.m.finito, true);
});
test('il fango rallenta', () => {
  const g = giorno([{ t: 0, tipo: 'fango', larghezza: 2000 }]);
  const m = V.creaMondo(g, 1, fisso), p = V.creaGiocatrice();
  V.aggiornaMondo(m, p, 1, () => {});
  assert.ok(m.dist < V.velocitaGiorno(1) * 0.7);
});
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `node --test "viaggio/tests/*.test.js"`
Expected: FAIL (`V.creaMondo is not a function`)

- [ ] **Step 3: Scrivi `world.js`**

```js
(function (V) {
  V.creaMondo = (giorno, n, rng = Math.random) => {
    const velocita = V.velocitaGiorno(n);
    const entita = V.applicaVariazione(giorno, n, rng).map(ev => {
      const box = V.ENTITA[ev.nome] || { w: 0, h: 0 };
      return { ev, tipo: ev.tipo, nome: ev.nome, d: ev.t * velocita, y: ev.y || 0,
        w: ev.larghezza || box.w, h: box.h, x: 0, preso: false, stato: null, tAmico: 0 };
    });
    return { n, giorno, velocita, lunghezza: giorno.durata * velocita, dist: 0, entita,
      ombrello: 0, finito: false, icona: null };
  };

  const centro = () => V.PX + V.GIOCATRICE.w / 2;
  const dentro = (e, x) => e.x < x && x < e.x + e.w;

  V.aggiornaMondo = (m, p, dt, avvisa) => {
    if (m.finito) return;
    const ferma = p.anim === 'stanca' || p.anim === 'pisolino';
    for (const e of m.entita) if (e.stato !== 'amico') e.x = V.PX + e.d - m.dist;
    const suFango = m.entita.some(e => e.tipo === 'fango' && dentro(e, centro()));
    m.dist += ferma ? 0 : m.velocita * (suFango ? V.FANGO : 1) * dt;
    m.ombrello = Math.max(0, m.ombrello - dt);
    const hb = V.hitboxGiocatrice(p);
    m.icona = null;

    for (const e of m.entita) {
      e.x = V.PX + e.d - m.dist;
      if (e.stato === 'amico') { e.tAmico += dt; e.x = V.PX - 26 - Math.max(0, e.tAmico - 4) * 60; continue; }
      if (e.preso || e.x > V.W + 80 || e.x + e.w < -80) continue;
      const box = { x: e.x, y: e.y, w: e.w, h: e.h };

      if (e.tipo === 'interattivo' && !e.preso) {
        const davanti = e.x - (V.PX + V.GIOCATRICE.w);
        if (!m.icona && davanti > -e.w && davanti < V.FINESTRA_AZIONE) m.icona = e;
      }
      if (e.tipo === 'buco') {
        if (p.aTerra && dentro(e, centro())) {
          m.dist += e.x + e.w - centro() + 4;
          V.colpisci(p); avvisa('caduta', e);
        }
        continue;
      }
      if (!V.sovrapposti(hb, box)) continue;
      if (e.tipo === 'ostacolo' || e.tipo === 'fulmine' || (e.tipo === 'interattivo' && e.nome === 'cane')) {
        if (e.tipo === 'fulmine' && m.ombrello > 0) continue;
        if (!e.stato && V.colpisci(p)) { e.stato = 'colpito'; avvisa('colpo', e); }
      } else if (e.tipo === 'ricarica') {
        e.preso = true;
        if (e.nome === 'panchina') V.posa(p, 'pisolino', 2);
        avvisa('ricarica', { nome: e.nome, valore: V.RICARICHE[e.nome] });
      } else if (e.tipo === 'ricordo') {
        e.preso = true; avvisa('ricordo', e.nome);
      }
    }
    if (m.dist >= m.lunghezza) { m.finito = true; avvisa('fine'); }
  };

  V.azioneMondo = (m, p, avvisa) => {
    const e = m.icona;
    if (!e) return false;
    if (e.nome === 'cane') { e.stato = 'amico'; e.preso = true; avvisa('ricarica', { nome: 'cane', valore: V.RICARICHE.cane }); }
    if (e.nome === 'ombrello') { e.preso = true; m.ombrello = V.OMBRELLO; avvisa('ombrello'); }
    m.icona = null;
    return true;
  };
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
```

- [ ] **Step 4: Esegui i test**

Run: `node --test "viaggio/tests/*.test.js"`
Expected: tutti PASS. Se "saltando in tempo" o il crepaccio falliscono per il tempismo, aggiusta il secondo `saltaA` del test (dipende da hitbox e velocità), non la logica: la giocabilità è già garantita da `validaGiorno`.

- [ ] **Step 5: Commit**

```bash
git add viaggio/js/world.js viaggio/tests/mondo.test.js
git commit -m "Viaggio: mondo con entità, collisioni e azioni contestuali"
```

### Task C5: Pagina, disegno con segnaposto, motore e input

**Files:**
- Create: `viaggio/index.html`
- Create: `viaggio/js/render.js`
- Create: `viaggio/js/engine.js`
- Create: `viaggio/assets/manifest.json` (vuoto per ora: `{"sprites":{},"sfondi":{},"illustrazioni":{}}`)

Nota: il server di preview `sito-meme` (porta 8777, in `.claude/launch.json`) serve già tutta la cartella del sito.

Questa parte si verifica nel browser, non con test Node.

- [ ] **Step 1: `index.html`**

Struttura (stile coerente con `anime-runner/index.html`: stesso meta viewport, `touch-action:none`, `user-select:none`, `noindex`):
- `<canvas id="gioco" width="384" height="216">` con `image-rendering: pixelated`, centrato, scalato da JS.
- Schermate `<section class="schermo">` sopra il canvas: `#titolo` (titolo "Un viaggio inaspettato", bottone `#bInizia`, bottone musica `#bMusica`), `#intro` (illustrazione + testo a macchina, tocca per saltare), `#falo` (illustrazione + riga di diario), `#stanca` ("Basta, mi siedo"), `#finale` (illustrazione divano, riepilogo, frase finale, `#bRigioca`), `#ruota` ("Gira il telefono" con icona), `#pausa` ("Tocca per continuare").
- Font: monospace in grassetto con ombra pixel (`text-shadow: 2px 2px 0 #000`), nessun font esterno.
- Script in ordine: `js/config.js, js/player.js, js/rules.js, js/days.js, js/world.js, js/render.js, js/audio.js, js/engine.js`.

- [ ] **Step 2: `render.js`**

Interfaccia:
- `V.caricaGrafica()` → Promise: legge `assets/manifest.json`, carica le immagini; ogni immagine mancante resta `null` (nessun errore).
- `V.disegna(ctx, stato)` dove `stato = { m, p, relax, stats, n, tempo }`.

Comportamento:
- Sfondi: 3 strati per bioma da `manifest.sfondi[bioma]` (`lontano`, `medio`, `vicino`), scorrimento a 0.2 / 0.5 / 1.0 × `m.dist`, ripetuti in orizzontale. Segnaposto se mancano: cielo a gradiente + 2 bande di colliline del colore del bioma (palette segnaposto in una tabella `COLORI` per bioma).
- Terreno: banda da `V.SUOLO` a `V.H`; i `buco` sono rettangoli neri nel terreno; il `fango` è una banda marrone.
- Entità: sprite `manifest.sprites[nome]` posato col bordo inferiore a `V.SUOLO - e.y` e centrato sulla hitbox; segnaposto = rettangolo colorato della hitbox (rosso ostacoli, verde ricariche, giallo ricordi, azzurro interattivi, grigio decori) + iniziale del nome. Il `decoro` cartello mostra `ev.testo` in font 6px.
- Fulmine: 1 s prima che arrivi davanti a lei (`e.x - V.PX < m.velocita`) disegna l'ombra a terra; quando `e.x` è entro 10 px da lei, saetta gialla e flash bianco a schermo intero per 2 frame.
- Giocatrice: frame da `V.frameGiocatrice(p)`, sprite sheet `manifest.sprites.lei` con `anim → riga`, frame larghi `fw`; lampeggia (salta 1 frame su 2) se `p.inv > 0`. Segnaposto: rettangolo 14×40 a righe bianche/nere. Con `m.ombrello > 0`, ombrello sopra la testa.
- Icona azione: se `m.icona`, fumetto sopra di lei con l'icona (`mano` per cane, `ombrello`) che pulsa.
- Ciclo giorno/notte: `f = m.dist / m.lunghezza`; overlay a schermo intero con `globalCompositeOperation = 'multiply'`: f 0-0.15 arancio alba, 0.15-0.6 nessuno, 0.6-0.8 arancio tramonto, 0.8-1 blu notte (`#3a4a8a`). Giorno 5: overlay grigio scuro fisso + pioggia (60 linee oblique che cadono) + lampi casuali ogni 4-7 s.
- HUD: barra Relax in alto a sinistra (64×6, verde → giallo → rosso, scritta "RELAX"), "Giorno N" in alto al centro, ricordi del giorno "◆ k/3" in alto a destra.
- Testi in pixel: font canvas `bold 8px monospace` con ombra di 1 px.

- [ ] **Step 3: `engine.js`**

Stato: `{ fase, n, m, p, relax, stats, statsInizio, musica }`; `fase` in `titolo | intro | gioco | stanca | falo | finale | pausa`.

- Loop: `requestAnimationFrame`, accumulatore a passo fisso `1/60` (massimo 5 passi per frame), poi `V.disegna`.
- Scala: a `resize`, `scala = max(1, floor(min(innerWidth/384, innerHeight/216)))`; se la scala intera lascia più del 30% vuoto, usa scala frazionaria (meglio pixel leggermente non uniformi che gioco minuscolo). Canvas centrato su sfondo nero.
- `iniziaGiorno(n)`: `m = V.creaMondo(V.GIORNI[n-1], n)`, `p = V.creaGiocatrice()`, `relax = 100`, `statsInizio = V.copiaStats(stats)`, `fase = 'gioco'`.
- Callback `avvisa`: `colpo`/`caduta` → `relax -= 20`, `stats.ostacoliPresi++`, suono `colpo`; `ricarica` → `relax = min(100, relax + valore)`, suono `ricarica`; `ricordo` → `stats.ricordi.push(nome)`, suono `ricordo`; `ombrello` → suono; `fine` → posa bacino 1.2 s, poi `fase = 'falo'` (giorni 1-5) o `finale` (giorno 6).
- In `gioco`: `relax -= 0.5*dt` se lei cammina; a `relax <= 0`: `V.posa(p, 'stanca', 2.5)`, `fase = 'stanca'`, dopo 2.5 s `stats = V.copiaStats(statsInizio)` e `iniziaGiorno(n)`.
- Input: `pointerdown` sul canvas o su `body` durante il gioco: `clientX < innerWidth/2` → `V.premiSalto` (+ suono `salto` se ha saltato), altrimenti `V.azioneMondo`; `pointerup`/`pointercancel` dello stesso pointer che ha iniziato il salto → `V.rilasciaSalto`. Tastiera: `Space`/`ArrowUp` keydown/keyup = salto, `Enter` = azione. `preventDefault` sui tasti usati.
- Orientamento: `matchMedia('(orientation: portrait)')` → mostra `#ruota` e mette in pausa; al ritorno in orizzontale va in `pausa` (tocca per continuare).
- `#bInizia`: sblocca audio (`V.audio.sblocca()`), prova `document.documentElement.requestFullscreen()` e `screen.orientation.lock('landscape')` in try/catch (sono Promise: `.catch(() => {})`), poi `intro`.
- `visibilitychange` hidden → `pausa`.
- Musica on/off salvata in `localStorage` chiave `viaggio-musica` con try/catch.
- Scorciatoie: `#giorno1`…`#giorno6` → salta titolo e intro, `iniziaGiorno(n)` (l'audio parte al primo tocco); `#falo3` → schermata falò del giorno 3; `#finale` → finale con statistiche finte (`ostacoliPresi: 7`, 12 ricordi).
- Falò: mostra `#falo` con l'illustrazione (o segnaposto: fuoco disegnato con 3 triangoli arancioni) e il diario `V.GIORNI[n-1].diario` scritto a macchina (40 ms per carattere); tocco = completa il testo, secondo tocco = `iniziaGiorno(n+1)`. Avanza da solo 3 s dopo il testo completo.
- Posa bacino: a fine di ogni giorno, prima del falò, `V.posa(p, 'bacino', 1.2)` con suono `bacino` (il mondo è già fermo perché `m.finito`). Nella schermata titolo e nel finale lo sprite di lei fa il bacino in loop (piccolo canvas dentro la schermata).
- Finale: `#finale` con giorni 6/6, ostacoli presi, ricordi `stats.ricordi.length`/18, `V.FRASE_FINALE`; `#bRigioca` → `stats = V.nuoveStats()`, `iniziaGiorno(1)`.

- [ ] **Step 4: Verifica nel browser**

Avvia il preview `sito-meme` (porta 8777) e apri `http://localhost:8777/viaggio/#giorno1`. Imposta il viewport 844×390.
Controlla:
- canvas centrato e nitido, segnaposto visibili, HUD leggibile
- tocco a sinistra salta, tenere premuto salta più in alto
- la gallina colpita toglie Relax e lei lampeggia
- console senza errori

Poi `#giorno4` (crepacci), `#giorno5` (pioggia, ombrello, fulmini) e `#finale`. Con viewport 390×844 deve comparire "Gira il telefono".

- [ ] **Step 5: Commit**

```bash
git add viaggio/index.html viaggio/js/render.js viaggio/js/engine.js viaggio/assets/manifest.json
git commit -m "Viaggio: pagina, disegno con segnaposto, motore e controlli"
```

### Task C6: Audio

**Files:**
- Create: `viaggio/js/audio.js`

- [ ] **Step 1: Scrivi `audio.js`**

`V.audio = { sblocca(), suona(nome), musica(on) }`:
- `sblocca()`: crea `AudioContext` (o `webkitAudioContext`) e chiama `resume()`; in try/catch, se fallisce `ac = null` e tutte le funzioni diventano no-op.
- `suona(nome)`: onde quadre con inviluppo breve: `salto` (sweep 300→600 Hz, 0.12 s), `colpo` (rumore + 150→60 Hz, 0.2 s), `ricarica` (due note 660, 880), `ricordo` (arpeggio 523-659-784-1047), `ombrello` (880 triangolo), `caduta` (sweep 600→100, 0.4 s), `stanca` (sbuffo: rumore filtrato 0.4 s), `bacino` (smack: rumore brevissimo + 1200 Hz).
- `musica(on)`: loop chiptune di 8 battute a 110 BPM con melodia (quadra 25%) e basso (triangolo), schedulato 0.5 s in anticipo con `setInterval` a 100 ms; volume master 0.15. Tema diverso al falò (più lento) se semplice da aggiungere, altrimenti stesso tema.

- [ ] **Step 2: Verifica nel browser**

Apri `#giorno1` e tocca per partire. Devono suonare salto, colpo e ricarica, e la musica deve andare in loop. Il pulsante musica on/off deve funzionare e ricordarsi la scelta dopo il ricaricamento. Nessun errore in console.

- [ ] **Step 3: Commit**

```bash
git add viaggio/js/audio.js
git commit -m "Viaggio: effetti 8-bit e musica chiptune"
```

---

## Chunk 2: Binario grafica e unione

Regole ComfyUI dell'utente (memoria del progetto ComfyUI, vincolanti):
- **Solo quanto richiesto**: nessun nodo o passaggio extra; nessun filtro né termine di contenuto nei negativi (solo qualità).
- **Output dedicato**: ogni SaveImage salva in `output\<Nome workflow>\`. Prefissi: `Pixel Retro/<nome>` per i grafi pixel, `Viaggio Personaggio/<nome>` per Qwen Edit e Wan.
- **AMD** RX 7900 XTX 24 GB, ROCm: niente dipendenze solo-CUDA, niente `pip install` dei requirements dei nodi.
- **Server di test separato su porta 8189** con gli stessi argomenti del Desktop, fermato a fine lavoro. Configurazione `comfy-test` in `.claude/launch.json`, avvio con `preview_start`. Gli script usano `COMFY_URL` (default `http://127.0.0.1:8189`).
- Gotcha AMD: la 2ª generazione con lo stesso modello residente è 10-20× più lenta. Chiamare `comfy.libera()` (`POST /free {"unload_models": true, "free_memory": true}`) tra un asset e l'altro e misurare i tempi della prima prova.

Cartelle:
- modelli: `C:/Users/piera/Documents/ComfyUI/models/`
- input: `C:/Users/piera/Documents/ComfyUI/input/`
- output: `C:/Users/piera/Documents/ComfyUI/output/`
- workflow UI: `C:/Users/piera/ComfyUI-Installs/Main Install/ComfyUI/user/default/workflows/`
- Python di ComfyUI: `C:/Users/piera/ComfyUI-Installs/Main Install/ComfyUI/.venv/Scripts/python.exe`

### Task G1: Preparazione (foto, gitignore, LoRA)

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Copia le foto fuori dal repo**

Copia le 4 foto caricate dall'utente (in `C:/Users/piera/.claude/uploads/7799389c-6aa1-439e-b7d8-89e54fbe6c80/`) in `C:/Users/piera/Documents/ComfyUI/input/viaggio/` come `lei1.jpg`, `lei2.jpg`, `lei3.jpg`, `lei4.jpg`. Lo screenshot Instagram (`d2b66e9c-image.jpg`) va ritagliato alla sola figura (box circa x 230-720, y 740-1420), così il nome utente e gli altri account non entrano nel processo.

- [ ] **Step 2: Gitignore**

Aggiungi a `.gitignore`:

```
viaggio/tools/_raw/
__pycache__/
```

- [ ] **Step 3: LoRA pixel-art-xl (CHIEDI CONFERMA)**

Leggi dimensione e nome del file da `https://huggingface.co/api/models/nerijs/pixel-art-xl/tree/main`. Chiedi all'utente: "Scarico `pixel-art-xl.safetensors` (X MB) da huggingface.co/nerijs/pixel-art-xl in `models/loras/`?" Solo dopo il sì:

```bash
curl -L -o "C:/Users/piera/Documents/ComfyUI/models/loras/pixel-art-xl.safetensors" "https://huggingface.co/nerijs/pixel-art-xl/resolve/main/pixel-art-xl.safetensors"
```

Verifica che la dimensione corrisponda e che `curl -s http://127.0.0.1:8189/object_info/LoraLoader` (server di test, avviato dopo il download) elenchi `pixel-art-xl.safetensors`. Per l'app Desktop dell'utente basta premere R nell'interfaccia.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "Viaggio: ignora i file grezzi di generazione"
```

### Task G2: Post-produzione `pixelize.py` (TDD)

**Files:**
- Create: `viaggio/tools/pixelize.py`
- Test: `viaggio/tools/test_pixelize.py`

Funzioni:
- `soglia_alpha(img, soglia=128)`: RGBA, alpha a 0 o 255.
- `pixellizza(img, altezza)`: ritaglia al bounding box opaco, ridimensiona con `NEAREST` all'altezza data mantenendo le proporzioni (per sfondi usa `dimensioni=(w,h)`).
- `estrai_palette(immagini, n)`: palette comune da più immagini. Concatena i pixel opachi in un'immagine RGB, `quantize(n, method=Image.MEDIANCUT)`, poi `getcolors()` sull'immagine quantizzata riconvertita in RGB. Restituisce una **lista di tuple `(r,g,b)`**, lunghezza ≤ n.
- `applica_palette(img, palette)`: ogni pixel opaco al colore più vicino della palette (distanza RGB), senza dithering.
- `contorno(img, colore=(24,16,24))`: pixel trasparenti confinanti (4-vicini) con un pixel opaco diventano `colore`.
- `ripetibile(img, banda=48)`: restituisce un'immagine larga `W - banda`, ripetibile in orizzontale. Per `i < banda`: `out[i] = img[W-banda+i]·(1 - i/banda) + img[i]·(i/banda)`; per `i ≥ banda`: `out[i] = img[i]`. Così `out[0] = img[W-banda]`, che continua naturalmente dopo `out[W-banda-1] = img[W-banda-1]`. Stesso modo dell'input (RGB resta RGB); la riquantizzazione la fa il chiamante. Per questo gli sfondi si ridimensionano a `larghezza + banda` prima di chiamarla.
- `monta_sheet(righe: dict[str, list[Image]])`: un'unica immagine con una riga per animazione, celle tutte della stessa misura (max w, max h), personaggio allineato in basso al centro. Restituisce `(sheet, meta)`, con `meta = {"fw":..., "fh":..., "righe": {"cammina": [riga, nframe], ...}}`.
- CLI: `python -I viaggio/tools/pixelize.py sprite --in DIR --out FILE --altezza 48 --colori 24 [--contorno]`, `... sheet --in DIR --out FILE --altezza 48 --colori 24` (le sottocartelle di DIR sono le animazioni, i file in ordine alfabetico sono i frame), `... sfondo --in FILE --out FILE --larghezza 768 --altezza 216 --colori 32 [--banda 48]` (ridimensiona nearest a `larghezza+banda`×`altezza`, `ripetibile`, poi palette).

- [ ] **Step 1: Scrivi i test `viaggio/tools/test_pixelize.py`** (unittest, immagini sintetiche)

```python
import unittest
from PIL import Image
import pixelize as px

class T(unittest.TestCase):
    def test_soglia_alpha(self):
        im = Image.new("RGBA", (2, 1)); im.putpixel((0, 0), (255, 0, 0, 100)); im.putpixel((1, 0), (0, 255, 0, 200))
        out = px.soglia_alpha(im)
        self.assertEqual(out.getpixel((0, 0))[3], 0); self.assertEqual(out.getpixel((1, 0))[3], 255)

    def test_pixellizza_altezza_e_crop(self):
        im = Image.new("RGBA", (400, 400)); im.paste((255, 0, 0, 255), (100, 0, 300, 400))
        out = px.pixellizza(im, 48)
        self.assertEqual(out.height, 48); self.assertEqual(out.width, 24)

    def test_palette_comune(self):
        a = Image.new("RGBA", (4, 4), (250, 10, 10, 255)); b = Image.new("RGBA", (4, 4), (10, 10, 250, 255))
        pal = px.estrai_palette([a, b], 2)
        self.assertEqual(len(pal), 2)
        out = px.applica_palette(Image.new("RGBA", (1, 1), (240, 20, 20, 255)), pal)
        self.assertIn(out.getpixel((0, 0))[:3], pal)

    def test_contorno(self):
        im = Image.new("RGBA", (3, 3), (0, 0, 0, 0)); im.putpixel((1, 1), (255, 255, 255, 255))
        out = px.contorno(im)
        self.assertEqual(out.getpixel((0, 1)), (24, 16, 24, 255)); self.assertEqual(out.getpixel((0, 0))[3], 0)

    def test_ripetibile_giunzione(self):
        im = Image.new("RGB", (100, 1))
        for x in range(100): im.putpixel((x, 0), (x * 2, 255 - x * 2, 0))   # gradiente
        out = px.ripetibile(im, banda=20)
        self.assertEqual(out.size, (80, 1))
        self.assertEqual(out.getpixel((0, 0)), im.getpixel((80, 0)))      # riparte da dove finirebbe
        self.assertEqual(out.getpixel((79, 0)), im.getpixel((79, 0)))
        self.assertEqual(out.getpixel((50, 0)), im.getpixel((50, 0)))

    def test_sheet(self):
        f = lambda w, h: Image.new("RGBA", (w, h), (255, 0, 0, 255))
        sheet, meta = px.monta_sheet({"cammina": [f(20, 40), f(22, 40)], "salto": [f(24, 44)]})
        self.assertEqual((meta["fw"], meta["fh"]), (24, 44))
        self.assertEqual(meta["righe"], {"cammina": [0, 2], "salto": [1, 1]})
        self.assertEqual(sheet.size, (48, 88))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `cd viaggio/tools && python -m unittest test_pixelize -v`
Expected: FAIL (`No module named 'pixelize'`)

- [ ] **Step 3: Implementa `pixelize.py`** con le funzioni sopra (Pillow, `argparse` per la CLI). Note: in `ripetibile` l'ultima colonna deve risultare uguale alla prima (dissolvenza lineare da 0 a 1 sulle ultime `banda` colonne verso il contenuto delle prime `banda` colonne); in `applica_palette` lascia invariati i pixel trasparenti.

- [ ] **Step 4: Esegui i test**

Run: `cd viaggio/tools && python -m unittest test_pixelize -v`
Expected: 6 OK.

- [ ] **Step 5: Commit**

```bash
git add viaggio/tools/pixelize.py viaggio/tools/test_pixelize.py
git commit -m "Viaggio: post-produzione pixel e sprite sheet"
```

### Task G3: Client ComfyUI e grafi

**Files:**
- Create: `viaggio/tools/comfy/comfy.py`
- Create: `viaggio/tools/comfy/grafi.py`

- [ ] **Step 1: Leggi le firme reali dei nodi**

```bash
for n in CheckpointLoaderSimple LoraLoader KSampler ImageScale ImageQuantize LoadBackgroundRemovalModel RemoveBackground LoadImage VAEEncode SaveImage TextEncodeQwenImageEditPlus ModelSamplingAuraFlow CFGNorm UNETLoader CLIPLoader LoraLoaderModelOnly WanImageToVideo; do curl -s "http://127.0.0.1:8189/object_info/$n" > "$TEMP/obj_$n.json"; done
```

Usa questi file per i nomi esatti degli input (specie `RemoveBackground`, `TextEncodeQwenImageEditPlus`, `WanImageToVideo`). Per Qwen Edit copia la catena del workflow utente "Character Sheet Lustify" (`/api/userdata/workflows%2FCharacter%20Sheet%20Lustify.json`: UNETLoader `qwen_image_edit_2511_int8_convrot`, CLIPLoader `qwen_2.5_vl_7b_fp8_scaled`, VAE `qwen_image_vae`, LoRA Lightning 4 step, ModelSamplingAuraFlow, CFGNorm). Per Wan 2.2 i2v copia la catena del template ufficiale `video_wan2_2_14B_i2v` (high/low noise fp8 + LoRA lightx2v 4 step, VAE `wan_2.1_vae`, text encoder `umt5_xxl_fp8_e4m3fn_scaled`).

- [ ] **Step 2: Scrivi `comfy.py`** (solo libreria standard)

```python
"""Client minimo per l'API di ComfyUI locale."""
import json, time, uuid, urllib.request, urllib.parse
from pathlib import Path

import os
BASE = os.environ.get("COMFY_URL", "http://127.0.0.1:8189")

def _get(path):
    with urllib.request.urlopen(BASE + path, timeout=60) as r:
        return r.read()

def _post(path, data):
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def carica(percorso, sottocartella="viaggio"):
    """Carica un'immagine in input/ e restituisce il nome da usare in LoadImage."""
    p = Path(percorso); confine = uuid.uuid4().hex
    corpo = b"".join([
        f"--{confine}\r\nContent-Disposition: form-data; name=\"subfolder\"\r\n\r\n{sottocartella}\r\n".encode(),
        f"--{confine}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n".encode(),
        f"--{confine}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{p.name}\"\r\nContent-Type: image/png\r\n\r\n".encode(),
        p.read_bytes(), f"\r\n--{confine}--\r\n".encode()])
    req = urllib.request.Request(BASE + "/upload/image", data=corpo, headers={"Content-Type": f"multipart/form-data; boundary={confine}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        info = json.loads(r.read())
    return f"{info['subfolder']}/{info['name']}" if info.get("subfolder") else info["name"]

def esegui(grafo, attesa_max=1800):
    """Mette in coda il grafo (formato API) e attende; restituisce la lista delle immagini prodotte."""
    pid = _post("/prompt", {"prompt": grafo, "client_id": "viaggio"})["prompt_id"]
    inizio = time.time()
    while time.time() - inizio < attesa_max:
        storia = json.loads(_get(f"/history/{pid}"))
        if pid in storia:
            stato = storia[pid].get("status", {})
            if stato.get("status_str") == "error":
                raise RuntimeError(json.dumps(stato.get("messages", []))[:2000])
            return [img for out in storia[pid]["outputs"].values() for img in out.get("images", [])]
        time.sleep(1.5)
    raise TimeoutError(pid)

def libera():
    """Scarica i modelli dalla VRAM (evita il rallentamento AMD alla 2a generazione)."""
    req = urllib.request.Request(BASE + "/free", data=json.dumps({"unload_models": True, "free_memory": True}).encode(),
                                 headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=60).read()   # risposta vuota: niente json.loads

def scarica(img, cartella):
    q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img["subfolder"], "type": img["type"]})
    dest = Path(cartella) / img["filename"]; dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(_get(f"/view?{q}"))
    return dest
```

- [ ] **Step 3: Scrivi `grafi.py`**

Per la rimozione dello sfondo usa il core `RemoveBackground` se funziona su AMD, altrimenti `easy imageRemBg` (RMBG-1.4, già usato da Character Sheet Lustify).

Funzioni che restituiscono dict in formato API (id nodo stringa → `{"class_type", "inputs"}`), con un piccolo helper `Grafo` che assegna gli id e collega gli output con `[id, indice]`:
- `sprite(prompt, seed, larghezza=1024, altezza=1024, lato_px=48, colori=24, sfondo_via=True, nome="sprite")`: CheckpointLoaderSimple `waiIllustriousSDXL_v170.safetensors` → LoraLoader `pixel-art-xl.safetensors` (forza 1.0/1.0) → CLIPTextEncode positivo `"pixel art, 16-bit sprite, side view, full body, simple white background, " + prompt` e negativo `"blurry, gradient, photo, 3d, text, watermark, multiple characters, cropped"` → EmptyLatentImage → KSampler (28 passi, cfg 6, `euler_ancestral`, `normal`) → VAEDecode → [RemoveBackground] → ImageScale `nearest-exact` a `lato_px` di altezza → ImageQuantize (`colori`, dither `none`) → ImageScale nearest ×8 (anteprima) → SaveImage `Pixel Retro/<nome>`. Salva anche il risultato a piena risoluzione con un secondo SaveImage `Pixel Retro/<nome>_hd` (serve a pixelize.py, che rifà il passaggio in modo deterministico).
- `img2img(immagine, prompt, seed, denoise=0.55, ...)`: come `sprite` ma LoadImage → VAEEncode al posto di EmptyLatentImage.
- `sfondo(prompt, seed, larghezza=1536, altezza=432, colori=32)`: come `sprite` senza rimozione sfondo; positivo `"pixel art, 16-bit game background, side-scrolling parallax layer, wide panorama, " + prompt`; downscale a 768×216.
- `qwen_edit(immagini: list[str], prompt, seed, larghezza=1024, altezza=1024)`: catena Qwen Edit 2511 + Lightning (4 passi, cfg 1) con fino a 3 immagini di riferimento.
- `wan_cammina(immagine, prompt, seed, frame=33)`: Wan 2.2 i2v 14B high+low noise + lightx2v 4 passi, 480×480, SaveImage di tutti i frame (niente video).

- [ ] **Step 4: Prova di fumo**

```bash
cd viaggio/tools/comfy && python -c "import comfy, grafi; imgs = comfy.esegui(grafi.sprite('a yellow rubber duck', 1, lato_px=16, colori=8)); print([comfy.scarica(i, '../_raw/prova') for i in imgs])"
```

Expected: 2 file in `viaggio/tools/_raw/prova/`. Apri l'anteprima ×8 e controlla che sia una paperella pixel su sfondo trasparente. Se un nodo dà errore, correggi gli input usando i file `obj_*.json` dello Step 1.

- [ ] **Step 5: Commit**

```bash
git add viaggio/tools/comfy/comfy.py viaggio/tools/comfy/grafi.py
git commit -m "Viaggio: client ComfyUI e grafi di generazione"
```

### Task G4: Workflow "Pixel Retro" per l'interfaccia di ComfyUI

**Files:**
- Create: `viaggio/tools/comfy/workflow_ui.py` (prepara API + layout)
- Create: `viaggio/tools/comfy/api_to_ui.js` (eseguito nel frontend, sul modello di `custom_nodes/comfyui-genera-3d/tools/api_to_ui.js`)

Stesso approccio già usato per "Genera 3D": la conversione nel formato UI la fa il frontend di ComfyUI.

- [ ] **Step 1: `workflow_ui.py`** unisce i grafi `sprite`, `img2img` e `sfondo` di `grafi.py` in **un unico** grafo API. Checkpoint e LoRA sono condivisi; ogni gruppo ha i suoi prompt e i suoi salvataggi in `Pixel Retro/`. Scrive `pixelretro_tmp/api.json` e `pixelretro_tmp/layout.json` (posizione e gruppo di ogni nodo) con `POST /api/userdata/pixelretro_tmp%2F<file>?overwrite=true`. Il layout è a colonne: x = 340 × profondità del nodo, y in base al gruppo.
- [ ] **Step 2: `api_to_ui.js`** (nel browser integrato su `http://127.0.0.1:8189`, via `javascript_tool`):
  - legge i due file con `fetch('/api/userdata/pixelretro_tmp%2Fapi.json')`;
  - `await app.loadApiJson(api, "Pixel Retro")`;
  - imposta posizione e titolo dei nodi e mette i seed su "randomize";
  - crea tre `LGraphGroup` colorati: "1 · Testo → Sprite", "2 · Immagine → Pixel", "3 · Sfondo panoramico";
  - aggiunge un nodo `Note` con le istruzioni in italiano: cosa fa ogni gruppo, cosa sono `colori` e `lato_px`, che i gruppi non usati si disattivano con Ctrl+B;
  - `app.graph.serialize()` → `POST /api/userdata/workflows%2FPixel%20Retro.json?overwrite=true`.
  La Note è documentazione, non un passaggio del grafo: se l'utente la considera un extra, si toglie.
- [ ] **Step 3: Verifica**: riapri "Pixel Retro" dalla barra dei workflow su 8189 e fai uno screenshot. `graphToPrompt()` deve dare gli stessi nodi e valori di `api.json` (confronto in JS). Poi esegui una volta il gruppo 1 e controlla l'output in `output\Pixel Retro\`.
- [ ] **Step 4: Commit**

```bash
git add viaggio/tools/comfy/workflow_ui.py viaggio/tools/comfy/api_to_ui.js
git commit -m "Viaggio: workflow ComfyUI Pixel Retro"
```

### Task G5: Personaggio (due checkpoint con l'utente)

**Files:**
- Create: `viaggio/tools/comfy/personaggio.py`
- Output: `viaggio/assets/sprites/lei.png`, voce `lei` in `viaggio/assets/manifest.json`

- [ ] **Step 1: Character sheet con Qwen Edit**

`python personaggio.py sheet --seed N --quanti 4` (dalla cartella `viaggio/tools/comfy`): carica `lei1`, `lei3`, `lei4` da `input/viaggio/`, poi `grafi.qwen_edit` con il prompt:

```
Turn the woman from the reference photos into a cute anime-style video game character, full body, side view facing right, walking pose, plain white background. Keep her face recognizable: long dark-brown curly hair pulled back into a curly ponytail, brown eyes, small nose stud piercing, small hoop earrings. Outfit: black and white horizontally striped cropped sweater, light blue jeans, white sneakers. Dark red nail polish. Chibi proportions, 3 heads tall.
```

Genera 4 varianti in `_raw/sheet/`. **CHECKPOINT:** mandale all'utente (`SendUserFile`) e fagli scegliere la più somigliante, o chiedi cosa correggere (capelli, viso, proporzioni) e rigenera.

- [ ] **Step 2: Camminata con Wan 2.2**

`personaggio.py cammina --base _raw/sheet/<scelta>.png --seed N`: `grafi.wan_cammina` con prompt `"the girl walks in place to the right, side view, steady camera, plain white background, looping walk cycle"`, 33 frame in `_raw/cammina/`. Scegli 6 frame che fanno un ciclo (contatto destro, passaggio, contatto sinistro, passaggio...) confrontando la posizione dei piedi (ispeziona le immagini). Se il viso o i vestiti cambiano tra i frame, passa al piano B: `qwen_edit` dalla base con le pose una per una ("same character, same outfit, walking pose frame k of 6: ...").

- [ ] **Step 3: Pose singole**

`qwen_edit` dalla base, 1-2 frame per posa, in `_raw/<anim>/`:
- `salto` (salita con le ginocchia piegate, discesa con le braccia in alto)
- `colpita` (indietro, occhi a X)
- `stanca` (seduta a terra che sbuffa, 2 frame)
- `pisolino` (sdraiata su un fianco con le "zzz", 2 frame)
- `bacino` (di fronte, boccuccia a bacino e occhiolino, 2 frame)

- [ ] **Step 4: Pixel e sheet**

Rimuovi lo sfondo con lo stesso nodo usato in `grafi.sprite` (grafo dedicato `grafi.rimuovi_sfondo(immagine)` che salva in `Viaggio Personaggio/pulite/`), poi:

```bash
python -I viaggio/tools/pixelize.py sheet --in viaggio/tools/_raw/lei_pulita --out viaggio/assets/sprites/lei.png --altezza 48 --colori 24 --contorno
```

Aggiungi in `manifest.json`: `"lei": {"file": "sprites/lei.png", "fw": .., "fh": .., "righe": {...}}` (dal meta dello sheet).

- [ ] **Step 5: CHECKPOINT animazione**

Apri `http://localhost:8777/viaggio/#giorno1` e fai uno screenshot del gioco; manda anche un ingrandimento ×8 dello sheet. Chiedi l'approvazione all'utente. Correggi i frame che sfarfallano (stessa palette, piedi allineati in basso).

- [ ] **Step 6: Commit** (solo sprite elaborati, mai foto)

```bash
git add viaggio/tools/comfy/personaggio.py viaggio/assets/sprites/lei.png viaggio/assets/manifest.json
git commit -m "Viaggio: sprite animato della protagonista"
```

### Task G6: Sfondi, ostacoli, oggetti, illustrazioni

**Files:**
- Create: `viaggio/tools/comfy/assets.json`
- Create: `viaggio/tools/comfy/genera.py`
- Output: `viaggio/assets/sprites/*.png`, `viaggio/assets/bg/*.png`, `viaggio/assets/illustrazioni/*.png`, `viaggio/assets/manifest.json`

- [ ] **Step 1: `assets.json`**

Una voce per asset: `{"nome", "tipo": "sprite|sfondo|illustrazione", "prompt", "lato_px"|"dimensioni", "colori", "seed"}`.
- Sprite (altezza in px circa = hitbox + 4): gallina, pozzanghera, mucca (sdraiata), trattore, cane, scoiattolo, radice, fungo, capra, sasso, cespuglio, monopattino, piccione, bus, snack (pacchetto di biscotti al cioccolato), grappolo, panchina, fonte (pozza fumante), ombrello, i 6 ricordi, cartello, porta, icona mano, saetta.
- Sfondi: per ogni bioma (campi, vigneti, bosco, montagna, temporale, periferia) 3 strati `lontano` (cielo + profilo lontano, opaco), `medio` e `vicino` (su sfondo da rendere trasparente, solo la metà bassa). Prompt di bioma, per esempio vigneti: `"rolling vineyard hills, rows of grapevines, italian countryside, warm afternoon"`.
- Illustrazioni (384×216, 48 colori): `intro` (lei in accappatoio bianco e cuffia davanti a terme termali con vapore, cartello "Casa →"), `falo` (lei seduta di profilo al falò di notte con le stelle), `divano` (lei sdraiata sul divano a casa, felice, gatto di peluche). Per le illustrazioni con lei usa `qwen_edit` con la base del character sheet come riferimento, poi pixelizza.

- [ ] **Step 2: `genera.py`**

`python genera.py [--solo nome1,nome2] [--tipo sprite]` (dalla cartella `viaggio/tools/comfy`): per ogni voce esegue il grafo giusto, salva in `_raw/<tipo>/<nome>/`, poi chiama `pixelize` (con `ripetibile` per gli strati di sfondo e una palette di bioma condivisa dai 3 strati, estratta prima dal livello `lontano`). Scrive i PNG finali in `viaggio/assets/...` e aggiorna `manifest.json` (`sprites[nome] = {file, w, h}`, `sfondi[bioma] = {lontano, medio, vicino}`, `illustrazioni[nome]`). Rigenerare un solo asset non tocca gli altri.

- [ ] **Step 3: Genera e rivedi a lotti**

Lancia per tipo e manda all'utente un contact sheet per tipo (`pixelize`: tutte le immagini di un tipo affiancate ×4 in un PNG in `_raw/`). Rigenera con un altro seed quelle venute male.

- [ ] **Step 4: Commit**

```bash
git add viaggio/tools/comfy/assets.json viaggio/tools/comfy/genera.py viaggio/assets
git commit -m "Viaggio: sfondi, ostacoli, oggetti e illustrazioni in pixel art"
```

### Task U1: Unione, bilanciamento, privacy, README

**Files:**
- Create: `viaggio/tools/check-privacy.py`
- Modify: `viaggio/js/render.js`, `viaggio/js/config.js` (hitbox, se servono), `README.md`

- [ ] **Step 1: `check-privacy.py`**

Scorre `viaggio/` (escluso `tools/_raw`): errore se trova `.jpg`/`.jpeg`/`.heic`, file immagine più grandi di 300 KB, o PNG/JPEG con dati EXIF. Exit 1 con l'elenco. Run: `python -I viaggio/tools/check-privacy.py` → Expected: `ok`.

- [ ] **Step 2: Grafica nel gioco**

Apri ogni giorno con `#giornoN` e verifica:
- sprite allineati al terreno
- hitbox coerenti con i disegni (eventualmente ritocca `V.ENTITA` e riesegui `node --test "viaggio/tests/*.test.js"` e `node viaggio/tools/check-days.js`)
- parallasse senza giunture visibili
- notte e temporale leggibili

- [ ] **Step 3: Partita completa**

Gioca dal titolo al finale con viewport 844×390. Annota:
- durata reale, attesa tra 7 e 8 minuti
- punti frustranti, da sistemare spostando i `t` in `days.js`
- console senza errori

Controlla anche la verticale ("Gira il telefono") e la pausa cambiando scheda.

- [ ] **Step 4: README**

Aggiungi a `README.md` una sezione "Un viaggio inaspettato (`viaggio/`)": cos'è, comandi, scorciatoie `#giornoN`/`#falo3`/`#finale`, come rigenerare la grafica (workflow "Pixel Retro", `genera.py`, `pixelize.py`) e che le foto originali stanno solo in ComfyUI `input/viaggio/`.

- [ ] **Step 5: Verifica finale e commit**

Run: `node --test "viaggio/tests/*.test.js"` · `node viaggio/tools/check-days.js` · `cd viaggio/tools && python -m unittest test_pixelize` · `python -I viaggio/tools/check-privacy.py`
Expected: tutto verde.

```bash
git add viaggio README.md
git commit -m "Viaggio: grafica integrata, bilanciamento e README"
```
