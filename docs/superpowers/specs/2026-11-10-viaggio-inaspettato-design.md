# Un viaggio inaspettato — design

Sotto-sito in `viaggio/`. Gioco pixel-art per telefono in orizzontale: lei esce
dalle terme Acquardens e torna a casa a piedi attraverso un'odissea inventata
ed esagerata di 6 giorni. Tono misto: si ride dell'impresa assurda, ma con cura
e un finale carino. Una partita dura 7-8 minuti, tutta d'un fiato.

## Vincoli

- Zero dipendenze e niente build: `viaggio/index.html` + script in `viaggio/js/`
  + PNG in `viaggio/assets/`. Funziona su GitHub Pages.
- Pensato per il telefono in orizzontale; giocabile anche da PC (spazio/invio).
- Grafica pixel art generata in locale con ComfyUI, ripulita da uno script.
- Suoni e musica sintetizzati con WebAudio, nessun file audio.
- **Privacy:** le foto originali di lei non entrano nel repo (finisce pubblico).
  Stanno solo in `ComfyUI/input/viaggio/`. Nel repo vanno solo gli sprite pixel
  elaborati.

## Il personaggio

Riconoscibilità affidata a pochi tratti leggibili a 48 px: ricci lunghi castano
scuro raccolti all'indietro, piercing al naso, piccoli cerchi alle orecchie,
tatuaggio girasole sull'avambraccio, unghie bordeaux. **Outfit unico per tutto il
viaggio: maglione a righe bianco/nero + jeans.** L'accappatoio compare solo
nell'illustrazione statica della scena iniziale alle terme.

Posa firma: la **boccuccia a bacino**, usata per vittoria di giornata e finale.

## Struttura della partita

