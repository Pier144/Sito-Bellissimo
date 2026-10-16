(() => {
  'use strict';

  /* ================= dati ================= */
  const LENGTH = 1150;          // lunghezza del percorso (unita' di mondo, ~65 s)
  const FRAGS = 10, NEED = 5;   // frammenti nel percorso / minimo per il boss
  const POWER_TIME = 6;         // secondi di durata dei powerup
  const D = 5;                  // "focale" della prospettiva
  const BOSS_Z = 24;            // distanza a cui sta il boss

  const LEVELS = {
    gojo: {
      id: 'gojo', n: 1, name: 'Satoru Gojo', from: 'Jujutsu Kaisen', photo: 'assets/gojo.webp',
      place: 'Shibuya', theme: 'shibuya', look: 'gojo',
      story: 'Shibuya è invasa dagli spiriti maledetti. Corri per le strade, raccogli i frammenti della carta di Gojo e affronta il Re delle Maledizioni.',
      obstacles: ['curse', 'barrier', 'rubble'],
      powers: { shield: 'Infinito', special: 'Sei Occhi', life: '+1 vita' },
      icons: { shield: 'inf', special: 'eye', life: 'heart' },
      special: 'magnet',
      boss: { name: 'Sukuna', title: 'Il Re delle Maledizioni', draw: 'sukuna', shot: ['#ffffff', '#ff2d55'] },
      orb: ['#4aa8ff', '#ff4a5e'], beam: '#b06bff',
      finisher: ['Espansione del dominio', 'Vuoto Immenso'], finCls: 'void',
      unlock: null,
    },
    jinwoo: {
      id: 'jinwoo', n: 2, name: 'Sung Jin-Woo', from: 'Solo Leveling', photo: 'assets/jinwoo.webp',
      place: 'Dungeon del portale rosso', theme: 'dungeon', look: 'jinwoo',
      story: 'Il portale rosso si è aperto e non si chiude più. Attraversa il dungeon, raccogli i frammenti della carta di Jin-Woo e abbatti il cavaliere che lo sorveglia.',
      obstacles: ['goblin', 'spikes', 'lava'],
      powers: { shield: 'Furtività', special: 'Soldato ombra', life: 'Pozione' },
      icons: { shield: 'hood', special: 'helm', life: 'potion' },
      special: 'soldier',
      boss: { name: 'Igris il Rosso', title: 'Il Cavaliere del Sangue', draw: 'igris', shot: ['#ffd0d0', '#d1102e'] },
      orb: ['#a66bff', '#6d3cff'], beam: '#8b5cff',
      finisher: ['Monarca delle ombre', 'ARISE!'], finCls: 'arise',
      unlock: 'gojo',
    },
  };

  // i 10 dell'album; quelli senza livello sono "Prossimamente"
  const ROSTER = [
    { lv: 'gojo' }, { lv: 'jinwoo' },
    { name: 'Levi Ackerman' }, { name: 'Itachi Uchiha' }, { name: 'Kakashi Hatake' },
    { name: 'Roronoa Zoro' }, { name: 'Toji Fushiguro' }, { name: 'Kyojuro Rengoku' },
    { name: 'Osamu Dazai' }, { name: 'Ryomen Sukuna' },
  ];

  /* ================= salvataggio ================= */
  const KEY = 'animeRunner.v1';
  let won = [];
  try { won = JSON.parse(localStorage.getItem(KEY)).won || []; } catch (e) { won = []; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ won })); } catch (e) { /* niente */ } }

  /* ================= utilita' ================= */
  const $ = id => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  const touchDevice = matchMedia('(pointer: coarse)').matches;

  /* ================= canvas e prospettiva ================= */
  const cv = $('game'), g = cv.getContext('2d');
  let W, H, DPR, LW, CX, Y0, Y1;
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    LW = Math.min(W * 0.29, 170);   // larghezza di una corsia all'altezza del giocatore
    CX = W / 2;
    Y0 = H * 0.30;                  // orizzonte
    Y1 = H * 0.84;                  // piedi del giocatore
    bgKey = '';
  }
  // z = distanza davanti al giocatore; s = scala (1 al giocatore, 0 all'orizzonte)
  const S = z => D / (D + Math.max(z, -D * 0.8));
  function proj(lane, z) {
    const s = S(z);
    return { x: CX + lane * LW * s, y: Y0 + (Y1 - Y0) * s, s };
  }

  /* ---- primitive di disegno ---- */
  function ell(x, y, rx, ry, col) { g.beginPath(); g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2); g.fillStyle = col; g.fill(); }
  function rrect(x, y, w, h, r, col) {
    if (w <= 0 || h <= 0) return;
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    g.fillStyle = col; g.fill();
  }
  function poly(pts, col) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = col; g.fill();
  }
  function glow(x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // striscia sul terreno tra due corsie e due profondita'
  function quad(l1, l2, z1, z2, col) {
    const a = proj(l1, z1), b = proj(l2, z1), c = proj(l2, z2), d = proj(l1, z2);
    poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y], col);
  }

  /* ================= scenari ================= */
  let bg = null, bgKey = '';
  const THEMES = {
    shibuya: {
      ground: '#1c1726', band: '#221c2e', road: '#363041', roadBand: '#3c3648',
      line: 'rgba(255,255,255,.6)', edge: '#ffcf5a', fog: '160,58,106', prop: 'lamp',
      sky(c) {
        const gr = c.createLinearGradient(0, 0, 0, Y0);
        gr.addColorStop(0, '#12061f'); gr.addColorStop(.45, '#3a1450'); gr.addColorStop(.8, '#8a3168'); gr.addColorStop(1, '#e0706c');
        c.fillStyle = gr; c.fillRect(0, 0, W, Y0 + 2);
        // luna
        const mx = W * 0.8, my = Y0 * 0.32, mr = Math.min(W, H) * 0.05;
        const mg = c.createRadialGradient(mx, my, mr * .8, mx, my, mr * 4);
        mg.addColorStop(0, 'rgba(255,200,220,.35)'); mg.addColorStop(1, 'rgba(255,200,220,0)');
        c.fillStyle = mg; c.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
        c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fillStyle = '#ffe6ef'; c.fill();
        // stelle
        const r = seeded(11);
        for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${r() * .6})`; c.fillRect(r() * W, r() * Y0 * .6, 1.5, 1.5); }
        // grattacieli su due file: dietro piu' chiari, davanti piu' scuri con finestre
        for (const front of [0, 1]) {
          let x = -10;
          while (x < W + 10) {
            const w = 16 + r() * 44;
            const h = H * (front ? 0.03 + r() * 0.13 : 0.07 + r() * 0.17);
            c.fillStyle = front ? '#140a22' : '#2b1640';
            c.fillRect(x, Y0 - h, w, h + 2);
            if (front) {
              for (let wy = Y0 - h + 5; wy < Y0 - 4; wy += 8)
                for (let wx = x + 4; wx < x + w - 4; wx += 7)
                  if (r() < 0.32) { c.fillStyle = `rgba(255,${190 + r() * 50 | 0},120,${.35 + r() * .5})`; c.fillRect(wx, wy, 3, 4); }
              // maxischermi, tipo incrocio di Shibuya
              if (r() < 0.18 && w > 30) {
                const col = pick(['94,231,255', '255,94,180', '180,120,255']);
                c.fillStyle = `rgba(${col},.85)`; c.fillRect(x + 4, Y0 - h + 6, w - 8, Math.min(h * 0.35, 22));
                c.fillStyle = `rgba(${col},.18)`; c.fillRect(x - 6, Y0 - h - 4, w + 12, Math.min(h * 0.35, 22) + 20);
              }
            }
            x += w + r() * 5;
          }
        }
      },
    },
    dungeon: {
      ground: '#120d1a', band: '#171121', road: '#262131', roadBand: '#2c2638',
      line: 'rgba(170,140,255,.35)', edge: '#6d3cff', fog: '60,10,30', prop: 'torch',
      sky(c) {
        const gr = c.createLinearGradient(0, 0, 0, Y0);
        gr.addColorStop(0, '#040207'); gr.addColorStop(.6, '#140a22'); gr.addColorStop(1, '#3a0c22');
        c.fillStyle = gr; c.fillRect(0, 0, W, Y0 + 2);
        const r = seeded(5);
        // pareti di roccia ai lati
        for (const side of [-1, 1]) {
          const pts = [];
          const base = side < 0 ? 0 : W;
          pts.push(base, -2);
          for (let i = 0; i <= 10; i++) {
            const y = (Y0 + 2) * i / 10;
            pts.push(base - side * (W * (0.18 + 0.16 * i / 10) + r() * W * 0.04), y);
          }
          pts.push(base, Y0 + 2);
          c.beginPath(); c.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
          c.closePath(); c.fillStyle = '#0a0610'; c.fill();
        }
        // stalattiti
        c.fillStyle = '#07040b';
        for (let i = 0; i < 14; i++) {
          const x = r() * W, w = 10 + r() * 24, h = 20 + r() * Y0 * 0.35;
          c.beginPath(); c.moveTo(x - w / 2, 0); c.lineTo(x + w / 2, 0); c.lineTo(x, h); c.fill();
        }
      },
      // il portale rosso pulsa, quindi si ridisegna a ogni frame
      live(t) {
        const rx = Math.min(W * 0.2, 150), ry = rx * 1.3;
        const x = CX, y = Y0 - ry * 0.75;
        glow(x, y, rx * 2.6, '255,30,60', 0.25 + 0.08 * Math.sin(t * 3));
        const gr = g.createRadialGradient(x, y, 0, x, y, ry);
        gr.addColorStop(0, '#ffe2e2'); gr.addColorStop(.25, '#ff5a6b'); gr.addColorStop(.6, '#b0081f'); gr.addColorStop(1, 'rgba(70,0,10,0)');
        g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
        g.save(); g.translate(x, y); g.strokeStyle = 'rgba(255,200,210,.35)'; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          g.rotate(t * 0.6 + i * 1.6);
          g.beginPath(); g.ellipse(0, 0, rx * (0.35 + i * 0.13), ry * (0.3 + i * 0.12), 0, 0, Math.PI * 1.2); g.stroke();
        }
        g.restore();
      },
    },
  };

  function background(theme) {
    const key = theme + W + 'x' + H;
    if (bgKey === key) return bg;
    bg = document.createElement('canvas');
    bg.width = Math.round(W * DPR); bg.height = Math.round((Y0 + 4) * DPR);
    const c = bg.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    THEMES[theme].sky(c);
    bgKey = key;
    return bg;
  }

  function drawGround(T, dist) {
    g.fillStyle = T.ground; g.fillRect(0, Y0, W, H - Y0);
    // fasce trasversali che scorrono: danno la sensazione di velocita'
    const off = dist % 10;
    for (let z = -off - 10; z < 110; z += 10) quad(-8, 8, z, z + 5, T.band);
    quad(-1.5, 1.5, -4, 300, T.road);
    for (let z = -off - 10; z < 110; z += 10) quad(-1.5, 1.5, z, z + 5, T.roadBand);
    // tratteggio tra le corsie
    const o6 = dist % 6;
    for (const l of [-0.5, 0.5])
      for (let z = -o6 - 6; z < 90; z += 6) quad(l - 0.025, l + 0.025, z, z + 2.6, T.line);
    for (const l of [-1.5, 1.5]) quad(l - 0.05, l + 0.05, -4, 300, T.edge);
    // nebbia sull'orizzonte
    const fg = g.createLinearGradient(0, Y0 - 2, 0, Y0 + H * 0.08);
    fg.addColorStop(0, `rgba(${T.fog},1)`); fg.addColorStop(1, `rgba(${T.fog},0)`);
    g.fillStyle = fg; g.fillRect(0, Y0 - 2, W, H * 0.08 + 2);
  }

  function drawProps(T, dist, t) {
    const step = 12, off = dist % step;
    for (let z = 96 - off; z > -4; z -= step) {
      for (const side of [-1, 1]) {
        const p = proj(side * 2.25, z), u = LW * p.s;
        if (T.prop === 'lamp') {
          rrect(p.x - u * 0.03, p.y - u * 2.3, u * 0.06, u * 2.3, u * 0.02, '#2a2238');
          const hx = p.x - side * u * 0.35, hy = p.y - u * 2.3;
          g.strokeStyle = '#2a2238'; g.lineWidth = Math.max(1, u * 0.04);
          g.beginPath(); g.moveTo(p.x, hy); g.lineTo(hx, hy); g.stroke();
          glow(hx, hy + u * 0.06, u * 0.7, '255,214,150', 0.45);
          ell(hx, hy + u * 0.05, u * 0.09, u * 0.04, '#fff3d6');
        } else {
          rrect(p.x - u * 0.13, p.y - u * 1.5, u * 0.26, u * 1.5, u * 0.04, '#1d1728');
          rrect(p.x - u * 0.2, p.y - u * 1.6, u * 0.4, u * 0.12, u * 0.03, '#2a2238');
          flame(p.x, p.y - u * 1.62, u * 0.22, t + z);
        }
      }
    }
  }
  function flame(x, y, r, t) {
    glow(x, y - r * 0.6, r * 4, '255,120,40', 0.35 + 0.1 * Math.sin(t * 11));
    const f = 1 + 0.15 * Math.sin(t * 17);
    g.beginPath();
    g.moveTo(x - r * 0.6, y);
    g.quadraticCurveTo(x - r * 0.7, y - r * 1.1 * f, x, y - r * 2 * f);
    g.quadraticCurveTo(x + r * 0.7, y - r * 1.1 * f, x + r * 0.6, y);
    g.closePath(); g.fillStyle = '#ff8a2a'; g.fill();
    ell(x, y - r * 0.5, r * 0.3, r * 0.6 * f, '#ffe9a0');
  }

  /* ================= ostacoli e oggetti ================= */
  function shadow(x, y, rx) { ell(x, y, rx, rx * 0.22, 'rgba(0,0,0,.35)'); }

  const OBST = {
    curse(x, y, u, t) {
      const w = 0.8 * u, h = 0.72 * u, wob = Math.sin(t * 6 + x * 0.05) * 0.04 * u;
      shadow(x, y, w * 0.55);
      glow(x, y - h * 0.5, w, '150,80,255', 0.3);
      for (let i = -2; i <= 2; i++) ell(x + i * w * 0.18, y - h * 0.08, w * 0.12, h * 0.12 + Math.sin(t * 8 + i) * u * 0.02, '#3b1470');
      const gr = g.createRadialGradient(x - w * .15, y - h * .7, w * .05, x, y - h * .5, w * .65);
      gr.addColorStop(0, '#b27bff'); gr.addColorStop(.55, '#5a1fa8'); gr.addColorStop(1, '#250a4d');
      g.beginPath(); g.ellipse(x, y - h * 0.5 + wob, w / 2, h / 2, 0, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
      const eyes = [[-0.2, -0.66, 0.1], [0.18, -0.6, 0.12], [-0.02, -0.82, 0.07], [0.3, -0.38, 0.06], [-0.32, -0.42, 0.06]];
      for (const [ex, ey, er] of eyes) {
        const blink = (Math.sin(t * 2 + ex * 9) > 0.96) ? 0.15 : 1;
        ell(x + ex * w, y + ey * h + wob, er * w, er * w * blink, '#fff');
        ell(x + ex * w, y + ey * h + wob, er * w * .5, er * w * .5 * blink, '#e3002b');
      }
      g.beginPath(); g.ellipse(x, y - h * 0.3 + wob, w * 0.2, h * 0.08, 0, 0, Math.PI); g.fillStyle = '#12021f'; g.fill();
      g.fillStyle = '#fff';
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * w * 0.07 - w * 0.025, y - h * 0.3 + wob); g.lineTo(x + i * w * 0.07 + w * 0.025, y - h * 0.3 + wob); g.lineTo(x + i * w * 0.07, y - h * 0.24 + wob); g.fill(); }
    },
    barrier(x, y, u, t) {
      const w = 0.92 * u, h = 0.52 * u;
      shadow(x, y, w * 0.55);
      for (const s of [-1, 1]) rrect(x + s * w * 0.38 - u * 0.03, y - h, u * 0.06, h, u * 0.02, '#ddd');
      const py = y - h, ph = h * 0.42;
      g.save();
      g.beginPath(); g.rect(x - w / 2, py, w, ph); g.clip();
      g.fillStyle = '#ffcc00'; g.fillRect(x - w / 2, py, w, ph);
      g.fillStyle = '#111';
      for (let i = -6; i < 8; i++) { const sx = x - w / 2 + i * w * 0.14; g.beginPath(); g.moveTo(sx, py + ph); g.lineTo(sx + w * 0.07, py + ph); g.lineTo(sx + w * 0.07 + ph, py); g.lineTo(sx + ph, py); g.fill(); }
      g.restore();
      g.strokeStyle = '#111'; g.lineWidth = Math.max(1, u * 0.015); g.strokeRect(x - w / 2, py, w, ph);
      const on = Math.sin(t * 8) > 0;
      if (on) glow(x - w * 0.38, py - u * 0.04, u * 0.25, '255,60,40', 0.7);
      ell(x - w * 0.38, py - u * 0.04, u * 0.04, u * 0.04, on ? '#ff5a3a' : '#7a1a10');
    },
    rubble(x, y, u) {
      shadow(x, y, u * 0.5);
      const rocks = [[-0.25, 0, 0.26, '#5d5668'], [0.2, 0, 0.3, '#4f4859'], [-0.02, -0.16, 0.24, '#6f677c'], [0.33, -0.05, 0.16, '#625a70'], [-0.38, -0.03, 0.14, '#544d5f']];
      for (const [rx, ry, rr, col] of rocks) {
        const cx = x + rx * u, cy = y + ry * u - rr * u * 0.5, r = rr * u;
        poly([cx - r, cy + r * .5, cx - r * .7, cy - r * .5, cx, cy - r * .8, cx + r * .8, cy - r * .4, cx + r, cy + r * .5], col);
        g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = Math.max(1, u * 0.01);
        g.beginPath(); g.moveTo(cx - r * .3, cy - r * .3); g.lineTo(cx + r * .1, cy + r * .2); g.stroke();
      }
      g.strokeStyle = '#8a4b2a'; g.lineWidth = Math.max(1, u * 0.025);
      g.beginPath(); g.moveTo(x - u * 0.1, y - u * 0.3); g.lineTo(x + u * 0.25, y - u * 0.55); g.stroke();
    },
    goblin(x, y, u, t) {
      const b = Math.abs(Math.sin(t * 7 + x)) * u * 0.04;
      shadow(x, y, u * 0.3);
      for (const s of [-1, 1]) rrect(x + s * u * 0.08 - u * 0.04, y - u * 0.22, u * 0.08, u * 0.22, u * 0.03, '#2f5a24');
      ell(x, y - u * 0.36 - b, u * 0.17, u * 0.18, '#4c8a3a');
      rrect(x - u * 0.15, y - u * 0.34 - b, u * 0.3, u * 0.12, u * 0.03, '#5a3a1e');
      const hy = y - u * 0.62 - b;
      for (const s of [-1, 1]) poly([x + s * u * 0.12, hy - u * 0.02, x + s * u * 0.36, hy - u * 0.14, x + s * u * 0.13, hy + u * 0.06], '#3f7a30');
      ell(x, hy, u * 0.15, u * 0.14, '#56a042');
      glow(x, hy, u * 0.25, '255,40,40', 0.35);
      for (const s of [-1, 1]) ell(x + s * u * 0.055, hy - u * 0.01, u * 0.03, u * 0.022, '#ff2a2a');
      g.fillStyle = '#fff'; g.fillRect(x - u * 0.05, hy + u * 0.06, u * 0.025, u * 0.03); g.fillRect(x + u * 0.025, hy + u * 0.06, u * 0.025, u * 0.03);
      g.save(); g.translate(x + u * 0.2, y - u * 0.4 - b); g.rotate(-0.6 + Math.sin(t * 7) * 0.2);
      rrect(-u * 0.02, -u * 0.25, u * 0.04, u * 0.25, u * 0.01, '#c9ccd6'); rrect(-u * 0.05, 0, u * 0.1, u * 0.03, u * 0.01, '#5a3a1e');
      g.restore();
    },
    spikes(x, y, u) {
      ell(x, y, u * 0.46, u * 0.1, '#1d1925');
      const sp = [-0.32, -0.16, 0, 0.16, 0.32];
      sp.forEach((sx, i) => {
        const h = u * (i % 2 ? 0.4 : 0.52), bx = x + sx * u, w = u * 0.08;
        const gr = g.createLinearGradient(bx - w, 0, bx + w, 0);
        gr.addColorStop(0, '#5f6270'); gr.addColorStop(.5, '#e4e7f0'); gr.addColorStop(1, '#6b6f7d');
        poly([bx - w, y, bx + w, y, bx, y - h], gr);
      });
    },
    lava(x, y, u, t) {
      glow(x, y - u * 0.1, u * 0.8, '255,110,20', 0.35);
      const gr = g.createRadialGradient(x, y, 0, x, y, u * 0.5);
      gr.addColorStop(0, '#fff2a8'); gr.addColorStop(.35, '#ff9a1a'); gr.addColorStop(.8, '#c42000'); gr.addColorStop(1, '#4a0800');
      g.beginPath(); g.ellipse(x, y, u * 0.48, u * 0.15, 0, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
      for (let i = 0; i < 3; i++) {
        const k = (t * 1.3 + i * 0.33) % 1;
        ell(x + (i - 1) * u * 0.18, y - k * u * 0.08, u * 0.03 * (1 - k) + u * 0.01, u * 0.02 * (1 - k) + u * 0.006, 'rgba(255,240,170,.9)');
      }
    },
  };

  function drawFrag(x, y, u, t) {
    const cy = y - u * 0.5 + Math.sin(t * 4 + x) * u * 0.06;
    shadow(x, y, u * 0.2);
    glow(x, cy, u * 0.5, '255,210,94', 0.55);
    const sx = Math.cos(t * 3 + x * 0.01);
    g.save(); g.translate(x, cy); g.scale(Math.abs(sx) * 0.9 + 0.1, 1);
    const w = u * 0.3, h = u * 0.42;
    const gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    gr.addColorStop(0, '#fff6c4'); gr.addColorStop(.5, '#ffd25e'); gr.addColorStop(1, '#e09a1a');
    rrect(-w / 2, -h / 2, w, h, w * 0.15, gr);
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, u * 0.02); g.stroke();
    poly([0, -h * 0.25, w * 0.2, 0, 0, h * 0.25, -w * 0.2, 0], sx > 0 ? '#8b5cff' : '#c25a00');
    g.restore();
  }

  function drawIcon(kind, x, y, r) {
    g.save(); g.translate(x, y);
    switch (kind) {
      case 'inf':
        g.fillStyle = '#fff'; g.font = `900 ${r * 1.5}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('∞', 0, r * 0.05); break;
      case 'eye':
        g.beginPath(); g.moveTo(-r * .75, 0); g.quadraticCurveTo(0, -r * .7, r * .75, 0); g.quadraticCurveTo(0, r * .7, -r * .75, 0);
        g.fillStyle = '#fff'; g.fill();
        ell(0, 0, r * .3, r * .3, '#3fd8ff'); ell(0, 0, r * .13, r * .13, '#05213a'); break;
      case 'heart':
        g.beginPath(); g.moveTo(0, r * .55);
        g.bezierCurveTo(-r * .9, -r * .05, -r * .45, -r * .75, 0, -r * .3);
        g.bezierCurveTo(r * .45, -r * .75, r * .9, -r * .05, 0, r * .55);
        g.fillStyle = '#fff'; g.fill(); break;
      case 'hood':
        g.beginPath(); g.moveTo(-r * .6, r * .55); g.quadraticCurveTo(-r * .7, -r * .7, 0, -r * .7); g.quadraticCurveTo(r * .7, -r * .7, r * .6, r * .55); g.closePath();
        g.fillStyle = '#0b0712'; g.fill();
        ell(-r * .18, -r * .05, r * .09, r * .05, '#c9a6ff'); ell(r * .18, -r * .05, r * .09, r * .05, '#c9a6ff'); break;
      case 'helm':
        g.beginPath(); g.arc(0, -r * .05, r * .55, Math.PI, 0); g.lineTo(r * .45, r * .55); g.lineTo(-r * .45, r * .55); g.closePath();
        g.fillStyle = '#0b0712'; g.fill();
        g.fillStyle = '#c9a6ff'; g.fillRect(-r * .38, -r * .05, r * .26, r * .1); g.fillRect(r * .12, -r * .05, r * .26, r * .1); break;
      case 'potion':
        rrect(-r * .12, -r * .7, r * .24, r * .3, r * .05, '#d9d2c5');
        g.beginPath(); g.arc(0, r * .15, r * .45, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
        g.beginPath(); g.arc(0, r * .15, r * .36, 0, Math.PI); g.fillStyle = '#3d8bff'; g.fill(); break;
    }
    g.restore();
  }

  const POW_RGB = { shield: '94,231,255', special: '139,92,255', life: '255,80,110' };
  function drawPow(x, y, u, t, kind, L) {
    const cy = y - u * 0.5 + Math.sin(t * 4 + x) * u * 0.06, r = u * 0.2;
    shadow(x, y, u * 0.18);
    glow(x, cy, r * 2.6, POW_RGB[kind], 0.6);
    const gr = g.createRadialGradient(x - r * .3, cy - r * .3, r * .1, x, cy, r);
    gr.addColorStop(0, `rgba(${POW_RGB[kind]},1)`); gr.addColorStop(1, `rgba(${POW_RGB[kind]},.55)`);
    ell(x, cy, r, r, gr);
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = Math.max(1, u * 0.015);
    g.beginPath(); g.arc(x, cy, r * (1.15 + 0.1 * Math.sin(t * 6)), 0, Math.PI * 2); g.stroke();
    drawIcon(L.icons[kind], x, cy, r);
  }

  function drawOrb(x, y, u, t, col) {
    const cy = y - u * 0.45, r = u * 0.22;
    glow(x, cy, r * 3, hexRgb(col), 0.7);
    const gr = g.createRadialGradient(x, cy, 0, x, cy, r);
    gr.addColorStop(0, '#fff'); gr.addColorStop(.45, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ell(x, cy, r, r, gr);
    g.save(); g.translate(x, cy); g.rotate(t * 5); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = Math.max(1, u * 0.02);
    g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 0.8); g.stroke(); g.restore();
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; }

  function drawShot(x, y, u, cols) {
    const cy = y - u * 0.45, R = u * 0.42;
    glow(x, cy, R * 1.6, hexRgb(cols[1]), 0.5);
    g.save(); g.lineCap = 'round';
    g.strokeStyle = cols[1]; g.lineWidth = u * 0.14;
    g.beginPath(); g.arc(x, cy + R * 0.6, R, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.strokeStyle = cols[0]; g.lineWidth = u * 0.05;
    g.beginPath(); g.arc(x, cy + R * 0.6, R, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    g.restore();
  }

  /* ================= personaggi ================= */
  const LOOKS = {
    gojo:   { pants: '#1b2340', shoe: '#0c0f1c', top: '#1d2647', sleeve: '#222c52', skin: '#f1d2b8', hair: '#f4f7ff' },
    jinwoo: { pants: '#14121a', shoe: '#0a090e', top: '#1b1824', sleeve: '#211d2c', skin: '#e8c4a4', hair: '#121018' },
    shadow: { pants: '#0c0716', shoe: '#05030a', top: '#120a20', sleeve: '#150c26', skin: '#120a20', hair: '#0c0716' },
  };

  // visto da dietro: corre "dentro" lo schermo. (x, y) = piedi, h = altezza
  function drawRunner(look, x, y, h, t, alpha) {
    const C = LOOKS[look], u = h / 100, ph = t * 13, sw = Math.sin(ph);
    g.save(); g.globalAlpha = alpha;
    ell(x, y, 22 * u, 6 * u, 'rgba(0,0,0,.4)');
    const by = y - Math.abs(Math.cos(ph)) * 3 * u;
    if (look === 'jinwoo') glow(x, by - 55 * u, 70 * u, '139,92,255', 0.28 + 0.08 * Math.sin(t * 9));
    if (look === 'shadow') glow(x, by - 55 * u, 60 * u, '139,92,255', 0.5);
    // gambe: quella sollevata si accorcia (il piede va indietro e in alto)
    for (const side of [-1, 1]) {
      const lift = Math.max(0, Math.sin(ph + (side > 0 ? Math.PI : 0))) * 12 * u;
      rrect(x + side * 8 * u - 6 * u, by - 46 * u, 12 * u, 42 * u - lift, 5 * u, C.pants);
      rrect(x + side * 8 * u - 7 * u, by - 9 * u - lift, 14 * u, 8 * u, 3 * u, C.shoe);
    }
    // braccia
    for (const side of [-1, 1]) {
      g.save(); g.translate(x + side * 19 * u, by - 82 * u); g.rotate(side * 0.18 + sw * side * 0.4);
      rrect(-5 * u, 0, 10 * u, 32 * u, 5 * u, C.sleeve);
      ell(0, 34 * u, 5 * u, 5 * u, C.skin);
      g.restore();
    }
    // busto: Jin-Woo ha il cappotto lungo che svolazza
    if (look === 'jinwoo' || look === 'shadow') {
      const fl = Math.sin(ph * 2) * 3 * u;
      poly([x - 20 * u, by - 86 * u, x + 20 * u, by - 86 * u, x + 24 * u + fl, by - 30 * u, x + 6 * u, by - 26 * u - fl, x - 6 * u, by - 26 * u + fl, x - 24 * u - fl, by - 30 * u], C.top);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5 * u;
      g.beginPath(); g.moveTo(x, by - 70 * u); g.lineTo(x, by - 28 * u); g.stroke();
    } else {
      rrect(x - 19 * u, by - 87 * u, 38 * u, 46 * u, 9 * u, C.top);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5 * u;
      g.beginPath(); g.moveTo(x, by - 80 * u); g.lineTo(x, by - 42 * u); g.stroke();
    }
    // collo
    rrect(x - 5 * u, by - 93 * u, 10 * u, 9 * u, 3 * u, look === 'gojo' ? C.top : C.skin);
    // testa (da dietro: si vedono i capelli)
    const hy = by - 103 * u;
    ell(x, hy, 13 * u, 14 * u, C.hair);
    if (look === 'gojo') {
      // capelli bianchi sparati in alto
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + Math.PI * i / 10, r = (i % 2 ? 23 : 14) * u + (i % 2 ? Math.sin(t * 3 + i) * u : 0);
        const px = x + Math.cos(a) * r, py = hy + Math.sin(a) * r * 1.05;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fillStyle = C.hair; g.fill();
      // benda nera con il nodo dietro e i lembi che svolazzano
      rrect(x - 14 * u, hy - 2 * u, 28 * u, 7 * u, 3 * u, '#0b0b12');
      const fl = Math.sin(ph * 1.3) * 4 * u;
      poly([x - 1 * u, hy + 2 * u, x + 3 * u, hy + 2 * u, x + 6 * u + fl, hy + 20 * u, x + 1 * u + fl, hy + 19 * u], '#0b0b12');
      poly([x - 3 * u, hy + 2 * u, x + 1 * u, hy + 2 * u, x - 4 * u - fl, hy + 18 * u, x - 8 * u - fl, hy + 16 * u], '#0b0b12');
      ell(x, hy + 1.5 * u, 3.5 * u, 3 * u, '#15151f');
    } else {
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * 0.9 + Math.PI * 1.2 * i / 12, r = (i % 2 ? 17 : 13) * u;
        const px = x + Math.cos(a) * r, py = hy + Math.sin(a) * r;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fillStyle = C.hair; g.fill();
      if (look === 'jinwoo') {
        g.strokeStyle = 'rgba(139,92,255,.55)'; g.lineWidth = 1.5 * u;
        g.beginPath(); g.arc(x, hy, 15 * u, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        // cappuccio abbassato sulle spalle
        ell(x, by - 86 * u, 16 * u, 6 * u, '#15121e');
      } else {
        for (const s of [-1, 1]) ell(x + s * 5 * u, hy, 3 * u, 1.6 * u, '#c9a6ff');
      }
    }
    g.restore();
  }

  /* ---- boss (di fronte) ---- */
  function drawSukuna(x, y, h, t, b) {
    const u = h / 120, atk = b.atk;
    glow(x, y - 60 * u, 90 * u, '255,30,70', 0.32 + 0.1 * Math.sin(t * 5));
    const W1 = '#ece5dc', W2 = '#c9bfb4', SK = '#efc7ad';
    for (const s of [-1, 1]) rrect(x + s * 13 * u - 7 * u, y - 7 * u, 14 * u, 7 * u, 2 * u, '#1a1014');
    poly([x - 22 * u, y - 54 * u, x + 22 * u, y - 54 * u, x + 30 * u, y - 5 * u, x - 30 * u, y - 5 * u], W1);
    g.strokeStyle = W2; g.lineWidth = 1.5 * u;
    for (const k of [-14, -4, 6, 16]) { g.beginPath(); g.moveTo(x + k * u * 0.9, y - 52 * u); g.lineTo(x + k * u * 1.15, y - 6 * u); g.stroke(); }
    // braccia: il destro si alza quando attacca
    for (const s of [-1, 1]) {
      g.save(); g.translate(x + s * 25 * u, y - 88 * u);
      g.rotate(s * 0.28 - (s > 0 ? atk * 2.1 : 0));
      poly([-7 * u, 0, 7 * u, 0, 13 * u, 34 * u, -11 * u, 34 * u], W1);
      rrect(-4 * u, 32 * u, 8 * u, 15 * u, 3 * u, SK);
      g.fillStyle = '#111'; g.fillRect(-4 * u, 37 * u, 8 * u, 1.6 * u); g.fillRect(-4 * u, 41 * u, 8 * u, 1.6 * u);
      ell(0, 49 * u, 5 * u, 5 * u, SK);
      g.restore();
    }
    poly([x - 27 * u, y - 92 * u, x + 27 * u, y - 92 * u, x + 22 * u, y - 52 * u, x - 22 * u, y - 52 * u], W1);
    poly([x - 10 * u, y - 92 * u, x + 10 * u, y - 92 * u, x, y - 66 * u], SK);
    g.strokeStyle = '#111'; g.lineWidth = 1.6 * u;
    g.beginPath(); g.moveTo(x - 5 * u, y - 84 * u); g.lineTo(x + 5 * u, y - 84 * u); g.moveTo(x - 3 * u, y - 78 * u); g.lineTo(x + 3 * u, y - 78 * u); g.stroke();
    g.strokeStyle = W2; g.lineWidth = 2 * u;
    g.beginPath(); g.moveTo(x - 10 * u, y - 92 * u); g.lineTo(x, y - 66 * u); g.lineTo(x + 10 * u, y - 92 * u); g.stroke();
    g.fillStyle = '#1b1418'; g.fillRect(x - 23 * u, y - 57 * u, 46 * u, 7 * u);
    rrect(x - 5 * u, y - 100 * u, 10 * u, 10 * u, 3 * u, SK);
    const hy = y - 110 * u;
    ell(x, hy, 11.5 * u, 13.5 * u, SK);
    // capelli rosa a punte
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 1.02 + Math.PI * 0.96 * i / 12, r = (i % 2 ? 21 : 12.5) * u;
      const px = x + Math.cos(a) * r, py = hy - 2 * u + Math.sin(a) * r;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fillStyle = '#f4a3c4'; g.fill();
    // occhi rossi, seconda coppia e segni neri sul viso
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(x + s * 2 * u, hy - 1 * u); g.quadraticCurveTo(x + s * 5 * u, hy - 3.5 * u, x + s * 8.5 * u, hy - 1.5 * u); g.quadraticCurveTo(x + s * 5 * u, hy + 0.8 * u, x + s * 2 * u, hy - 1 * u);
      g.fillStyle = '#fff'; g.fill();
      ell(x + s * 5 * u, hy - 1.3 * u, 1.5 * u, 1.5 * u, '#d10f2f');
      ell(x + s * 6 * u, hy + 3 * u, 2 * u, 0.9 * u, '#d10f2f');
      g.strokeStyle = '#111'; g.lineWidth = 1.3 * u;
      g.beginPath(); g.moveTo(x + s * 3 * u, hy + 5 * u); g.quadraticCurveTo(x + s * 8 * u, hy + 5 * u, x + s * 10 * u, hy + 1 * u); g.stroke();
    }
    g.strokeStyle = '#111'; g.lineWidth = 1.3 * u;
    g.beginPath(); g.moveTo(x - 3 * u, hy - 7 * u); g.lineTo(x + 3 * u, hy - 7 * u); g.stroke();
    // ghigno
    g.beginPath(); g.moveTo(x - 5 * u, hy + 7 * u); g.quadraticCurveTo(x, hy + 10.5 * u, x + 5 * u, hy + 6 * u); g.quadraticCurveTo(x, hy + 8 * u, x - 5 * u, hy + 7 * u);
    g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#300'; g.lineWidth = 0.8 * u; g.stroke();
  }

  function drawIgris(x, y, h, t, b) {
    const u = h / 120, atk = b.atk;
    glow(x, y - 60 * u, 90 * u, '200,0,30', 0.35 + 0.1 * Math.sin(t * 4));
    const wave = Math.sin(t * 3) * 4 * u;
    poly([x - 28 * u, y - 92 * u, x + 28 * u, y - 92 * u, x + 42 * u + wave, y - 4 * u, x - 42 * u - wave, y - 4 * u], '#4a0710');
    for (const s of [-1, 1]) {
      rrect(x + s * 11 * u - 6.5 * u, y - 46 * u, 13 * u, 42 * u, 4 * u, '#8e1222');
      ell(x + s * 11 * u, y - 26 * u, 5 * u, 4 * u, '#d9a441');
      rrect(x + s * 11 * u - 8 * u, y - 7 * u, 16 * u, 7 * u, 2 * u, '#3a0a10');
    }
    poly([x - 22 * u, y - 58 * u, x + 22 * u, y - 58 * u, x + 26 * u, y - 40 * u, x - 26 * u, y - 40 * u], '#a3192b');
    const gr = g.createLinearGradient(x, y - 92 * u, x, y - 56 * u);
    gr.addColorStop(0, '#e03549'); gr.addColorStop(1, '#7c0c1c');
    poly([x - 24 * u, y - 94 * u, x + 24 * u, y - 94 * u, x + 18 * u, y - 56 * u, x - 18 * u, y - 56 * u], gr);
    g.strokeStyle = '#d9a441'; g.lineWidth = 1.6 * u;
    g.beginPath(); g.moveTo(x, y - 92 * u); g.lineTo(x, y - 58 * u); g.moveTo(x - 16 * u, y - 80 * u); g.lineTo(x + 16 * u, y - 80 * u); g.stroke();
    // spada piantata a terra davanti a lui (si alza quando attacca)
    const sy = -atk * 40 * u;
    const bl = g.createLinearGradient(x - 3 * u, 0, x + 3 * u, 0);
    bl.addColorStop(0, '#8d93a3'); bl.addColorStop(.5, '#f3f5fb'); bl.addColorStop(1, '#8d93a3');
    poly([x - 3.5 * u, y - 58 * u + sy, x + 3.5 * u, y - 58 * u + sy, x + 2 * u, y - 4 * u + sy, x, y + sy, x - 2 * u, y - 4 * u + sy], bl);
    rrect(x - 12 * u, y - 61 * u + sy, 24 * u, 4 * u, 1.5 * u, '#d9a441');
    rrect(x - 2 * u, y - 72 * u + sy, 4 * u, 11 * u, 1 * u, '#3a0a10');
    ell(x, y - 73 * u + sy, 3 * u, 3 * u, '#d9a441');
    for (const s of [-1, 1]) {
      g.strokeStyle = '#8e1222'; g.lineWidth = 9 * u; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x + s * 22 * u, y - 88 * u); g.quadraticCurveTo(x + s * 18 * u, y - 70 * u, x + s * 4 * u, y - 66 * u + sy); g.stroke();
      ell(x + s * 4 * u, y - 66 * u + sy, 4.5 * u, 4.5 * u, '#5a0a14');
      ell(x + s * 25 * u, y - 91 * u, 13 * u, 9 * u, '#c21f33');
      g.strokeStyle = '#d9a441'; g.lineWidth = 1.5 * u; g.lineCap = 'butt';
      g.beginPath(); g.ellipse(x + s * 25 * u, y - 91 * u, 13 * u, 9 * u, 0, Math.PI, 0); g.stroke();
    }
    const hy = y - 106 * u;
    // pennacchio rosso che ondeggia
    g.beginPath(); g.moveTo(x - 2 * u, hy - 12 * u);
    g.bezierCurveTo(x + 10 * u, hy - 30 * u, x + 30 * u + wave, hy - 18 * u, x + 36 * u + wave * 1.5, hy + 8 * u);
    g.bezierCurveTo(x + 22 * u, hy - 8 * u, x + 10 * u, hy - 10 * u, x + 2 * u, hy - 8 * u);
    g.fillStyle = '#ff2440'; g.fill();
    ell(x, hy, 11 * u, 13 * u, '#b81a2e');
    g.strokeStyle = '#d9a441'; g.lineWidth = 1.4 * u;
    g.beginPath(); g.moveTo(x, hy - 13 * u); g.lineTo(x, hy + 4 * u); g.stroke();
    rrect(x - 8 * u, hy - 2 * u, 16 * u, 4 * u, 1.5 * u, '#14030a');
    glow(x, hy, 14 * u, '255,200,210', 0.6);
    for (const s of [-1, 1]) ell(x + s * 4 * u, hy, 2.4 * u, 1.1 * u, '#ffe1e6');
  }
  const BOSS_DRAW = { sukuna: drawSukuna, igris: drawIgris };

  function bossPos(b, t) {
    const p = proj(Math.sin(t * 0.8) * 0.55, BOSS_Z);
    const h = Math.min(H * 0.26, W * 0.58);   // la testa non deve finire sotto la barra della vita
    const k = b.phase === 'intro' ? clamp(b.t / 1.2, 0, 1) : 1;
    return { x: p.x, y: p.y + 4, h: h * (0.7 + 0.3 * k), a: k, cy: p.y - h * 0.5 };
  }

  /* ================= audio ================= */
  let ac = null, master = null;
  function unlockAudio() {
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      }
      ac.resume();
    } catch (e) { ac = null; }
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), gn = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(vol || 0.3, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, f0, f1, delay) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ac.createBufferSource(); src.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gn = ac.createGain(); gn.gain.value = vol;
    src.connect(lp).connect(gn).connect(master);
    src.start(t);
  }
  const SFX = {
    frag: () => { tone(988, 0, .08, 'triangle', .25); tone(1480, 0, .16, 'triangle', .25, .07); },
    power: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0, .14, 'square', .1, i * .06)),
    hit: () => { noise(.3, .9, 1800, 120); tone(160, 60, .25, 'sawtooth', .25); },
    ping: () => tone(1800, 2600, .1, 'sine', .15),
    slash: () => noise(.15, .5, 6000, 800),
    warn: () => tone(220, 170, .2, 'square', .07),
    whoosh: () => noise(.35, .45, 500, 3200),
    orb: () => tone(400, 1500, .25, 'sine', .25),
    bossHit: () => { noise(.3, .8, 3000, 200); tone(90, 40, .3, 'square', .2); },
    boss: () => { tone(110, 50, 1.3, 'sawtooth', .22); noise(1, .3, 400, 80); },
    final: () => { tone(60, 30, 2, 'sawtooth', .3); noise(2.2, .5, 8000, 100); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0, .5, 'triangle', .16, .7 + i * .12)); },
    card: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0, .3, 'triangle', .2, .3 + i * .1)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0, .3, 'square', .1, i * .18)),
  };
  const sfx = k => { try { SFX[k](); } catch (e) { /* audio non disponibile */ } };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* niente */ } };

  /* ================= stato di gioco ================= */
  let st = null;                                   // partita in corso
  const idle = { lv: 'gojo', dist: 0, t: 0, px: 0, ents: [] };  // sfondo dell'album
  let fx = [];
  let paused = false;

  function buildTrack(L) {
    const ents = [], rows = [];
    for (let z = 40; z < LENGTH - 25; z += 13 - 4 * (z / LENGTH) + rand(0, 3)) rows.push(z);
    const fragRows = new Set();
    for (let k = 0; k < FRAGS; k++) fragRows.add(Math.floor((k + 0.5) * rows.length / FRAGS));
    rows.forEach((z, i) => {
      const p = z / LENGTH;
      const lanes = shuffle([-1, 0, 1]);
      const n = Math.random() < 0.15 + 0.45 * p ? 2 : 1;
      for (let k = 0; k < n; k++) ents.push({ type: 'obs', kind: pick(L.obstacles), lane: lanes[k], z });
      const free = lanes[n];
      if (fragRows.has(i)) ents.push({ type: 'frag', lane: free, z });
      else if (i % 8 === 4) {
        const r = Math.random();
        ents.push({ type: 'pow', kind: r < 0.4 ? 'shield' : r < 0.8 ? 'special' : 'life', lane: free, z });
      }
    });
    return ents;
  }

  function startLevel(lv, opts) {
    const L = LEVELS[lv];
    idle.lv = lv;
    st = {
      lv, L, mode: 'run', t: 0, dist: 0, speed: 13, lives: 3, frags: 0,
      lane: 0, px: 0, inv: 0, power: null, powerT: 0, shake: 0, hurtT: 0,
      ents: buildTrack(L), boss: null, timers: [],
    };
    fx = [];
    tiltBase = null;
    paused = false;
    show(null);
    $('hud').classList.add('on');
    $('bossbar').classList.remove('on');
    hudCache = {};
    if (opts && opts.boss) { st.frags = opts.frags; startBoss(); }
    else if (location.hash === '#boss') { st.frags = FRAGS; startBoss(); }
    else say(L.place, 'Livello ' + L.n);
  }

  function later(t, fn) { st.timers.push({ t, fn }); }

  function update(dt) {
    const s = st, L = s.L;
    s.t += dt;
    for (const tm of s.timers) { tm.t -= dt; if (tm.t <= 0) { tm.done = true; tm.fn(); } }
    s.timers = s.timers.filter(tm => !tm.done);
    if (!st || st !== s) return;

    if (s.mode === 'run') {
      s.speed = 13 + 9 * Math.min(1, s.dist / LENGTH);
      s.dist += s.speed * dt;
      if (s.dist >= LENGTH) endRun();
    } else if (s.mode === 'boss' || s.mode === 'final') {
      s.speed = 15;
      s.dist += s.speed * dt;
      bossUpdate(dt);
    } else {
      s.dist += s.speed * dt;
      s.speed = Math.max(0, s.speed - 30 * dt);
    }

    const d = s.lane - s.px;
    s.px += Math.sign(d) * Math.min(Math.abs(d), 8 * dt);
    s.inv = Math.max(0, s.inv - dt);
    s.hurtT = Math.max(0, s.hurtT - dt);
    s.shake = Math.max(0, s.shake - dt);
    if (s.power) { s.powerT -= dt; if (s.powerT <= 0) s.power = null; }

    const alive = s.mode === 'run' || s.mode === 'boss';
    for (const e of s.ents) {
      if (e.done) continue;
      if (e.v) e.z -= e.v * dt;
      const rel = e.z - s.dist;
      if (rel < -4) { e.done = true; continue; }
      if (s.power === 'magnet' && e.type === 'frag' && rel < 10) e.lane += (s.px - e.lane) * Math.min(1, dt * 9);
      if (s.power === 'soldier' && e.type === 'obs' && rel < 5 && rel > 0) {
        e.done = true; sfx('slash');
        const p = proj(e.lane, rel); burst(p.x, p.y - LW * p.s * 0.3, '#8b5cff', 14, 220);
        continue;
      }
      // controllo "a spazzata": niente salti di collisione se un frame dura tanto
      const prev = e.rel === undefined ? rel : e.rel;
      e.rel = rel;
      if (alive && !e.passed && prev >= -0.6 && rel <= 0.6 && Math.abs(e.lane - s.px) < 0.55) collide(e, rel);
    }
    s.ents = s.ents.filter(e => !e.done);
  }

  function collide(e, rel) {
    const s = st, L = s.L;
    const p = proj(e.lane, rel), x = p.x, y = p.y - LW * 0.5;
    switch (e.type) {
      case 'frag':
        e.done = true; s.frags++; sfx('frag');
        pop('+1 ◆', x, y, '#ffd25e'); burst(x, y, '#ffd25e', 12, 180);
        if (s.frags === NEED) say(L.boss.name + ' ti aspetta', 'Boss sbloccato');
        break;
      case 'pow':
        e.done = true; sfx('power'); burst(x, y, '#fff', 14, 200);
        if (e.kind === 'life') { s.lives = Math.min(4, s.lives + 1); say(L.powers.life); }
        else {
          s.power = e.kind === 'shield' ? 'shield' : L.special;
          s.powerT = POWER_TIME;
          s.powerName = L.powers[e.kind];
          say(L.powers[e.kind], 'Powerup');
        }
        break;
      case 'orb':
        e.done = true; bossHit(x, y);
        break;
      case 'obs': case 'shot':
        e.passed = true;
        if (s.power === 'shield') { sfx('ping'); pop('MISS', x, y, '#5ee7ff'); return; }
        if (s.inv > 0) return;
        if (e.type === 'obs') { e.done = true; burst(x, y, '#ccc', 16, 240); }
        hurt();
        break;
    }
  }

  function hurt() {
    const s = st;
    s.lives--; s.inv = 1.4; s.shake = 0.35; s.hurtT = 0.4;
    sfx('hit'); buzz(140);
    if (s.lives <= 0) die();
  }

  function die() {
    const s = st;
    const inBoss = s.mode === 'boss';
    s.mode = 'dead';
    sfx('lose');
    later(1, () => showOver(inBoss ? 'boss' : 'run'));
  }

  function endRun() {
    const s = st;
    s.ents = s.ents.filter(e => e.z - s.dist < 3);
    if (s.frags >= NEED) { startBoss(); return; }
    s.mode = 'few';
    sfx('lose');
    later(0.8, () => showOver('few'));
  }

  function startBoss() {
    const s = st, L = s.L;
    s.mode = 'boss';
    s.ents = [];
    s.power = null;
    const hp = 100 - (s.frags - NEED) * 8;
    s.boss = { hp, t: 0, phase: 'intro', nextAtk: 2.6, nextOrb: 2, teles: [], atk: 0, flash: 0, orbN: 0 };
    $('bossbar').classList.add('on');
    $('bossbar').querySelector('.name').textContent = L.boss.name;
    sfx('boss'); s.shake = 0.6;
    say(L.boss.name, L.boss.title);
  }

  function bossUpdate(dt) {
    const s = st, b = s.boss;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt * 3);
    b.atk = Math.max(0, b.atk - dt * 2);
    if (s.mode !== 'boss') return;
    if (b.phase === 'intro') { if (b.t > 2.2) b.phase = 'fight'; return; }
    b.nextAtk -= dt;
    if (b.nextAtk <= 0) {
      const lanes = shuffle([-1, 0, 1]);
      const n = b.hp < 60 && Math.random() < 0.45 ? 2 : 1;
      for (let i = 0; i < n; i++) b.teles.push({ lane: lanes[i], t: 0 });
      b.nextAtk = 0.95 + 0.8 * (b.hp / 100) + rand(0, 0.4);
      sfx('warn');
    }
    for (const tl of b.teles) {
      tl.t += dt;
      if (tl.t >= 0.7 && !tl.fired) {
        tl.fired = true;
        s.ents.push({ type: 'shot', lane: tl.lane, z: s.dist + BOSS_Z - 2, v: 26 });
        b.atk = 1; sfx('whoosh');
      }
    }
    b.teles = b.teles.filter(tl => tl.t < 0.95);
    b.nextOrb -= dt;
    if (b.nextOrb <= 0) {
      const busy = b.teles.map(tl => tl.lane);
      const free = [-1, 0, 1].filter(l => !busy.includes(l));
      s.ents.push({ type: 'orb', lane: pick(free.length ? free : [-1, 0, 1]), z: s.dist + 40, n: b.orbN++ });
      b.nextOrb = 1.4 + rand(0, 0.7);
    }
  }

  function bossHit(x, y) {
    const s = st, b = s.boss, L = s.L;
    sfx('orb');
    const bp = bossPos(b, s.t);
    fx.push({ k: 'beam', x1: x, y1: y, x2: bp.x, y2: bp.cy, life: 0.3, max: 0.3, col: L.beam });
    later(0.22, () => {
      if (s.mode !== 'boss') return;
      b.hp -= 14; b.flash = 1; s.shake = 0.2;
      sfx('bossHit'); buzz(40);
      burst(bp.x, bp.cy, L.beam, 22, 320);
      pop('-14', bp.x + rand(-30, 30), bp.cy - 30, '#ff6b7f');
      if (b.hp <= 0) win();
    });
  }

  function win() {
    const s = st, L = s.L;
    s.mode = 'final';
    s.boss.hp = 0;
    s.boss.teles = [];
    s.ents = s.ents.filter(e => e.type !== 'shot' && e.type !== 'orb');
    sfx('final'); buzz([60, 40, 60, 40, 200]);
    if (!won.includes(L.id)) { won.push(L.id); save(); s.fresh = true; }
    later(0.7, () => finisher(L));
    later(3.9, () => { $('finisher').classList.remove('on'); reveal(L, s.fresh); });
  }

  /* ================= effetti ================= */
  function burst(x, y, col, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * rand(0.3, 1);
      fx.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3, life: rand(0.4, 0.8), max: 0.8, col, r: rand(2, 5) });
    }
  }
  function pop(txt, x, y, col) { fx.push({ k: 'txt', txt, x, y, col, life: 0.9, max: 0.9 }); }

  function updateFx(dt) {
    for (const f of fx) {
      f.life -= dt;
      if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 500 * dt; }
      if (f.k === 'txt') f.y -= 60 * dt;
    }
    fx = fx.filter(f => f.life > 0);
  }
  function drawFx() {
    for (const f of fx) {
      const a = clamp(f.life / f.max, 0, 1);
      g.globalAlpha = a;
      if (f.k === 'p') { g.fillStyle = f.col; g.fillRect(f.x - f.r / 2, f.y - f.r / 2, f.r, f.r); }
      else if (f.k === 'txt') {
        g.font = `italic 900 ${Math.round(LW * 0.24)}px "Arial Black", sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(f.txt, f.x, f.y);
        g.fillStyle = f.col; g.fillText(f.txt, f.x, f.y);
      } else if (f.k === 'beam') {
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        g.strokeStyle = f.col; g.lineWidth = 22 * a;
        g.beginPath(); g.moveTo(f.x1, f.y1); g.lineTo(f.x2, f.y2); g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 7 * a;
        g.beginPath(); g.moveTo(f.x1, f.y1); g.lineTo(f.x2, f.y2); g.stroke();
        g.restore();
      }
    }
    g.globalAlpha = 1;
  }

  /* ================= disegno del frame ================= */
  function render() {
    const v = st || idle, L = LEVELS[v.lv], T = THEMES[L.theme];
    g.save();
    if (st && st.shake > 0) g.translate(rand(-1, 1) * st.shake * 22, rand(-1, 1) * st.shake * 22);
    g.drawImage(background(L.theme), 0, 0, W, Y0 + 4);
    if (T.live) T.live(v.t);
    drawGround(T, v.dist);
    drawProps(T, v.dist, v.t);

    const b = st && st.boss;
    if (b) {
      const bp = bossPos(b, st.t);
      g.save(); g.globalAlpha = bp.a;
      BOSS_DRAW[L.boss.draw](bp.x, bp.y, bp.h, st.t, b);
      if (b.flash > 0) { g.globalCompositeOperation = 'lighter'; glow(bp.x, bp.cy, bp.h * 0.6, '255,255,255', b.flash * 0.8); }
      g.restore();
      // corsie in cui sta per arrivare l'attacco
      for (const tl of b.teles) {
        const k = 0.18 + 0.22 * Math.abs(Math.sin(tl.t * 18));
        quad(tl.lane - 0.45, tl.lane + 0.45, 0, BOSS_Z - 2, `rgba(255,30,60,${k})`);
      }
    }

    // oggetti dal piu' lontano al piu' vicino; il giocatore in mezzo
    const ents = v.ents.map(e => ({ e, rel: e.z - v.dist })).filter(o => o.rel < 80 && o.rel > -3).sort((a, c) => c.rel - a.rel);
    let drewPlayer = false;
    for (const o of ents) {
      if (!drewPlayer && o.rel < 0.3) { drawPlayer(v, L); drewPlayer = true; }
      drawEnt(o.e, o.rel, v, L);
    }
    if (!drewPlayer) drawPlayer(v, L);

    drawFx();
    g.restore();

    if (st && st.hurtT > 0) {
      const gr = g.createRadialGradient(CX, H / 2, Math.min(W, H) * 0.3, CX, H / 2, Math.max(W, H) * 0.75);
      gr.addColorStop(0, 'rgba(255,0,40,0)'); gr.addColorStop(1, `rgba(255,0,40,${st.hurtT * 1.2})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
  }

  function drawEnt(e, rel, v, L) {
    const p = proj(e.lane, rel), u = LW * p.s;
    switch (e.type) {
      case 'obs': OBST[e.kind](p.x, p.y, u, v.t); break;
      case 'frag': drawFrag(p.x, p.y, u, v.t); break;
      case 'pow': drawPow(p.x, p.y, u, v.t, e.kind, L); break;
      case 'orb': drawOrb(p.x, p.y, u, v.t, L.orb[e.n % L.orb.length]); break;
      case 'shot': drawShot(p.x, p.y, u, L.boss.shot); break;
    }
  }

  function drawPlayer(v, L) {
    const x = CX + v.px * LW, y = Y1, h = LW * 1.12;
    const s = st;
    let alpha = 1;
    if (s && s.inv > 0 && Math.floor(s.t * 14) % 2) alpha = 0.35;
    if (s && s.power === 'shield' && L.special === 'soldier') alpha = 0.35;  // furtivita'
    if (s && s.power === 'soldier') {
      const p = proj(v.px, 2.4);
      drawRunner('shadow', p.x, p.y, h * p.s, v.t + 0.3, 0.9);
    }
    const t = (s && (s.mode === 'dead' || s.mode === 'few')) ? s.t * 0.15 : v.t;
    drawRunner(L.look, x, y, h, t, alpha);
    if (s && s.power === 'shield' && L.special === 'magnet') {
      // Infinito: bolla blu attorno a Gojo
      const r = h * 0.62, cy = y - h * 0.55;
      const gr = g.createRadialGradient(x, cy, r * 0.6, x, cy, r);
      gr.addColorStop(0, 'rgba(94,231,255,0)'); gr.addColorStop(1, 'rgba(94,231,255,.4)');
      ell(x, cy, r, r, gr);
      g.strokeStyle = `rgba(200,250,255,${0.5 + 0.3 * Math.sin(v.t * 10)})`; g.lineWidth = 2;
      g.beginPath(); g.arc(x, cy, r, 0, Math.PI * 2); g.stroke();
    }
    if (s && s.power === 'shield' && L.special === 'soldier' && Math.random() < 0.5)
      fx.push({ k: 'p', x: x + rand(-20, 20), y: y - rand(0, h), vx: 0, vy: -40, life: 0.6, max: 0.6, col: 'rgba(139,92,255,.6)', r: rand(4, 9) });
    if (s && s.power === 'magnet') glow(x, y - h * 0.95, h * 0.4, '94,231,255', 0.5 + 0.2 * Math.sin(v.t * 8));
  }

  /* ================= HUD e messaggi ================= */
  let hudCache = {};
  function hud() {
    const s = st;
    const lives = Math.max(0, s.lives), slots = Math.max(3, lives);
    const key = lives + '/' + slots;
    if (hudCache.lives !== key) {
      hudCache.lives = key;
      $('lives').innerHTML = Array.from({ length: slots }, (_, i) => `<i class="${i < lives ? 'on' : ''}">♥</i>`).join('');
    }
    if (hudCache.frags !== s.frags) { hudCache.frags = s.frags; $('frags').textContent = `◆ ${s.frags}/${FRAGS}`; }
    $('prog').firstChild.style.width = (s.boss ? 100 : Math.min(100, s.dist / LENGTH * 100)) + '%';
    const pw = $('power');
    if (s.power) {
      pw.classList.add('on');
      pw.querySelector('.label').textContent = s.powerName;
      pw.querySelector('b').style.width = (s.powerT / POWER_TIME * 100) + '%';
    } else pw.classList.remove('on');
    if (s.boss) $('bossbar').querySelector('b').style.width = Math.max(0, s.boss.hp) + '%';
  }

  function say(text, small) {
    const m = $('msg');
    m.innerHTML = (small ? `<small>${small}</small>` : '') + text;
    m.classList.remove('on'); void m.offsetWidth; m.classList.add('on');
  }

  /* ================= schermate ================= */
  const SCREENS = ['album', 'brief', 'over', 'pause'];
  function show(id) { for (const s of SCREENS) $(s).classList.toggle('on', s === id); }

  function photoOrInitials(L) {
    const img = new Image();
    img.src = L.photo; img.alt = ''; img.draggable = false;
    img.onerror = () => {
      const d = document.createElement('div');
      d.className = 'initials';
      d.textContent = L.name.split(/[\s-]+/).map(w => w[0]).join('').slice(0, 2);
      img.replaceWith(d);
    };
    return img;
  }

  function renderAlbum(freshId) {
    const grid = $('grid');
    grid.innerHTML = '';
    ROSTER.forEach((r, i) => {
      const el = document.createElement('div');
      el.className = 'slot';
      const L = r.lv && LEVELS[r.lv];
      if (!L) {
        el.classList.add('soon');
        el.innerHTML = `<div class="mark">?</div><div class="who">???</div><div class="from">Prossimamente</div>`;
      } else if (won.includes(L.id)) {
        el.classList.add('won');
        if (L.id === freshId) el.classList.add('fresh');
        el.appendChild(photoOrInitials(L));
        el.insertAdjacentHTML('beforeend', `<span class="badge">N° ${i + 1}</span><div class="who">${L.name}</div><div class="from">${L.from}</div>`);
        el.onclick = () => openBrief(L.id);
      } else if (!L.unlock || won.includes(L.unlock)) {
        el.classList.add('play');
        el.innerHTML = `<div class="mark">?</div><span class="badge">Livello ${L.n}</span><div class="who">${L.name}</div><div class="from">${L.from}</div>`;
        el.onclick = () => openBrief(L.id);
      } else {
        el.classList.add('locked');
        el.innerHTML = `<div class="mark">🔒</div><div class="who">${L.name}</div><div class="from">Batti prima ${LEVELS[L.unlock].name.split(' ').pop()}</div>`;
      }
      grid.appendChild(el);
    });
    $('count').textContent = `${won.length} / ${ROSTER.length}`;
  }

  let briefLv = null;
  function openBrief(lv) {
    const L = LEVELS[lv];
    briefLv = lv;
    idle.lv = lv;
    $('bLv').textContent = `Livello ${L.n} · ${L.place}`;
    $('bName').textContent = L.name;
    $('bFrom').textContent = L.from;
    $('bStory').textContent = L.story;
    const move = touchDevice
      ? 'Inclina il telefono a destra e sinistra per cambiare corsia (oppure scorri col dito)'
      : 'Frecce ← → (o A / D) per cambiare corsia';
    $('bRules').innerHTML = [
      ['↔', move],
      ['◆', `Raccogli almeno <b>${NEED} frammenti</b> su ${FRAGS} della carta`],
      ['✦', `Powerup: ${L.powers.shield}, ${L.powers.special}, ${L.powers.life}`],
      ['☠', `Sconfiggi <b>${L.boss.name}</b>: schiva i suoi attacchi e prendi le sfere di energia`],
    ].map(([i, t]) => `<li><span>${i}</span>${t}</li>`).join('');
    show('brief');
  }

  function showOver(kind) {
    const s = st, L = s.L;
    $('hud').classList.remove('on');
    const hp = Math.max(1, Math.round(s.boss ? s.boss.hp : 100));
    const T = {
      run: ['Sconfitto!', `Hai raccolto ${s.frags} ${s.frags === 1 ? 'frammento' : 'frammenti'} su ${FRAGS}. Ritenta!`, 'Riprova', null],
      few: ['Frammenti insufficienti', `Ne hai ${s.frags === 1 ? 'preso solo 1' : `presi solo ${s.frags}`}: te ne servono almeno ${NEED} per sfidare ${L.boss.name}.`, 'Riprova', null],
      boss: [`${L.boss.name} ha vinto`, `Gli restava il ${hp}% di vita. ${hp <= 30 ? 'Ci sei quasi!' : 'Schiva le corsie rosse e prendi più sfere!'}`, 'Riprova il boss', 'Ricomincia il livello'],
    }[kind];
    $('oTitle').textContent = T[0];
    $('oText').textContent = T[1];
    $('oRetry').textContent = T[2];
    $('oAlt').textContent = T[3] || '';
    $('oAlt').style.display = T[3] ? '' : 'none';
    const frags = s.frags;
    $('oRetry').onclick = () => { unlockAudio(); startLevel(L.id, kind === 'boss' ? { boss: true, frags } : null); };
    $('oAlt').onclick = () => { unlockAudio(); startLevel(L.id); };
    show('over');
  }

  function toAlbum(freshId) {
    st = null;
    $('hud').classList.remove('on');
    renderAlbum(freshId);
    show('album');
  }

  function finisher(L) {
    const f = $('finisher');
    f.className = 'on ' + L.finCls;
    f.querySelector('.small').textContent = L.finisher[0];
    f.querySelector('.big').textContent = L.finisher[1];
    const c = f.querySelector('.stars');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    for (let i = 0; i < 260; i++) {
      x.fillStyle = L.finCls === 'void' ? `rgba(255,255,255,${Math.random()})` : `rgba(180,140,255,${Math.random() * 0.8})`;
      const r = Math.random() * 2.2;
      x.fillRect(Math.random() * W, Math.random() * H, r, r);
    }
  }

  function reveal(L, fresh) {
    $('hud').classList.remove('on');
    const face = $('rFace');
    face.innerHTML = '';
    face.appendChild(photoOrInitials(L));
    face.insertAdjacentHTML('beforeend', `<div class="cap"><b>${L.name}</b><span>${L.from}</span></div><div class="shine"></div>`);
    const r = $('reveal');
    // riparte l'animazione della carta anche se la mostro una seconda volta
    const inner = r.querySelector('.inner');
    inner.style.animation = 'none'; void inner.offsetWidth; inner.style.animation = '';
    r.classList.add('on');
    sfx('card');
    $('rGo').onclick = () => { r.classList.remove('on'); toAlbum(fresh ? L.id : null); };
  }

  $('bGo').addEventListener('click', () => {
    unlockAudio();
    askTilt();
    startLevel(briefLv);
  });
  $('bBack').addEventListener('click', () => show('album'));
  $('oBack').addEventListener('click', () => toAlbum());
  $('pGo').addEventListener('click', () => {
    unlockAudio();
    paused = false; tiltBase = null; last = performance.now();
    show(null);
  });

  function playing() { return st && !paused && (st.mode === 'run' || st.mode === 'boss'); }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing()) { paused = true; show('pause'); }
  });

  /* ================= controlli ================= */
  function move(d) { if (playing()) st.lane = clamp(st.lane + d, -1, 1); }

  // inclinazione: lo zero e' come tieni il telefono al via; corsia "assoluta"
  let tiltBase = null, tiltZone = 0;
  function askTilt() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function')
        DeviceOrientationEvent.requestPermission().catch(() => {});
    } catch (e) { /* niente sensori: resta lo swipe */ }
  }
  addEventListener('deviceorientation', e => {
    if (e.gamma === null || e.gamma === undefined) return;
    const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    const v = ang === 90 ? e.beta : (ang === -90 || ang === 270) ? -e.beta : e.gamma;
    if (tiltBase === null) { tiltBase = v; tiltZone = 0; return; }
    const d = v - tiltBase;
    let z = tiltZone;
    if (d > 13) z = 1; else if (d < -13) z = -1; else if (Math.abs(d) < 7) z = 0;
    if (z !== tiltZone) { tiltZone = z; if (playing()) st.lane = z; }
  });

  // swipe; un tocco veloce senza trascinare = una corsia verso quel lato
  let sx = null, sx0 = 0, swiped = false, downT = 0, pid = null;
  cv.addEventListener('pointerdown', e => { sx = sx0 = e.clientX; swiped = false; downT = performance.now(); pid = e.pointerId; });
  addEventListener('pointermove', e => {
    // solo il dito (o il mouse col tasto premuto) che ha iniziato lo swipe
    if (sx === null || e.pointerId !== pid || (e.pointerType === 'mouse' && !(e.buttons & 1))) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 28) { move(Math.sign(dx)); sx = e.clientX; swiped = true; }
  });
  addEventListener('pointerup', e => {
    if (sx !== null && !swiped && Math.abs(e.clientX - sx0) < 12 && performance.now() - downT < 300)
      move(e.clientX < W / 2 ? -1 : 1);
    sx = null;
  });
  addEventListener('pointercancel', () => { sx = null; });
  addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') move(-1);
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') move(1);
  });

  /* ================= ciclo principale ================= */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (st && !paused) { update(dt); if (st) hud(); }
    if (!st) { idle.t += dt; idle.dist += 7 * dt; }
    if (!paused) updateFx(dt);
    render();
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  resize();
  renderAlbum();
  requestAnimationFrame(frame);
})();
