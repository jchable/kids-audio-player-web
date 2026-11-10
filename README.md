# Lecteur de livres audio pour enfant

Un lecteur web pensé pour un enfant de 3 ans qui ne sait pas lire et l'utilise seul, sur téléphone ou tablette. Il choisit un livre sur une étagère, un chapitre sur un chemin, et écoute.

> **État du projet : en conception.** Le lecteur n'est pas encore construit. Ce dépôt contient pour l'instant le document de conception et les maquettes.

## Documents

- [Conception](docs/superpowers/specs/2026-11-10-lecteur-livres-audio-enfant-design.md)
- [Maquette retenue](docs/superpowers/specs/2026-11-10-maquette-retenue.html), à ouvrir dans un navigateur
- [Les trois pistes d'origine](docs/superpowers/specs/2026-11-10-maquettes-trois-pistes.html)

## Ce qui est prévu

- Un site statique en HTML, CSS et JavaScript, sans compilation ni base de données.
- Une illustration par livre et, si elle existe, par chapitre.
- Le téléchargement d'un livre pour l'écouter hors de la maison.

## Ajouter un livre (prévu)

Les livres sont déposés à la main dans `bibliotheque/`, un dossier par livre :

```text
bibliotheque/
  le-petit-ours/
    album.json        facultatif
    couverture.jpg
    01-la-foret.mp3
    01-la-foret.jpg   facultatif, même nom que l'audio
```

Une commande générera ensuite le catalogue lu par le lecteur. Elle n'existe pas encore.

Le contenu de `bibliotheque/` et `catalogue.json` ne sont pas versionnés dans Git : ils vivent sur le serveur.

## Hébergement

Le site est prévu pour un serveur privé, joignable uniquement depuis le réseau de la maison. Il doit :

- servir les fichiers en **HTTPS**, sans quoi le mode hors-ligne ne fonctionne pas dans les navigateurs ;
- utiliser un nom de domaine dont un sous-domaine pointe vers l'adresse locale du serveur, avec un certificat obtenu par challenge DNS ;
- accepter les requêtes HTTP `Range`, pour pouvoir avancer dans l'audio.

Certaines box bloquent les réponses DNS publiques contenant une adresse privée. Il faut alors y ajouter une exception ou une résolution locale.

## Préparer un appareil pour l'écoute hors de la maison (prévu)

À faire à la maison, une fois le lecteur construit :

1. Installer l'application sur l'écran d'accueil.
2. L'ouvrir depuis son icône, et télécharger les livres depuis cette icône. Sur iPhone et iPad, un livre téléchargé dans Safari n'est pas disponible depuis l'icône.
3. Fermer l'application, passer en mode avion et vérifier qu'elle démarre et lit un livre téléchargé.
