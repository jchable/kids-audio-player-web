/* Navigation par adresse : #/, #/livre/<id>, #/livre/<id>/<n>. */

const SHELF = { name: 'shelf' };

export function parseRoute(hash) {
  const match = /^#\/livre\/([^/]+)(?:\/(\d+))?$/.exec(hash);
  if (!match) return SHELF;
  let bookId;
  try {
    bookId = decodeURIComponent(match[1]);
  } catch {
    return SHELF;
  }
  if (match[2] === undefined) return { name: 'path', bookId };
  const n = Number(match[2]);
  return n >= 1 ? { name: 'player', bookId, n } : SHELF;
}

export function routeHash(route) {
  if (route.name === 'shelf') return '#/';
  const base = `#/livre/${encodeURIComponent(route.bookId)}`;
  return route.name === 'path' ? base : `${base}/${route.n}`;
}

/* Une adresse ne change jamais l'audio : le lecteur n'affiche que le chapitre actif. */
export function guardPlayerRoute(route, active, book) {
  if (route.name === 'shelf') return route;
  if (!book) return SHELF;
  if (route.name !== 'player') return route;
  const chapter = book.chapters[route.n - 1];
  const isActive = chapter && active
    && active.bookId === route.bookId && active.chapterId === chapter.id;
  return isActive ? route : { name: 'path', bookId: route.bookId };
}
