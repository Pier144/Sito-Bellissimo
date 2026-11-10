const test = require('node:test');
const assert = require('node:assert');
for (const f of ['config', 'player', 'rules']) require(`../js/${f}.js`);
const V = globalThis.VIAGGIO;

const base = eventi => ({ bioma: 'campi', durata: 30, diario: 'x', eventi });
const ricordi = [10, 14, 18].map(t => ({ t, tipo: 'ricordo', nome: 'paperella', y: 46 }));
const ok = altri => base([...altri, ...ricordi, { t: 20, tipo: 'ricarica', nome: 'snack' }].sort((a, b) => a.t - b.t));

test('sovrapposti', () => {
  assert.strictEqual(V.sovrapposti({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 }), true);
  assert.strictEqual(V.sovrapposti({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }), false);
});
test('giorno valido non ha errori', () => {
  assert.deepStrictEqual(V.validaGiorno(ok([{ t: 3, tipo: 'ostacolo', nome: 'gallina' }]), 1), []);
});
test('ostacoli troppo vicini', () => {
  const g = ok([{ t: 3, tipo: 'ostacolo', nome: 'gallina' }, { t: 4, tipo: 'ostacolo', nome: 'gallina' }]);
  assert.match(V.validaGiorno(g, 1).join(), /troppo vicino/);
});
test('crepaccio vietato prima del giorno 4', () => {
  const g = ok([{ t: 3, tipo: 'buco', larghezza: 60 }]);
  assert.match(V.validaGiorno(g, 2).join(), /crepaccio/);
  assert.deepStrictEqual(V.validaGiorno(g, 4), []);
});
test('crepaccio troppo largo', () => {
  assert.match(V.validaGiorno(ok([{ t: 3, tipo: 'buco', larghezza: 150 }]), 6).join(), /troppo largo/);
});
test('ostacolo in aria troppo basso', () => {
  assert.match(V.validaGiorno(ok([{ t: 3, tipo: 'ostacolo', nome: 'piccione', y: 20 }]), 6).join(), /in aria/);
});
test('servono 3 ricordi', () => {
  const g = base([{ t: 3, tipo: 'ricarica', nome: 'snack' }]);
  assert.match(V.validaGiorno(g, 1).join(), /3 ricordi/);
});
test('nome sconosciuto', () => {
  assert.match(V.validaGiorno(ok([{ t: 3, tipo: 'ostacolo', nome: 'drago' }]), 1).join(), /sconosciuto/);
});
test('variazione: deterministica e sempre valida', () => {
  const g = ok([{ t: 3, tipo: 'ostacolo', nome: 'gallina' }, { t: 5, tipo: 'ostacolo', nome: 'gallina' }]);
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const a = V.applicaVariazione(g, 1, rng(7)), b = V.applicaVariazione(g, 1, rng(7));
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(V.validaGiorno({ ...g, eventi: a }, 1), []);
  assert.strictEqual(g.eventi[0].t, 3); // non modifica l'originale
});
test('statistiche: copia indipendente', () => {
  const s = V.nuoveStats(); s.ricordi.push('telo');
  const c = V.copiaStats(s); c.ricordi.push('cuffia'); c.ostacoliPresi = 3;
  assert.deepStrictEqual(s, { ostacoliPresi: 0, ricordi: ['telo'] });
});
