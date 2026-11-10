/* Téléchargement des livres et disponibilité du serveur de la maison. */
import { bookVersion } from './catalog.js';

const AUDIO_CACHE = 'lecteur-audio-v1';
const COPY_FOLDER = '__copies__/';
const copyKey = (bookId) => `${COPY_FOLDER}${encodeURIComponent(bookId)}.json`;

export function createOffline({
  caches, fetch: fetchFn, persist, timeoutMs = 3000,
  setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  const statuses = new Map();
  const copies = new Map(); // livres complets, tels que téléchargés
  const known = new Map();  // derniers livres vus, pour nettoyer un téléchargement partiel
  let serverBooks = new Map();

  const open = () => caches.open(AUDIO_CACHE);
  const isComplete = (id) => ['downloaded', 'update'].includes(statuses.get(id));

  async function countPresent(cache, book) {
    const found = await Promise.all(book.assets.map((a) => cache.match(a.src)));
    return found.filter(Boolean).length;
  }

  function statusOfCopy(copy) {
    const server = serverBooks.get(copy.id);
    return server && bookVersion(server) !== bookVersion(copy) ? 'update' : 'downloaded';
  }

  async function readCopies(cache) {
    const keys = await cache.keys();
    const found = [];
    for (const { url } of keys) {
      const index = url.indexOf(COPY_FOLDER);
      if (index >= 0) found.push(await (await cache.match(url.slice(index))).json());
    }
    return found;
  }

  async function deleteBook(cache, bookId) {
    const book = copies.get(bookId) || known.get(bookId);
    if (book) await Promise.all(book.assets.map((a) => cache.delete(a.src)));
    await cache.delete(copyKey(bookId));
    copies.delete(bookId);
  }

  /* Un fichier d'une ancienne version, laissé par une interruption, ne compte pas. */
  async function hasCurrentFile(cache, asset) {
    const cached = await cache.match(asset.src);
    return Boolean(cached) && (await cached.blob()).size === asset.size;
  }

  async function pingServer() {
    const controller = new AbortController();
    const timer = setTimer(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn('catalogue.json', {
        method: 'HEAD', cache: 'no-store', signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimer(timer);
    }
  }

  async function requestPersistence() {
    try {
      await persist();
    } catch { /* la persistance reste une demande, pas une garantie */ }
  }

  return {
    supported: Boolean(caches),

    async reconcile(catalogue) {
      serverBooks = new Map((catalogue ? catalogue.books : []).map((b) => [b.id, b]));
      for (const [id, book] of serverBooks) known.set(id, book);
      if (!caches) return;

      try {
        const cache = await open();
        const stored = await readCopies(cache);
        copies.clear();
        for (const copy of stored) {
          known.set(copy.id, known.get(copy.id) || copy);
          if (statuses.get(copy.id) !== 'downloading') {
            if ((await countPresent(cache, copy)) === copy.assets.length) {
              copies.set(copy.id, copy);
              statuses.set(copy.id, statusOfCopy(copy));
            } else {
              statuses.set(copy.id, 'failed');
            }
          }
        }
        const storedIds = new Set(stored.map((c) => c.id));
        for (const [id, book] of serverBooks) {
          if (!storedIds.has(id) && statuses.get(id) !== 'downloading') {
            statuses.set(id, (await countPresent(cache, book)) > 0 ? 'failed' : 'none');
          }
        }
      } catch { /* cache illisible : l'application démarre sans téléchargements */ }
    },

    snapshots() {
      return [...copies.values()];
    },

    status(bookId) {
      return statuses.get(bookId) || 'none';
    },

    async download(book, onProgress = () => {}) {
      const previous = statuses.get(book.id);
      // La mise à jour supprime d'abord le livre : jamais sans serveur joignable.
      if (previous === 'update' && !(await pingServer())) return;
      statuses.set(book.id, 'downloading');
      known.set(book.id, book);
      try {
        await requestPersistence();
        const cache = await open();
        if (previous === 'update') await deleteBook(cache, book.id);

        let done = 0;
        for (const asset of book.assets) {
          if (!(await hasCurrentFile(cache, asset))) {
            const response = await fetchFn(asset.src, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await cache.put(asset.src, response);
          }
          done += 1;
          onProgress(done, book.assets.length);
        }
        // Écrite en dernier : sa présence garantit un téléchargement complet.
        await cache.put(copyKey(book.id), new Response(JSON.stringify(book)));
        copies.set(book.id, book);
        statuses.set(book.id, statusOfCopy(book));
      } catch {
        statuses.set(book.id, 'failed');
      }
    },

    async remove(bookId) {
      if (caches) await deleteBook(await open(), bookId);
      statuses.set(bookId, 'none');
    },

    isChapterAvailable(book, chapterId, serverUp) {
      return serverUp || isComplete(book.id);
    },

    pingServer,
  };
}
