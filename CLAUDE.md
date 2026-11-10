# CLAUDE.md

Lecteur web de livres audio pour un enfant de 3 ans, non lecteur, qui l'utilise seul sur téléphone ou tablette.

**État : en conception, aucun code applicatif.** La référence est [le document de conception](docs/superpowers/specs/2026-11-10-lecteur-livres-audio-enfant-design.md), et [la maquette retenue](docs/superpowers/specs/2026-11-10-maquette-retenue.html) pour le rendu.

## Règles du projet

- Site statique HTML/CSS/JS : pas de compilation, pas de dépendance d'exécution, pas de base de données, pas de code côté serveur.
- Aucune requête vers un service tiers, polices comprises. Pas de mesure d'audience.
- L'interface doit rester utilisable sans savoir lire, mais le titre du livre et du chapitre est toujours affiché.
- Textes de l'interface et commentaires en français.
- `bibliotheque/` et `catalogue.json` ne sont jamais versionnés.
- Le mode hors-ligne exige un contexte sécurisé : le tester sur `localhost` ou en HTTPS, pas sur une adresse locale en HTTP.

Le code du site [pct-jukebox](../pct-jukebox) sert de source pour le service worker, Media Session et le téléchargement. La conception indique ce qui est repris et comment.
