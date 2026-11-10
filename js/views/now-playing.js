/* Commande « écoute en cours », en bas de l'étagère et du chemin. */
import { escapeHtml, iconHtml, imageHtml } from '../dom.js';

export function updateNowPlaying(root, state) {
  const toggle = root.querySelector('.now-toggle');
  if (!toggle) return;
  const icon = state.playing ? 'pause' : 'play';
  if (toggle.dataset.icon !== icon) {
    toggle.dataset.icon = icon;
    toggle.innerHTML = iconHtml(icon);
  }
}

export function clearNowPlaying(root) {
  root.innerHTML = '';
  document.body.classList.remove('has-now-playing');
}

export function renderNowPlaying(root, {
  book, chapter, state, onToggle, onOpen,
}) {
  root.innerHTML = `<div class="now-bar">
    <button class="now-open" data-target aria-label="Ouvrir le lecteur">
      <span class="now-image">${imageHtml(chapter.image || book.cover, chapter.title)}</span>
      <span class="now-text">
        <span class="now-title">${escapeHtml(chapter.title)}</span>
        <span class="now-book">${escapeHtml(book.title)}</span>
      </span>
    </button>
    <button class="round now-toggle" data-target aria-label="Lecture ou pause"></button>
  </div>`;
  document.body.classList.add('has-now-playing');
  root.querySelector('.now-open').addEventListener('click', onOpen);
  root.querySelector('.now-toggle').addEventListener('click', onToggle);
  updateNowPlaying(root, state);
}
