/* Assemble les données, le moteur audio et les écrans. */
import { createAudioEngine } from './audio-engine.js';
import {
  chapterIndex, findBook, mergeDownloaded, parseCatalogue,
} from './catalog.js';
import { installImageFallback } from './dom.js';
import { createInputGuard } from './input-guard.js';
import { createOffline } from './offline.js';
import {
  next as nextCommand, restoreAtStartup, shouldRelease, tapChapter,
} from './playback.js';
import { guardPlayerRoute, parseRoute, routeHash } from './router.js';
import { createStore } from './store.js';
import { renderDownloadButton } from './views/download-button.js';
import {
  clearNowPlaying, renderNowPlaying, updateNowPlaying,
} from './views/now-playing.js';
import { renderPath, updatePath } from './views/path.js';
import { renderPlayer, updatePlayer } from './views/player.js';
import { renderShelf } from './views/shelf.js';
import { renderEmptyLibrary, renderLoadFailure } from './views/states.js';

const CATALOGUE_TIMEOUT_MS = 3000;
const CATALOGUE_RETRY_MS = 10000;
const SCREEN_CHANGE_HOLD_MS = 400;

const root = document.getElementById('app');
const nowPlayingRoot = document.getElementById('now-playing');
installImageFallback(document);

let serverCatalogue = null;
let catalogue = null;
let serverUp = true;
let serviceWorkerReady = false; // sans worker actif, un « téléchargé » ne servirait à rien hors-ligne
let lastActiveKey = null;
let shownNowPlayingKey = null;
const seenBooks = new Map(); // un livre en écoute reste connu même s'il disparaît du catalogue
const progress = new Map();

const inputGuard = createInputGuard();
const guarded = (action) => (...args) => { if (inputGuard.allows()) action(...args); };
const navigating = (action) => guarded((...args) => {
  inputGuard.hold(SCREEN_CHANGE_HOLD_MS);
  action(...args);
});

const store = createStore(() => localStorage);

/* Couleur de la barre du système, assortie au haut des écrans. */
const THEME_COLORS = { jour: '#BFE6F2', nuit: '#1B2050' };

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}
applyTheme(store.getTheme());

const audio = new Audio();
audio.preload = 'metadata';

const offline = createOffline({
  caches: window.caches,
  fetch: (url, init) => fetch(url, init),
  persist: () => navigator.storage?.persist?.(),
});

const getBook = (bookId) => seenBooks.get(bookId) || null;
const isDownloaded = (bookId) => ['downloaded', 'update'].includes(offline.status(bookId));
const isChapterAvailable = (book, chapterId) => offline.isChapterAvailable(book, chapterId, serverUp);
const isBookAvailable = (book) => serverUp || isDownloaded(book.id);

const engine = createAudioEngine({
  audio,
  store,
  page: document,
  getBook,
  isAvailable: (bookId, chapterId) => isChapterAvailable(getBook(bookId), chapterId),
  mediaSession: 'mediaSession' in navigator ? navigator.mediaSession : null,
  Metadata: window.MediaMetadata,
});

const go = (route) => { location.hash = routeHash(route); };
const replaceRoute = (route) => location.replace(routeHash(route));
const currentRoute = () => parseRoute(location.hash);
const keyOf = (active) => (active ? `${active.bookId}/${active.chapterId}` : null);

function setCatalogue(fromServer) {
  serverCatalogue = fromServer;
  catalogue = mergeDownloaded(serverCatalogue, offline.snapshots());
  catalogue.books.forEach((book) => seenBooks.set(book.id, book));
}

function playerRouteFor(active) {
  const book = getBook(active.bookId);
  return { name: 'player', bookId: book.id, n: chapterIndex(book, active.chapterId) + 1 };
}

