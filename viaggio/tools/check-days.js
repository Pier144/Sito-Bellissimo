// Uso: node viaggio/tools/check-days.js  -> elenca i problemi di giocabilità, exit 1 se ce ne sono
for (const f of ['config', 'player', 'rules', 'days']) require(`../js/${f}.js`);
const V = globalThis.VIAGGIO;
let tot = 0;
V.GIORNI.forEach((g, i) => {
  const err = V.validaGiorno(g, i + 1);
  tot += err.length;
  console.log(`Giorno ${i + 1} (${g.bioma}): ${err.length ? err.length + ' problemi' : 'ok'}`);
  err.forEach(e => console.log('  - ' + e));
});
process.exit(tot ? 1 : 0);
