/* Élément audio unique, indépendant des écrans, et commandes système. */
import { previous as previousCommand, next as nextCommand, onEnded } from './playback.js';

const SAVE_EVERY_SECONDS = 5;
const STALL_LIMIT_MS = 8000;

const IMAGE_TYPES = { png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };
const imageType = (src) => IMAGE_TYPES[src.split('.').pop().toLowerCase()] || 'image/jpeg';

export function createAudioEngine({
  audio, store, page, getBook, isAvailable, mediaSession, Metadata,
  setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  let active = null;
  let playing = false;
  let error = null;
  let pendingTime = null;
  let lastSavedTime = 0;
  let stallTimer = null;
  const listeners = new Set();
  const finishedHandlers = new Set();

  const notify = () => listeners.forEach((fn) => fn());
  const getChapter = () => {
    if (!active) return null;
    return getBook(active.bookId).chapters.find((c) => c.id === active.chapterId) || null;
  };

  function savePosition() {
    if (!active) return;
    const time = pendingTime !== null ? pendingTime : audio.currentTime;
    store.setPosition(active.bookId, active.chapterId, time);
    lastSavedTime = time;
  }

  function disarmStall() {
    if (stallTimer !== null) clearTimer(stallTimer);
    stallTimer = null;
  }

  function fail(kind) {
    disarmStall();
    playing = false;
    error = kind;
    notify();
  }

  function armStall() {
    disarmStall();
    stallTimer = setTimer(() => {
      stallTimer = null;
      audio.pause();
      fail('audio');
    }, STALL_LIMIT_MS);
  }

  function updateMetadata() {
    const chapter = getChapter();
    if (!mediaSession || !Metadata || !chapter) return;
    const book = getBook(active.bookId);
    const image = chapter.image || book.cover;
    const artwork = image
      ? [{ src: new URL(image, page.baseURI).href, sizes: '512x512', type: imageType(image) }]
      : [];
    mediaSession.metadata = new Metadata({ title: chapter.title, album: book.title, artwork });
  }

  function startPlaying() {
    armStall();
    const result = audio.play();
    if (result && result.catch) result.catch(() => { disarmStall(); playing = false; notify(); });
  }

  function apply(command) {
    const { bookId, chapterId, time, play } = command;
    const sameChapter = active && active.bookId === bookId && active.chapterId === chapterId;
    error = null;

    if (!sameChapter) {
      savePosition();
      const chapter = getBook(bookId).chapters.find((c) => c.id === chapterId);
      active = { bookId, chapterId };
      pendingTime = time || 0;
      lastSavedTime = pendingTime;
      audio.src = chapter.src;
      store.setPosition(bookId, chapterId, pendingTime);
      store.setLast(bookId);
      updateMetadata();
    } else if (time !== null) {
      audio.currentTime = time;
    }

    if (play) startPlaying();
    notify();
  }

  function go(command) {
    if (!command) return;
    if (!isAvailable(command.bookId, command.chapterId)) {
      fail('unavailable');
      return;
    }
    apply(command);
  }

  function finish(bookId) {
    disarmStall();
    active = null;
    playing = false;
    error = null;
    audio.removeAttribute('src');
    audio.load();
    store.clearPosition(bookId);
    finishedHandlers.forEach((fn) => fn(bookId));
    notify();
  }

  function handleEnded() {
    if (!active) return;
    const { bookId, chapterId } = active;
    const book = getBook(bookId);
    const result = onEnded(book, chapterId);
    store.star(bookId, result.star);
    if (result.finished) {
      finish(bookId);
    } else if (isAvailable(bookId, result.command.chapterId)) {
      apply(result.command);
    } else {
      store.setPosition(bookId, result.command.chapterId, 0);
      fail('unavailable');
    }
  }

  audio.addEventListener('loadedmetadata', () => {
    if (pendingTime !== null) {
      audio.currentTime = pendingTime < audio.duration ? pendingTime : 0;
      pendingTime = null;
    }
    notify();
  });
  audio.addEventListener('play', () => {
    playing = true;
    if (mediaSession) mediaSession.playbackState = 'playing';
    notify();
  });
  audio.addEventListener('playing', () => { disarmStall(); notify(); });
  audio.addEventListener('waiting', () => { if (playing) armStall(); });
  audio.addEventListener('pause', () => {
    disarmStall();
    playing = false;
    if (mediaSession) mediaSession.playbackState = 'paused';
    savePosition();
    notify();
  });
  audio.addEventListener('timeupdate', () => {
    if (Math.abs(audio.currentTime - lastSavedTime) >= SAVE_EVERY_SECONDS) savePosition();
    notify();
  });
  audio.addEventListener('ended', handleEnded);
  audio.addEventListener('error', () => { if (active) fail('audio'); });
  page.addEventListener('visibilitychange', () => {
    if (page.visibilityState === 'hidden') savePosition();
  });

  const controls = {
    apply,
    restore: apply,
    toggle() {
      if (!active) return;
      error = null;
      if (audio.paused) startPlaying(); else audio.pause();
      notify();
    },
    markUnavailable() {
      audio.pause();
      fail('unavailable');
    },
    seek(seconds) {
      audio.currentTime = seconds;
      notify();
    },
    previous() {
      if (active) go(previousCommand(getBook(active.bookId), active.chapterId));
    },
    next() {
      if (active) go(nextCommand(getBook(active.bookId), active.chapterId));
    },
    getState() {
      return {
        active,
        playing,
        error,
        time: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      };
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onFinished(fn) {
      finishedHandlers.add(fn);
    },
  };

  if (mediaSession) {
    const handlers = {
      play: () => startPlaying(),
      pause: () => audio.pause(),
      previoustrack: () => controls.previous(),
      nexttrack: () => controls.next(),
      seekbackward: null, // null : iOS affiche précédent/suivant plutôt que ±10 s
      seekforward: null,
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch { /* action non prise en charge */ }
    }
  }

  return controls;
}
