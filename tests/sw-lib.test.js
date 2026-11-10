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

function fakeCache(entries = {}) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    added: [],
    async add(request) { this.added.push(request); },
    async match(request) { return store.get(request.url || request); },
    async put(request, response) { store.set(request.url || request, response); },
    async keys() { return [...store.keys()].map((url) => ({ url })); },
  };
}

test('precache contourne le cache HTTP', async () => {
  const cache = fakeCache();
  await SwLib.precache(cache, ['a.js'], (asset) => ({ asset, cache: 'reload' }));
  assert.deepEqual(cache.added, [{ asset: 'a.js', cache: 'reload' }]);
});

test('precache échoue si un fichier manque', async () => {
  const cache = fakeCache();
  cache.add = async () => { throw new Error('404'); };
  await assert.rejects(SwLib.precache(cache, ['a.js'], (a) => a));
});

test('carryOver reprend le catalogue et les couvertures de la version précédente', async () => {
  const old = fakeCache({
    'https://s/catalogue.json': 'cat', 'https://s/bibliotheque/l/c.jpg': 'img', 'https://s/js/a.js': 'code',
  });
  const fresh = fakeCache();
  const caches = {
    keys: async () => ['lecteur-shell-v1', 'lecteur-shell-v2', 'lecteur-audio-v1'],
    open: async (name) => (name === 'lecteur-shell-v1' ? old : fresh),
  };
  await SwLib.carryOver(caches, 'lecteur-shell-v2', 'lecteur-shell-');
  assert.deepEqual([...fresh.store.keys()].sort(), ['https://s/bibliotheque/l/c.jpg', 'https://s/catalogue.json']);
});
