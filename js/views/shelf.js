/* Écran d'accueil : l'étagère des livres. */
import { escapeHtml, imageHtml } from '../dom.js';

export function renderShelf(root, { catalogue, isBookAvailable, onOpenBook }) {
  root.innerHTML = `<div class="shelf">${catalogue.books.map((book) => {
    const available = isBookAvailable(book);
    return `
      <button class="book" data-book-id="${escapeHtml(book.id)}" aria-disabled="${!available}">
        <span class="book-cover" data-target>${imageHtml(book.cover, book.title)}</span>
        <span class="book-title">${escapeHtml(book.title)}</span>
      </button>`;
  }).join('')}</div>`;

  root.querySelectorAll('.book').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') !== 'true') onOpenBook(button.dataset.bookId);
    });
  });
}
