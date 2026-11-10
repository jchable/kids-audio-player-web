import test from 'node:test';
import assert from 'node:assert/strict';

await import('../js/sw-lib.js');
const { SwLib } = globalThis;

test('parseRange : intervalle complet', () => {
  assert.deepEqual(SwLib.parseRange('bytes=10-19', 100), { start: 10, end: 19 });
});

test('parseRange : derniers octets', () => {
  assert.deepEqual(SwLib.parseRange('bytes=-10', 100), { start: 90, end: 99 });
});

test('parseRange : jusqu\'à la fin', () => {
  assert.deepEqual(SwLib.parseRange('bytes=90-', 100), { start: 90, end: 99 });
});

test('parseRange : fin au-delà de la taille', () => {
  assert.deepEqual(SwLib.parseRange('bytes=90-500', 100), { start: 90, end: 99 });
});

test('parseRange : début hors du fichier', () => {
  assert.equal(SwLib.parseRange('bytes=200-', 100), 'unsatisfiable');
});

test('parseRange : sans en-tête ou mal formé', () => {
  assert.equal(SwLib.parseRange(null, 100), null);
  assert.equal(SwLib.parseRange('n importe quoi', 100), null);
});

test('isAudioPath : MP3 dans un sous-dossier de la bibliothèque', () => {
  assert.ok(SwLib.isAudioPath('/bibliotheque/le%20livre/01.mp3'));
  assert.ok(SwLib.isAudioPath('/site/bibliotheque/livre/01.MP3'));
});

test('isAudioPath : autres fichiers', () => {
  assert.ok(!SwLib.isAudioPath('/bibliotheque/livre/01.jpg'));
  assert.ok(!SwLib.isAudioPath('/audio/01.mp3'));
});

test('isValidCatalogueText', () => {
  assert.ok(SwLib.isValidCatalogueText('{"books":[]}'));
  assert.ok(!SwLib.isValidCatalogueText('<html>'));
  assert.ok(!SwLib.isValidCatalogueText('{"books":3}'));
});
