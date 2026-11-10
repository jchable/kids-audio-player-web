/* Construit le catalogue à partir des dossiers de bibliotheque/. */
import fs from 'node:fs';
import path from 'node:path';
import { readId3Title } from './id3.js';

const LIBRARY = 'bibliotheque';
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
const naturalCompare = (a, b) => a.localeCompare(b, 'fr', { numeric: true });

export function cleanTitle(fileName) {
  const text = fileName
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/^\d+[\s._-]*/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function readAlbum(dir, bookId, warnings) {
  const file = path.join(dir, 'album.json');
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    warnings.push(`${bookId} : album.json invalide, ignoré`);
    return {};
  }
}

function findImage(names, base) {
  return IMAGE_EXTENSIONS
    .map((ext) => `${base}.${ext}`)
    .find((candidate) => names.includes(candidate)) || null;
}

function buildBook(root, bookId, warnings) {
  const dir = path.join(root, LIBRARY, bookId);
  const names = fs.readdirSync(dir);
  const audioFiles = names.filter((n) => /\.mp3$/i.test(n)).sort(naturalCompare);
  if (audioFiles.length === 0) {
    warnings.push(`${bookId} : aucun MP3, livre écarté`);
    return null;
  }

  const album = readAlbum(dir, bookId, warnings);
  const urlOf = (name) => [LIBRARY, bookId, name].map(encodeURIComponent).join('/');
  const assets = [];
  const addAsset = (name) => {
    const stat = fs.statSync(path.join(dir, name));
    assets.push({ src: urlOf(name), size: stat.size, mtime: Math.floor(stat.mtimeMs) });
    return urlOf(name);
  };

  const coverName = findImage(names, 'couverture');
  const cover = coverName ? addAsset(coverName) : null;

  const chapters = audioFiles.map((id) => {
    const meta = (album.chapters && album.chapters[id]) || {};
    const imageName = findImage(names, id.replace(/\.mp3$/i, ''));
    return {
      id,
      title: meta.title || readId3Title(fs.readFileSync(path.join(dir, id))) || cleanTitle(id),
      src: addAsset(id),
      image: imageName ? addAsset(imageName) : null,
      lyrics: meta.lyrics || null,
    };
  });

  return { id: bookId, title: album.title || cleanTitle(bookId), cover, chapters, assets };
}

export function buildCatalogue(rootDir, now) {
  const warnings = [];
  const entries = fs.readdirSync(path.join(rootDir, LIBRARY), { withFileTypes: true });
  const books = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort(naturalCompare)
    .map((id) => buildBook(rootDir, id, warnings))
    .filter(Boolean);
  return { catalogue: { version: 1, generatedAt: now.toISOString(), books }, warnings };
}
