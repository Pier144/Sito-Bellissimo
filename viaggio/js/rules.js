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
})(globalThis.VIAGGIO = globalThis.VIAGGIO || {});
