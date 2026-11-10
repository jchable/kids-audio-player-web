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

Les livres sont déposés à la main dans `bibliotheque/`, un dossier par livre :

```text
bibliotheque/
  le-petit-ours/
    album.json        facultatif
    couverture.jpg
    01-la-foret.mp3
    01-la-foret.jpg   facultatif, même nom que l'audio
```

Après chaque ajout, lancez `npm run catalogue` à la racine du site. Elle signale les fichiers à corriger. Le nouveau livre apparaît sur les appareils sans autre action.

Le titre d'un chapitre vient de `album.json`, sinon du tag du MP3, sinon du nom du fichier. Exemple de `album.json` :

```json
{
  "title": "Le petit ours",
  "chapters": { "01-la-foret.mp3": { "title": "La forêt" } }
}
```

Le contenu de `bibliotheque/` et `catalogue.json` ne sont pas versionnés dans Git : ils vivent sur le serveur.

## Hébergement

Copiez sur le serveur `index.html`, `manifest.webmanifest`, `sw.js`, `catalogue.json` et les dossiers `css/`, `js/`, `fonts/`, `icons/`, `img/`, `bibliotheque/`.

Après toute modification de l'application (pas des livres), incrémentez `SHELL_CACHE` dans `sw.js`, sinon les appareils garderont l'ancienne version.

Le site est prévu pour un serveur privé, joignable uniquement depuis le réseau de la maison. Il doit :

- servir les fichiers en **HTTPS**, sans quoi le mode hors-ligne ne fonctionne pas dans les navigateurs ;
- utiliser un nom de domaine dont un sous-domaine pointe vers l'adresse locale du serveur, avec un certificat obtenu par challenge DNS ;
- accepter les requêtes HTTP `Range`, pour pouvoir avancer dans l'audio.

Certaines box bloquent les réponses DNS publiques contenant une adresse privée. Il faut alors y ajouter une exception ou une résolution locale.

## Préparer un appareil pour l'écoute hors de la maison

À faire à la maison :

1. Installer l'application sur l'écran d'accueil.
2. L'ouvrir depuis son icône, et télécharger les livres depuis cette icône. Sur iPhone et iPad, un livre téléchargé dans Safari n'est pas disponible depuis l'icône.
3. Fermer l'application, passer en mode avion et vérifier qu'elle démarre et lit un livre téléchargé.
