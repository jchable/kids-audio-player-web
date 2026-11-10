/* Assemble les données, le moteur audio et les écrans. */
import { findBook, parseCatalogue } from './catalog.js';
import { installImageFallback } from './dom.js';
import { parseRoute, routeHash } from './router.js';
import { createStore } from './store.js';
import { renderPath } from './views/path.js';
import { renderShelf } from './views/shelf.js';

const root = document.getElementById('app');
installImageFallback(document);
const store = createStore(localStorage);

let catalogue = null;
const go = (route) => { location.hash = routeHash(route); };

function render() {
  if (!catalogue) return;
  const route = parseRoute(location.hash);
  const book = route.name === 'shelf' ? null : findBook(catalogue, route.bookId);
  if (book) {
    renderPath(root, {
      book,
      saved: store.getPosition(book.id),
      isStarred: store.isStarred,
      isChapterAvailable: () => true,
      onTapChapter: () => {},
      onHome: () => go({ name: 'shelf' }),
    });
  } else {
    renderShelf(root, {
      catalogue,
      isBookAvailable: () => true,
      onOpenBook: (bookId) => go({ name: 'path', bookId }),
    });
  }
}

async function start() {
  const response = await fetch('catalogue.json');
  catalogue = parseCatalogue(await response.text());
  render();
}

addEventListener('hashchange', render);
start();
