# Lecteur de livres audio pour enfant

Un lecteur web pensé pour un enfant de 3 ans qui ne sait pas lire et l'utilise seul, sur téléphone ou tablette. Il choisit un livre sur une étagère, un chapitre sur un chemin, et écoute.

## Essayer le lecteur

Depuis la racine du dépôt, avec Node 22 ou plus récent :

```sh
npm run exemple      # crée une bibliothèque de démonstration
npm run catalogue    # génère catalogue.json
npx serve .          # ouvre le site sur http://localhost:3000
npm test             # lance les tests
```

## Documents

- [Recette sur les appareils](docs/recette-appareils.md)

- [Conception](docs/superpowers/specs/2026-11-10-lecteur-livres-audio-enfant-design.md)
- [Maquette retenue](docs/superpowers/specs/2026-11-10-maquette-retenue.html), à ouvrir dans un navigateur
- [Les trois pistes d'origine](docs/superpowers/specs/2026-11-10-maquettes-trois-pistes.html)

## Ajouter un livre

Un dossier par livre dans `bibliotheque/`, puis `npm run catalogue` à la racine du site. La commande signale les fichiers à corriger, et le livre apparaît ensuite sur les appareils sans autre action.

```text
bibliotheque/
  le-petit-ours/      le nom du dossier identifie le livre : ne pas le renommer ensuite
    album.json        facultatif
    couverture.jpg
    01-la-foret.mp3   numéroter sur 2 chiffres pour fixer l'ordre
    01-la-foret.jpg   facultatif, même nom que l'audio
```

| Fichier | Nom | Format | Taille conseillée |
|---|---|---|---|
| Audio | Libre, en `.mp3` | MP3 uniquement | Sans contrainte |
| Couverture du livre | `couverture.jpg` (ou `.jpeg`, `.png`, `.webp`, `.svg`) | Portrait 3:4 | 900 × 1200 px, moins de 300 Ko |
| Illustration de chapitre | Nom du MP3, autre extension | Carré | 1000 × 1000 px, moins de 300 Ko |

- Gardez le sujet au centre : les images sont recadrées en carré et en rond. La couverture remplace l'illustration d'un chapitre qui n'en a pas.
- Les espaces et les accents sont acceptés dans les noms de fichiers.
- Toutes les couvertures sont copiées sur chaque appareil : gardez-les légères.
- Un MP3 ou une image remplacé sur un livre déjà téléchargé affiche « mise à jour disponible » sur le chemin (bouton jaune).

Le titre du livre vient de `album.json`, sinon du nom du dossier. Celui d'un chapitre vient de `album.json`, sinon du tag du MP3, sinon du nom du fichier (sans correction des accents). Exemple de `album.json` :

```json
{
  "title": "Le petit ours",
  "chapters": { "01-la-foret.mp3": { "title": "La forêt" } }
}
```

Le contenu de `bibliotheque/` et `catalogue.json` ne sont pas versionnés dans Git : ils vivent sur le serveur.

## Hébergement

Copiez sur le serveur `index.html`, `manifest.webmanifest`, `sw.js`, `catalogue.json` et les dossiers `css/`, `js/`, `fonts/`, `icons/`, `img/`, `bibliotheque/`. Ne servez pas la racine du dépôt : `.git/`, `scripts/`, `tests/` et `docs/` seraient lisibles.

Après toute modification de l'application (pas des livres), incrémentez `SHELL_CACHE` dans `sw.js`, sinon les appareils garderont l'ancienne version.

Le site est prévu pour un serveur privé, joignable uniquement depuis le réseau de la maison. Il doit :

- servir les fichiers en **HTTPS**, sans quoi le mode hors-ligne ne fonctionne pas dans les navigateurs ;
- utiliser un nom de domaine dont un sous-domaine pointe vers l'adresse locale du serveur, avec un certificat obtenu par challenge DNS ;
- accepter les requêtes HTTP `Range`, pour pouvoir avancer dans l'audio ;
- ne pas être exposé sur Internet : aucune redirection de port vers lui sur la box ;
- envoyer ces en-têtes sur toutes les réponses :

  ```text
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'self'; font-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  ```

- et, pour les fichiers `.svg` de `bibliotheque/`, remplacer la politique ci-dessus par `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`.

`index.html` déclare déjà la même politique, sauf `frame-ancestors`, que seul un en-tête peut imposer. Le service worker protège aussi les SVG de la bibliothèque, mais seulement une fois installé : l'en-tête du serveur couvre la première visite.

Certaines box bloquent les réponses DNS publiques contenant une adresse privée. Il faut alors y ajouter une exception ou une résolution locale.

## Préparer un appareil pour l'écoute hors de la maison

À faire à la maison :

1. Installer l'application sur l'écran d'accueil.
2. L'ouvrir depuis son icône, et télécharger les livres depuis cette icône. Sur iPhone et iPad, un livre téléchargé dans Safari n'est pas disponible depuis l'icône.
3. Fermer l'application, passer en mode avion et vérifier qu'elle démarre et lit un livre téléchargé.
