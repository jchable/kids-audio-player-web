# CLAUDE.md

Lecteur web de livres audio pour un enfant de 3 ans, non lecteur, qui l'utilise seul sur téléphone ou tablette. La référence est [le document de conception](docs/superpowers/specs/2026-11-10-lecteur-livres-audio-enfant-design.md), et [la maquette retenue](docs/superpowers/specs/2026-11-10-maquette-retenue.html) pour le rendu.

## Commandes

- `npm test` : tests (`node --test`, aucune dépendance).
- `npm run exemple` puis `npm run catalogue` : bibliothèque de démonstration et `catalogue.json`.
- `npx serve .` : serveur local, avec requêtes `Range`.

## Architecture

- `js/main.js` assemble tout. `js/views/` affiche, sans logique métier.
- Logique pure et testée : `catalog.js`, `store.js`, `playback.js`, `router.js`, `path-layout.js`, `offline.js`, `audio-engine.js` (dépendances injectées).
- `sw.js` et `js/sw-lib.js` sont des scripts classiques, sans `import` ni `export`.

## Règles du projet

- Site statique HTML/CSS/JS : pas de compilation, pas de dépendance d'exécution, pas de base de données, pas de code côté serveur.
- Aucune requête vers un service tiers, polices comprises. Pas de mesure d'audience.
- L'interface doit rester utilisable sans savoir lire, mais le titre du livre et du chapitre est toujours affiché.
- Cibles tactiles d'au moins 72 px (attribut `data-target`).
- Textes de l'interface et commentaires en français.
- `bibliotheque/` et `catalogue.json` ne sont jamais versionnés.
- `navigator.onLine` n'est jamais une source de vérité : un téléphone en 4G est « en ligne » sans joindre le serveur de la maison.
- Le mode hors-ligne exige un contexte sécurisé : le tester sur `localhost` ou en HTTPS, pas sur une adresse locale en HTTP.
- ⚠ Toute modification d'un fichier du shell (`index.html`, `css/`, `js/`, `fonts/`, `icons/`, `img/`, manifeste) impose d'incrémenter `SHELL_CACHE` dans `sw.js`. Un nouveau fichier JS doit aussi être ajouté à `SHELL_ASSETS`. Ne jamais renommer `AUDIO_CACHE`.
