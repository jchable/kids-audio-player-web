import test from 'node:test';
import assert from 'node:assert/strict';
import { createOffline } from '../js/offline.js';

const asset = (src, size = 1, mtime = 1) => ({ src, size, mtime });

function makeBook({ title = 'Livre', size = 1 } = {}) {
  return {
    id: 'b',
    title,
    cover: 'b/cover.jpg',
    chapters: [{ id: 'a.mp3', src: 'b/a.mp3', image: null }, { id: 'c.mp3', src: 'b/c.mp3', image: null }],
    assets: [asset('b/cover.jpg'), asset('b/a.mp3', size), asset('b/c.mp3')],
  };
}

function fakeCaches() {
  const stores = new Map();
  const fake = {
    log: [],
    full: false,
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(url) { const r = store.get(url); return r ? r.clone() : undefined; },
        async put(url, response) {
          if (fake.full) throw new DOMException('plein', 'QuotaExceededError');
          fake.log.push(url);
          store.set(url, response);
        },
        async delete(url) { return store.delete(url); },
        async keys() { return [...store.keys()].map((url) => ({ url: `https://site.test/${url}` })); },
      };
    },
  };
  return fake;
}

function setup({ failAt = Infinity } = {}) {
  const caches = fakeCaches();
  const context = {
    caches, fetched: [], failAt, persisted: 0, persistResult: true,
  };
  context.offline = createOffline({
    caches,
    fetch: async (url) => {
      context.fetched.push(url);
      if (context.fetched.length >= context.failAt) throw new TypeError('réseau coupé');
      return new Response('x');
    },
    persist: async () => { context.persisted += 1; return context.persistResult; },
  });
  return context;
}

const reopen = (caches) => createOffline({
  caches, fetch: async () => new Response('x'), persist: async () => true,
});
const inCache = (c, url) => c.caches.stores.get('lecteur-audio-v1').has(url);

test('download : téléchargé et tous les fichiers en cache', async () => {
  const c = setup();
  const book = makeBook();
  await c.offline.reconcile({ books: [book] });
  await c.offline.download(book);
  assert.equal(c.offline.status('b'), 'downloaded');
  for (const a of book.assets) assert.ok(inCache(c, a.src));
});

test('download signale la progression', async () => {
  const c = setup();
  const seen = [];
  await c.offline.download(makeBook(), (done, total) => seen.push([done, total]));
  assert.deepEqual(seen, [[1, 3], [2, 3], [3, 3]]);
});

test('status vaut downloading pendant le téléchargement', async () => {
  const c = setup();
  let during;
  await c.offline.download(makeBook(), () => { during = c.offline.status('b'); });
  assert.equal(during, 'downloading');
});

