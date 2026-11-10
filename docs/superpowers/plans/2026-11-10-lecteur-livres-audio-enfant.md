# Lecteur de livres audio pour enfant : plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** construire le lecteur web statique décrit dans la spec : étagère de livres, chemin de chapitres, lecteur, téléchargement hors-ligne.

**Architecture :** une page unique en modules ES natifs, sans compilation. La logique (catalogue, transitions de lecture, mise en page du chemin, téléchargement) vit dans des modules purs testés avec `node --test`. Les vues sont fines et vérifiées dans un navigateur. Un service worker classique gère le cache.

**Tech Stack :** HTML, CSS, JavaScript (modules ES), Node 22 pour les tests et la génération du catalogue, aucune dépendance npm.

**Spec :** [`docs/superpowers/specs/2026-11-10-lecteur-livres-audio-enfant-design.md`](../specs/2026-11-10-lecteur-livres-audio-enfant-design.md), maquette : [`2026-11-10-maquette-retenue.html`](../specs/2026-11-10-maquette-retenue.html).

## Global Constraints

- Site statique : pas de compilation, pas de dépendance npm, pas de code côté serveur, pas de base de données.
- Aucune requête vers un tiers, polices comprises. Pas de mesure d'audience.
- Textes et commentaires en français. Le titre du livre et du chapitre est toujours affiché.
- Toutes les cibles tactiles font au moins 72 px, séparées d'au moins 8 px. Bouton de téléchargement : au moins 56 px. Curseur de progression : zone de saisie d'au moins 56 px.
- `navigator.onLine` n'est jamais utilisé.
- Délai maximal d'une requête vers le serveur : 3 secondes.
- Position sauvegardée toutes les 5 secondes, à la pause, et quand la page passe en arrière-plan.
- Le cache shell porte un numéro à incrémenter à chaque modification d'un fichier du shell. Le cache audio n'est jamais renommé.
- Titres et chemins passent toujours par `escapeHtml` à l'affichage.
- Commits en français, au format `type(portée): message`.

## Review Focus

1. Dossiers et fichiers avec espaces, accents, apostrophes ou `#` : les URL du catalogue doivent rester valides (test en tâche 1).
2. `localStorage` indisponible ou plein : l'application continue à lire, sans mémoire (test en tâche 2).
3. Position mémorisée pointant vers un chapitre disparu : le livre repart du début sans erreur (test en tâche 3).
4. Double toucher rapide sur un chapitre : l'audio n'est chargé qu'une fois et ne repart pas de zéro (test en tâche 4).
5. MP3 remplacé sous le même nom après téléchargement : la copie reste cohérente et une mise à jour est proposée (test en tâche 9).

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `package.json` | `"type": "module"`, scripts `test`, `catalogue`, `exemple` |
| `scripts/lib/id3.js`, `scripts/lib/catalogue.js`, `scripts/generer-catalogue.js` | Génération de `catalogue.json` |
| `scripts/creer-exemple.js` | Bibliothèque de démonstration pour le développement |
| `js/catalog.js`, `js/store.js`, `js/playback.js`, `js/router.js`, `js/path-layout.js` | Logique pure |
| `js/audio-engine.js` | Élément audio unique et Media Session |
| `js/offline.js` | Téléchargements et disponibilité |
| `js/sw-lib.js`, `sw.js` | Service worker (script classique) |
| `js/dom.js`, `js/views/*.js`, `js/main.js` | Vues et assemblage |
| `index.html`, `css/app.css`, `manifest.webmanifest`, `fonts/`, `icons/`, `img/` | Shell |

Toutes les vues reçoivent leurs données en paramètres. Chaque élément touchable porte `data-target`, ce qui permet de vérifier les tailles.

---

### Task 1 : Génération du catalogue

**Files :** Create `package.json`, `scripts/lib/id3.js`, `scripts/lib/catalogue.js`, `scripts/generer-catalogue.js`. Test `tests/catalogue.test.js`.

**Interfaces — Produces :**

