# Lecteur de livres audio pour enfant : conception

Date : 2026-11-10, révisé après revue externe. Maquette validée : [2026-11-10-maquette-retenue.html](2026-11-10-maquette-retenue.html).

## Intention

Un enfant de 3 ans écoute seul, sur un téléphone, les livres audio reçus sur CD puis convertis en MP3. Il ne sait pas lire. Il doit reconnaître son livre à son image, choisir un chapitre et l'écouter sans aide d'un adulte.

Un album est un livre audio. Une piste est un chapitre.

## Objectifs

- Choisir un livre parmi tous ceux de la bibliothèque, puis n'importe lequel de ses chapitres.
- Afficher une illustration par livre et, si elle existe, par chapitre.
- Toujours afficher le titre du livre et du chapitre, même en petit, à côté de l'image.
- Fonctionner sur téléphone (cible principale) et sur tablette.
- Permettre l'écoute hors du domicile après téléchargement d'un livre.

## Hors périmètre

- Interface d'administration ou d'ajout par les parents : les fichiers sont déposés à la main sur le serveur.
- Base de données et code côté serveur.
- Paroles : prévues pour une v2, avec génération automatique. Il suffit de ne pas empêcher leur ajout (champ réservé dans `album.json`).
- Mesure d'audience : pas de Matomo ni d'équivalent.
- Effet de braises du site The Long Burn.
- Compte, profil, contrôle parental, restriction de navigation : l'enfant peut librement changer de livre et de chapitre.

## À éviter absolument

- Une interface qui oblige à lire pour se repérer.
- Des cibles tactiles trop petites ou trop proches pour un enfant de 3 ans.
- Un écran où l'enfant reste bloqué sans moyen évident de revenir à ses livres, y compris en cas d'erreur.
- Du son qu'il ne peut pas arrêter depuis l'écran où il se trouve.
- Une dépendance à Internet ou à un service tiers en fonctionnement normal (polices comprises).

## Contraintes

