import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCatalogue, findBook, chapterIndex, bookVersion, mergeDownloaded,
} from '../js/catalog.js';
import { createStore } from '../js/store.js';

const book = (id, title = id) => ({
  id, title, cover: null, chapters: [{ id: 'a.mp3' }, { id: 'b.mp3' }], assets: [],
});

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

test('parseCatalogue rejette un JSON invalide', () => {
  assert.equal(parseCatalogue('{oups'), null);
});

test('parseCatalogue rejette un catalogue sans liste de livres', () => {
  assert.equal(parseCatalogue('{"books":3}'), null);
  assert.equal(parseCatalogue('null'), null);
});

test('parseCatalogue accepte un catalogue valide', () => {
  assert.deepEqual(parseCatalogue('{"books":[]}'), { books: [] });
});

test('findBook et chapterIndex', () => {
  const cat = { books: [book('x')] };
  assert.equal(findBook(cat, 'x').id, 'x');
  assert.equal(findBook(cat, 'y'), null);
  assert.equal(chapterIndex(cat.books[0], 'b.mp3'), 1);
  assert.equal(chapterIndex(cat.books[0], 'z.mp3'), -1);
});

test('bookVersion change si la taille change', () => {
  const a = { assets: [{ src: 'a', size: 1, mtime: 5 }] };
  const b = { assets: [{ src: 'a', size: 2, mtime: 5 }] };
  assert.notEqual(bookVersion(a), bookVersion(b));
});

test('bookVersion ne dépend pas de l\'ordre des fichiers', () => {
  const x = { src: 'a', size: 1, mtime: 5 };
  const y = { src: 'b', size: 2, mtime: 6 };
  assert.equal(bookVersion({ assets: [x, y] }), bookVersion({ assets: [y, x] }));
});

test('mergeDownloaded : la copie téléchargée prime', () => {
  const merged = mergeDownloaded({ books: [book('x', 'Nouveau')] }, [book('x', 'Ancien')]);
  assert.deepEqual(merged.books.map((b) => b.title), ['Ancien']);
});

test('mergeDownloaded : un livre retiré du serveur reste', () => {
  const merged = mergeDownloaded({ books: [book('x')] }, [book('retire')]);
  assert.deepEqual(merged.books.map((b) => b.id), ['x', 'retire']);
});

test('mergeDownloaded accepte un catalogue null', () => {
  assert.deepEqual(mergeDownloaded(null, [book('x')]).books.map((b) => b.id), ['x']);
  assert.deepEqual(mergeDownloaded(null, []).books, []);
});

test('position indépendante par livre', () => {
  const s = createStore(memoryStorage());
  s.setPosition('a', 'c1', 12);
  s.setPosition('b', 'c2', 30);
  assert.deepEqual(s.getPosition('a'), { chapterId: 'c1', time: 12 });
  assert.deepEqual(s.getPosition('b'), { chapterId: 'c2', time: 30 });
});

test('clearPosition efface la position du seul livre visé', () => {
  const s = createStore(memoryStorage());
  s.setPosition('a', 'c1', 12);
  s.setPosition('b', 'c2', 30);
  s.clearPosition('a');
  assert.equal(s.getPosition('a'), null);
  assert.deepEqual(s.getPosition('b'), { chapterId: 'c2', time: 30 });
});

test('étoiles indépendantes par livre', () => {
  const s = createStore(memoryStorage());
  s.star('a', 'c1');
  assert.equal(s.isStarred('a', 'c1'), true);
  assert.equal(s.isStarred('b', 'c1'), false);
});

test('getLast et setLast', () => {
  const s = createStore(memoryStorage());
  assert.equal(s.getLast(), null);
  s.setLast('a');
  assert.equal(s.getLast(), 'a');
});

test('une donnée corrompue est ignorée', () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  s.setPosition('a', 'c1', 12);
  for (const k of ['lecteur.v1.positions']) storage.setItem(k, '{oups');
  assert.equal(s.getPosition('a'), null);
});

test('storage qui lève une exception', () => {
  const s = createStore({
    getItem() { throw new Error('non'); },
    setItem() { throw new Error('non'); },
    removeItem() { throw new Error('non'); },
  });
  s.setPosition('a', 'b', 3);
  s.star('a', 'b');
  s.setLast('a');
  assert.equal(s.getPosition('a'), null);
  assert.equal(s.isStarred('a', 'b'), false);
  assert.equal(s.getLast(), null);
});