```text
readId3Title(buf: Buffer) -> string | null
cleanTitle(fileName: string) -> string
buildCatalogue(rootDir: string, now: Date) -> { catalogue: Catalogue, warnings: string[] }

Catalogue = { version: 1, generatedAt: string, books: Book[] }
Book = { id, title, cover: string|null, chapters: Chapter[], assets: Asset[] }
Chapter = { id, title, src, image: string|null, lyrics: array|null }
Asset = { src, size: number, mtime: number }
```

`id` d'un livre : nom du dossier. `id` d'un chapitre : nom du fichier audio. `src`, `cover`, `image` et `assets[].src` sont relatifs à la racine du site et encodés segment par segment avec `encodeURIComponent`. `assets` liste tous les fichiers du livre : audio, images, couverture.

- [ ] **Step 1 : Créer `package.json`**

`{"name":"kids-audio-player-web","private":true,"type":"module","scripts":{"test":"node --test","catalogue":"node scripts/generer-catalogue.js","exemple":"node scripts/creer-exemple.js"}}`

- [ ] **Step 2 : Écrire les tests qui échouent** (bibliothèques construites dans `fs.mkdtemp`)

```js
test('tri naturel : 2 avant 10', ...)         // ['2-b.mp3','10-a.mp3'] dans cet ordre
test('titre : album.json, puis ID3, puis nom', ...)
assert.equal(cleanTitle('01-la-foret.mp3'), 'La foret');
test('TIT2 en latin1, UTF-16 et UTF-8', ...)  // tampons ID3v2.3 et 2.4 construits à la main
test('image de chapitre : même nom que l\'audio', ...)
test('couverture : jpg, jpeg, png, webp ou svg, sinon null', ...)
test('livre sans MP3 écarté avec avertissement', ...)
test('album.json invalide ignoré avec avertissement', ...)
test('lyrics de album.json transmis, sinon null', ...)
test('assets contient audio, image et couverture avec size et mtime', ...)
// Review Focus 1
test('URL encodées', () => {
  // dossier "l'ours #1", fichier "01 été.mp3"
  assert.equal(ch.src, "bibliotheque/l'ours%20%231/01%20%C3%A9t%C3%A9.mp3");
});
```

- [ ] **Step 3 : Vérifier l'échec.** Run : `npm test`. Expected : FAIL, module introuvable.
- [ ] **Step 4 : Implémenter.** `id3.js` reprend le parcours de cadres de `pct-jukebox/.claude/skills/add-song/scripts/add_song.js:32-54`, en lisant `TIT2`. Tri : `localeCompare(b, 'fr', { numeric: true })`. `generer-catalogue.js` écrit `catalogue.json`, affiche les avertissements et sort en code 1 si `bibliotheque/` manque. `encodeURIComponent` conserve l'apostrophe.
- [ ] **Step 5 : Vérifier le succès.** Run : `npm test`. Expected : PASS.
- [ ] **Step 6 : Commit.** `git add package.json scripts tests && git commit -m "feat(catalogue): génération depuis les dossiers"`

### Task 2 : Données côté navigateur

**Files :** Create `js/catalog.js`, `js/store.js`. Test `tests/data.test.js`.

**Interfaces — Produces :**

```text
parseCatalogue(text: string) -> Catalogue | null
findBook(catalogue, bookId) -> Book | null
chapterIndex(book, chapterId) -> number   // -1 si absent
bookVersion(book) -> string               // assets triés, "src:size:mtime" joints
mergeDownloaded(catalogue: Catalogue|null, snapshots: Book[]) -> Catalogue
createStore(storage) -> {
  getPosition(bookId) -> {chapterId, time}|null, setPosition(bookId, chapterId, time),
  clearPosition(bookId), isStarred(bookId, chapterId), star(bookId, chapterId),
  getLast() -> bookId|null, setLast(bookId) }
```

