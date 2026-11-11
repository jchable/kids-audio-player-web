/* Mémoire locale de l'appareil : positions, étoiles, dernier livre écouté, thème.
   Si le stockage est indisponible, l'application continue, sans mémoire. */

const PREFIX = 'lecteur.v1.';
export const THEMES = ['jour', 'nuit']; // le premier est le thème par défaut

export function createStore(storage) {
  // Simple accès à localStorage : il peut lever une exception selon le navigateur.
  const access = typeof storage === 'function' ? storage : () => storage;

  function read(name, fallback) {
    try {
      const raw = access().getItem(PREFIX + name);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(name, value) {
    try {
      access().setItem(PREFIX + name, JSON.stringify(value));
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
    getTheme() {
      return THEMES.includes(read('theme', null)) ? read('theme', null) : THEMES[0];
    },
    setTheme(theme) {
      write('theme', theme);
    },
  };
}