Titolo → intro alle terme → 6 giorni (~60-70 s ciascuno) → finale.
Nessun salvataggio. Se la barra Relax arriva a zero si ripete solo il giorno
corrente (dall'inizio del giorno, con Relax piena). A inizio giorno engine.js
fotografa le statistiche (`ostacoliPresi`, `ricordi`); su un nuovo tentativo le
ripristina, quindi ricordi e colpi del tentativo fallito non contano.

### Schermata titolo

"Un viaggio inaspettato", lei in pixel che fa il bacino, bottone **Inizia**.
Il tocco su Inizia sblocca l'audio e chiede fullscreen + blocco orizzontale
(dove supportato). Icona per musica on/off, ricordata in `localStorage`
(con try/catch).

### Intro (saltabile)

Illustrazione statica: lei in accappatoio esce dalle terme Acquardens, cartello
"Casa →". Testo a macchina da scrivere: "Doveva essere un pomeriggio di relax...".

### I 6 giorni

| Giorno | Bioma | Ostacoli / gag | Novità introdotta |
|---|---|---|---|
| 1 | Uscita dalle terme, campi | pozzanghere, galline, mucca sdraiata | salto |
| 2 | Vigneti / collina | trattore, cane che abbaia, grappoli (snack) | azione: accarezzare il cane |
| 3 | Bosco | radici, scoiattolo ruba-snack, funghi | il giorno arriva alla notte |
| 4 | Montagna | capre, sassi che rotolano, crepacci, cespugli spinti dal vento | salto lungo (crepacci larghi: serve tenere premuto) |
| 5 | Temporale | fulmini annunciati (ombra a terra), fango, ombrello da raccogliere | schermo scuro, pioggia, lampi |

Il terreno è sempre piatto (nessuna pendenza): la montagna si vede negli sfondi.
I crepacci sono buchi nel terreno: caderci = -20 Relax e lei riappare subito dopo
il buco. Il fango rallenta lo scorrimento del 40% finché ci si cammina sopra.
Pioggia e lampi sono solo effetti grafici di world.js (particelle + flash bianco);
il fulmine è un ostacolo: ombra a terra per 1 s, poi colpo in quel punto.
| 6 | Periferia → casa | monopattini, piccioni, bus che non si ferma | la porta di casa in fondo |

Ogni giorno: ciclo alba → giorno → tramonto → notte accelerato, fatto in codice
ricolorando la palette (nessuno sfondo extra). Sui cartelli lungo la strada,
gag ricorrente: "Terme 3 km ←", "Casa ??? km →".

### Comandi

- Tocco sulla **metà sinistra** dello schermo = salto. Tenuto premuto = salto più
  lungo (altezza variabile fino a un massimo, stile platform classico).
- Tocco sulla **metà destra** = azione contestuale, attiva solo quando sopra lei
  compare l'icona (raccogli, accarezza, apri ombrello). Fuori contesto non fa nulla.
- PC: spazio = salto, invio = azione.
- Eventi `pointerdown`/`pointerup` (niente ritardo da click), multi-touch ok.

### Barra Relax (la "vita")

- Parte piena (100) a inizio giorno.
- Cala di 1 ogni 2 s camminando; un ostacolo preso toglie 20 + 1 s di invulnerabilità
  (lei lampeggia, frame "colpita").
- Si ricarica: snack +10, panchina +25 (pisolino automatico di 2 s, scena zzz),
  fonte calda +40 (rara).
- A zero: lei sbuffa e si siede (frame "stanca"), scritta "Basta, mi siedo",
  poi si ripete il giorno.

### Azioni contestuali

- Accarezzare il cane (giorno 2): il cane smette di abbaiare e la segue per qualche
  secondo, +10 Relax. Se non lo accarezzi il cane è un ostacolo normale.
- Raccogliere l'ombrello (giorno 5): per 8 s i fulmini non la colpiscono.
- Raccogliere un ricordo (vedi sotto).

### Ricordi delle terme

3 per giorno, 18 in tutto. Sono 6 tipi di oggetto (paperella, cuffia,
accappatoio, ciabatta, telo, braccialetto spa) riusati: 6 sprite, 18 posizioni.
Messi in punti un po' scomodi da raggiungere (in alto, sopra un crepaccio). Facoltativi: servono solo al
riepilogo finale.

### Fine giornata: il falò (saltabile)

Lei seduta al falò di notte, 4-5 s, una riga di diario scritta a macchina:

1. "Giorno 1: le galline mi guardano male. Mi manca l'idromassaggio."
2. "Giorno 2: un cane mi ha adottata. Il trattore no."
3. "Giorno 3: uno scoiattolo mi ha rubato i biscotti. Lo perdono. Forse."
4. "Giorno 4: le capre vanno in montagna per scelta. Io no."
5. "Giorno 5: ho visto un fulmine da vicino. Ora ho i ricci elettrici."
6. "Giorno 6: vedo casa. Non ci credo."

### Finale

Lei apre la porta, crolla sul divano, zzz. Schermata **"Casa dolce casa"** con il
riepilogo: giorni 6/6, ostacoli presi, ricordi trovati N/18, poi lei che fa il
bacino e la frase finale: "Bentornata a casa! La prossima volta: terme sotto
casa." (modificabile in `days.js`). Bottone "Rigioca".

## Grafica

- Canvas logico **384×216** (16:9), scalato a multipli interi con
  `image-rendering: pixelated`; bande nere se lo schermo non è 16:9.
- Lei alta ~48 px, proporzioni da 3 teste. Ostacoli 16-48 px.
- Sfondi: 3 strati di parallasse per bioma (cielo/lontano, medio, primo piano),
  ciascuno largo 768×216 e ripetibile in orizzontale.
- Palette ridotta per bioma (~32 colori), lei con palette fissa propria in tutti i
  frame per evitare sfarfallio.

### Elenco asset

| Asset | Quantità |
|---|---|
| Lei: camminata 6, salto 2, colpita 1, stanca 2, pisolino 2, bacino 2 | 15 frame |
| Sfondi: 6 biomi × 3 strati | 18 |
| Ostacoli e animali (gallina, mucca, trattore, cane, scoiattolo, funghi, radici, capra, sasso, fango, monopattino, piccione, bus, pozzanghera) | ~14 |
| Oggetti (snack ×3 tipi, grappolo, ombrello, fonte calda, panchina, 6 ricordi, cartelli) | ~13 |
| Illustrazioni statiche: intro alle terme, falò, divano finale | 3 |
| UI: icone azione, barra Relax, cuore/ricordo | ~6 |

## Pipeline ComfyUI

ComfyUI desktop gira su `127.0.0.1:8188`. Modelli già presenti usati:
WAI Illustrious SDXL v17, Qwen Image Edit 2511 + LoRA Lightning 4 step,
Wan 2.2 i2v + LoRA lightx2v 4 step, ControlNet OpenPose SDXL (piano B).

**Da aggiungere:** LoRA `nerijs/pixel-art-xl` (SDXL) in `models/loras/`.
Download solo dopo conferma esplicita (nome file, fonte, dimensione).

### Workflow "Pixel Retro" (`user/default/workflows/Pixel Retro.json`)

Solo nodi già installati più la LoRA. Tre gruppi attivabili:

1. **Testo → sprite:** WAI Illustrious + pixel-art-xl → RemoveBackground →
   ImageScale *nearest-exact* alla dimensione reale → ImageQuantize (N colori,
   dither off) → upscale ×8 nearest solo per anteprima → salva PNG trasparente.
2. **Immagine → pixel:** stessa catena partendo da un'immagine (img2img,
   denoise regolabile).
