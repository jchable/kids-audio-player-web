/* Assemble les données, le moteur audio et les écrans. */
import { createAudioEngine } from './audio-engine.js';
import {
  chapterIndex, findBook, mergeDownloaded, parseCatalogue,
} from './catalog.js';
import { installImageFallback } from './dom.js';
import { createOffline } from './offline.js';
import { next as nextCommand, restoreAtStartup, tapChapter } from './playback.js';
import { guardPlayerRoute, parseRoute, routeHash } from './router.js';
import { createStore } from './store.js';
import { renderDownloadButton } from './views/download-button.js';
import {
  clearNowPlaying, renderNowPlaying, updateNowPlaying,
} from './views/now-playing.js';
import { renderPath, updatePath } from './views/path.js';
import { renderPlayer, updatePlayer } from './views/player.js';
import { renderShelf } from './views/shelf.js';

const root = document.getElementById('app');
const nowPlayingRoot = document.getElementById('now-playing');
installImageFallback(document);

let serverCatalogue = null;
let catalogue = null;
let serverUp = true;
let lastActiveKey = null;
let shownNowPlayingKey = null;
const seenBooks = new Map(); // un livre en écoute reste connu même s'il disparaît du catalogue
const progress = new Map();

const store = createStore(localStorage);
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
        onToggle: engine.toggle,
        onOpen: () => go(playerRouteFor(engine.getState().active)),
      });
    }
  }
  updateNowPlaying(nowPlayingRoot, state);
}

function showShelf() {
  renderShelf(root, {
    catalogue,
    isBookAvailable,
    onOpenBook: (bookId) => go({ name: 'path', bookId }),
  });
}

function mountDownload(book) {
  const slot = root.querySelector('.path-action');
  if (!slot || !offline.supported) return;
  renderDownloadButton(slot, {
    status: offline.status(book.id),
    progress: progress.get(book.id) || 0,
    onDownload: () => startDownload(book.id),
    onRemove: () => removeDownload(book.id),
  });
}

function refreshDownloadButton(bookId) {
  const route = currentRoute();
  if (route.name === 'path' && route.bookId === bookId) mountDownload(getBook(bookId));
}

async function startDownload(bookId) {
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

function showPath(book, scrollToCurrent) {
  renderPath(root, {
    book,
    saved: store.getPosition(book.id),
    isStarred: store.isStarred,
    isChapterAvailable,
    scrollToCurrent,
    onHome: () => go({ name: 'shelf' }),
    onTapChapter: (chapterId) => {
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
    },
  });
  mountDownload(book);
}

function showPlayer(book, route) {
  const chapter = book.chapters[route.n - 1];
  renderPlayer(root, {
    book,
    chapter,
    state: engine.getState(),
    canNext: nextCommand(book, chapter.id) !== null,
    getDuration: () => engine.getState().duration,
    onToggle: engine.toggle,
    onPrev: engine.previous,
    onNext: engine.next,
    onSeek: engine.seek,
    onHome: () => go({ name: 'shelf' }),
    onPath: () => go({ name: 'path', bookId: book.id }),
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
    if (book) updatePath(root, { book, saved: store.getPosition(book.id), isStarred: store.isStarred });
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
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data?.type !== 'catalogue-updated') return;
    const updated = parseCatalogue(await (await fetch('catalogue.json')).text());
    if (!updated) return;
    await offline.reconcile(updated);
    setCatalogue(updated);
    if (currentRoute().name !== 'player') render(false);
  });
}

async function restoreLastListening() {
  if (engine.getState().active) return;
  const lastBook = getBook(store.getLast());
  const restored = restoreAtStartup(
    lastBook,
    lastBook ? store.getPosition(lastBook.id) : null,
    (chapterId) => isChapterAvailable(lastBook, chapterId),
  );
  if (restored) engine.restore(restored);
}

async function start() {
  const response = await fetch('catalogue.json');
  const loaded = parseCatalogue(await response.text());
  await offline.reconcile(loaded);
  setCatalogue(loaded);
  render();
  await refreshServer();
  await restoreLastListening();
  render(false);
}

start();