function syncNowPlaying(route) {
  const state = engine.getState();
  const key = route.name === 'player' ? null : keyOf(state.active);
  if (key !== shownNowPlayingKey) {
    shownNowPlayingKey = key;
    if (!key) {
      clearNowPlaying(nowPlayingRoot);
    } else {
      const book = getBook(state.active.bookId);
      renderNowPlaying(nowPlayingRoot, {
        book,
        chapter: book.chapters[chapterIndex(book, state.active.chapterId)],
        state,
        onToggle: guarded(engine.toggle),
        onOpen: navigating(() => go(playerRouteFor(engine.getState().active))),
      });
    }
  }
  updateNowPlaying(nowPlayingRoot, state);
}

function showShelf() {
  if (catalogue.books.length === 0) {
    if (serverCatalogue) renderEmptyLibrary(root);
    else renderLoadFailure(root);
    return;
  }
  renderShelf(root, {
    catalogue,
    isBookAvailable,
    onOpenBook: navigating((bookId) => go({ name: 'path', bookId })),
    night: store.getTheme() === 'nuit',
    onToggleTheme: guarded(() => {
      const theme = store.getTheme() === 'nuit' ? 'jour' : 'nuit';
      store.setTheme(theme);
      applyTheme(theme);
      showShelf();
    }),
  });
}

function mountDownload(book) {
  const slot = root.querySelector('.path-action');
  if (!slot || !offline.supported || !serviceWorkerReady) return;
  renderDownloadButton(slot, {
    status: offline.status(book.id),
    progress: progress.get(book.id) || 0,
    onDownload: guarded(() => startDownload(book.id)),
    onRemove: () => removeDownload(book.id),
  });
}

function refreshDownloadButton(bookId) {
  const route = currentRoute();
  if (route.name === 'path' && route.bookId === bookId) mountDownload(getBook(bookId));
}

async function startDownload(bookId) {
  if (offline.status(bookId) === 'downloading') return;
  const book = (serverCatalogue && findBook(serverCatalogue, bookId)) || getBook(bookId);
  progress.set(bookId, 0);
  const running = offline.download(book, (done, total) => {
    progress.set(bookId, done / total);
    refreshDownloadButton(bookId);
  });
  refreshDownloadButton(bookId);
  await running;
  progress.delete(bookId);
  setCatalogue(serverCatalogue);
  render(false);
}

async function removeDownload(bookId) {
  await offline.remove(bookId);
  setCatalogue(serverCatalogue);
  render(false);
}

async function refreshServer() {
  const up = await offline.pingServer();
  if (up !== serverUp) {
    serverUp = up;
    if (catalogue && currentRoute().name !== 'player') render(false);
  }
  return up;
}

function syncPath(book) {
  const { error, active } = engine.getState();
  updatePath(root, {
    book,
    saved: store.getPosition(book.id),
    isStarred: store.isStarred,
    failedChapterId: error && active && active.bookId === book.id ? active.chapterId : null,
  });
}

function showPath(book, scrollToCurrent) {
  renderPath(root, {
    book,
    saved: store.getPosition(book.id),
    isStarred: store.isStarred,
    isChapterAvailable,
    scrollToCurrent,
    onHome: navigating(() => go({ name: 'shelf' })),
    onTapChapter: navigating((chapterId) => {
      const command = tapChapter({
        book, active: engine.getState().active, saved: store.getPosition(book.id),
      }, chapterId);
      // Lancé tout de suite : iOS exige que la lecture parte du geste de l'enfant.
      engine.apply(command);
      go(playerRouteFor(command));
      if (!isDownloaded(book.id)) {
        refreshServer().then((up) => {
          if (!up && keyOf(engine.getState().active) === keyOf(command)) engine.markUnavailable();
        });
      }
    }),
  });
  mountDownload(book);
  syncPath(book);
}

function showPlayer(book, route) {
  const chapter = book.chapters[route.n - 1];
  renderPlayer(root, {
    book,
    chapter,
    state: engine.getState(),
    canNext: nextCommand(book, chapter.id) !== null,
    getDuration: () => engine.getState().duration,
    onToggle: guarded(engine.toggle),
    onPrev: guarded(engine.previous),
    onNext: guarded(engine.next),
    onSeek: guarded(engine.seek),
    onHome: navigating(() => go({ name: 'shelf' })),
    onPath: navigating(() => go({ name: 'path', bookId: book.id })),
  });
}

