const test = require('node:test');
const assert = require('node:assert');
for (const f of ['config', 'player', 'rules', 'days']) require(`../js/${f}.js`);
const V = globalThis.VIAGGIO;

test('6 giorni', () => assert.strictEqual(V.GIORNI.length, 6));
V.GIORNI.forEach((g, i) => test(`giorno ${i + 1} giocabile`, () => assert.deepStrictEqual(V.validaGiorno(g, i + 1), [])));
test('18 ricordi in tutto', () => {
  assert.strictEqual(V.GIORNI.flatMap(g => g.eventi).filter(e => e.tipo === 'ricordo').length, 18);
});
test('durata totale tra 6 e 7 minuti', () => {
  const s = V.GIORNI.reduce((a, g) => a + g.durata, 0);
  assert.ok(s >= 360 && s <= 420, `${s} s`);
});
test('ultimo giorno finisce con la porta', () => {
  assert.ok(V.GIORNI[5].eventi.some(e => e.nome === 'porta'));
});
test('frase finale presente', () => assert.ok(V.FRASE_FINALE.length > 10));
