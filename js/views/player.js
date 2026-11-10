/* Écran de lecture. */
import { escapeHtml, iconHtml, imageHtml } from '../dom.js';

let dragging = false;

function setProgress(root, ratio) {
  const percent = `${Math.min(Math.max(ratio, 0), 1) * 100}%`;
  root.querySelector('.progress-fill').style.width = percent;
  root.querySelector('.progress-handle').style.left = percent;
}

export function updatePlayer(root, state) {
  const toggle = root.querySelector('.toggle');
  if (!toggle) return;
  root.querySelector('.player').classList.toggle('has-error', Boolean(state.error));
  let icon = state.playing ? 'pause' : 'play';
  if (state.error) icon = 'retry';
  if (toggle.dataset.icon !== icon) {
    toggle.dataset.icon = icon;
    toggle.innerHTML = iconHtml(icon);
  }
  if (!dragging && state.duration > 0) setProgress(root, state.time / state.duration);
}

function installSeek(root, getDuration, onSeek) {
  const bar = root.querySelector('.progress');
  const handle = root.querySelector('.progress-handle');
  let ratio = 0;

  const follow = (event) => {
    const box = bar.getBoundingClientRect();
    ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    setProgress(root, ratio);
  };

  /* Seul le curseur se saisit : toucher la barre ne fait rien. */
  handle.addEventListener('pointerdown', (event) => {
    dragging = true;
    handle.setPointerCapture(event.pointerId);
    follow(event);
  });
  handle.addEventListener('pointermove', (event) => { if (dragging) follow(event); });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    if (getDuration() > 0) onSeek(ratio * getDuration());
  };
  handle.addEventListener('pointerup', release);
  handle.addEventListener('pointercancel', () => { dragging = false; });
}

export function renderPlayer(root, {
  book, chapter, state, onToggle, onPrev, onNext, onSeek, onHome, onPath, canNext, getDuration,
}) {
  dragging = false;
  const number = book.chapters.indexOf(chapter) + 1;
  root.innerHTML = `<div class="player">
    <header class="player-top">
      <button class="round home" data-target aria-label="Mes livres">${iconHtml('home')}</button>
      <button class="book-thumb" data-target aria-label="Les chapitres">${imageHtml(book.cover, book.title)}</button>
    </header>
    <div class="player-art"><div class="player-page">${imageHtml(chapter.image || book.cover, chapter.title)}</div></div>
    <div class="player-info">
      <h1 class="player-title">${escapeHtml(chapter.title)}</h1>
      <p class="player-book">${escapeHtml(book.title)} · chapitre ${number}</p>
      <div class="progress">
        <div class="progress-fill"></div>
        <div class="progress-handle"><span></span></div>
      </div>
      <div class="controls">
        <button class="round secondary prev" data-target aria-label="Chapitre précédent">${iconHtml('prev')}</button>
        <button class="round toggle" data-target aria-label="Lecture ou pause"></button>
        <button class="round secondary next" data-target aria-label="Chapitre suivant" aria-disabled="${!canNext}">${iconHtml('next')}</button>
      </div>
    </div>
  </div>`;

  root.querySelector('.home').addEventListener('click', onHome);
  root.querySelector('.book-thumb').addEventListener('click', onPath);
  root.querySelector('.prev').addEventListener('click', onPrev);
  root.querySelector('.toggle').addEventListener('click', onToggle);
  root.querySelector('.next').addEventListener('click', () => { if (canNext) onNext(); });
  installSeek(root, getDuration, onSeek);
  updatePlayer(root, state);
}
