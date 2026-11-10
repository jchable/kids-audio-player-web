import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioEngine } from '../js/audio-engine.js';
import { createStore } from '../js/store.js';
import { tapChapter } from '../js/playback.js';

const chapter = (id) => ({ id, title: `T-${id}`, src: `${id}.mp3`, image: null, lyrics: null });
const BOOK = { id: 'b', title: 'Livre', cover: 'cover.jpg', chapters: ['c1', 'c2', 'c3'].map(chapter) };
const OTHER = { id: 'o', title: 'Autre', cover: null, chapters: ['x1'].map(chapter) };

class FakeAudio extends EventTarget {
  loads = 0;
  currentTime = 0;
  duration = 100;
  paused = true;
  #src = '';
  get src() { return this.#src; }
  set src(value) { this.#src = value; this.loads += 1; this.currentTime = 0; }
  removeAttribute() { this.#src = ''; }
  load() {}
  play() { this.paused = false; this.fire('play'); return Promise.resolve(); }
  pause() { this.paused = true; this.fire('pause'); }
  fire(name) { this.dispatchEvent(new Event(name)); }
  ready() { this.fire('loadedmetadata'); }
}

class FakePage extends EventTarget {
  visibilityState = 'visible';
  baseURI = 'https://site.test/';
  hide() { this.visibilityState = 'hidden'; this.dispatchEvent(new Event('visibilitychange')); }
}

function fakeSession() {
  return { handlers: {}, metadata: null, playbackState: 'none', setActionHandler(n, h) { this.handlers[n] = h; } };
}

function setup({ available = () => true } = {}) {
  const audio = new FakeAudio();
  const page = new FakePage();
  const data = new Map();
  const store = createStore({
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  });
  const timers = [];
  const mediaSession = fakeSession();
  const engine = createAudioEngine({
    audio,
    store,
    page,
    getBook: (id) => ({ b: BOOK, o: OTHER }[id]),
    isAvailable: available,
    mediaSession,
    Metadata: class { constructor(init) { Object.assign(this, init); } },
    setTimer: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; },
    clearTimer: (t) => { if (t) t.cleared = true; },
  });
  const runTimers = () => timers.filter((t) => !t.cleared).forEach((t) => t.fn());
  return { audio, store, engine, mediaSession, page, runTimers };
}

const play = (chapterId, time = 0, bookId = 'b') => ({ bookId, chapterId, time, play: true });

test('apply charge le chapitre et se place au temps demandé', () => {
  const { audio, engine } = setup();
  engine.apply(play('c2', 42));
  assert.equal(audio.src, 'c2.mp3');
  assert.equal(audio.paused, false);
  audio.ready();
  assert.equal(audio.currentTime, 42);
  assert.deepEqual(engine.getState().active, { bookId: 'b', chapterId: 'c2' });
});

test('position au-delà de la durée : repart du début', () => {
  const { audio, engine } = setup();
  engine.apply(play('c1', 500));
  audio.ready();
  assert.equal(audio.currentTime, 0);
});

test('apply avec play false reste en pause', () => {
  const { audio, engine } = setup();
  engine.apply({ bookId: 'b', chapterId: 'c1', time: 3, play: false });
  assert.equal(audio.paused, true);
});

test('sauvegarde avant le chargement : la position mémorisée n\'est pas perdue', () => {
  const { engine, store, page } = setup();
  engine.apply({ bookId: 'b', chapterId: 'c1', time: 30, play: false });
  page.hide();
  assert.deepEqual(store.getPosition('b'), { chapterId: 'c1', time: 30 });
});

test('deux apply identiques : un seul chargement', () => {
  const { audio, engine } = setup();
  engine.apply(play('c1'));
  engine.apply(play('c1'));
  assert.equal(audio.loads, 1);
});

test('double toucher sur un chapitre : la lecture ne repart pas de zéro', () => {
  const { audio, engine } = setup();
  const tap = () => engine.apply(tapChapter(
    { book: BOOK, active: engine.getState().active, saved: null }, 'c1',
  ));
  tap();
  audio.ready();
  audio.currentTime = 3;
  tap();
  assert.equal(audio.currentTime, 3);
  assert.equal(audio.loads, 1);
});

test('apply avec time null ne touche ni src ni currentTime', () => {
  const { audio, engine } = setup();
  engine.apply(play('c1'));
  audio.ready();
  audio.currentTime = 7;
  engine.apply({ bookId: 'b', chapterId: 'c1', time: null, play: true });
  assert.equal(audio.currentTime, 7);
  assert.equal(audio.loads, 1);
});

test('apply sur le chapitre actif avec un temps : repositionne', () => {
  const { audio, engine } = setup();
  engine.apply(play('c1'));
  audio.ready();
  audio.currentTime = 7;
  engine.apply(play('c1', 0));
  assert.equal(audio.currentTime, 0);
});

test('changer de livre sauvegarde la position du précédent', () => {
  const { audio, engine, store } = setup();
  engine.apply(play('c2'));
  audio.ready();
  audio.currentTime = 33;
  engine.apply(play('x1', 0, 'o'));
  assert.deepEqual(store.getPosition('b'), { chapterId: 'c2', time: 33 });
});

test('apply mémorise le dernier livre', () => {
  const { engine, store } = setup();
  engine.apply(play('c1'));
  assert.equal(store.getLast(), 'b');
});

test('sauvegarde toutes les 5 secondes de lecture', () => {
  const { audio, engine, store } = setup();
  engine.apply(play('c1'));
  audio.ready();
  store.clearPosition('b');
  audio.currentTime = 4.9;
  audio.fire('timeupdate');
  assert.equal(store.getPosition('b'), null);
  audio.currentTime = 5;
  audio.fire('timeupdate');
  assert.deepEqual(store.getPosition('b'), { chapterId: 'c1', time: 5 });
});

test('sauvegarde à la pause', () => {
  const { audio, engine, store } = setup();
  engine.apply(play('c1'));
  audio.ready();
  audio.currentTime = 2;
  audio.pause();
  assert.deepEqual(store.getPosition('b'), { chapterId: 'c1', time: 2 });
});

test('sauvegarde quand la page passe en arrière-plan', () => {
  const { audio, engine, store, page } = setup();
  engine.apply(play('c1'));
  audio.ready();
  audio.currentTime = 2;
  page.hide();
  assert.deepEqual(store.getPosition('b'), { chapterId: 'c1', time: 2 });
});

test('ended : étoile et chapitre suivant lancé', () => {
  const { audio, engine, store } = setup();
  engine.apply(play('c1'));
  audio.fire('ended');
  assert.equal(store.isStarred('b', 'c1'), true);
  assert.equal(audio.src, 'c2.mp3');
  assert.equal(audio.paused, false);
});

test('ended au dernier : position effacée et onFinished appelé', () => {
  const { audio, engine, store } = setup();
  let finished = null;
  engine.onFinished((bookId) => { finished = bookId; });
  engine.apply(play('c3'));
  audio.fire('ended');
  assert.equal(finished, 'b');
  assert.equal(store.isStarred('b', 'c3'), true);
  assert.equal(store.getPosition('b'), null);
  assert.equal(engine.getState().active, null);
  assert.equal(engine.getState().playing, false);
});

test('seek jusqu\'à la fin sans ended : pas d\'étoile', () => {
  const { audio, engine, store } = setup();
  engine.apply(play('c1'));
  audio.ready();
  engine.seek(100);
  assert.equal(audio.currentTime, 100);
  assert.equal(store.isStarred('b', 'c1'), false);
});

test('chapitre suivant indisponible : arrêt et erreur unavailable', () => {
  const { audio, engine, store } = setup({ available: (_, id) => id !== 'c2' });
  engine.apply(play('c1'));
  audio.fire('ended');
  assert.equal(audio.src, 'c1.mp3');
  assert.equal(engine.getState().error, 'unavailable');
  assert.equal(engine.getState().playing, false);
  assert.deepEqual(store.getPosition('b'), { chapterId: 'c2', time: 0 });
});

test('événement error : lecture arrêtée, erreur audio', () => {
  const { audio, engine } = setup();
  engine.apply(play('c1'));
  audio.fire('error');
  assert.equal(engine.getState().playing, false);
  assert.equal(engine.getState().error, 'audio');
});

test('une nouvelle commande efface l\'erreur', () => {
  const { audio, engine } = setup();
  engine.apply(play('c1'));
  audio.fire('error');
  engine.apply(play('c2'));
  assert.equal(engine.getState().error, null);
});

test('waiting sans reprise pendant 8 s : arrêt et erreur audio', () => {
  const { audio, engine, runTimers } = setup();
  engine.apply(play('c1'));
  audio.fire('playing');
  audio.fire('waiting');
  runTimers();
  assert.equal(audio.paused, true);
  assert.equal(engine.getState().error, 'audio');
});

test('lecture qui repart avant 8 s : pas d\'erreur', () => {
  const { audio, engine, runTimers } = setup();
  engine.apply(play('c1'));
  audio.fire('playing');
  audio.fire('waiting');
  audio.fire('playing');
  runTimers();
  assert.equal(engine.getState().error, null);
});

test('lancement qui ne démarre jamais : erreur audio après 8 s', () => {
  const { engine, runTimers } = setup();
  engine.apply(play('c1'));
  runTimers();
  assert.equal(engine.getState().error, 'audio');
});

test('toggle alterne lecture et pause', () => {
  const { audio, engine } = setup();
  engine.apply(play('c1'));
  engine.toggle();
  assert.equal(audio.paused, true);
  assert.equal(engine.getState().playing, false);
  engine.toggle();
  assert.equal(audio.paused, false);
  assert.equal(engine.getState().playing, true);
});

test('toggle sans audio actif ne fait rien', () => {
  const { audio, engine } = setup();
  engine.toggle();
  assert.equal(audio.paused, true);
});

test('previous et next suivent les règles', () => {
  const { audio, engine } = setup();
  engine.apply(play('c2'));
  engine.next();
  assert.equal(audio.src, 'c3.mp3');
  engine.next();
  assert.equal(audio.src, 'c3.mp3');
  engine.previous();
  assert.equal(audio.src, 'c2.mp3');
});

test('subscribe notifie et se désabonne', () => {
  const { engine } = setup();
  let calls = 0;
  const off = engine.subscribe(() => { calls += 1; });
  engine.apply(play('c1'));
  const seen = calls;
  assert.ok(seen > 0);
  off();
  engine.apply(play('c2'));
  assert.equal(calls, seen);
});

test('Media Session : métadonnées du chapitre', () => {
  const { engine, mediaSession } = setup();
  engine.apply(play('c1'));
  assert.equal(mediaSession.metadata.title, 'T-c1');
  assert.equal(mediaSession.metadata.album, 'Livre');
  assert.equal(mediaSession.metadata.artwork[0].src, 'https://site.test/cover.jpg');
});

test('Media Session : previoustrack et nexttrack suivent les règles', () => {
  const { audio, engine, mediaSession } = setup();
  engine.apply(play('c2'));
  mediaSession.handlers.nexttrack();
  assert.equal(audio.src, 'c3.mp3');
  mediaSession.handlers.previoustrack();
  assert.equal(audio.src, 'c2.mp3');
  assert.equal(mediaSession.handlers.seekforward, null);
  assert.equal(mediaSession.handlers.seekbackward, null);
});

test('fonctionne sans Media Session', () => {
  const audio = new FakeAudio();
  const engine = createAudioEngine({
    audio,
    store: createStore({ getItem: () => null, setItem() {}, removeItem() {} }),
    page: new FakePage(),
    getBook: () => BOOK,
    isAvailable: () => true,
    mediaSession: null,
    setTimer: () => null,
    clearTimer: () => {},
  });
  engine.apply(play('c1'));
  assert.equal(audio.src, 'c1.mp3');
});