3. **Sfondo panoramico:** generazione larga, downscale nearest a 768×216,
   quantize con la palette del bioma.

### Personaggio

1. Qwen Image Edit 2511 dalle foto del viso → character sheet anime a figura
   intera, di profilo, outfit maglione a righe + jeans. **Checkpoint: approvazione
   dell'utente sulla somiglianza prima di proseguire.**
2. Wan 2.2 i2v: lei che cammina di profilo su sfondo neutro, ~2 s → estrazione di
   6 frame per il ciclo di camminata. Pose singole (salto, stanca, bacino...) con
   Qwen Edit dal character sheet. Piano B se Wan non è coerente: OpenPose
   ControlNet frame per frame.
3. Ogni frame → gruppo 2 del workflow con la stessa palette.
   **Checkpoint: approvazione dello sprite animato.**

### Post-produzione: `viaggio/tools/pixelize.py`

Script Python (Pillow) deterministico: allinea alla griglia, soglia alpha netta
(niente semitrasparenze), snap alla palette data, contorno scuro opzionale,
monta gli sprite sheet orizzontali + un JSON con dimensioni/frame. Gira con
`python -I`, legge da una cartella sorgente e scrive in `viaggio/assets/`.

## Struttura del codice

```
viaggio/
  index.html        canvas, overlay "Gira il telefono", schermate titolo/fine
  js/engine.js      loop a passo fisso, scala intera, input touch/tastiera, stati di gioco
  js/player.js      fisica del salto, stati e animazioni di lei, invulnerabilità
  js/days.js        dati dei 6 giorni (bioma, durata, sequenza eventi, diario, frase finale)
  js/world.js       parallasse, ciclo giorno/notte via palette, ostacoli, oggetti, collisioni
  js/audio.js       effetti 8-bit e musica chiptune in WebAudio
  assets/sprites/   sprite sheet + JSON
  assets/bg/        sfondi per bioma
  tools/pixelize.py post-produzione
```

Script classici caricati in ordine (niente moduli né build), un unico oggetto
globale `VIAGGIO` come namespace.

- **engine.js:** possiede lo stato (`titolo`, `intro`, `giorno`, `falò`,
  `finale`, `pausa`), il loop `requestAnimationFrame` con aggiornamento a passo
  fisso 60 Hz, la scala del canvas e l'input. Espone `onTap(lato)`.
- **player.js:** riceve input e tempo, espone posizione, hitbox, frame corrente.
  Non conosce i giorni.
