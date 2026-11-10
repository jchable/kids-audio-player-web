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

test('withSvgPolicy : un SVG ouvert directement ne peut exécuter aucun script', async () => {
  const original = new Response('<svg/>', { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
  const hardened = SwLib.withSvgPolicy(original, '/bibliotheque/livre/couverture.svg');
  const policy = hardened.headers.get('Content-Security-Policy');
  assert.match(policy, /sandbox/);
  assert.match(policy, /default-src 'none'/);
  assert.equal(hardened.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(hardened.headers.get('Content-Type'), 'image/svg+xml');
  assert.equal(hardened.status, 200);
  assert.equal(await hardened.text(), '<svg/>');
});

test('withSvgPolicy : extension en majuscules ou type déclaré par le serveur', () => {
  const upper = SwLib.withSvgPolicy(new Response('x'), '/bibliotheque/l/01.SVG');
  assert.match(upper.headers.get('Content-Security-Policy'), /sandbox/);
  const typed = SwLib.withSvgPolicy(
    new Response('x', { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } }),
    '/bibliotheque/l/image',
  );
  assert.match(typed.headers.get('Content-Security-Policy'), /sandbox/);
});

test('withSvgPolicy : les autres images sont rendues telles quelles', () => {
  const jpeg = new Response('x', { headers: { 'Content-Type': 'image/jpeg' } });
  assert.equal(SwLib.withSvgPolicy(jpeg, '/bibliotheque/l/couverture.jpg'), jpeg);
});

test('isShellAsset : seuls les fichiers de l\'application sont mis en cache', () => {
  const scope = 'https://s/app/';
  const assets = ['./', 'js/main.js', 'css/app.css'];
  assert.ok(SwLib.isShellAsset('https://s/app/js/main.js', scope, assets));
  assert.ok(SwLib.isShellAsset('https://s/app/css/app.css?v=2', scope, assets));
  assert.ok(SwLib.isShellAsset('https://s/app/', scope, assets));
  assert.ok(!SwLib.isShellAsset('https://s/app/js/autre.js', scope, assets));
  assert.ok(!SwLib.isShellAsset('https://s/app/docs/notes.md', scope, assets));
  assert.ok(!SwLib.isShellAsset('https://s/js/main.js', scope, assets));
});