`mergeDownloaded` : un livre téléchargé remplace celui du serveur, et un livre retiré du serveur reste s'il est téléchargé.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
assert.equal(parseCatalogue('{oups'), null);
assert.equal(parseCatalogue('{"books":3}'), null);
test('bookVersion change si la taille change, pas selon l\'ordre', ...)
test('mergeDownloaded : la copie téléchargée prime', ...)
test('mergeDownloaded : un livre retiré du serveur reste', ...)
test('mergeDownloaded accepte un catalogue null', ...)
test('position et étoiles indépendantes par livre', ...)
// Review Focus 2
test('storage qui lève une exception', () => {
  const s = createStore({ getItem(){throw 0}, setItem(){throw 0}, removeItem(){throw 0} });
  s.setPosition('a','b',3);
  assert.equal(s.getPosition('a'), null);
});
```

- [ ] **Step 2 : Vérifier l'échec.** Run : `npm test`. Expected : FAIL.
- [ ] **Step 3 : Implémenter.** Clés `localStorage` préfixées par `lecteur.v1.`. Toute erreur de stockage est ignorée.
- [ ] **Step 4 : Vérifier le succès.** Run : `npm test`. Expected : PASS.
- [ ] **Step 5 : Commit.** `git commit -m "feat(donnees): catalogue et mémoire locale"`

### Task 3 : Règles de lecture et navigation

**Files :** Create `js/playback.js`, `js/router.js`. Test `tests/playback.test.js`.

**Interfaces — Consumes :** `chapterIndex`, `Book`. **Produces :**

```text
Command = { bookId, chapterId, time: number|null, play: boolean }   // time null : ne pas repositionner
Ctx = { book: Book, active: {bookId, chapterId}|null, saved: {chapterId, time}|null }

tapChapter(ctx, chapterId) -> Command
previous(book, chapterId) -> Command
next(book, chapterId) -> Command | null
onEnded(book, chapterId) -> { star: chapterId, command: Command|null, finished: boolean }
restoreAtStartup(book|null, saved, isAvailable: (chapterId)=>boolean) -> Command | null

parseRoute(hash) -> {name:'shelf'} | {name:'path', bookId} | {name:'player', bookId, n}
routeHash(route) -> string
guardPlayerRoute(route, active, book) -> route
```

`n` part de 1. Les valeurs reprennent le tableau « Comportement de lecture » de la spec.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
test('chapitre actif : time null, play true', ...)
test('chapitre mémorisé non actif : reprend à saved.time', ...)
test('autre chapitre : time 0', ...)
test('previous au premier chapitre : même chapitre, time 0', ...)
assert.equal(next(book, dernier), null);
test('onEnded au milieu : étoile et chapitre suivant', ...)
test('onEnded au dernier : étoile, command null, finished true', ...)
test('restoreAtStartup : play false, à la position mémorisée', ...)
test('restoreAtStartup : chapitre indisponible donne null', ...)
// Review Focus 3
test('position vers un chapitre disparu', () => {
  assert.equal(restoreAtStartup(book, {chapterId:'parti.mp3', time:9}, () => true), null);
  assert.equal(tapChapter({book, active:null, saved:{chapterId:'parti.mp3',time:9}}, ch1).time, 0);
});
assert.deepEqual(parseRoute('#/livre/a%20b/2'), {name:'player', bookId:'a b', n:2});
assert.deepEqual(parseRoute('#/nimporte'), {name:'shelf'});
test('guardPlayerRoute : audio différent redirige vers le chemin', ...)
```

- [ ] **Step 2 : Vérifier l'échec.** Run : `npm test`. Expected : FAIL.
- [ ] **Step 3 : Implémenter** ces fonctions pures, sans accès au DOM.
- [ ] **Step 4 : Vérifier le succès.** Run : `npm test`. Expected : PASS.
- [ ] **Step 5 : Commit.** `git commit -m "feat(lecture): règles de transition et navigation"`

### Task 4 : Moteur audio

**Files :** Create `js/audio-engine.js`. Test `tests/audio-engine.test.js`.

**Interfaces — Consumes :** tâches 2 et 3. **Produces :**

```text
createAudioEngine({ audio, store, getBook, isAvailable, mediaSession, setTimer, clearTimer }) -> {
  apply(command), toggle(), seek(seconds), previous(), next(), restore(command),
  getState() -> { active, playing, time, duration, error: null|'audio'|'unavailable' },
  subscribe(fn) -> unsubscribe, onFinished(fn) }
```

