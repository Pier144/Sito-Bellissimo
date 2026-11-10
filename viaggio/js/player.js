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
