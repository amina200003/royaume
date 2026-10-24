# ADR-0005 - Une intelligence artificielle déterministe, exécutée dans le domaine, sans tâche de fond



* Statut : accepté


* Date : 2026-10-24



## Contexte



* Le jeu nécessite des monstres dont le comportement s'adapte à un niveau de difficulté, ainsi que des compagnons permettant de jouer en solitaire.
* Notre hébergement serverless ne permet aucun processus permanent ni boucle de jeu classique en tâche de fond (conformément à l'ADR 0004).
* L'état d'une expédition est reconstruit exclusivement à partir de ses événements (ADR 0002). De plus, une manche échue peut être calculée lors d'une simple lecture sans être enregistrée immédiatement (ADR 0004).

## Décision



* Les décisions de l'intelligence artificielle sont implémentées sous forme de fonctions pures au sein du domaine métier, et ne sont appelées qu'au moment précis de la résolution d'une manche.
* Ces fonctions ne procèdent à aucun tirage aléatoire externe ; elles utilisent exclusivement le générateur de la manche en cours.
* Les résultats des choix de l'IA (actions des monstres et des compagnons comprises) sont définitivement enregistrés dans l'événement `RoundResolved`.
* Le comportement des monstres est isolé derrière un port de stratégie (interface), permettant à chaque niveau de difficulté de fournir sa propre mise en œuvre.
* Un compagnon géré par l'ordinateur n'agit que si au moins un joueur humain a choisi une action pour la manche.
* L'équilibre du jeu face à cette IA est mesuré par un système de simulation et protégé en continu par des tests statistiques automatisés.

## Conséquences



### Positives



* **Reproductibilité totale** : Les décisions de l'IA étant pures et déterministes, elles s'intègrent parfaitement dans le modèle d'Event Sourcing.
* **Respect des contraintes d'hébergement** : L'absence de boucle de jeu (Game Loop) permet de faire tourner l'IA sur notre hébergement gratuit et éphémère sans infrastructure supplémentaire.
* **Facilité d'équilibrage** : Le découplage des décisions permet d'exécuter des milliers de simulations rapides en mémoire pour valider statistiquement l'équilibrage du jeu.

### Négatives



* **Absence d'initiative asynchrone** : Un personnage piloté par l'ordinateur est incapable d'agir ou de réagir entre deux échéances de manches.
* **Dépendance à l'action humaine** : Un compagnon ne peut pas prendre l'initiative d'agir si aucun joueur ne déclenche la résolution de la manche.
* **Biais de simulation** : La qualité de l'équilibrage du jeu dépend fortement de la fidélité de la règle de décision suivie par les joueurs simulés par rapport au comportement réel des joueurs humains.

## Alternatives écartées



* **Une boucle de jeu exécutée par un processus permanent (Game Loop classique)** : Rejetée car totalement incompatible avec les contraintes de notre hébergement serverless (qui coupe les processus inactifs et limite leur durée).
* **Des décisions d'IA prises par le navigateur d'un joueur** : Rejetée car cela poserait d'énormes problèmes de sécurité (triche facile), de désynchronisation entre les joueurs, et de confiance envers le client.
* **Un recalcul systématique des décisions de l'IA lors de la relecture** : Rejeté car cela obligerait à relancer l'algorithme d'IA à chaque reconstruction d'état, ce qui est plus coûteux en ressources et moins robuste que d'enregistrer le résultat figé de l'IA dans le journal.

## Réexamen



Cette décision devra être réexaminée si le gameplay évolue et nécessite un comportement en temps réel continu (comme un personnage devant agir de manière asynchrone hors du système de manches). Elle devra également être revue si les algorithmes de l'intelligence artificielle deviennent trop complexes et coûteux en temps de calcul pour être exécutés à la volée lors d'une simple requête de lecture.

## Usage de l'IA générative



Outil utilisé : Gemini.
Nature de sa contribution : Structuration et rédaction de l'ADR en respectant le format Markdown imposé et les directives techniques fournies. Le résultat a été relu pour garantir que les principes de l'Event Sourcing et des fonctions pures sont correctement retranscrits.