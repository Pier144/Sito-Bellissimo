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
