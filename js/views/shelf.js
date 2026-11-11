/* Écran d'accueil : l'étagère des livres, avec la bascule jour / nuit. */
import { escapeHtml, iconHtml, imageHtml } from '../dom.js';

/* Décor du bandeau : nuages le jour, étoiles la nuit (le CSS montre l'un ou l'autre). */
const DECOR = `<svg class="shelf-decor" viewBox="0 0 170 90" aria-hidden="true">
  <g class="decor-day" fill="#fff">
    <ellipse cx="44" cy="30" rx="30" ry="11"/><circle cx="34" cy="23" r="12"/><circle cx="52" cy="19" r="14"/>
    <ellipse cx="120" cy="64" rx="24" ry="9"/><circle cx="112" cy="58" r="10"/><circle cx="127" cy="56" r="11"/>
  </g>
  <g class="decor-night" fill="#FFF6DC">
    <path d="m40 14 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>
    <path d="m128 50 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z"/>
    <circle cx="86" cy="24" r="2"/><circle cx="12" cy="62" r="1.6"/><circle cx="160" cy="18" r="1.8"/><circle cx="70" cy="74" r="1.5"/>
  </g>
</svg>`;

export function renderShelf(root, {
  catalogue, isBookAvailable, onOpenBook, night, onToggleTheme,
}) {
  root.innerHTML = `<header class="shelf-header">
      ${DECOR}
      <h1 class="shelf-heading">Mes histoires</h1>
      <button class="round theme-toggle" data-target aria-pressed="${night}"
        aria-label="Mode nuit">${iconHtml(night ? 'moon' : 'sun')}</button>
    </header>
    <div class="shelf">${catalogue.books.map((book) => {
    const available = isBookAvailable(book);
    return `
      <button class="book" data-book-id="${escapeHtml(book.id)}" aria-disabled="${!available}">
        <span class="book-cover" data-target>${imageHtml(book.cover, book.title)}</span>
        <span class="book-title">${escapeHtml(book.title)}</span>
      </button>`;
  }).join('')}</div>`;

  root.querySelector('.theme-toggle').addEventListener('click', onToggleTheme);
  root.querySelectorAll('.book').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') !== 'true') onOpenBook(button.dataset.bookId);
    });
  });
}
