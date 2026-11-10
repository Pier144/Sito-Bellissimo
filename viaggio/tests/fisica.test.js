const test = require('node:test');
const assert = require('node:assert');
require('../js/config.js'); require('../js/player.js'); require('../js/rules.js');
const V = globalThis.VIAGGIO;

test('salto breve tra 20 e 40 px', () => {
  const s = V.simulaSalto(0.08);
  assert.ok(s.altezza >= 20 && s.altezza <= 40, `altezza ${s.altezza}`);
});
test('salto lungo tra 50 e 65 px', () => {
  const s = V.simulaSalto(Infinity);
  assert.ok(s.altezza >= 50 && s.altezza <= 65, `altezza ${s.altezza}`);
});
test('salto lungo supera un crepaccio di 85 px dal giorno 4', () => {
  const s = V.simulaSalto(Infinity);
  assert.ok(s.volo * V.velocitaGiorno(4) >= 85 + 16, `percorre ${s.volo * V.velocitaGiorno(4)}`);
});
test('non si salta in aria e si riatterra', () => {
  const p = V.creaGiocatrice();
  assert.strictEqual(V.premiSalto(p), true);
  assert.strictEqual(V.premiSalto(p), false);
  for (let i = 0; i < 200; i++) V.aggiornaGiocatrice(p, 1 / 60);
  assert.strictEqual(p.aTerra, true); assert.strictEqual(p.y, 0);
});
test('colpita: invulnerabile per 1 s', () => {
  const p = V.creaGiocatrice();
  assert.strictEqual(V.colpisci(p), true);
  assert.strictEqual(V.colpisci(p), false);
  for (let i = 0; i < 61; i++) V.aggiornaGiocatrice(p, 1 / 60);
  assert.strictEqual(V.colpisci(p), true);
});
test('durante il pisolino non salta', () => {
  const p = V.creaGiocatrice(); V.posa(p, 'pisolino', 2);
  assert.strictEqual(V.premiSalto(p), false);
});
test('frame della camminata ciclico', () => {
  const p = V.creaGiocatrice(); p.tAnim = 0.7;   // 0.7 s * 12 fps = 8.4 -> fotogramma 0 di 8
  assert.deepStrictEqual(V.frameGiocatrice(p), { anim: 'cammina', i: 0 });
});
