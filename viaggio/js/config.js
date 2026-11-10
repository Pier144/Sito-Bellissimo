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