`isAvailable` a pour signature `(bookId, chapterId) => boolean`, synchrone. `audio` est un élément unique créé une fois dans `main.js`. Les tests utilisent un faux élément basé sur `EventTarget` et un minuteur injecté.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
test('apply charge src et se place au temps demandé', ...)
// Review Focus 4
test('deux apply identiques : un seul chargement', ...)
test('apply avec time null ne touche ni src ni currentTime', ...)
test('sauvegarde toutes les 5 secondes de lecture', ...)
test('sauvegarde à la pause', ...)
test('sauvegarde quand la page passe en arrière-plan', ...)
test('ended : étoile et chapitre suivant lancé', ...)
test('ended au dernier : position effacée, onFinished appelé', ...)
test('seek jusqu\'à la fin sans ended : pas d\'étoile', ...)
test('chapitre suivant indisponible : arrêt, error unavailable', ...)
test('événement error : playing false, error audio', ...)
test('waiting sans reprise pendant 8 s : arrêt, error audio', ...)
test('Media Session : previoustrack et nexttrack suivent les règles', ...)
```

- [ ] **Step 2 : Vérifier l'échec.** Run : `npm test`. Expected : FAIL.
- [ ] **Step 3 : Implémenter.** Media Session d'après `pct-jukebox/index.html:633-650` : album = titre du livre, artwork = image du chapitre ou couverture, `seekbackward` et `seekforward` à `null`.
- [ ] **Step 4 : Vérifier le succès.** Run : `npm test`. Expected : PASS.
- [ ] **Step 5 : Commit.** `git commit -m "feat(audio): moteur unique et Media Session"`

### Task 5 : Shell et étagère

**Files :** Create `index.html`, `css/app.css`, `manifest.webmanifest`, `js/dom.js`, `js/main.js`, `js/views/shelf.js`, `scripts/creer-exemple.js`, `scripts/fetch-fonts.js`, `fonts/`, `icons/`, `img/couverture-neutre.svg`.

**Interfaces — Produces :**

```text
escapeHtml(text) -> string
imageHtml(src, alt, fallbackSrc) -> string   // remplace l'image si elle ne charge pas
renderShelf(root, { catalogue, isBookAvailable, onOpenBook })
```

- [ ] **Step 1 : Polices et icônes.** Adapter `pct-jukebox/scripts/fetch_fonts.js` à `Fredoka:wght@400..700` (une police variable, déclarée avec `font-weight: 400 700`). Dessiner `icons/icon.svg` dans l'esprit de la maquette et l'exporter en PNG 192, 512, 512 maskable et `apple-touch-icon` 180 avec Playwright. Expected : `file icons/*.png` indique les bonnes dimensions.
- [ ] **Step 2 : Créer `scripts/creer-exemple.js`.** Il écrit dans `bibliotheque/` deux livres (l'un illustré de 4 chapitres, l'autre sans illustrations de 12 chapitres) : MP3 silencieux de 20 secondes (trames MPEG1 Layer III valides, précédées d'un tag ID3 `TIT2`) et images SVG reprises de la maquette. Expected : `npm run exemple && npm run catalogue` affiche 2 livres.
- [ ] **Step 3 : Implémenter le shell et l'étagère** d'après l'écran 1 de la maquette. `manifest.webmanifest` : d'après `pct-jukebox`, `orientation: any`. Les rangées se complètent selon la largeur, sans jamais réduire les couvertures (au moins 130 px de large à 390 px d'écran). Pas de bouton d'installation.
- [ ] **Step 4 : Vérifier dans le navigateur.** Run : `npx serve .`, puis avec Playwright à 390×844 et 1024×768 :

```js
document.querySelectorAll('[data-book-id]').length === 2
[...document.querySelectorAll('[data-target]')].every(e => { const r = e.getBoundingClientRect(); return r.width >= 72 && r.height >= 72 })
document.documentElement.scrollWidth <= innerWidth
```

Expected : `true` partout, et capture conforme à la maquette.

- [ ] **Step 5 : Commit.** `git commit -m "feat(etagere): shell et écran d'accueil"`

### Task 6 : Chemin des chapitres

**Files :** Create `js/path-layout.js`, `js/views/path.js`. Modify `js/main.js`, `css/app.css`. Test `tests/path-layout.test.js`.

**Interfaces — Consumes :** `isStarred`, `getPosition`. **Produces :**

```text
STEP_SIZE = 112, CURRENT_SIZE = 128
pathLayout(count, width) -> { points: [{x, y, row}], height }
pathD(points) -> string
renderPath(root, { book, active, saved, isStarred, isChapterAvailable, onTapChapter, onHome })
updatePath(root, { active, saved, isStarred })     // ne déplace jamais le défilement
```

Moins de 600 px de large : zigzag vertical sur deux colonnes. À partir de 600 px : `Math.floor(width / 170)` étapes par ligne, une ligne sur deux en sens inverse.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
test('zigzag : x alterne en dessous de 600 px', ...)
test('tablette : deuxième ligne en sens inverse', ...)
test('20 chapitres : height augmente, largeur de cellule inchangée', ...)
test('tous les points tiennent dans la largeur à 320, 390, 768, 1024', ...)
assert.ok(pathD(points).startsWith('M'));
```

- [ ] **Step 2 : Vérifier l'échec.** Run : `npm test`. Expected : FAIL.
- [ ] **Step 3 : Implémenter** d'après les écrans 2 et 2 bis. Fond prairie, chemin en pointillés, numéro, titre et étoile sur chaque étape, cercle orange sur le chapitre mémorisé. En-tête fixe avec le bouton maison. Le toucher passe par `click`, et `touch-action: pan-y` laisse le défilement au navigateur. `scrollIntoView({ block: 'center' })` n'est appelé que dans `renderPath`. Le bouton de téléchargement est ajouté en tâche 9.
- [ ] **Step 4 : Vérifier le succès.** Run : `npm test`. Expected : PASS.
- [ ] **Step 5 : Vérifier dans le navigateur** à 390×844, 768×1024 et 1024×768, sur le livre de 12 chapitres : mêmes contrôles qu'en tâche 5. Le titre de chaque étape est visible et le bouton maison reste à l'écran après `scrollTo(0, 9999)`.
- [ ] **Step 6 : Commit.** `git commit -m "feat(chemin): écran des chapitres"`

### Task 7 : Lecteur et écoute en cours

**Files :** Create `js/views/player.js`, `js/views/now-playing.js`. Modify `js/main.js`, `css/app.css`.

**Interfaces — Consumes :** `createAudioEngine`, `tapChapter`, `restoreAtStartup`, `guardPlayerRoute`, vues des tâches 5 et 6. **Produces :**

```text
renderPlayer(root, { book, chapter, state, onToggle, onPrev, onNext, onSeek, onHome, onPath, canNext })
updatePlayer(root, state)
renderNowPlaying(root, { book, chapter, state, onToggle, onOpen })
```

- [ ] **Step 1 : Implémenter le lecteur** d'après l'écran 3, en deux colonnes à partir de 600 px de large. Seul un `pointerdown` sur le curseur (zone de 56 px) démarre un déplacement.
- [ ] **Step 2 : Implémenter la commande d'écoute en cours,** visible sur l'étagère et le chemin dès qu'il y a un audio actif. Réserver sa hauteur en bas de page pour qu'elle ne recouvre rien.
- [ ] **Step 3 : Câbler `main.js`** : audio unique, `restoreAtStartup` au démarrage, `guardPlayerRoute` à chaque changement d'adresse, retour au chemin sur `onFinished`.
- [ ] **Step 4 : Vérifier dans le navigateur** avec la bibliothèque d'exemple :

| Scénario | Résultat attendu |
|---|---|
| Toucher un chapitre | Lecteur ouvert, `audio.paused === false` |
| Maison pendant la lecture | Étagère, le temps continue d'avancer, commande visible |
| Ouvrir le chemin d'un autre livre | Son inchangé, commande visible avec pause qui fonctionne |
| Toucher la barre hors du curseur | `currentTime` inchangé |
| Faire glisser le curseur | `currentTime` modifié |
| `history.back()` vers un autre chapitre | Audio inchangé, redirection vers le chemin |
| Recharger la page | Commande visible, audio en pause, à la position mémorisée |
| Fin du dernier chapitre (seek à -1 s) | Chemin affiché, cercle sur le chapitre 1, plus de commande |

Mêmes contrôles de tailles qu'en tâche 5, sur chaque écran.

- [ ] **Step 5 : Commit.** `git commit -m "feat(lecteur): écoute et commande en cours"`

### Task 8 : Service worker

**Files :** Create `js/sw-lib.js`, `sw.js`. Modify `js/main.js`. Test `tests/sw-lib.test.js`.

**Interfaces — Produces** (`js/sw-lib.js`, script classique sans `import`, exposé sur `globalThis.SwLib`) :

```text
SwLib.parseRange(header: string|null, size: number) -> {start, end} | 'unsatisfiable' | null
SwLib.isAudioPath(pathname) -> boolean
SwLib.isValidCatalogueText(text) -> boolean
SHELL_CACHE = 'lecteur-shell-v1', AUDIO_CACHE = 'lecteur-audio-v1'
```

- [ ] **Step 1 : Écrire les tests qui échouent** (`await import('../js/sw-lib.js')`, puis `globalThis.SwLib`)

```js
assert.deepEqual(SwLib.parseRange('bytes=10-19', 100), {start:10, end:19});
assert.deepEqual(SwLib.parseRange('bytes=-10', 100), {start:90, end:99});
assert.deepEqual(SwLib.parseRange('bytes=90-', 100), {start:90, end:99});
assert.equal(SwLib.parseRange('bytes=200-', 100), 'unsatisfiable');
assert.equal(SwLib.parseRange(null, 100), null);
assert.ok(SwLib.isAudioPath('/bibliotheque/le%20livre/01.mp3'));
assert.ok(!SwLib.isAudioPath('/bibliotheque/livre/01.jpg'));
assert.ok(!SwLib.isValidCatalogueText('<html>'));
```

- [ ] **Step 2 : Vérifier l'échec.** Run : `npm test`. Expected : FAIL.
- [ ] **Step 3 : Implémenter.** `serveAudio` d'après `pct-jukebox/sw.js:52-83`. Règles de `fetch` :

| Requête | Stratégie |
|---|---|
| Autre que GET, ou autre origine | Non interceptée |
| MP3 sous `bibliotheque/` | Cache audio avec 206, sinon réseau |
| Image sous `bibliotheque/` | Cache audio, puis cache shell, puis réseau |
| `catalogue.json` | Cache immédiat, rafraîchi en arrière-plan. Le cache n'est remplacé que si `isValidCatalogueText`, puis les couvertures sont mises en cache |
| Navigation et reste du shell | Cache immédiat, rafraîchi en arrière-plan |

À l'installation : shell, `catalogue.json` et couvertures, avec une erreur tolérée par fichier.

- [ ] **Step 4 : Vérifier le succès.** Run : `npm test`. Expected : PASS.
- [ ] **Step 5 : Vérifier dans le navigateur.** Laisser le service worker s'activer, passer le contexte Playwright hors-ligne, recharger. Expected : étagère affichée, aucune requête en attente.
- [ ] **Step 6 : Commit.** `git commit -m "feat(pwa): service worker et cache de l'application"`

### Task 9 : Téléchargement et disponibilité

**Files :** Create `js/offline.js`, `js/views/download-button.js`. Modify `js/main.js`, `js/views/shelf.js`, `js/views/path.js`, `css/app.css`. Test `tests/offline.test.js`.

**Interfaces — Consumes :** `bookVersion`, `mergeDownloaded`, `AUDIO_CACHE`. **Produces :**

```text
createOffline({ caches, fetch, persist, timeoutMs = 3000 }) -> {
  reconcile(catalogue) -> Promise<void>, snapshots() -> Book[],
  status(bookId) -> 'none'|'downloading'|'downloaded'|'failed'|'update',
  download(book, onProgress) -> Promise<void>, remove(bookId) -> Promise<void>,
  isChapterAvailable(book, chapterId, serverUp) -> boolean, pingServer() -> Promise<boolean> }
renderDownloadButton(root, { status, progress, onDownload, onRemove })
```

La copie du catalogue du livre est écrite dans `AUDIO_CACHE` sous `__copies__/<id>.json`, **après** tous ses fichiers : sa présence vaut téléchargement complet. `pingServer` envoie un `HEAD` sur `catalogue.json`, requête que le service worker n'intercepte pas.

- [ ] **Step 1 : Écrire les tests qui échouent** (faux `caches` et `fetch` en mémoire)

```js
test('download : status downloaded et tous les assets en cache', ...)
test('la copie est écrite après le dernier fichier', ...)
test('réseau coupé au 3e fichier : status failed, fichiers reçus conservés', ...)
test('nouvelle tentative : seuls les fichiers manquants sont demandés', ...)
test('stockage plein à l\'écriture : status failed', ...)
test('reconcile après interruption : fichiers sans copie donnent failed', ...)
test('reconcile : copie présente mais fichier disparu donne failed', ...)
test('remove efface les fichiers et la copie', ...)
test('pingServer : false après 3 s sans réponse', ...)
test('persist appelé au téléchargement, un refus n\'empêche rien', ...)
test('chapitre non téléchargé indisponible si serveur injoignable', ...)
// Review Focus 5
test('fichier remplacé sur le serveur', () => { /* status 'update', snapshots() garde l'ancien titre */ });
```

- [ ] **Step 2 : Vérifier l'échec.** Run : `npm test`. Expected : FAIL.
- [ ] **Step 3 : Implémenter `offline.js`.** Mettre à jour supprime puis retélécharge le livre.
- [ ] **Step 4 : Vérifier le succès.** Run : `npm test`. Expected : PASS.
- [ ] **Step 5 : Câbler l'interface.** Bouton en haut à droite du chemin avec les 5 états, sans texte. Appui long de 1,5 seconde, puis confirmation à deux grandes icônes (poubelle, retour). Livres et chapitres indisponibles grisés et inactifs. `pingServer` au démarrage, au retour au premier plan, et avant le lancement d'un chapitre non téléchargé.
- [ ] **Step 6 : Vérifier le contrat hors-ligne** avec Playwright, après téléchargement du livre illustré puis passage hors-ligne :

```js
(await fetch(src, {headers:{Range:'bytes=10-19'}})).status === 206
(await (await fetch(src, {headers:{Range:'bytes=10-19'}})).arrayBuffer()).byteLength === 10
```

Expected : `true` deux fois. Le chapitre se lance, reprend à sa position, le curseur fonctionne, et le livre non téléchargé est grisé.

- [ ] **Step 7 : Commit.** `git commit -m "feat(hors-ligne): téléchargement par livre"`

### Task 10 : États particuliers, documentation, recette

**Files :** Create `js/views/states.js`, `docs/recette-appareils.md`. Modify `js/main.js`, `js/views/path.js`, `css/app.css`, `README.md`, `CLAUDE.md`.

**Interfaces — Consumes :** `getState().error`, `parseCatalogue`.

- [ ] **Step 1 : Implémenter les états** de la section « États particuliers » de la spec : bibliothèque vide, chargement impossible avec nouvelle tentative toutes les 10 secondes, erreur audio signalée sur l'étape concernée sans texte à lire.
- [ ] **Step 2 : Vérifier dans le navigateur :**

| Situation provoquée | Résultat attendu |
|---|---|
| `catalogue.json` avec `books: []` | Image « bibliothèque vide » |
| `catalogue.json` absent, sans cache | Image « chargement impossible », puis rétablissement seul |
| MP3 supprimé, chapitre touché | Erreur visible, bouton maison utilisable |
| Couverture supprimée | Image de remplacement |
| Premier lancement (stockage vidé) | Aucune commande d'écoute en cours |
| Liste des requêtes réseau | Toutes sur la même origine |

- [ ] **Step 3 : Écrire `docs/recette-appareils.md`,** à dérouler sur les téléphones et tablettes de la famille, en HTTPS, depuis l'icône installée : préparation du README, démarrage en mode avion, continuité de navigation, lecture écran verrouillé, enchaînement de 3 chapitres écran verrouillé, reprise après 10 minutes de pause, déplacement hors-ligne.
- [ ] **Step 4 : Mettre à jour `README.md` et `CLAUDE.md`** : retirer « en conception » et « prévu », documenter `npm run catalogue`, la règle du numéro de cache, et déployer en copiant le site sans `tests/`, `docs/` ni `.superpowers/`.
- [ ] **Step 5 : Vérifier l'ensemble.** Run : `npm test`. Expected : tout PASS.
- [ ] **Step 6 : Commit.** `git commit -m "feat(etats): cas particuliers et recette"`
