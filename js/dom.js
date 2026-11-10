/* Petits utilitaires d'affichage. */

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export const NEUTRAL_COVER = 'img/couverture-neutre.svg';

export function imageHtml(src, alt, fallbackSrc = NEUTRAL_COVER) {
  const shown = src || fallbackSrc;
  return `<img src="${escapeHtml(shown)}" alt="${escapeHtml(alt)}" draggable="false"`
    + ` data-fallback="${escapeHtml(fallbackSrc)}">`;
}

/* Remplace toute image qui ne charge pas (les erreurs d'image ne remontent qu'en capture). */
export function installImageFallback(root) {
  root.addEventListener('error', (event) => {
    const img = event.target;
    if (img.tagName !== 'IMG' || !img.dataset.fallback) return;
    const fallback = img.dataset.fallback;
    delete img.dataset.fallback;
    img.src = fallback;
  }, true);
}

const ICONS = {
  play: 'M7 4.2v15.6a1 1 0 0 0 1.5.86l13-7.8a1 1 0 0 0 0-1.72l-13-7.8A1 1 0 0 0 7 4.2Z',
  pause: 'M6 4h4.5v16H6Zm7.5 0H18v16h-4.5Z',
  prev: 'M3 4.5h3.4v15H3Zm18 1v13a1 1 0 0 1-1.55.84L9 12.84a1 1 0 0 1 0-1.68l10.45-6.5A1 1 0 0 1 21 5.5Z',
  next: 'M17.6 4.5H21v15h-3.4ZM3 5.5v13a1 1 0 0 0 1.55.84L15 12.84a1 1 0 0 0 0-1.68L4.55 4.66A1 1 0 0 0 3 5.5Z',
  home: 'M12 2.6 1.8 11.8a.8.8 0 0 0 .54 1.4H4.6v7.3c0 .55.45 1 1 1h4v-6.4h4.8v6.4h4c.55 0 1-.45 1-1v-7.3h2.26a.8.8 0 0 0 .54-1.4Z',
  star: 'm12 1.8 3 6.5 7.1.8-5.3 4.8 1.5 7-6.3-3.6-6.3 3.6 1.5-7-5.3-4.8 7.1-.8Z',
  download: 'M10 3h4v8.2h3.6L12 17.6 6.4 11.2H10ZM4 19h16v2.6H4Z',
  check: 'm9.3 18.6-6-6 2.4-2.4 3.6 3.6 9-9 2.4 2.4Z',
  retry: 'M12 4V1L7 6l5 5V7a5.5 5.5 0 1 1-5.5 5.5H3.5A8.5 8.5 0 1 0 12 4Z',
  trash: 'M9 2h6l1 2h4v2.6H4V4h4ZM6 8h12l-1 14H7Z',
  back: 'M15.7 3.3a1.6 1.6 0 0 1 0 2.3L9.2 12l6.5 6.4a1.6 1.6 0 1 1-2.3 2.3l-7.7-7.6a1.6 1.6 0 0 1 0-2.2l7.7-7.6a1.6 1.6 0 0 1 2.3 0Z',
};

export function iconHtml(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
}
