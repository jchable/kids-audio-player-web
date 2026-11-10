/* Assemble les données, le moteur audio et les écrans. */
import { createAudioEngine } from './audio-engine.js';
import { chapterIndex, findBook, parseCatalogue } from './catalog.js';
import { installImageFallback } from './dom.js';
import { next as nextCommand, restoreAtStartup, tapChapter } from './playback.js';
import { guardPlayerRoute, parseRoute, routeHash } from './router.js';
import { createStore } from './store.js';
import {
  clearNowPlaying, renderNowPlaying, updateNowPlaying,
} from './views/now-playing.js';
import { renderPath, updatePath } from './views/path.js';
import { renderPlayer, updatePlayer } from './views/player.js';
import { renderShelf } from './views/shelf.js';

const root = document.getElementById('app');
const nowPlayingRoot = document.getElementById('now-playing');
installImageFallback(document);

let catalogue = null;
let lastActiveKey = null;
let shownNowPlayingKey = null;

const store = createStore(localStorage);
const audio = new Audio();
audio.preload = 'metadata';

const getBook = (bookId) => findBook(catalogue, bookId);
const isChapterAvailable = () => true;
const isBookAvailable = () => true;

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

function showPath(book, scrollToCurrent = true) {
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
      engine.apply(command);
      go(playerRouteFor(command));
    },
  });
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

function render() {
  if (!catalogue) return;
  const requested = currentRoute();
  const book = requested.name === 'shelf' ? null : getBook(requested.bookId);
  const route = guardPlayerRoute(requested, engine.getState().active, book);
  if (route !== requested) {
    replaceRoute(route);
    return;
  }
  if (route.name === 'shelf') showShelf();
  else if (route.name === 'path') showPath(book);
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
  const route = currentRoute();
  if (route.name === 'player') replaceRoute({ name: 'path', bookId });
});

let lastWidth = innerWidth;
addEventListener('resize', () => {
  if (innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  const route = currentRoute();
  if (route.name === 'path' && catalogue && getBook(route.bookId)) showPath(getBook(route.bookId), false);
});

addEventListener('hashchange', render);

async function start() {
  const response = await fetch('catalogue.json');
  catalogue = parseCatalogue(await response.text());
  const lastBookId = store.getLast();
  const lastBook = lastBookId ? getBook(lastBookId) : null;
  const restored = restoreAtStartup(
    lastBook,
    lastBook ? store.getPosition(lastBook.id) : null,
    (chapterId) => isChapterAvailable(lastBook, chapterId),
  );
  if (restored) engine.restore(restored);
  render();
}

start();