- **days.js:** solo dati. Ogni giorno è
  `{ bioma, durata, eventi: [{ t, tipo, nome, y?, durata? }], diario }`, dove `t`
  è il secondo di comparsa, `y` l'altezza da terra in px (default 0) e `durata`
  vale per crepacci/fango (larghezza in secondi di scorrimento). Valori di `tipo`:
  - `ostacolo` — a terra o in aria, toglie Relax al contatto (`nome`: gallina,
    mucca, capra, sasso, trattore, piccione, monopattino, bus, cespuglio...).
  - `buco` — crepaccio; `fango` — rallenta; `fulmine` — ombra poi colpo.
  - `ricarica` — snack, grappolo, panchina, fonte (`nome` decide quanto Relax).
  - `ricordo` — collezionabile.
  - `interattivo` — cane, ombrello: definisce `icona` e una finestra di 1.5 s
    in cui il tocco destro attiva l'azione; senza azione il cane si comporta da
    `ostacolo`, l'ombrello sparisce.
  - `cartello` — decorativo, con testo.
  La variazione casuale (±0.3 s) è applicata solo se non porta due eventi da
  saltare a meno di `DISTANZA_MIN` (vedi Fisica).
- **Statistiche:** le tiene engine.js (`stats = { ostacoliPresi, ricordi[] }`);
  world.js notifica gli eventi con `engine.evento(nome, dati)`.

### Fisica (valori iniziali, da bilanciare)

Unità in px del canvas logico e secondi.

- Velocità di scorrimento 90 px/s (giorno 1) fino a 120 px/s (giorno 6).
- Gravità 900 px/s²; salto breve (tocco) ~32 px di altezza, salto lungo (tenuto
  ≥ 0.25 s) ~56 px di altezza e ~130 px di lunghezza.
- Crepaccio massimo 90 px (superabile solo col salto lungo dal giorno 4).
- `DISTANZA_MIN` tra due ostacoli da saltare: 110 px.
- Uno script di controllo (`viaggio/tools/check-days.js`, eseguibile con
  `node`) verifica per ogni giorno che spazi e larghezze rispettino questi
  limiti.
- **world.js:** fa scorrere sfondi ed entità secondo i dati del giorno, gestisce
  collisioni (rettangoli) e ricariche; comunica a engine fine giorno o Relax a zero.
- **audio.js:** `suona(nome)`, `musica(on/off)`. L'`AudioContext` si crea e si
  sblocca (`resume()`) al tocco su Inizia, necessario su iPhone. Se WebAudio
  manca o fallisce, le funzioni diventano vuote e il gioco va avanti muto.

### Telefono

- In verticale: overlay "Gira il telefono" e gioco in pausa.
- Al tocco su Inizia: `requestFullscreen` + `screen.orientation.lock('landscape')`
  in try/catch (funziona su Android; su iPhone resta l'overlay).
- `visibilitychange` → pausa automatica; ritorno → schermata "Tocca per continuare".
- Asset non caricati: si usa un rettangolo colorato al posto dello sprite (il
  gioco resta giocabile e si vede subito cosa manca).

### Scorciatoie di test

`viaggio/#giorno1` … `#giorno6`, `#falo3`, `#finale`.

## Verifica

- Browser integrato con viewport telefono orizzontale (844×390) e verticale
  (overlay), console senza errori.
- Partita completa per controllare i tempi (6 giorni in 7-8 min) e che ogni
  sequenza di ostacoli sia superabile.
- Controllo che `viaggio/` non contenga foto originali.

## Ordine di lavoro

Due binari indipendenti; il codice non aspetta la grafica grazie ai segnaposto.

**Grafica**
1. LoRA + workflow "Pixel Retro", test su un oggetto semplice.
2. Personaggio: character sheet → approvazione → animazioni → approvazione.
3. Sfondi, ostacoli, oggetti, illustrazioni.

**Codice**
1. Engine, player, input, orientamento, con segnaposto colorati.
2. days.js + world.js + check-days.js, poi falò, intro, finale, audio.

**Unione**
- Montaggio grafica, bilanciamento, controllo che nel repo non ci siano foto
  originali (nessun file in `viaggio/` più grande di 300 KB né con dati EXIF),
  README.
