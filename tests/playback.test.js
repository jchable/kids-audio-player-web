import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tapChapter, previous, next, onEnded, restoreAtStartup, shouldRelease,
} from '../js/playback.js';
import { parseRoute, routeHash, guardPlayerRoute } from '../js/router.js';

const book = { id: 'b', chapters: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] };
const ctx = (active, saved) => ({ book, active, saved });

test('chapitre actif : ne repositionne pas et lance la lecture', () => {
  assert.deepEqual(tapChapter(ctx({ bookId: 'b', chapterId: 'c2' }, null), 'c2'),
    { bookId: 'b', chapterId: 'c2', time: null, play: true });
});

test('chapitre mémorisé non actif : reprend à la position', () => {
  const saved = { chapterId: 'c2', time: 42 };
  assert.deepEqual(tapChapter(ctx(null, saved), 'c2'),
    { bookId: 'b', chapterId: 'c2', time: 42, play: true });
});

test('autre chapitre : depuis le début', () => {
  const saved = { chapterId: 'c2', time: 42 };
  assert.equal(tapChapter(ctx({ bookId: 'b', chapterId: 'c2' }, saved), 'c3').time, 0);
});

test('même chapitre dans un autre livre actif : pas considéré comme actif', () => {
  assert.equal(tapChapter(ctx({ bookId: 'autre', chapterId: 'c1' }, null), 'c1').time, 0);
});

test('previous recule d\'un chapitre', () => {
  assert.deepEqual(previous(book, 'c2'), { bookId: 'b', chapterId: 'c1', time: 0, play: true });
});

test('previous au premier chapitre : même chapitre, depuis le début', () => {
  assert.deepEqual(previous(book, 'c1'), { bookId: 'b', chapterId: 'c1', time: 0, play: true });
});

test('next avance d\'un chapitre', () => {
  assert.deepEqual(next(book, 'c1'), { bookId: 'b', chapterId: 'c2', time: 0, play: true });
});

test('next au dernier chapitre : rien', () => {
  assert.equal(next(book, 'c3'), null);
});

test('onEnded au milieu : étoile et chapitre suivant', () => {
  assert.deepEqual(onEnded(book, 'c1'), {
    star: 'c1',
    command: { bookId: 'b', chapterId: 'c2', time: 0, play: true },
    finished: false,
  });
});

test('onEnded au dernier chapitre : étoile et fin du livre', () => {
  assert.deepEqual(onEnded(book, 'c3'), { star: 'c3', command: null, finished: true });
});

test('restoreAtStartup : en pause, à la position mémorisée', () => {
  assert.deepEqual(restoreAtStartup(book, { chapterId: 'c2', time: 9 }, () => true),
    { bookId: 'b', chapterId: 'c2', time: 9, play: false });
});

test('restoreAtStartup : chapitre indisponible', () => {
  assert.equal(restoreAtStartup(book, { chapterId: 'c2', time: 9 }, () => false), null);
});

test('restoreAtStartup : sans livre ni position', () => {
  assert.equal(restoreAtStartup(null, { chapterId: 'c2', time: 9 }, () => true), null);
  assert.equal(restoreAtStartup(book, null, () => true), null);
});

test('position vers un chapitre disparu : pas de reprise', () => {
  const saved = { chapterId: 'parti.mp3', time: 9 };
  assert.equal(restoreAtStartup(book, saved, () => true), null);
  assert.equal(tapChapter(ctx(null, saved), 'c1').time, 0);
});

test('parseRoute : étagère', () => {
  assert.deepEqual(parseRoute(''), { name: 'shelf' });
  assert.deepEqual(parseRoute('#/'), { name: 'shelf' });
  assert.deepEqual(parseRoute('#/nimporte'), { name: 'shelf' });
});

test('parseRoute : chemin et lecteur, identifiants décodés', () => {
  assert.deepEqual(parseRoute('#/livre/a%20b'), { name: 'path', bookId: 'a b' });
  assert.deepEqual(parseRoute('#/livre/a%20b/2'), { name: 'player', bookId: 'a b', n: 2 });
});

test('parseRoute : adresse malformée', () => {
  assert.deepEqual(parseRoute('#/livre/%E0%A4%A'), { name: 'shelf' });
  assert.deepEqual(parseRoute('#/livre/a/0'), { name: 'shelf' });
});

test('routeHash est l\'inverse de parseRoute', () => {
  for (const route of [
    { name: 'shelf' },
    { name: 'path', bookId: "l'ours #1" },
    { name: 'player', bookId: "l'ours #1", n: 3 },
  ]) {
    assert.deepEqual(parseRoute(routeHash(route)), route);
  }
});

test('guardPlayerRoute : audio correspondant, route conservée', () => {
  const route = { name: 'player', bookId: 'b', n: 2 };
  assert.deepEqual(guardPlayerRoute(route, { bookId: 'b', chapterId: 'c2' }, book), route);
});

test('guardPlayerRoute : audio différent, redirection vers le chemin', () => {
  const route = { name: 'player', bookId: 'b', n: 2 };
  const expected = { name: 'path', bookId: 'b' };
  assert.deepEqual(guardPlayerRoute(route, { bookId: 'b', chapterId: 'c1' }, book), expected);
  assert.deepEqual(guardPlayerRoute(route, null, book), expected);
});

test('guardPlayerRoute : livre inconnu, retour à l\'étagère', () => {
  assert.deepEqual(guardPlayerRoute({ name: 'path', bookId: 'x' }, null, null), { name: 'shelf' });
});

test('guardPlayerRoute : étagère inchangée', () => {
  assert.deepEqual(guardPlayerRoute({ name: 'shelf' }, null, null), { name: 'shelf' });
});

const withBook = { books: [book] };
const withoutBook = { books: [{ id: 'autre', chapters: [] }] };
const restored = { active: { bookId: 'b', chapterId: 'c2' }, playing: false };

test('livre restauré retiré du catalogue : libéré', () => {
  assert.equal(shouldRelease(restored, withoutBook), true);
});

test('livre restauré encore au catalogue : gardé', () => {
  assert.equal(shouldRelease(restored, withBook), false);
});

test('livre retiré mais en lecture : gardé, l\'écoute n\'est jamais coupée', () => {
  assert.equal(shouldRelease({ ...restored, playing: true }, withoutBook), false);
});

test('aucun livre actif : rien à libérer', () => {
  assert.equal(shouldRelease({ active: null, playing: false }, withoutBook), false);
});
