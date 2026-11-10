(function (V) {
  // Stati di gioco, loop a passo fisso, input, orientamento, schermate DOM, scorciatoie.
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const DT = 1 / 60;
  const $ = id => document.getElementById(id);
  const SCHERMI = ['titolo', 'intro', 'falo', 'stanca', 'finale', 'pausa'];
  const SOSPENDIBILI = ['gioco', 'stanca', 'intro', 'falo'];
  const TESTO_INTRO = 'Doveva essere un pomeriggio di relax alle terme... ' +
    'Poi l\'ultima corriera è partita senza di me. Casa? Di là. A piedi.';

  const S = { fase: 'titolo', n: 1, m: null, p: null, relax: V.RELAX.max,
    stats: V.nuoveStats(), statsInizio: V.nuoveStats(), musica: true };
  V.stato = S;   // comodo per il debug dalla console

  let ctx = null, tempo = 0, orologio = 0, tFase = 0, tFine = 0;
  let sospesa = null, ruotato = false, audioOk = false, pointerSalto = null;
  let macchina = null;            // testo a macchina: { el, pieno, k, t, completo, tDopo }
  let vetrina = null;             // mondo vuoto che scorre dietro il titolo
  const effetti = [];             // scritte che salgono (+10, -20, ricordi)
  const tele = [];                // canvas delle schermate: { el, ctx, illus }

  /* ---------- schermate ---------- */
  function mostra(nome) { for (const s of SCHERMI) $(s).classList.toggle('on', s === nome); }
  function vai(fase) { S.fase = fase; tFase = 0; mostra(fase); aggiornaMusica(); }

  function scrivi(el, pieno) { el.textContent = ''; macchina = { el, pieno, k: 0, t: 0, completo: false, tDopo: 0 }; }
  function completa() {
    if (!macchina) return;
    macchina.k = macchina.pieno.length; macchina.el.textContent = macchina.pieno; macchina.completo = true;
  }
  function aggiornaMacchina(dt) {
    const mc = macchina;
    if (!mc) return;
    if (mc.completo) { mc.tDopo += dt; return; }
    mc.t += dt;
    const k = Math.min(mc.pieno.length, Math.floor(mc.t / 0.04));
    if (k !== mc.k) { mc.k = k; mc.el.textContent = mc.pieno.slice(0, k); }
    if (k >= mc.pieno.length) mc.completo = true;
  }

  /* ---------- audio ---------- */
  const suona = nome => V.audio && V.audio.suona(nome);
  function sbloccaAudio() {
    if (!V.audio) return;
    V.audio.sblocca();
    if (!audioOk) { audioOk = true; aggiornaMusica(); }
  }
  function aggiornaMusica() {
    if (!audioOk || !V.audio) return;
    const on = S.musica && S.fase !== 'pausa' && !ruotato && !document.hidden;
    V.audio.musica(on, S.fase === 'falo' || S.fase === 'finale' ? 'falo' : 'viaggio');
  }
  function etichettaMusica() { $('bMusica').textContent = '♫ Musica: ' + (S.musica ? 'sì' : 'no'); }

  /* ---------- flusso della partita ---------- */
  function iniziaGiorno(n) {
    S.n = n;
    S.m = V.creaMondo(V.GIORNI[n - 1], n);
    S.p = V.creaGiocatrice();
    S.relax = V.RELAX.max;
    S.statsInizio = V.copiaStats(S.stats);
    tFine = 0; pointerSalto = null; macchina = null; effetti.length = 0;
    vai('gioco');
  }

  function avviaIntro() { vai('intro'); scrivi($('introTesto'), TESTO_INTRO); }

  function apriFalo(n) {
    S.n = n;
    vai('falo');
    $('faloNota').classList.remove('vis');
    scrivi($('faloTesto'), V.GIORNI[n - 1].diario);
  }

  function apriFinale() {
    const r = $('riepilogo');
    r.textContent = '';
    for (const riga of ['Giorni: 6/6', `Ostacoli presi: ${S.stats.ostacoliPresi}`,
      `Ricordi trovati: ${S.stats.ricordi.length}/18`]) {
      const li = document.createElement('li'); li.textContent = riga; r.appendChild(li);
    }
    $('frase').textContent = V.FRASE_FINALE;
    vai('finale');
  }

  function fineGiorno() { if (S.n < V.GIORNI.length) apriFalo(S.n); else apriFinale(); }

  function effetto(testo, colore) {
    effetti.push({ testo, colore, x: V.PX + V.GIOCATRICE.w / 2, y: V.SUOLO - S.p.y - V.GIOCATRICE.h - 10, t: 0 });
  }

  function avvisa(nome, dati) {
    if (nome === 'colpo' || nome === 'caduta') {
      const danno = nome === 'caduta' ? V.RELAX.buco : V.RELAX.colpo;
      S.relax -= danno; S.stats.ostacoliPresi++;
      suona(nome); effetto(`-${danno}`, '#ff6a6a');
    } else if (nome === 'ricarica') {
      S.relax = Math.min(V.RELAX.max, S.relax + dati.valore);
      suona('ricarica'); effetto(`+${dati.valore}`, '#7dff8a');
    } else if (nome === 'ricordo') {
      S.stats.ricordi.push(dati);
      suona('ricordo'); effetto(dati, '#ffe060');
    } else if (nome === 'ombrello') {
      suona('ombrello'); effetto('ombrello!', '#8fd8ff');
    } else if (nome === 'fine') {
      V.posa(S.p, 'bacino', 1.2); suona('bacino'); tFine = 1.2;
    }
  }

  function aggiorna(dt) {
    if (ruotato || S.fase === 'pausa') return;
    tempo += dt; tFase += dt;
    for (let i = effetti.length - 1; i >= 0; i--) if ((effetti[i].t += dt) > 0.9) effetti.splice(i, 1);

    switch (S.fase) {
      case 'gioco': {
        const { m, p } = S;
        V.aggiornaGiocatrice(p, dt);
        if (m.finito) { if ((tFine -= dt) <= 0) fineGiorno(); break; }
        V.aggiornaMondo(m, p, dt, avvisa);
        if (m.finito) break;
        if (p.anim !== 'pisolino' && p.anim !== 'stanca') S.relax -= V.RELAX.caloAlSecondo * dt;
        if (S.relax <= 0) {
          S.relax = 0;
          if (p.tenendo) V.rilasciaSalto(p);
          V.posa(p, 'stanca', 2.5); suona('stanca');
          m.icona = null;
          vai('stanca');
        }
        break;
      }
      case 'stanca':
        V.aggiornaGiocatrice(S.p, dt);
        if (tFase >= 2.5) { S.stats = V.copiaStats(S.statsInizio); iniziaGiorno(S.n); }
        break;
      case 'intro':
        aggiornaMacchina(dt);
        if (macchina && macchina.completo && macchina.tDopo >= 2.5) iniziaGiorno(1);
        break;
      case 'falo':
        aggiornaMacchina(dt);
        if (macchina && macchina.completo) {
          $('faloNota').classList.add('vis');
          if (macchina.tDopo >= 3) iniziaGiorno(S.n + 1);
        }
        break;
      case 'titolo':
        if (vetrina) vetrina.dist += 24 * dt;
        break;
    }
  }

  /* ---------- disegno ---------- */
  function disegna() {
    const fase = S.fase === 'pausa' ? sospesa : S.fase;   // in pausa da intro/falò il mondo è vecchio: non va mostrato
    if (S.fase === 'titolo') V.disegna(ctx, { m: vetrina, p: null, hud: false, tempo: orologio });
    else if (S.m && (fase === 'gioco' || fase === 'stanca')) {
      V.disegna(ctx, { m: S.m, p: S.p, relax: S.relax, stats: S.stats, n: S.n, tempo, effetti,
        ricordiGiorno: S.stats.ricordi.length - S.statsInizio.ricordi.length });
    } else V.disegna(ctx, { m: null });

    for (const c of tele) {
      if (!c.el.closest('.schermo.on')) continue;
      if (c.illus) V.disegnaIllustrazione(c.ctx, c.illus, orologio);
      else {
        c.ctx.clearRect(0, 0, c.el.width, c.el.height);
        V.disegnaLei(c.ctx, c.el.width / 2, c.el.height - 2, { anim: 'bacino', i: Math.floor(orologio * 3) % 2 }, orologio);
      }
    }
  }

  let ultimo = null, acc = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (ultimo === null) ultimo = ts;
    const dt = Math.min(0.25, Math.max(0, (ts - ultimo) / 1000));
    ultimo = ts; orologio += dt; acc += dt;
    let passi = 0;
    while (acc >= DT && passi < 5) { aggiorna(DT); acc -= DT; passi++; }
    if (passi === 5) acc = 0;
    disegna();
  }

  /* ---------- pausa e orientamento ---------- */
  function sospendi() {
    if (S.p && S.p.tenendo) V.rilasciaSalto(S.p);
    pointerSalto = null;
    if (SOSPENDIBILI.includes(S.fase)) { sospesa = S.fase; S.fase = 'pausa'; mostra('pausa'); }
    aggiornaMusica();
  }
  function riprendi() {
    S.fase = sospesa || 'gioco'; sospesa = null;
    mostra(S.fase); acc = 0;
    aggiornaMusica();
  }

  const verticale = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
  function controllaOrientamento() {
    const v = !!(verticale && verticale.matches);
    if (v === ruotato) return;
    ruotato = v;
    $('ruota').classList.toggle('on', v);
    if (v) sospendi(); else aggiornaMusica();
  }

  function ridimensiona() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1, fit = Math.min(w / V.W, h / V.H);
    // ogni pixel logico = un numero intero di pixel del dispositivo
    let s = Math.max(1, Math.floor(fit * dpr)) / dpr;
    // se così resta più del 30% vuoto, scala frazionaria (meglio pixel non uniformi che gioco minuscolo)
    if (s > fit || 1 - s / fit > 0.3) s = fit;
    const px = v => Math.round(v * dpr) / dpr;   // allinea ai pixel del dispositivo
    const sc = $('scena'), cw = px(V.W * s), ch = px(V.H * s);
    sc.style.width = cw + 'px'; sc.style.height = ch + 'px';
    sc.style.left = px((w - cw) / 2) + 'px'; sc.style.top = px((h - ch) / 2) + 'px';
    sc.style.setProperty('--s', s.toFixed(4));
    controllaOrientamento();
  }

  /* ---------- input ---------- */
  function tocco(sinistra, id) {
    switch (S.fase) {
      case 'gioco':
        if (S.m.finito) return;
        if (sinistra) { if (V.premiSalto(S.p)) { suona('salto'); pointerSalto = id; } }
        else if (S.p.anim !== 'pisolino') V.azioneMondo(S.m, S.p, avvisa);
        break;
      case 'intro': iniziaGiorno(1); break;
      case 'falo': if (macchina && !macchina.completo) completa(); else iniziaGiorno(S.n + 1); break;
      case 'pausa': riprendi(); break;
    }
  }
  function rilascia(id) {
    if (id !== pointerSalto) return;
    pointerSalto = null;
    if (S.p) V.rilasciaSalto(S.p);
  }

  document.addEventListener('pointerdown', e => {
    sbloccaAudio();
    if (ruotato || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest && e.target.closest('button')) return;
    e.preventDefault();
    tocco(e.clientX < window.innerWidth / 2, e.pointerId);
  }, { passive: false });
  document.addEventListener('pointerup', e => rilascia(e.pointerId));
  document.addEventListener('pointercancel', e => rilascia(e.pointerId));

  const SALTO = ['Space', 'ArrowUp'];
  document.addEventListener('keydown', e => {
    const salto = SALTO.includes(e.code), invio = e.code === 'Enter' || e.code === 'NumpadEnter';
    if (!salto && !invio) return;
    e.preventDefault();
    sbloccaAudio();
    if (e.repeat || ruotato) return;
    if (S.fase === 'titolo') return inizia();
    if (S.fase === 'finale') { if (invio) rigioca(); return; }
    tocco(S.fase === 'gioco' ? salto : true, 'tasto');
  });
  document.addEventListener('keyup', e => { if (SALTO.includes(e.code)) { e.preventDefault(); rilascia('tasto'); } });

  function inizia() {
    sbloccaAudio();
    try {
      const de = document.documentElement;
      const blocca = () => {
        if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape');
      };
      const r = de.requestFullscreen ? de.requestFullscreen() : null;
      // il blocco dell'orientamento funziona solo a schermo intero: si chiede dopo
      if (r && r.then) r.then(blocca).catch(() => {});
      else { const b = blocca(); if (b && b.catch) b.catch(() => {}); }
    } catch (e) { /* non supportato */ }
    S.stats = V.nuoveStats();
    avviaIntro();
  }
  function rigioca() { S.stats = V.nuoveStats(); iniziaGiorno(1); }

  /* ---------- scorciatoie di test ---------- */
  // in verticale la scorciatoia parte già in pausa: tornando in orizzontale c'è "Tocca per continuare"
  function apriScorciatoia() {
    const ok = scorciatoia();
    if (ok && ruotato) sospendi();
    return ok;
  }
  function scorciatoia() {
    const h = location.hash.slice(1);
    const g = h.match(/^giorno([1-6])$/), f = h.match(/^falo([1-5])$/);
    if (g) { S.stats = V.nuoveStats(); iniziaGiorno(+g[1]); return true; }
    if (f) { S.stats = V.nuoveStats(); apriFalo(+f[1]); return true; }
    if (h === 'finale') {
      S.stats = { ostacoliPresi: 7, ricordi: V.RICORDI.concat(V.RICORDI).slice(0, 12) };
      apriFinale(); return true;
    }
    return false;
  }

  /* ---------- avvio ---------- */
  function avvia() {
    ctx = $('gioco').getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (const el of document.querySelectorAll('canvas.illus, canvas.lei')) {
      const c = el.getContext('2d'); c.imageSmoothingEnabled = false;
      tele.push({ el, ctx: c, illus: el.dataset.illus || null });
    }
    try { S.musica = localStorage.getItem('viaggio-musica') !== '0'; } catch (e) { S.musica = true; }
    etichettaMusica();

    $('bInizia').addEventListener('click', inizia);
    $('bRigioca').addEventListener('click', rigioca);
    $('bMusica').addEventListener('click', () => {
      S.musica = !S.musica;
      try { localStorage.setItem('viaggio-musica', S.musica ? '1' : '0'); } catch (e) { /* niente storage */ }
      etichettaMusica(); sbloccaAudio(); aggiornaMusica();
    });

    document.addEventListener('visibilitychange', () => { if (document.hidden) sospendi(); else aggiornaMusica(); });
    window.addEventListener('resize', ridimensiona);
    if (verticale) {
      if (verticale.addEventListener) verticale.addEventListener('change', controllaOrientamento);
      else if (verticale.addListener) verticale.addListener(controllaOrientamento);
    }
    window.addEventListener('hashchange', apriScorciatoia);
    for (const el of [$('gioco'), document.body]) el.addEventListener('contextmenu', e => e.preventDefault());

    vetrina = V.creaMondo({ bioma: 'campi', durata: 1e6, diario: '-', eventi: [] }, 1);
    vetrina.ciclo = 0.3;   // pieno giorno dietro il titolo
    ridimensiona();
    if (!apriScorciatoia()) vai('titolo');
    V.caricaGrafica();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
