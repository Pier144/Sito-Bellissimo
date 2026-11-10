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