- Site statique HTML/CSS/JavaScript, sans étape de compilation ni dépendance d'exécution.
- Dépôt : `E:\Sources\kids-audio-player-web`.
- Hébergement sur un serveur privé, joignable uniquement depuis le réseau de la maison, ouvert à quiconque y accède (pas d'authentification).
- **HTTPS obligatoire** : service worker et Cache API n'existent qu'en contexte sécurisé. Sans HTTPS, pas de téléchargement hors-ligne.
- Le serveur doit gérer les requêtes HTTP `Range` pour l'avancement dans l'audio.
- Les pistes durent quelques minutes (confirmé par le propriétaire). La volumétrie n'est pas un sujet de conception.

### Prérequis d'hébergement (hors code)

- Un nom de domaine du propriétaire, dont un sous-domaine pointe vers l'adresse privée du serveur.
- Un certificat reconnu par les navigateurs, obtenu par challenge DNS (le challenge HTTP est impossible : le serveur n'est pas joignable depuis Internet), avec renouvellement automatique.
- À vérifier : certaines box bloquent les réponses DNS publiques contenant une adresse privée (protection « DNS rebinding »). Il faudra alors une exception ou une résolution locale.

`localhost` suffit au développement. Il ne valide ni l'installation, ni le hors-ligne, ni la lecture écran verrouillé : ces points se testent sur les vrais appareils, une fois les prérequis en place.

## Écrans (décidés avec le propriétaire, voir la maquette)

1. **Étagère (accueil).** Les couvertures sont posées sur des étagères en bois, titre sur la planche. Sur tablette, 6 livres par rangée.
2. **Chemin des chapitres.** Fond prairie verte, chaque chapitre est une étape ronde sur un chemin en pointillés, avec image, numéro et titre. Une étoile marque les chapitres écoutés. Sur téléphone, le chemin zigzague verticalement. Sur tablette, il serpente sur des lignes successives.
3. **Lecteur.** Grande illustration du chapitre, titre, livre et numéro de chapitre, barre de progression, gros bouton lecture/pause, boutons chapitre précédent/suivant, bouton maison, vignette du livre pour revenir au chemin. Sur tablette, l'image est à gauche et les commandes à droite.

Le bouton maison, en haut à gauche, ramène toujours à l'étagère.

**Le son continue quand l'enfant quitte le lecteur** (décidé par le propriétaire). Conséquence : une commande « écoute en cours » (image et titre du chapitre, bouton lecture/pause) reste visible en bas de l'étagère et du chemin dès qu'un chapitre est actif, y compris sur le chemin d'un autre livre. La toucher hors du bouton ouvre le lecteur. C'est un ajout par rapport à la maquette, qui ne la montre que sur l'étagère.

## Comportement de lecture

Ces choix ont été proposés sans susciter d'objection, ou décidés à la rédaction et à la revue. À relire.

Trois notions distinctes :

- **Livre consulté** : celui dont le chemin est affiché.
- **Audio actif** : le chapitre chargé dans le lecteur, en lecture ou en pause. Il y en a au plus un, et il est indépendant des écrans.
- **Position mémorisée** : par livre, un chapitre et une position, sur l'appareil (`localStorage`). Le cercle orange du chemin indique le chapitre mémorisé du livre consulté.

| Action | Effet |
|---|---|
| Toucher un livre | Ouvre son chemin. Le son en cours n'est pas modifié. |
| Toucher le chapitre actif | Ouvre le lecteur sans repartir du début. S'il était en pause, la lecture reprend. |
| Toucher le chapitre mémorisé, non actif | Ouvre le lecteur et reprend à la position mémorisée. |
| Toucher un autre chapitre, même déjà écouté | Ouvre le lecteur et le lance depuis le début. La position de l'audio précédent est sauvegardée. |
| Précédent | Revient au chapitre précédent. Au premier chapitre, repart à zéro. |
| Suivant | Passe au chapitre suivant. Inactif et grisé au dernier chapitre. |
| Fin d'un chapitre | Étoile posée, le chapitre suivant démarre seul. |
| Fin du dernier chapitre | Étoile posée, le son s'arrête, le livre revient au chapitre 1 et l'écran retourne au chemin. Plus d'audio actif. |
| Bouton retour du téléphone | Change l'écran, jamais l'audio. Une adresse de lecteur qui ne correspond pas à l'audio actif redirige vers le chemin du livre. |

- Au démarrage, le dernier chapitre écouté redevient l'audio actif, en pause, à sa position mémorisée, s'il est disponible. La commande « écoute en cours » de l'étagère sert ainsi de bouton « reprendre ».
- Les commandes système (écran verrouillé) suivent les mêmes règles que les boutons du lecteur.
- Si le chapitre suivant n'est pas disponible, la lecture s'arrête au lieu d'attendre.
- Position sauvegardée toutes les 5 secondes, à la pause, et quand la page passe en arrière-plan.
- Une étoile n'est posée qu'à la fin naturelle du chapitre, pas en déplaçant le curseur jusqu'au bout.
- Navigation par adresse : `#/`, `#/livre/<id>`, `#/livre/<id>/<n>`.
- Un seul élément audio, indépendant des écrans, pour que le son survive à la navigation.
- Interface uniquement en français, puisque presque tout passe par des icônes. Pas de liens de partage.

### Lecture écran verrouillé

Media Session fournit les commandes système et les métadonnées, mais ne garantit pas la lecture en arrière-plan. Trois exigences à valider séparément :

1. Continuité pendant la navigation dans l'application.
2. Lecture écran verrouillé.
3. Enchaînement de plusieurs chapitres écran verrouillé, y compris après une pause prolongée.

Cibles : les téléphones et tablettes de la famille, sur leur système à jour, en ligne et hors-ligne, depuis l'icône installée. L'enchaînement écran verrouillé dépend du système : si un appareil le refuse, ce n'est pas bloquant, la lecture reprend à l'ouverture.

## Interaction tactile

- Toutes les cibles (maison, vignette du livre, étapes du chemin, précédent/suivant, lecture, commande d'écoute en cours) font au moins 72 px à l'écran réel, séparées d'au moins 8 px. Le bouton de téléchargement fait au moins 56 px. Les dimensions de la maquette sont à l'échelle réduite et ne font pas foi.
- Barre de progression : seul un glissement volontaire qui part du curseur (zone de saisie d'au moins 56 px) déplace la lecture. Toucher la barre ne fait rien.
- Le chemin distingue toucher et défilement : un doigt qui glisse ne lance pas de chapitre.
- Le bouton maison reste visible pendant le défilement.

## Débordement

- La taille des couvertures et des étapes ne diminue jamais avec leur nombre : on défile verticalement, sur téléphone comme sur tablette, en portrait comme en paysage.
- Sur l'étagère, de nouvelles rangées s'ajoutent. Sur le chemin en tablette, de nouvelles lignes s'ajoutent. Le nombre d'étapes par ligne dépend de la largeur de l'écran.
- Le contenu suivant reste en partie visible en bas d'écran, pour montrer qu'il y a une suite.
- Le chemin se place sur le chapitre mémorisé à l'entrée sur l'écran uniquement, jamais pendant que l'enfant le parcourt.
- La commande « écoute en cours » ne recouvre jamais la dernière rangée ni la dernière étape : on peut toujours les faire défiler au-dessus.

## Hors-ligne

- **Préparation initiale, à faire à la maison :** installer l'application sur l'écran d'accueil, l'ouvrir depuis l'icône, télécharger les livres depuis cette icône. Sur iPhone et iPad, l'application installée a un stockage séparé de Safari : un livre téléchargé dans Safari n'est pas disponible depuis l'icône. Vérifier ensuite un démarrage après fermeture en mode avion. Cette procédure figure dans le README.
- L'application (page, scripts, styles, polices, catalogue, couvertures) est mise en cache automatiquement à l'installation du service worker. Les couvertures des nouveaux livres le sont au rafraîchissement du catalogue.
- **L'audio** n'est jamais mis en cache sans action : ni à l'installation, ni à la simple lecture. Les illustrations de chapitre sont téléchargées avec le livre.
- Téléchargement livre par livre, via un bouton en haut à droite du chemin (à ajouter à la maquette). États : à télécharger, en cours avec progression, téléchargé, échec avec nouvelle tentative, mise à jour disponible.
- **« Téléchargé » signifie** que tous les fichiers du livre sont présents dans le cache, vérifiés contre le catalogue conservé avec le téléchargement. Au démarrage, l'état est recalculé à partir du cache : un téléchargement interrompu (réseau, fermeture de l'application, stockage plein) apparaît comme « à télécharger » ou « échec », jamais « en cours » indéfiniment. Les fichiers déjà reçus sont conservés et une nouvelle tentative ne récupère que ceux qui manquent.
- Demander le stockage persistant quand le navigateur le permet, sans le promettre.
- Suppression d'un téléchargement : appui long sur le bouton « téléchargé », puis confirmation explicite.

### Serveur injoignable

`navigator.onLine` n'est pas utilisable : un téléphone en 4G est « en ligne » sans pouvoir joindre le serveur de la maison.

- La disponibilité se déduit du cache local et du résultat réel des requêtes vers le serveur, avec un délai maximal de 3 secondes.
- L'étagère s'affiche immédiatement à partir des données locales, le catalogue est rafraîchi en arrière-plan.
- Serveur injoignable : les livres et chapitres non téléchargés sont grisés et ne se lancent pas.
- Si le serveur disparaît pendant la lecture d'un chapitre non téléchargé, la lecture s'arrête, avec un état visible et sans attente infinie. Maison et retour restent utilisables.

## Bibliothèque de fichiers

```text
bibliotheque/
  le-petit-ours/
    album.json        (facultatif)
    couverture.jpg
    01-la-foret.mp3
    01-la-foret.jpg   (facultatif, même nom que l'audio)
```

Une page statique ne peut pas lister les dossiers. Une commande sans dépendance (`node scripts/generer-catalogue.js`), lancée après chaque ajout, produit `catalogue.json` à partir de ces dossiers.

- **Identifiants stables :** le nom du dossier pour un livre, le nom du fichier audio pour un chapitre. La position mémorisée et les étoiles s'y rattachent, pas au numéro. Un chapitre inséré ne décale donc pas la reprise.
- **Version :** le catalogue contient pour chaque fichier sa taille et sa date de modification. C'est ce qui permet de détecter qu'un livre a changé.
- Ordre des chapitres : tri naturel des noms de fichiers.
- Titre d'un chapitre : `album.json` si présent, sinon tag ID3, sinon nom de fichier nettoyé (sans correction automatique des accents).
- Chapitre sans illustration : l'image du livre le remplace, le numéro et le titre distinguant alors les étapes (écran « 2 bis » validé). Les illustrations restent facultatives, par décision du propriétaire. Limite assumée : dans un livre sans illustrations, un enfant qui ne lit pas choisit difficilement un chapitre précis.
- Livre sans couverture : image neutre fournie par l'application.

### Validation à la génération

La commande signale chaque anomalie. Un livre sans aucun chapitre lisible est écarté du catalogue. Un dossier mal formé ne doit jamais casser les autres livres.

### Livre modifié après téléchargement

Le propriétaire modifie rarement un livre : la règle reste simple.

- Un livre téléchargé conserve la copie du catalogue prise au téléchargement et l'utilise tant qu'il n'est pas mis à jour. Métadonnées et fichiers restent cohérents.
- Si le catalogue du serveur diffère, le bouton passe à « mise à jour disponible ». Mettre à jour supprime puis retélécharge le livre.
- Un livre retiré du serveur reste visible tant qu'il est téléchargé sur l'appareil.

## États particuliers

- **Premier lancement :** pas de commande d'écoute en cours ni de reprise fictive.
- **Bibliothèque vide :** image dédiée, distincte de l'échec de chargement.
- **Échec de chargement du catalogue :** conserver le dernier catalogue valide, en ne remplaçant le cache qu'avec un JSON valide. S'il n'y en a aucun, image dédiée et nouvelles tentatives automatiques.
- **Audio illisible ou manquant :** retour visible sur l'étape concernée (image et animation, sans texte à lire), lecture arrêtée, commandes de retour disponibles.
- **Image manquante :** même remplacement que pour une image absente du catalogue.

## Technique

- Projet neuf, pas de duplication de The Long Burn, dont tout le code repose sur une liste plate de morceaux.
- Polices hébergées dans le site (Fredoka ou équivalent arrondi).
- Application installable sur l'écran d'accueil, pour éviter la barre du navigateur.

## Reprise depuis `E:\Sources\pct-jukebox`

| Source | Usage | Adaptation |
|---|---|---|
| `sw.js` | Cache en deux niveaux, réponses 206 pour avancer dans l'audio hors-ligne | Noms des caches ; cibler tous les MP3 sous `bibliotheque/`, sous-dossiers compris, et non `/audio/` ; catalogue servi depuis le cache et rafraîchi en arrière-plan |
| `index.html` lignes 633-650 | Media Session | Livre comme album, illustration du chapitre |
| `index.html` lignes 827-855 | Téléchargement et cache audio | Par livre, progression, reprise, suppression par livre |
| `manifest.webmanifest` | Installation manuelle, selon la procédure du README | Nom, icônes, `orientation` à `any` pour la tablette |
| `.claude/skills/add-song/scripts/add_song.js` lignes 32-54 | Parcours des cadres ID3 sans dépendance | Ce script ne lit que la pochette : ajouter la lecture du titre (`TIT2`) |

**À ne pas reprendre :** `guardOffline` (`index.html` ligne 872), qui repose sur `navigator.onLine`.

**Contrat à vérifier pour l'audio hors-ligne :** téléchargement complet, chemins en sous-dossiers reconnus, réponses partielles correctes, reprise à une position mémorisée, déplacement dans le chapitre. Le code `serveAudio` gère déjà les réponses 206, mais ces cas doivent être testés sur les vrais appareils.

**Mise à jour :** reprendre la règle de The Long Burn. Toute modification d'un fichier du shell impose d'incrémenter le numéro du cache shell, et le cache audio n'est jamais renommé. `catalogue.json` ne fait pas partie du shell versionné : un nouveau livre apparaît sans changement de version.

## Laissé au constructeur

- Organisation du code en fichiers.
- Format exact de `catalogue.json` et de `album.json`.
- Génération ou non de miniatures.
- Tracé exact du chemin pour un nombre variable de chapitres, sous réserve du rendu de la maquette.
- Détails d'animation et dessin des états particuliers.
