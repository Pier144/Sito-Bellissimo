const test = require('node:test');
const assert = require('node:assert');
for (const f of ['config', 'player', 'rules', 'world']) require(`../js/${f}.js`);
const V = globalThis.VIAGGIO;
const fisso = () => 0.5; // rng che non sposta nulla
const giorno = eventi => ({ bioma: 'campi', durata: 10, diario: 'x', eventi });

function gioca(g, { saltaA, tenuto = Infinity, azioneA } = {}) {
  const m = V.creaMondo(g, 6, fisso), p = V.creaGiocatrice(), log = [];
  const avvisa = (n, d) => log.push(n);
  for (let t = 0; t < g.durata + 1; t += 1 / 60) {
    if (saltaA !== undefined && Math.abs(t - saltaA) < 1 / 120) V.premiSalto(p);
    if (p.tenendo && t - saltaA >= tenuto) V.rilasciaSalto(p);
    if (azioneA !== undefined && Math.abs(t - azioneA) < 1 / 120) V.azioneMondo(m, p, avvisa);
    V.aggiornaGiocatrice(p, 1 / 60); V.aggiornaMondo(m, p, 1 / 60, avvisa);
  }
  return { m, p, log };
}

test('senza saltare la gallina la colpisce', () => {
  assert.ok(gioca(giorno([{ t: 2, tipo: 'ostacolo', nome: 'gallina' }])).log.includes('colpo'));
});
test('saltando in tempo non la colpisce', () => {
  assert.ok(!gioca(giorno([{ t: 2, tipo: 'ostacolo', nome: 'gallina' }]), { saltaA: 1.75 }).log.includes('colpo'));
});
test('ricordo in alto solo saltando', () => {
  const g = giorno([{ t: 2, tipo: 'ricordo', nome: 'telo', y: 46 }]);
  assert.ok(!gioca(g).log.includes('ricordo'));
  assert.ok(gioca(g, { saltaA: 1.7 }).log.includes('ricordo'));
});
test('cade nel crepaccio se non salta, e lo supera saltando', () => {
  const g = giorno([{ t: 2, tipo: 'buco', larghezza: 80 }]);
  assert.ok(gioca(g).log.includes('caduta'));
  assert.ok(!gioca(g, { saltaA: 1.85 }).log.includes('caduta'));
});
test('accarezzare il cane: niente colpo, ricarica', () => {
  const r = gioca(giorno([{ t: 2, tipo: 'interattivo', nome: 'cane' }]), { azioneA: 1.8 });
  assert.ok(!r.log.includes('colpo')); assert.ok(r.log.includes('ricarica'));
});
test('ombrello protegge dai fulmini', () => {
  const g = giorno([{ t: 1, tipo: 'interattivo', nome: 'ombrello' }, { t: 4, tipo: 'fulmine', nome: 'fulmine' }]);
  assert.ok(gioca(g).log.includes('colpo'));
  assert.ok(!gioca(g, { azioneA: 0.85 }).log.includes('colpo'));
});
test('panchina: pisolino e ricarica', () => {
  const r = gioca(giorno([{ t: 2, tipo: 'ricarica', nome: 'panchina' }]));
  assert.ok(r.log.includes('ricarica'));
});
test('fine del giorno avvisata una volta', () => {
  const r = gioca(giorno([]));
  assert.strictEqual(r.log.filter(n => n === 'fine').length, 1);
  assert.strictEqual(r.m.finito, true);
});
test('il fango rallenta', () => {
  const g = giorno([{ t: 0, tipo: 'fango', larghezza: 2000 }]);
  const m = V.creaMondo(g, 1, fisso), p = V.creaGiocatrice();
  V.aggiornaMondo(m, p, 1, () => {});
  assert.ok(m.dist < V.velocitaGiorno(1) * 0.7);
});
