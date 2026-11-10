/* Génère catalogue.json. À lancer depuis la racine du site après chaque ajout de livre. */
import fs from 'node:fs';
import path from 'node:path';
import { buildCatalogue } from './lib/catalogue.js';

const root = process.cwd();
if (!fs.existsSync(path.join(root, 'bibliotheque'))) {
  console.error('Dossier bibliotheque/ introuvable : lancez la commande depuis la racine du site.');
  process.exit(1);
}

const { catalogue, warnings } = buildCatalogue(root, new Date());
fs.writeFileSync(path.join(root, 'catalogue.json'), `${JSON.stringify(catalogue, null, 2)}\n`);

for (const warning of warnings) console.warn(`Attention : ${warning}`);
console.log(`catalogue.json : ${catalogue.books.length} livre(s).`);
