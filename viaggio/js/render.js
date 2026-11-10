(function (V) {
  // Disegno su canvas. Ogni immagine assente ha un segnaposto colorato: il gioco
  // resta giocabile senza grafica e passa da solo alle immagini quando il
  // manifest le elenca.

  // palette segnaposto per bioma; forme = [strato lontano, strato medio]
  const COLORI = {
    campi:     { cielo: ['#6cb8ec', '#d6efff'], lontano: '#a6cf8c', medio: '#79b45c', suolo: '#8a6a44', erba: '#66a84a', forme: ['onde', 'onde'] },
    vigneti:   { cielo: ['#7cb4e4', '#f4e6c4'], lontano: '#b4b48a', medio: '#7c9a4c', suolo: '#8c5c3c', erba: '#5f8f3c', forme: ['onde', 'filari'] },
    bosco:     { cielo: ['#5c9cc0', '#c4e0cc'], lontano: '#4f7f5c', medio: '#2f5c3c', suolo: '#5c4030', erba: '#3c6c30', forme: ['alberi', 'alberi'] },
    montagna:  { cielo: ['#8cb0e0', '#eaf0fa'], lontano: '#9ca4bc', medio: '#6c748c', suolo: '#7a7068', erba: '#8a9a6a', forme: ['picchi', 'onde'] },
    temporale: { cielo: ['#4c5262', '#80889a'], lontano: '#4c5464', medio: '#363c4a', suolo: '#5a4a3a', erba: '#4c5c3c', forme: ['onde', 'onde'] },
    periferia: { cielo: ['#88b4e0', '#f2d8bc'], lontano: '#a4a4b4', medio: '#7c7c8e', suolo: '#686870', erba: '#8c8c80', forme: ['blocchi', 'blocchi'] }
  };
  const COLORE_TIPO = { ostacolo: '#e04848', fulmine: '#e04848', ricarica: '#48c060', ricordo: '#f0d040', interattivo: '#58b8f0', decoro: '#9a9a9a' };

  // grafica caricata dal manifest (null / assente = segnaposto)
  const G = { sprite: {}, lei: null, sfondi: {}, illus: {} };
  V.grafica = G;

  const caricaImg = file => new Promise(ok => {
    if (!file || typeof Image === 'undefined') return ok(null);
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = 'assets/' + file;
  });

  V.caricaGrafica = async () => {
    let man = {};
    try {
      const r = await fetch('assets/manifest.json', { cache: 'no-cache' });
      if (r.ok) man = await r.json();
    } catch (e) { man = {}; }
    const lavori = [];
    for (const [nome, s] of Object.entries(man.sprites || {})) {
      if (!s || !s.file) continue;
      lavori.push(caricaImg(s.file).then(img => {
        if (!img) return;
        if (nome === 'lei') G.lei = { img, fw: s.fw || img.width, fh: s.fh || img.height, righe: s.righe || {} };
        else G.sprite[nome] = { img, w: s.w || img.width, h: s.h || img.height };
      }));
    }
    for (const [bioma, strati] of Object.entries(man.sfondi || {})) {
      const dest = G.sfondi[bioma] = { lontano: null, medio: null, vicino: null };
      for (const k of Object.keys(dest)) lavori.push(caricaImg(strati && strati[k]).then(img => { dest[k] = img; }));
    }
    for (const [nome, file] of Object.entries(man.illustrazioni || {})) {
      lavori.push(caricaImg(file).then(img => { G.illus[nome] = img; }));
    }
    await Promise.all(lavori);
    return G;
  };

  /* ---------- utilità ---------- */
  const R = Math.round;
  const hash = n => {
    n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13;
    n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  };

  function testo(ctx, s, x, y, colore = '#fff', allinea = 'left', px = 8) {
    ctx.font = `bold ${px}px monospace`;
    ctx.textBaseline = 'top'; ctx.textAlign = allinea;
    ctx.fillStyle = '#000'; ctx.fillText(s, R(x) + 1, R(y) + 1);
    ctx.fillStyle = colore; ctx.fillText(s, R(x), R(y));
  }

  // icone a pixel: '#' = colore, 'o' = nero
  function pix(ctx, x, y, righe, colore) {
    for (let r = 0; r < righe.length; r++) for (let c = 0; c < righe[r].length; c++) {
      const ch = righe[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = ch === 'o' ? '#000' : colore;
      ctx.fillRect(R(x) + c, R(y) + r, 1, 1);
    }
  }
  const ICONE = {
    mano: ['.#.#.#..', '.#.#.#..', '.#.#.#.#', '.#####.#', '.######.', '.######.', '..####..', '..####..'],
    ombrello: ['..#####..', '.#######.', '#########', '....#....', '....#....', '....#....', '..#.#....', '...#.....'],
    cuore: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
    rombo: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
    z: ['####', '..#.', '.#..', '####']
  };

  function triangolo(ctx, cx, base, w, h, colore) {
    ctx.fillStyle = colore;
    for (let r = 0; r < h; r++) {
      const l = Math.max(1, R(w * (1 - r / h)));
      ctx.fillRect(R(cx - l / 2), R(base - r - 1), l, 1);
    }
  }

  function righe(ctx, x, y, w, h, c1 = '#fff', c2 = '#000') {
    for (let r = 0; r < h; r += 2) {
      ctx.fillStyle = (r / 2) % 2 ? c2 : c1;
      ctx.fillRect(R(x), R(y) + r, w, Math.min(2, h - r));
    }
  }

  /* ---------- sfondi ---------- */
  // profili periodici su P px: lo strato si disegna una volta in un canvas fuori schermo e si ripete
  const P = 768, TAU = 2 * Math.PI / P;
  const PROFILI = {
    onde: (x, s) => 14 + 7 * Math.sin(3 * TAU * x + s) + 4 * Math.sin(7 * TAU * x + s * 3),
    filari: (x, s) => 9 + 3 * Math.sin(3 * TAU * x + s) + (x % 12 < 7 ? 4 : 0),
    picchi: (x, s) => {
      const p = 128, u = ((x + s * 50) % p) / p;
      return 16 + 48 * (1 - Math.abs(u * 2 - 1)) + 3 * Math.sin(24 * TAU * x);
    },
    alberi: (x, s) => {
      const p = 12, i = Math.floor(x / p), u = (x - i * p) / p;
      return 6 + (20 + hash(i + s * 1000) * 22) * (1 - Math.abs(u * 2 - 1));
    },
    blocchi: (x, s) => 16 + Math.floor(hash(Math.floor(x / 32) + s * 1000) * 5) * 8
  };

  const nuovaTela = (w, h) => {
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    return new OffscreenCanvas(w, h);
  };
  const cache = new Map();   // strati e cieli segnaposto già disegnati
  function inCache(chiave, w, h, disegno) {
    let c = cache.get(chiave);
    if (!c) { c = nuovaTela(w, h); disegno(c.getContext('2d')); cache.set(chiave, c); }
    return c;
  }

  function strato(ctx, colore, forma, off, seme, scalaH, base) {
    const tela = inCache(`strato|${colore}|${forma}|${seme}|${scalaH}|${base}`, P, V.SUOLO, c => {
      c.fillStyle = colore;
      const f = PROFILI[forma] || PROFILI.onde;
      for (let x = 0; x < P; x++) {
        const h = R(f(x, seme) * scalaH);
        c.fillRect(x, base - h, 1, V.SUOLO - base + h);
      }
    });
    tile(ctx, tela, off);
  }

  function cielo(ctx, chiave, alto, c0, c1) {
    ctx.drawImage(inCache(`cielo|${chiave}|${alto}`, V.W, alto, c => {
      const g = c.createLinearGradient(0, 0, 0, alto);
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      c.fillStyle = g; c.fillRect(0, 0, V.W, alto);
    }), 0, 0);
  }

  function tile(ctx, img, off) {
    const w = img.width;
    let x = -(((R(off) % w) + w) % w);
    for (; x < V.W; x += w) ctx.drawImage(img, x, 0);
  }

  function sfondo(ctx, m) {
    const b = m.giorno.bioma, c = COLORI[b] || COLORI.campi, img = G.sfondi[b] || {};
    if (img.lontano) tile(ctx, img.lontano, m.dist * 0.2);
    else {
      cielo(ctx, b, V.SUOLO, c.cielo[0], c.cielo[1]);
      strato(ctx, c.lontano, c.forme[0], R(m.dist * 0.2), 1, 1.8, V.SUOLO - 16);
    }
    if (img.medio) tile(ctx, img.medio, m.dist * 0.5);
    else strato(ctx, c.medio, c.forme[1], R(m.dist * 0.5), 2, 1.1, V.SUOLO);
    if (img.vicino) tile(ctx, img.vicino, m.dist);
    else terreno(ctx, m, c);
  }

  function terreno(ctx, m, c) {
    ctx.fillStyle = c.suolo; ctx.fillRect(0, V.SUOLO, V.W, V.H - V.SUOLO);
    ctx.fillStyle = c.erba; ctx.fillRect(0, V.SUOLO, V.W, 3);
    const d = R(m.dist), inizio = Math.floor(d / 16);
    for (let i = inizio; i < inizio + V.W / 16 + 2; i++) {
      const x = i * 16 - d;
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(x, V.SUOLO + 6 + Math.floor(hash(i) * 22), 3, 1);
      ctx.fillStyle = c.erba;
      if (hash(i + 77) < 0.5) ctx.fillRect(x + 5, V.SUOLO - 2, 1, 2), ctx.fillRect(x + 7, V.SUOLO - 3, 1, 3);
    }
  }

  function suoloSpeciale(ctx, m) {
    for (const e of m.entita) {
      if ((e.tipo !== 'buco' && e.tipo !== 'fango') || e.x > V.W || e.x + e.w < 0) continue;
      const x = R(e.x);
      if (e.tipo === 'buco') {
        ctx.fillStyle = '#000'; ctx.fillRect(x, V.SUOLO, R(e.w), V.H - V.SUOLO);
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x, V.SUOLO, 2, V.H - V.SUOLO); ctx.fillRect(x + R(e.w) - 2, V.SUOLO, 2, V.H - V.SUOLO);
      } else {
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x, V.SUOLO - 1, R(e.w), 9);
        ctx.fillStyle = '#7a5230';
        for (let k = 4; k < e.w - 4; k += 11) ctx.fillRect(x + k, V.SUOLO + 2 + ((k / 11) % 2) * 3, 4, 1);
      }
    }
  }

  /* ---------- entità ---------- */
  const fulminiVisti = new WeakMap();   // fulmine -> istante (ms) del primo disegno della saetta
  const FLASH_MS = 33;
  const larghezzeCartelli = new Map();  // testo -> larghezza in px a 6px

  function segnaposto(ctx, e, x, top) {
    ctx.fillStyle = COLORE_TIPO[e.tipo] || '#ccc';
    ctx.fillRect(x, top, R(e.w), R(e.h));
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, top + R(e.h) - 1, R(e.w), 1);
    if (e.h >= 8) testo(ctx, (e.nome || '?')[0].toUpperCase(), x + e.w / 2, top + e.h / 2 - 4, '#fff', 'center');
  }

  function cartello(ctx, e, x, base) {
    const s = e.ev.testo || '';
    let tw = larghezzeCartelli.get(s);
    if (tw === undefined) {
      ctx.font = 'bold 6px monospace';
      tw = Math.ceil(ctx.measureText(s).width);
      larghezzeCartelli.set(s, tw);
    }
    const bw = Math.max(16, tw + 6), cx = x + R(e.w / 2);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(cx - 1, base - 20, 2, 20);
    const bx = cx - R(bw / 2), by = base - 30;
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 12);
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = '#ddd'; ctx.fillRect(bx, by, bw, 1);
    testo(ctx, s, cx, by + 2, '#fff', 'center', 6);
  }

  function entita(ctx, m, t) {
    for (const e of m.entita) {
      if (e.tipo === 'buco' || e.tipo === 'fango' || e.tipo === 'fulmine') continue;
      if (e.preso && e.stato !== 'amico') continue;
      if (e.x > V.W + 40 || e.x + e.w < -40) continue;
      let x = R(e.x), base = R(V.SUOLO - e.y);
      if (e.nome === 'cespuglio') x += R(Math.sin(t * 4 + e.d) * 1.5);
      if (e.tipo === 'ricordo') base -= Math.floor(t * 3 + e.d) % 2;
      if (e.stato === 'colpito') ctx.globalAlpha = 0.6;
      const s = G.sprite[e.nome];
      if (s) {
        const cx = x + e.w / 2;
        if (e.nome === 'sasso') {
          // rotola verso di lei a scatti di 90°: resta nitido
          ctx.save(); ctx.translate(R(cx), R(base - s.h / 2));
          ctx.rotate(-(Math.floor(m.dist / 6) % 4) * Math.PI / 2);
          ctx.drawImage(s.img, -R(s.w / 2), -R(s.h / 2), s.w, s.h);
          ctx.restore();
        } else ctx.drawImage(s.img, R(cx - s.w / 2), R(base - s.h), s.w, s.h);
      } else if (e.nome === 'cartello') cartello(ctx, e, x, base);
      else segnaposto(ctx, e, x, base - R(e.h));
      if (e.stato === 'amico' && Math.floor(t * 2) % 2) pix(ctx, x + R(e.w / 2) - 3, base - R(e.h) - 8, ICONE.cuore, '#ff6a8a');
      ctx.globalAlpha = 1;
    }
  }

  // ombra del fulmine (prima dell'overlay); restituisce i fulmini da disegnare sopra
  function ombreFulmini(ctx, m, t) {
    const attivi = [];
    for (const e of m.entita) {
      if (e.tipo !== 'fulmine') continue;
      const davanti = e.x - V.PX;
      if (davanti > m.velocita || davanti < -24) continue;
      const k = 1 - Math.max(0, davanti) / m.velocita;          // 0 -> 1 avvicinandosi
      const w = R(e.w * (0.5 + k * 0.8)), cx = R(e.x + e.w / 2);
      if (Math.floor(t * 12) % 2 || k > 0.7) {
        ctx.fillStyle = 'rgba(0,0,0,.7)';
        ctx.fillRect(cx - R(w / 2), V.SUOLO - 1, w, 3);
        ctx.fillRect(cx - R(w / 2) + 2, V.SUOLO - 2, w - 4, 1);
        // scintille gialle ai bordi: l'ombra si vede anche sul terreno scuro del temporale
        ctx.fillStyle = '#ffe860';
        ctx.fillRect(cx - R(w / 2) - 1, V.SUOLO - 2 - (Math.floor(t * 20) % 2), 1, 1);
        ctx.fillRect(cx + R(w / 2), V.SUOLO - 2 - (Math.floor(t * 20 + 1) % 2), 1, 1);
        ctx.fillRect(cx, V.SUOLO - 4 - R(k * 3), 1, 1);
      }
      if (Math.abs(davanti) <= 10) attivi.push(e);
    }
    return attivi;
  }

  function saetta(ctx, e) {
    const cx = R(e.x + e.w / 2);
    let x = cx + 6;
    ctx.fillStyle = '#fff6a0';
    for (let y = 0; y < V.SUOLO; y += 6) {
      const nx = cx + R((hash(y + R(e.d)) - 0.5) * 12);
      ctx.fillRect(Math.min(x, nx), y, Math.abs(nx - x) + 2, 2);
      ctx.fillRect(nx, y, 2, 6);
      x = nx;
    }
    ctx.fillStyle = '#ffe040'; ctx.fillRect(cx - 6, V.SUOLO - 2, 12, 2);
  }

  /* ---------- lei ---------- */
  // cx = centro della hitbox, base = y dei piedi
  V.disegnaLei = (ctx, cx, base, fr, t = 0) => {
    const L = G.lei;
    if (L) {
      const riga = L.righe[fr.anim] || L.righe.cammina || [0, 1], n = riga[1] || 1;
      ctx.drawImage(L.img, (fr.i % n) * L.fw, riga[0] * L.fh, L.fw, L.fh, R(cx - L.fw / 2), R(base - L.fh), L.fw, L.fh);
      return;
    }
    const W = V.GIOCATRICE.w, H = V.GIOCATRICE.h, x = R(cx - W / 2);
    if (fr.anim === 'pisolino') {
      righe(ctx, x - 13, base - 10, H, 10);
      pix(ctx, x + 18, base - 18 - (fr.i ? 3 : 0), ICONE.z, '#fff');
      return;
    }
    if (fr.anim === 'stanca') {
      righe(ctx, x, base - 26, W, 26);
      if (fr.i) { ctx.fillStyle = '#ddd'; ctx.fillRect(x + W + 1, base - 26, 3, 2); ctx.fillRect(x + W + 4, base - 28, 2, 2); }
      return;
    }
    const sale = fr.anim === 'cammina' ? fr.i % 2 : 0;
    righe(ctx, x, base - H - sale, W, H, fr.anim === 'colpita' ? '#ff7070' : '#fff');
    if (fr.anim === 'bacino') {
      ctx.fillStyle = '#ff5a8a'; ctx.fillRect(x + W, base - H + 9, 2 + fr.i, 2);
      if (fr.i) pix(ctx, x + W + 3, base - H - 6, ICONE.cuore, '#ff6a8a');
    }
  };

  function ombrelloAperto(ctx, cx, top) {
    const x = R(cx);
    for (let r = 0; r < 6; r++) {
      const l = 8 + r * 3;
      ctx.fillStyle = r % 2 ? '#a02848' : '#e04870';
      ctx.fillRect(x - R(l / 2), top - 14 + r, l, 1);
    }
    ctx.fillStyle = '#222'; ctx.fillRect(x, top - 8, 1, 8);
  }

  function fumetto(ctx, m, cx, top, t) {
    const su = Math.floor(t * 4) % 2, bx = R(cx - 9), by = R(top - 22 - su);
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, 20, 16); ctx.fillRect(bx + 7, by + 15, 5, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, 18, 14); ctx.fillRect(bx + 8, by + 14, 3, 2);
    if (m.icona.nome === 'cane') pix(ctx, bx + 5, by + 3, ICONE.mano, '#e0a070');
    else pix(ctx, bx + 4, by + 3, ICONE.ombrello, '#e04870');
  }

  /* ---------- effetti di schermo ---------- */
  const CICLO = [[0, [255, 178, 122]], [0.15, [255, 255, 255]], [0.6, [255, 255, 255]], [0.7, [255, 160, 100]],
    [0.8, [232, 140, 112]], [0.88, [58, 74, 138]], [1, [58, 74, 138]]];
  function coloreCiclo(f) {
    f = Math.max(0, Math.min(1, f));
    for (let i = 1; i < CICLO.length; i++) {
      const [f1, c1] = CICLO[i], [f0, c0] = CICLO[i - 1];
      if (f <= f1) {
        const k = (f - f0) / (f1 - f0 || 1);
        return c0.map((v, j) => R(v + (c1[j] - v) * k));
      }
    }
    return CICLO[CICLO.length - 1][1];
  }
  function moltiplica(ctx, rgb) {
    if (rgb[0] === 255 && rgb[1] === 255 && rgb[2] === 255) return;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.fillRect(0, 0, V.W, V.H);
    ctx.globalCompositeOperation = 'source-over';
  }

  const lampo = { prossimo: null, inizio: -9, ultimo: 0 };
  function temporale(ctx, t) {
    moltiplica(ctx, [118, 124, 146]);
    ctx.fillStyle = 'rgba(190,205,235,.65)';
    for (let i = 0; i < 60; i++) {
      const v = 220 + hash(i) * 90, alto = V.H + 20;
      const y = R(((hash(i + 100) * alto + t * v) % alto) - 10);
      const x = R((((hash(i + 200) * (V.W + 60) - y * 0.45 - t * 30) % (V.W + 60)) + V.W + 60) % (V.W + 60) - 30);
      for (let k = 0; k < 4; k++) ctx.fillRect(x - k, y + k * 2, 1, 2);
    }
    if (lampo.prossimo === null || t < lampo.ultimo) { lampo.prossimo = t + 4 + Math.random() * 3; lampo.inizio = -9; }
    lampo.ultimo = t;
    if (t >= lampo.prossimo) { lampo.inizio = t; lampo.prossimo = t + 4 + Math.random() * 3; }
    const a = 0.55 - (t - lampo.inizio) * 3;
    if (a > 0) { ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fillRect(0, 0, V.W, V.H); }
  }

  /* ---------- HUD ---------- */
  function hud(ctx, stato) {
    const { m, n } = stato, relax = Math.max(0, Math.min(100, stato.relax)), t = stato.tempo || 0;
    testo(ctx, 'RELAX', 4, 3);
    ctx.fillStyle = '#000'; ctx.fillRect(33, 3, 66, 8);
    ctx.fillStyle = '#333'; ctx.fillRect(34, 4, 64, 6);
    const colore = relax > 60 ? '#4cd964' : relax > 30 ? '#ffd23f' : '#ff4d4d';
    if (relax > 30 || Math.floor(t * 4) % 2) { ctx.fillStyle = colore; ctx.fillRect(34, 4, R(64 * relax / 100), 6); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(34, 4, R(64 * relax / 100), 1);
    testo(ctx, `Giorno ${n}`, V.W / 2, 3, '#fff', 'center');
    // ricordi del giorno: li conta engine.js (stato.ricordiGiorno), niente scansione delle entità a ogni frame
    const k = stato.ricordiGiorno || 0;
    testo(ctx, `${k}/3`, V.W - 4, 3, '#ffe060', 'right');
    pix(ctx, V.W - 31, 4, ICONE.rombo, '#ffe060');
  }

  /* ---------- disegno principale ---------- */
  // stato = { m, p, relax, stats, n, tempo, ricordiGiorno?, effetti?, hud? }
  V.disegna = (ctx, stato) => {
    const { m, p } = stato, t = stato.tempo || 0;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (!m) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, V.W, V.H); return; }

    sfondo(ctx, m);
    suoloSpeciale(ctx, m);
    entita(ctx, m, t);

    const cx = V.PX + V.GIOCATRICE.w / 2;
    let top = 0;
    if (p) {
      const base = R(V.SUOLO - p.y);
      top = base - V.GIOCATRICE.h;
      if (!(p.inv > 0 && Math.floor(t * 15) % 2)) V.disegnaLei(ctx, cx, base, V.frameGiocatrice(p), t);
      if (m.ombrello > 0 && (m.ombrello > 2 || Math.floor(t * 8) % 2)) ombrelloAperto(ctx, cx, top);
    }

    moltiplica(ctx, coloreCiclo(m.ciclo != null ? m.ciclo : m.dist / m.lunghezza));   // ciclo fisso: vetrina del titolo
    if (m.giorno.bioma === 'temporale') temporale(ctx, t);

    const fulmini = ombreFulmini(ctx, m, t);   // dopo gli overlay: è un avviso di gioco, deve leggersi

    for (const e of fulmini) {
      saetta(ctx, e);
      // flash bianco a tempo reale (~2 frame a 60 Hz), indipendente da quante volte si ridisegna
      const ora = Date.now();
      if (!fulminiVisti.has(e)) fulminiVisti.set(e, ora);
      if (ora - fulminiVisti.get(e) < FLASH_MS) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, V.W, V.H); }
    }

    if (p && m.icona && p.anim !== 'stanca' && p.anim !== 'pisolino') fumetto(ctx, m, cx, top, t);
    for (const f of stato.effetti || []) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / 0.9);
      testo(ctx, f.testo, f.x, f.y - f.t * 22, f.colore, 'center');
      ctx.globalAlpha = 1;
    }
    if (stato.hud !== false) hud(ctx, stato);
  };

  /* ---------- illustrazioni (intro, falò, divano) ---------- */
  function stelle(ctx, n, hMax) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < n; i++) ctx.fillRect(R(hash(i) * V.W), R(hash(i + 500) * hMax), 1, 1);
  }

  const ILLUS = {
    intro(ctx, t) {
      cielo(ctx, 'intro', 170, '#f0a070', '#ffe0b0');
      strato(ctx, '#b8a890', 'onde', 0, 4, 1.4, 168);
      ctx.fillStyle = '#7a6a4a'; ctx.fillRect(0, 168, V.W, V.H - 168);
      // le terme
      ctx.fillStyle = '#e8dcc8'; ctx.fillRect(30, 96, 150, 72);
      ctx.fillStyle = '#b05a40';
      for (let r = 0; r < 14; r++) ctx.fillRect(24 + r, 82 + r, 162 - r * 2, 1);
      ctx.fillStyle = '#c8bca8';
      for (let c = 0; c < 6; c++) ctx.fillRect(40 + c * 24, 104, 6, 64);
      ctx.fillStyle = '#5ab0d8'; ctx.fillRect(190, 156, 70, 12);
      ctx.fillStyle = '#8ad0f0'; ctx.fillRect(190, 156, 70, 2);
      testo(ctx, 'TERME', 105, 86, '#fff', 'center');
      // vapore
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      for (let i = 0; i < 6; i++) {
        const k = ((t * 0.4 + i / 6) % 1);
        ctx.fillRect(R(200 + i * 10 + Math.sin(t * 2 + i) * 3), R(150 - k * 50), 4 + R(k * 4), 4 + R(k * 4));
      }
      // cartello "Casa ->"
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(320, 138, 2, 30);
      ctx.fillStyle = '#000'; ctx.fillRect(301, 127, 42, 14);
      ctx.fillStyle = '#9a7a4a'; ctx.fillRect(302, 128, 40, 12);
      testo(ctx, 'Casa →', 322, 130, '#fff', 'center');
      V.disegnaLei(ctx, 282, 168, { anim: 'cammina', i: Math.floor(t * 6) % 6 }, t);
    },
    falo(ctx, t) {
      cielo(ctx, 'falo', 170, '#0c1028', '#2a3050');
      stelle(ctx, 50, 110);
      strato(ctx, '#161c30', 'alberi', 0, 9, 1.2, 168);
      ctx.fillStyle = '#20180f'; ctx.fillRect(0, 168, V.W, V.H - 168);
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#ff9a40';
      ctx.fillRect(152, 128, 80, 48); ctx.fillRect(162, 118, 60, 68);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(176, 164, 32, 4); ctx.fillRect(180, 160, 24, 4);
      const f = i => Math.sin(t * (9 + i * 3) + i * 2);
      triangolo(ctx, 184, 162, 12, 18 + R(f(0) * 3), '#ff6a20');
      triangolo(ctx, 200, 162, 12, 16 + R(f(1) * 3), '#ff6a20');
      triangolo(ctx, 192, 162, 14, 26 + R(f(2) * 4), '#ffb030');
      triangolo(ctx, 192, 162, 6, 12 + R(f(3) * 2), '#fff0a0');
      V.disegnaLei(ctx, 150, 168, { anim: 'stanca', i: 0 }, t);
    },
    divano(ctx, t) {
      ctx.fillStyle = '#c8a888'; ctx.fillRect(0, 0, V.W, 160);
      ctx.fillStyle = '#b89878'; for (let x = 0; x < V.W; x += 16) ctx.fillRect(x, 0, 1, 160);
      ctx.fillStyle = '#7a5a40'; ctx.fillRect(0, 160, V.W, V.H - 160);
      ctx.fillStyle = '#20284a'; ctx.fillRect(280, 30, 60, 50);
      ctx.fillStyle = '#fff'; ctx.fillRect(296, 40, 1, 1); ctx.fillRect(320, 52, 1, 1); ctx.fillRect(330, 36, 1, 1);
      ctx.fillStyle = '#6a4a30'; ctx.fillRect(278, 28, 64, 2); ctx.fillRect(278, 80, 64, 2); ctx.fillRect(308, 30, 2, 50);
      ctx.fillStyle = '#a04050'; ctx.fillRect(90, 112, 200, 28);
      ctx.fillStyle = '#b85060'; ctx.fillRect(90, 134, 200, 22);
      ctx.fillStyle = '#8a3040'; ctx.fillRect(80, 124, 14, 36); ctx.fillRect(286, 124, 14, 36);
      ctx.fillStyle = '#4a2a1a'; ctx.fillRect(92, 160, 4, 6); ctx.fillRect(284, 160, 4, 6);
      V.disegnaLei(ctx, 180, 136, { anim: 'pisolino', i: Math.floor(t * 2) % 2 }, t);
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.5 + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        pix(ctx, 200 + R(k * 20), 114 - R(k * 40), ICONE.z, '#fff');
      }
      ctx.globalAlpha = 1;
    }
  };

  V.disegnaIllustrazione = (ctx, nome, t = 0) => {
    ctx.imageSmoothingEnabled = false;
    const img = G.illus[nome];
    if (img) {
      const cw = ctx.canvas.width, ch = ctx.canvas.height, k = Math.max(cw / img.width, ch / img.height);
      const w = R(img.width * k), h = R(img.height * k);
      ctx.drawImage(img, R((cw - w) / 2), R((ch - h) / 2), w, h);
    } else if (ILLUS[nome]) ILLUS[nome](ctx, t);
  };
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
