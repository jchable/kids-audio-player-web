/* Assemble les données, le moteur audio et les écrans. */
import { parseCatalogue } from './catalog.js';
import { installImageFallback } from './dom.js';
import { parseRoute, routeHash } from './router.js';
import { renderShelf } from './views/shelf.js';

const root = document.getElementById('app');
installImageFallback(document);

let catalogue = null;

function render() {
  const route = parseRoute(location.hash);
  if (route.name === 'shelf' && catalogue) {
    renderShelf(root, {
      catalogue,
      isBookAvailable: () => true,
      onOpenBook: (bookId) => { location.hash = routeHash({ name: 'path', bookId }); },
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
