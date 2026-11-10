/* Mémoire locale de l'appareil : positions, étoiles, dernier livre écouté.
   Si le stockage est indisponible, l'application continue, sans mémoire. */

const PREFIX = 'lecteur.v1.';

export function createStore(storage) {
  function read(name, fallback) {
    try {
      const raw = storage.getItem(PREFIX + name);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(name, value) {
    try {
      storage.setItem(PREFIX + name, JSON.stringify(value));
    } catch {
      /* stockage indisponible ou plein */
    }
  }

  return {
    getPosition(bookId) {
      return read('positions', {})[bookId] || null;
    },
    setPosition(bookId, chapterId, time) {
      write('positions', { ...read('positions', {}), [bookId]: { chapterId, time } });
    },
    clearPosition(bookId) {
      const positions = read('positions', {});
      delete positions[bookId];
      write('positions', positions);
    },
    isStarred(bookId, chapterId) {
      return (read('stars', {})[bookId] || []).includes(chapterId);
    },
    star(bookId, chapterId) {
      const stars = read('stars', {});
      const list = stars[bookId] || [];
      if (!list.includes(chapterId)) write('stars', { ...stars, [bookId]: [...list, chapterId] });
    },
    getLast() {
      return read('last', null);
    },
    setLast(bookId) {
      write('last', bookId);
    },
  };
}
