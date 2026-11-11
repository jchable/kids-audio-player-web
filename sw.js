/* Service worker : application disponible hors-ligne, audio servi depuis les téléchargements. */
importScripts('js/sw-lib.js');

const SHELL_CACHE = 'lecteur-shell-v5';  // ⚠ à incrémenter à chaque modification d'un fichier du shell
const AUDIO_CACHE = 'lecteur-audio-v1';  // Ne jamais renommer : contient les téléchargements

const {
  parseRange, isAudioPath, isValidCatalogueText, precache, carryOver, withSvgPolicy, isShellAsset,
} = self.SwLib;

const SHELL_ASSETS = [
  './', 'manifest.webmanifest', 'css/app.css',
  'js/audio-engine.js', 'js/catalog.js', 'js/dom.js', 'js/input-guard.js', 'js/main.js', 'js/offline.js',
  'js/path-layout.js', 'js/playback.js', 'js/router.js', 'js/store.js', 'js/sw-lib.js',
  'js/views/download-button.js', 'js/views/now-playing.js', 'js/views/path.js',
  'js/views/player.js', 'js/views/shelf.js', 'js/views/states.js',
  'fonts/fredoka.woff2', 'img/couverture-neutre.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

async function cacheCovers(catalogue) {
  const cache = await caches.open(SHELL_CACHE);
  const covers = catalogue.books.map((book) => book.cover).filter(Boolean);
  await Promise.allSettled(covers.map(async (cover) => {
    if (!(await cache.match(cover))) await cache.add(cover);
  }));
}

/* Un catalogue invalide ne remplace jamais le dernier catalogue valide. */
async function refreshCatalogue(cache, request) {
  const response = await fetch(request, { cache: 'no-store' });
  if (!response.ok) return null;
  const text = await response.clone().text();
  if (!isValidCatalogueText(text)) return null;

  const previous = await cache.match('catalogue.json');
  const changed = !previous || (await previous.text()) !== text;
  await cache.put('catalogue.json', response.clone());
  await cacheCovers(JSON.parse(text));

  if (changed && previous) {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => client.postMessage({ type: 'catalogue-updated' }));
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await precache(cache, SHELL_ASSETS, (asset) => new Request(asset, { cache: 'reload' }));
    await carryOver(caches, SHELL_CACHE, 'lecteur-shell-');
    await refreshCatalogue(cache, 'catalogue.json').catch(() => null);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== SHELL_CACHE && key !== AUDIO_CACHE).map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

async function serveAudio(request) {
  if (request.cache === 'no-store') return fetch(request); // téléchargement explicite : toujours le réseau
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request.url, { ignoreSearch: true });
  if (!cached) return fetch(request);

  const header = request.headers.get('range');
  if (!header) return cached;

  const buffer = await cached.arrayBuffer();
  const size = buffer.byteLength;
  const range = parseRange(header, size);
  if (range === null) return new Response(buffer, { headers: cached.headers });
  if (range === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buffer.slice(range.start, range.end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Content-Length': String(range.end - range.start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

async function serveImage(request) {
  if (request.cache === 'no-store') return fetch(request);
  const audioCache = await caches.open(AUDIO_CACHE);
  const shellCache = await caches.open(SHELL_CACHE);
  return (await audioCache.match(request.url, { ignoreSearch: true }))
    || (await shellCache.match(request.url, { ignoreSearch: true }))
    || fetch(request);
}

async function serveCatalogue(event) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match('catalogue.json');
  const refreshing = refreshCatalogue(cache, event.request);
  event.waitUntil(refreshing.catch(() => null));
  if (cached) return cached;
  return (await refreshing) || Response.error();
}

async function serveShell(event, key) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(key, { ignoreSearch: true });
  const refreshing = fetch(event.request).then((response) => {
    if (response.ok) return cache.put(key, response.clone()).then(() => response);
    return response;
  });
  event.waitUntil(refreshing.catch(() => null));
  return cached || refreshing;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isAudioPath(url.pathname)) event.respondWith(serveAudio(request));
  else if (url.pathname.includes('/bibliotheque/')) {
    event.respondWith(serveImage(request).then((response) => withSvgPolicy(response, url.pathname)));
  } else if (url.pathname.endsWith('/catalogue.json')) event.respondWith(serveCatalogue(event));
  else if (request.mode === 'navigate') event.respondWith(serveShell(event, './'));
  else if (isShellAsset(request.url, self.registration.scope, SHELL_ASSETS)) {
    event.respondWith(serveShell(event, request));
  }
  // Toute autre requête va au réseau, sans passer par le cache.
});
