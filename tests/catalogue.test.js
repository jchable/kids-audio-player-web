import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readId3Title } from '../scripts/lib/id3.js';
import { cleanTitle, buildCatalogue } from '../scripts/lib/catalogue.js';

const NOW = new Date('2026-11-10T12:00:00Z');

function syncsafe(n) {
  return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
}

function id3(major, encoding, textBytes) {
  const body = Buffer.concat([Buffer.from([encoding]), textBytes]);
  const size = major === 4
    ? Buffer.from(syncsafe(body.length))
    : Buffer.from([0, 0, body.length >> 8, body.length & 0xff]);
  const frame = Buffer.concat([Buffer.from('TIT2'), size, Buffer.from([0, 0]), body]);
  return Buffer.concat([
    Buffer.from('ID3'), Buffer.from([major, 0, 0]), Buffer.from(syncsafe(frame.length)), frame,
  ]);
}

function makeLibrary(books) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogue-'));
  for (const [book, files] of Object.entries(books)) {
    const dir = path.join(root, 'bibliotheque', book);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
  }
  return root;
}

const build = (books) => buildCatalogue(makeLibrary(books), NOW);

test('cleanTitle retire le numéro et l\'extension', () => {
  assert.equal(cleanTitle('01-la-foret.mp3'), 'La foret');
  assert.equal(cleanTitle('02_le miel.mp3'), 'Le miel');
});

test('TIT2 en latin1 (ID3v2.3)', () => {
  assert.equal(readId3Title(id3(3, 0, Buffer.from('La forêt', 'latin1'))), 'La forêt');
});

test('TIT2 en UTF-16 avec BOM (ID3v2.3)', () => {
  const text = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('La forêt', 'utf16le')]);
  assert.equal(readId3Title(id3(3, 1, text)), 'La forêt');
});

test('TIT2 en UTF-8 (ID3v2.4)', () => {
  assert.equal(readId3Title(id3(4, 3, Buffer.from('La forêt', 'utf8'))), 'La forêt');
});

test('readId3Title renvoie null sans tag', () => {
  assert.equal(readId3Title(Buffer.from('pas de tag ici')), null);
});

test('tri naturel : 2 avant 10', () => {
  const { catalogue } = build({ livre: { '10-a.mp3': 'x', '2-b.mp3': 'x' } });
  assert.deepEqual(catalogue.books[0].chapters.map((c) => c.id), ['2-b.mp3', '10-a.mp3']);
});

test('titre : album.json, puis ID3, puis nom de fichier', () => {
  const { catalogue } = build({
    livre: {
      'album.json': JSON.stringify({ title: 'Mon livre', chapters: { '01-a.mp3': { title: 'Depuis album' } } }),
      '01-a.mp3': id3(3, 0, Buffer.from('Depuis tag', 'latin1')),
      '02-b.mp3': id3(3, 0, Buffer.from('Depuis tag', 'latin1')),
      '03-c.mp3': 'sans tag',
    },
  });
  const [book] = catalogue.books;
  assert.equal(book.title, 'Mon livre');
  assert.deepEqual(book.chapters.map((c) => c.title), ['Depuis album', 'Depuis tag', 'C']);
});

test('titre du livre : nom de dossier nettoyé sans album.json', () => {
  const { catalogue } = build({ 'le-petit-ours': { 'a.mp3': 'x' } });
  assert.equal(catalogue.books[0].title, 'Le petit ours');
});

test('image de chapitre : même nom que l\'audio', () => {
  const { catalogue } = build({ livre: { '01-a.mp3': 'x', '01-a.jpg': 'i', '02-b.mp3': 'x' } });
  const [a, b] = catalogue.books[0].chapters;
  assert.equal(a.image, 'bibliotheque/livre/01-a.jpg');
  assert.equal(b.image, null);
});

for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'svg']) {
  test(`couverture acceptée : ${ext}`, () => {
    const { catalogue } = build({ livre: { 'a.mp3': 'x', [`couverture.${ext}`]: 'i' } });
    assert.equal(catalogue.books[0].cover, `bibliotheque/livre/couverture.${ext}`);
  });
}

test('sans couverture : null', () => {
  const { catalogue } = build({ livre: { 'a.mp3': 'x' } });
  assert.equal(catalogue.books[0].cover, null);
});

test('livre sans MP3 écarté avec avertissement', () => {
  const { catalogue, warnings } = build({ vide: { 'couverture.jpg': 'i' }, bon: { 'a.mp3': 'x' } });
  assert.deepEqual(catalogue.books.map((b) => b.id), ['bon']);
  assert.ok(warnings.some((w) => w.includes('vide')));
});

test('album.json invalide ignoré avec avertissement', () => {
  const { catalogue, warnings } = build({ livre: { 'album.json': '{oups', 'a.mp3': 'x' } });
  assert.equal(catalogue.books[0].title, 'Livre');
  assert.ok(warnings.some((w) => w.includes('album.json')));
});

test('lyrics de album.json transmis, sinon null', () => {
  const lyrics = [{ t: 1, text: 'Bonjour' }];
  const { catalogue } = build({
    livre: {
      'album.json': JSON.stringify({ chapters: { 'a.mp3': { lyrics } } }),
      'a.mp3': 'x',
      'b.mp3': 'x',
    },
  });
  assert.deepEqual(catalogue.books[0].chapters[0].lyrics, lyrics);
  assert.equal(catalogue.books[0].chapters[1].lyrics, null);
});

test('assets contient audio, image et couverture avec size et mtime', () => {
  const { catalogue } = build({ livre: { 'a.mp3': 'xxx', 'a.jpg': 'ii', 'couverture.png': 'c' } });
  const assets = catalogue.books[0].assets;
  assert.deepEqual(
    assets.map((a) => [a.src, a.size]).sort(),
    [
      ['bibliotheque/livre/a.jpg', 2],
      ['bibliotheque/livre/a.mp3', 3],
      ['bibliotheque/livre/couverture.png', 1],
    ],
  );
  assert.ok(assets.every((a) => typeof a.mtime === 'number'));
});

test('catalogue daté et versionné', () => {
  const { catalogue } = build({ livre: { 'a.mp3': 'x' } });
  assert.equal(catalogue.version, 1);
  assert.equal(catalogue.generatedAt, NOW.toISOString());
});

test('URL encodées segment par segment', () => {
  const { catalogue } = build({ "l'ours #1": { '01 été.mp3': 'x' } });
  const [ch] = catalogue.books[0].chapters;
  assert.equal(ch.src, "bibliotheque/l'ours%20%231/01%20%C3%A9t%C3%A9.mp3");
  assert.equal(catalogue.books[0].id, "l'ours #1");
  assert.equal(ch.id, '01 été.mp3');
});