test('la copie est écrite après le dernier fichier', async () => {
  const c = setup();
  await c.offline.download(makeBook());
  assert.match(c.caches.log.at(-1), /^__copies__\//);
});

test('réseau coupé au 3e fichier : échec, fichiers reçus conservés', async () => {
  const c = setup({ failAt: 3 });
  await c.offline.download(makeBook());
  assert.equal(c.offline.status('b'), 'failed');
  assert.ok(inCache(c, 'b/cover.jpg') && inCache(c, 'b/a.mp3'));
  assert.deepEqual(c.offline.snapshots(), []);
});

test('nouvelle tentative : seuls les fichiers manquants sont demandés', async () => {
  const c = setup({ failAt: 3 });
  await c.offline.download(makeBook());
  c.failAt = Infinity;
  c.fetched.length = 0;
  await c.offline.download(makeBook());
  assert.deepEqual(c.fetched, ['b/c.mp3']);
  assert.equal(c.offline.status('b'), 'downloaded');
});

test('stockage plein à l\'écriture : échec', async () => {
  const c = setup();
  c.caches.full = true;
  await c.offline.download(makeBook());
  assert.equal(c.offline.status('b'), 'failed');
});

test('réponse HTTP en erreur : échec', async () => {
  const offline = createOffline({
    caches: fakeCaches(), fetch: async () => new Response('', { status: 404 }), persist: async () => true,
  });
  await offline.download(makeBook());
  assert.equal(offline.status('b'), 'failed');
});

test('reconcile après interruption : fichiers sans copie donnent un échec', async () => {
  const c = setup({ failAt: 3 });
  const book = makeBook();
  await c.offline.download(book);
  const after = reopen(c.caches);
  await after.reconcile({ books: [book] });
  assert.equal(after.status('b'), 'failed');
});

test('reconcile : rien en cache donne none', async () => {
  const c = setup();
  await c.offline.reconcile({ books: [makeBook()] });
  assert.equal(c.offline.status('b'), 'none');
});

test('reconcile : copie présente mais fichier disparu donne un échec', async () => {
  const c = setup();
  const book = makeBook();
  await c.offline.download(book);
  c.caches.stores.get('lecteur-audio-v1').delete('b/a.mp3');
  await c.offline.reconcile({ books: [book] });
  assert.equal(c.offline.status('b'), 'failed');
  assert.deepEqual(c.offline.snapshots(), []);
});

test('reconcile retrouve les livres téléchargés au démarrage', async () => {
  const c = setup();
  await c.offline.download(makeBook());
  const after = reopen(c.caches);
  await after.reconcile(null);
  assert.equal(after.status('b'), 'downloaded');
  assert.deepEqual(after.snapshots().map((b) => b.id), ['b']);
});

test('remove efface les fichiers et la copie', async () => {
  const c = setup();
  await c.offline.download(makeBook());
  await c.offline.remove('b');
  assert.equal(c.offline.status('b'), 'none');
  assert.equal(c.caches.stores.get('lecteur-audio-v1').size, 0);
});

test('fichier remplacé sur le serveur : mise à jour proposée, ancienne copie conservée', async () => {
  const c = setup();
  await c.offline.download(makeBook({ title: 'Ancien' }));
  await c.offline.reconcile({ books: [makeBook({ title: 'Nouveau', size: 2 })] });
  assert.equal(c.offline.status('b'), 'update');
  assert.deepEqual(c.offline.snapshots().map((b) => b.title), ['Ancien']);
});

test('mise à jour : télécharge la nouvelle version', async () => {
  const c = setup();
  await c.offline.download(makeBook({ title: 'Ancien' }));
  const fresh = makeBook({ title: 'Nouveau', size: 2 });
  await c.offline.reconcile({ books: [fresh] });
  c.fetched.length = 0;
  await c.offline.download(fresh);
  assert.equal(c.offline.status('b'), 'downloaded');
  assert.equal(c.fetched.filter((u) => u !== 'catalogue.json').length, 3);
  assert.deepEqual(c.offline.snapshots().map((b) => b.title), ['Nouveau']);
});

test('livre retiré du serveur : reste téléchargé', async () => {
  const c = setup();
  await c.offline.download(makeBook());
  await c.offline.reconcile({ books: [] });
  assert.equal(c.offline.status('b'), 'downloaded');
});

test('persist appelé, un refus n\'empêche rien', async () => {
  const c = setup();
  c.persistResult = false;
  await c.offline.download(makeBook());
  assert.equal(c.persisted, 1);
  assert.equal(c.offline.status('b'), 'downloaded');
});

test('persist qui échoue n\'empêche rien', async () => {
  const offline = createOffline({
    caches: fakeCaches(), fetch: async () => new Response('x'), persist: async () => { throw new Error('non'); },
  });
  await offline.download(makeBook());
  assert.equal(offline.status('b'), 'downloaded');
});

test('chapitre non téléchargé indisponible si le serveur est injoignable', async () => {
  const c = setup();
  const book = makeBook();
  assert.equal(c.offline.isChapterAvailable(book, 'a.mp3', true), true);
  assert.equal(c.offline.isChapterAvailable(book, 'a.mp3', false), false);
  await c.offline.download(book);
  assert.equal(c.offline.isChapterAvailable(book, 'a.mp3', false), true);
});

test('pingServer : vrai si le serveur répond', async () => {
  const offline = createOffline({
    caches: fakeCaches(),
    fetch: async (url, init) => { assert.equal(init.method, 'HEAD'); return new Response(null, { status: 200 }); },
    persist: async () => true,
  });
  assert.equal(await offline.pingServer(), true);
});

test('pingServer : faux après 3 s sans réponse', async () => {
  let delay;
  let fire;
  const offline = createOffline({
    caches: fakeCaches(),
    fetch: (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('stop', 'AbortError')));
    }),
    persist: async () => true,
    setTimer: (fn, ms) => { fire = fn; delay = ms; return 1; },
    clearTimer: () => {},
  });
  const result = offline.pingServer();
  assert.equal(delay, 3000);
  fire();
  assert.equal(await result, false);
});

test('sans Cache API : non pris en charge, sans erreur', async () => {
  const offline = createOffline({
    caches: undefined, fetch: async () => new Response(null), persist: async () => true,
  });
  assert.equal(offline.supported, false);
  await offline.reconcile({ books: [makeBook()] });
  assert.equal(offline.status('b'), 'none');
  assert.deepEqual(offline.snapshots(), []);
});

test('les fichiers contournent le cache HTTP du navigateur', async () => {
  const inits = [];
  const offline = createOffline({
    caches: fakeCaches(),
    fetch: async (url, init) => { inits.push(init); return new Response('x'); },
    persist: async () => true,
  });
  await offline.download(makeBook());
  assert.ok(inits.length === 3 && inits.every((i) => i.cache === 'no-store'));
});

test('reprise : un fichier d\'une ancienne version est retéléchargé', async () => {
  const c = setup({ failAt: 3 });
  await c.offline.download(makeBook());
  c.failAt = Infinity;
  c.fetched.length = 0;
  await c.offline.download(makeBook({ size: 5 }));
  assert.deepEqual(c.fetched, ['b/a.mp3', 'b/c.mp3']);
});

test('mise à jour avec serveur injoignable : le livre reste intact', async () => {
  const caches = fakeCaches();
  let reachable = true;
  const offline = createOffline({
    caches,
    fetch: async () => {
      if (!reachable) throw new TypeError('injoignable');
      return new Response('x');
    },
    persist: async () => true,
  });
  await offline.download(makeBook());
  await offline.reconcile({ books: [makeBook({ title: 'Nouveau', size: 2 })] });
  reachable = false;
  await offline.download(makeBook({ title: 'Nouveau', size: 2 }));
  assert.equal(offline.status('b'), 'update');
  assert.equal(caches.stores.get('lecteur-audio-v1').size, 4);
});

test('reconcile ne fait jamais échouer le démarrage', async () => {
  const offline = createOffline({
    caches: { open: async () => { throw new Error('non'); } },
    fetch: async () => new Response('x'),
    persist: async () => true,
  });
  await offline.reconcile({ books: [makeBook()] });
  assert.equal(offline.status('b'), 'none');
});