function render(scrollToCurrent = true) {
  if (!catalogue) return;
  const requested = currentRoute();
  const book = requested.name === 'shelf' ? null : findBook(catalogue, requested.bookId);
  const route = guardPlayerRoute(requested, engine.getState().active, book);
  if (route !== requested) {
    replaceRoute(route);
    return;
  }
  if (route.name === 'shelf') showShelf();
  else if (route.name === 'path') showPath(book, scrollToCurrent);
  else showPlayer(book, route);
  syncNowPlaying(route);
}

function onEngineChange() {
  if (!catalogue) return;
  const state = engine.getState();
  const route = currentRoute();
  const activeKey = keyOf(state.active);

  /* Le lecteur suit le chapitre qui change seul (fin de chapitre, boutons). */
  if (activeKey !== lastActiveKey) {
    lastActiveKey = activeKey;
    if (route.name === 'player' && state.active) {
      replaceRoute(playerRouteFor(state.active));
      return;
    }
  }

  if (route.name === 'player') updatePlayer(root, state);
  else if (route.name === 'path') {
    const book = getBook(route.bookId);
    if (book) syncPath(book);
  }
  syncNowPlaying(route);
}

engine.subscribe(onEngineChange);
engine.onFinished((bookId) => {
  if (currentRoute().name === 'player') replaceRoute({ name: 'path', bookId });
});

let lastWidth = innerWidth;
addEventListener('resize', () => {
  if (innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  if (currentRoute().name === 'path') render(false);
});

addEventListener('hashchange', () => render());
addEventListener('online', refreshServer);
addEventListener('offline', refreshServer);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshServer();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.ready.then(() => {
    serviceWorkerReady = true;
    const route = currentRoute();
    if (route.name === 'path' && getBook(route.bookId)) refreshDownloadButton(route.bookId);
  });
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data?.type !== 'catalogue-updated') return;
    const updated = await loadCatalogue();
    if (updated) await applyCatalogue(updated);
  });
}

function releaseVanishedBook() {
  const state = engine.getState();
  if (!shouldRelease(state, catalogue)) return false;
  seenBooks.delete(state.active.bookId); // avant release : les écrans ne le retrouvent plus
  engine.release();
  return true;
}

/* L'écran du lecteur n'est redessiné que si son livre a été retiré. */
async function applyCatalogue(loaded) {
  await offline.reconcile(loaded);
  setCatalogue(loaded);
  const released = releaseVanishedBook();
  if (released || currentRoute().name !== 'player') render(false);
}

async function loadCatalogue() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOGUE_TIMEOUT_MS);
  try {
    const response = await fetch('catalogue.json', { signal: controller.signal });
    return response.ok ? parseCatalogue(await response.text()) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function retryLoadingCatalogue() {
  const loaded = await loadCatalogue();
  if (!loaded) {
    setTimeout(retryLoadingCatalogue, CATALOGUE_RETRY_MS);
    return;
  }
  await applyCatalogue(loaded);
}

async function restoreLastListening() {
  if (engine.getState().active) return;
  // Le catalogue courant, pas seenBooks : un livre retiré entre-temps n'est pas restauré.
  const lastBook = findBook(catalogue, store.getLast());
  const restored = restoreAtStartup(
    lastBook,
    lastBook ? store.getPosition(lastBook.id) : null,
    (chapterId) => isChapterAvailable(lastBook, chapterId),
  );
  if (restored) engine.restore(restored);
}

async function start() {
  const loaded = await loadCatalogue();
  await offline.reconcile(loaded);
  setCatalogue(loaded);
  render();
  if (!loaded) setTimeout(retryLoadingCatalogue, CATALOGUE_RETRY_MS);
  await refreshServer();
  await restoreLastListening();
  render(false);
}

start();
