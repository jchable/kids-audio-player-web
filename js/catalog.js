/* Accès au catalogue des livres. */

export function parseCatalogue(text) {
  try {
    const data = JSON.parse(text);
    return data && Array.isArray(data.books) ? data : null;
  } catch {
    return null;
  }
}

export function findBook(catalogue, bookId) {
  return catalogue.books.find((b) => b.id === bookId) || null;
}

export function chapterIndex(book, chapterId) {
  return book.chapters.findIndex((c) => c.id === chapterId);
}

export function bookVersion(book) {
  return book.assets.map((a) => `${a.src}:${a.size}:${a.mtime}`).sort().join('|');
}

/* Un livre téléchargé reste affiché tel que téléchargé, même retiré du serveur. */
export function mergeDownloaded(catalogue, snapshots) {
  const byId = new Map(snapshots.map((b) => [b.id, b]));
  const serverBooks = catalogue ? catalogue.books : [];
  const serverIds = new Set(serverBooks.map((b) => b.id));
  return {
    ...catalogue,
    books: [
      ...serverBooks.map((b) => byId.get(b.id) || b),
      ...snapshots.filter((b) => !serverIds.has(b.id)),
    ],
  };
}
