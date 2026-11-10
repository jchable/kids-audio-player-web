/* Fonctions du service worker. Script classique : aucun import ni export. */
globalThis.SwLib = {
  parseRange(header, size) {
    if (!header) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match || (match[1] === '' && match[2] === '')) return null;

    let start;
    let end;
    if (match[1] === '') {
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
    }
    return start > end || start >= size ? 'unsatisfiable' : { start, end };
  },

  isAudioPath(pathname) {
    return /\/bibliotheque\/.+\.mp3$/i.test(pathname);
  },

  isValidCatalogueText(text) {
    try {
      return Array.isArray(JSON.parse(text).books);
    } catch {
      return false;
    }
  },
};
