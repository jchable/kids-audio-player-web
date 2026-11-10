/* Règles de lecture : que faire quand l'enfant touche quelque chose. Sans accès au DOM. */
import { chapterIndex } from './catalog.js';

const command = (book, chapterId, time, play = true) => ({
  bookId: book.id, chapterId, time, play,
});

export function tapChapter({ book, active, saved }, chapterId) {
  if (active && active.bookId === book.id && active.chapterId === chapterId) {
    return command(book, chapterId, null);
  }
  const time = saved && saved.chapterId === chapterId ? saved.time : 0;
  return command(book, chapterId, time);
}

export function previous(book, chapterId) {
  const index = Math.max(chapterIndex(book, chapterId) - 1, 0);
  return command(book, book.chapters[index].id, 0);
}

export function next(book, chapterId) {
  const index = chapterIndex(book, chapterId);
  if (index < 0 || index >= book.chapters.length - 1) return null;
  return command(book, book.chapters[index + 1].id, 0);
}

export function onEnded(book, chapterId) {
  const following = next(book, chapterId);
  return { star: chapterId, command: following, finished: following === null };
}

export function restoreAtStartup(book, saved, isAvailable) {
  if (!book || !saved) return null;
  if (chapterIndex(book, saved.chapterId) < 0) return null;
  if (!isAvailable(saved.chapterId)) return null;
  return command(book, saved.chapterId, saved.time, false);
}
