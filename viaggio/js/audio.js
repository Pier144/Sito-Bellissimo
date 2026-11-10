(function (V) {
  // Effetti 8-bit e musica chiptune in WebAudio. Se WebAudio manca o fallisce
  // tutto diventa no-op e il gioco resta muto.
  let ac = null, fx = null, onda25 = null, rumore = null;
  const mus = { on: false, tema: null, timer: null, passo: 0, prossimo: 0, uscita: null };

  function sblocca() {
    try {
      if (!ac) {
        const C = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!C) return;
        ac = new C();
        fx = ac.createGain(); fx.gain.value = 0.35; fx.connect(ac.destination);
        // onda quadra al 25% (serie di Fourier di un'onda a impulsi)
        const N = 32, re = new Float32Array(N), im = new Float32Array(N);
        for (let k = 1; k < N; k++) re[k] = 2 * Math.sin(k * Math.PI * 0.25) / (k * Math.PI);
        onda25 = ac.createPeriodicWave(re, im);
        rumore = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = rumore.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended' || ac.state === 'interrupted') {   // 'interrupted': iOS dopo una chiamata o Siri
        const r = ac.resume();
        if (r && r.catch) r.catch(() => {});
      }
    } catch (e) { ac = null; }
  }

  // nota con inviluppo: 'colpo' decade subito (effetti), 'tenuta' resta e chiude alla fine (musica)
  function nota(t, f0, dur, tipo, vol, { f1, dest, tenuta } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (tipo === 'q25') o.setPeriodicWave(onda25); else o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    if (tenuta) { g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || fx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function fruscio(t, dur, vol, filtro, f0, f1) {
    const s = ac.createBufferSource(); s.buffer = rumore;
    const fl = ac.createBiquadFilter(); fl.type = filtro;
    fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(fx);
    s.start(t, Math.random() * 0.5, dur + 0.02);
  }

  const SUONI = {
    salto: t => nota(t, 300, 0.12, 'square', 0.14, { f1: 600 }),
    colpo: t => { fruscio(t, 0.2, 0.5, 'lowpass', 2400, 300); nota(t, 150, 0.2, 'square', 0.2, { f1: 60 }); },
    ricarica: t => { nota(t, 660, 0.09, 'square', 0.12); nota(t + 0.09, 880, 0.16, 'square', 0.12); },
    ricordo: t => [523, 659, 784, 1047].forEach((f, i) => nota(t + i * 0.07, f, 0.14, 'square', 0.1)),
    ombrello: t => nota(t, 880, 0.3, 'triangle', 0.3),
    caduta: t => nota(t, 600, 0.4, 'square', 0.15, { f1: 100 }),
    stanca: t => fruscio(t, 0.4, 0.6, 'bandpass', 900, 250),
    bacino: t => { fruscio(t, 0.03, 0.7, 'highpass', 3000); nota(t + 0.01, 1200, 0.07, 'sine', 0.22); }
  };

  function suona(nome) {
    if (!ac || !SUONI[nome]) return;
    try { SUONI[nome](ac.currentTime + 0.005); } catch (e) { /* muto */ }
  }

  /* ---------- musica ---------- */
  const _ = null;
  // griglia a crome (8 per battuta); il basso è a semiminime (4 per battuta)
  const TEMI = {
    viaggio: {
      bpm: 110, onda: 'q25', vol: 0.5,
      mel: [
        76, _, 79, 76, 72, _, 74, 76,   74, _, 71, 74, 79, _, 77, 74,
        72, _, 76, 72, 69, _, 71, 72,   77, 76, 74, 72, 74, _, _, _,
        76, _, 79, 84, 83, _, 79, 76,   77, _, 81, 77, 76, _, 74, 72,
        74, _, 79, 77, 76, 74, 72, 71,  72, _, 67, _, 72, _, _, _
      ],
      bas: [48, 55, 48, 55, 43, 50, 43, 50, 45, 52, 45, 52, 41, 48, 41, 48,
        48, 55, 48, 55, 41, 48, 41, 48, 43, 50, 43, 50, 48, 43, 48, _]
    },
    falo: {
      bpm: 72, onda: 'triangle', vol: 0.55,
      mel: [
        69, _, 72, _, 76, _, 72, _,   65, _, 69, _, 72, _, 69, _,
        67, _, 72, _, 76, _, 74, _,   71, _, 74, _, 79, _, _, _
      ],
      bas: [45, _, 52, _, 41, _, 48, _, 48, _, 55, _, 43, _, 50, _]
    }
  };
  const freq = n => 440 * Math.pow(2, (n - 69) / 12);

  function programma() {
    if (!ac || !mus.on) return;
    const T = TEMI[mus.tema], croma = 60 / T.bpm / 2;
    if (mus.prossimo < ac.currentTime) mus.prossimo = ac.currentTime + 0.05;   // scheda rimasta indietro
    while (mus.prossimo < ac.currentTime + 0.5) {
      const i = mus.passo % T.mel.length, t = mus.prossimo;
      try {
        if (T.mel[i] != null) nota(t, freq(T.mel[i]), croma * 0.9, T.onda, T.vol, { dest: mus.uscita, tenuta: true });
        const b = i % 2 === 0 ? T.bas[i / 2] : null;
        if (b != null) nota(t, freq(b), croma * 1.8, 'triangle', 0.6, { dest: mus.uscita, tenuta: true });
      } catch (e) { /* muto */ }
      mus.passo++; mus.prossimo += croma;
    }
  }

  function ferma() {
    if (mus.timer) clearInterval(mus.timer);
    mus.timer = null; mus.on = false;
    const g = mus.uscita; mus.uscita = null;
    if (g) {
      try { g.gain.setTargetAtTime(0, ac.currentTime, 0.05); } catch (e) { /* già chiuso */ }
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* già staccato */ } }, 600);
    }
  }

  function musica(on, tema = 'viaggio') {
    if (!ac) return;
    if (!TEMI[tema]) tema = 'viaggio';
    if (on && mus.on && mus.tema === tema) return;
    if (!on && !mus.on) return;
    ferma();
    if (!on) return;
    try {
      mus.uscita = ac.createGain(); mus.uscita.gain.value = 0.15; mus.uscita.connect(ac.destination);
      mus.on = true; mus.tema = tema; mus.passo = 0; mus.prossimo = ac.currentTime + 0.1;
      programma();
      mus.timer = setInterval(programma, 100);
    } catch (e) { ferma(); }
  }

  V.audio = {
    sblocca, suona, musica,
    get attivo() { return !!ac; },
    get suonaMusica() { return mus.on ? mus.tema : null; }
  };
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
