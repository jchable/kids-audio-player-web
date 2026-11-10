/* Écran des chapitres : un chemin d'étapes. */
import { escapeHtml, iconHtml, imageHtml } from '../dom.js';
import { STEP_SIZE, pathD, pathLayout } from '../path-layout.js';

function stepHtml(book, chapter, index, point, available) {
  const left = point.x - STEP_SIZE / 2;
  const top = point.y - STEP_SIZE / 2;
  return `
    <button class="step" data-chapter-id="${escapeHtml(chapter.id)}" data-target
      aria-disabled="${!available}" style="left:${left}px;top:${top}px">
      <span class="step-image">${imageHtml(chapter.image || book.cover, chapter.title)}</span>
      <span class="step-number">${index + 1}</span>
      <span class="step-star">${iconHtml('star')}</span>
      <span class="step-title">${escapeHtml(chapter.title)}</span>
    </button>`;
}

export function updatePath(root, {
  book, saved, isStarred, failedChapterId = null,
}) {
  const current = saved ? saved.chapterId : book.chapters[0].id;
  root.querySelectorAll('.step').forEach((step) => {
    const { chapterId } = step.dataset;
    step.classList.toggle('current', chapterId === current);
    step.classList.toggle('starred', isStarred(book.id, chapterId));
    step.classList.toggle('failed', chapterId === failedChapterId);
  });
}

export function renderPath(root, {
  book, saved, isStarred, isChapterAvailable, onTapChapter, onHome, scrollToCurrent = true,
}) {
  root.innerHTML = `<div class="path-view"><header class="path-header">
      <button class="round home" data-target aria-label="Mes livres">${iconHtml('home')}</button>
      <h1 class="path-title">${escapeHtml(book.title)}</h1>
      <div class="path-action"></div>
    </header><div class="path-map"></div></div>`;

  const map = root.querySelector('.path-map');
  const { points, height } = pathLayout(book.chapters.length, map.clientWidth);
  map.style.height = `${height}px`;
  map.innerHTML = `<svg class="path-line" width="100%" height="${height}" aria-hidden="true">
      <path d="${pathD(points)}"/></svg>
    ${book.chapters.map((chapter, i) => stepHtml(book, chapter, i, points[i], isChapterAvailable(book, chapter.id))).join('')}`;

  root.querySelector('.home').addEventListener('click', onHome);
  map.querySelectorAll('.step').forEach((step) => {
    step.addEventListener('click', () => {
      if (step.getAttribute('aria-disabled') !== 'true') onTapChapter(step.dataset.chapterId);
    });
  });

  updatePath(root, { book, saved, isStarred });
  if (scrollToCurrent) {
    const current = root.querySelector('.step.current');
    if (current) current.scrollIntoView({ block: 'center' });
  }
}
