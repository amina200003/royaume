# ADR-0004 - Des manches simultanées, aux échéances paresseuses, pour les combats du Donjon



* Statut : accepté


* Date : 2026-10-24



## Contexte



* Les combats du Donjon réunissent jusqu'à quatre joueurs humains simultanément. Ces joueurs ne doivent pas s'attendre indéfiniment, et l'ordre dans lequel ils valident leurs actions ne doit procurer aucun avantage.
* Les choix des joueurs doivent rester strictement confidentiels jusqu'à la résolution finale de la manche en cours.
* L'infrastructure d'hébergement Vercel impose des contraintes strictes : elle ne permet ni minuteur en mémoire (processus éphémères), ni tâche de fond continue, et l'offre gratuite limite l'exécution des tâches planifiées (cron) à une seule fois par jour.
* L'état d'une expédition est entièrement reconstruit à partir de ses événements, conformément à l'ADR 0002 : tout calcul, notamment ceux impliquant du hasard, doit donc être parfaitement reproductible à chaque relecture.

## Décision



* Les héros effectuent leurs choix de manière simultanée. La manche est résolue soit lorsque tous les participants ont validé leur action, soit lorsque son échéance temporelle de trente secondes est atteinte. Un héros n'ayant formulé aucun choix à l'échéance se défend par défaut.
* L'échéance de la manche est formellement enregistrée dans les événements sous forme de donnée. Une manche arrivée à terme est considérée comme résolue à l'instant précis de son échéance, et non au moment du traitement.
* Une simple requête de lecture calcule et applique dynamiquement la résolution des manches échues pour son rendu, sans rien inscrire dans le journal d'événements. À l'inverse, toute commande d'écriture commence par enregistrer la résolution des manches échues.
* Le navigateur du client est mis à contribution : il envoie automatiquement une commande d'échéance (ne contenant aucune action spécifique) lorsque son propre compte à rebours local atteint zéro, forçant ainsi le serveur à acter la fin de la manche.
* Le hasard est généré lors de la phase de décision (fonction `decide`) au moyen d'un générateur à graine dérivée du numéro de la manche. Les résultats spécifiques de ces tirages sont figés et enregistrés dans les événements.
* Toute action envoyée porte le numéro de la manche visée et est systématiquement refusée si cette manche est déjà considérée comme résolue.

## Conséquences



### Positives



* **Respect des contraintes d'hébergement** : L'architecture s'affranchit totalement de la nécessité d'un planificateur de tâches serveur (cron ou worker) pour gérer le temps.
* **Équité et fluidité du jeu** : Le système de choix simultanés et secrets empêche l'anti-jeu basé sur l'observation des actions adverses et évite les blocages liés aux joueurs inactifs.
* **Reproductibilité absolue de l'état** : L'utilisation d'un générateur de nombres aléatoires basé sur une graine garantit que la reconstruction de l'état (Event Sourcing) donnera toujours le même résultat à partir d'un historique donné.

### Négatives



* **Dépendance au client** : Le système s'en remet aux navigateurs des joueurs pour envoyer la commande déclenchant la résolution d'une échéance et l'émission des notifications associées.
* **Incohérence visuelle potentielle (Décalage de l'état)** : Si plus aucun joueur ne se manifeste (fermeture des navigateurs), un décalage apparaît entre l'état réel stocké dans le journal (non résolu) et l'état affiché par une nouvelle lecture (qui simulera la résolution de l'échéance passée).
* **Historique incomplet en cas d'abandon** : Une expédition massivement abandonnée par tous les joueurs ne recevra jamais la commande déclenchant sa fin. L'événement `GameEnded` ne sera jamais enregistré, ce qui posera un défi futur pour la construction de classements basés sur cet événement.

## Alternatives écartées



* **Le tour par tour strict** : Rejeté car il introduirait une faille d'équité (avantage à la réaction aux choix précédents) et créerait des blocages infinis si un joueur abandonne la partie sans passer son tour.
* **L'utilisation d'un minuteur en mémoire (setTimeout/setInterval) ou d'une tâche planifiée serveur** : Rejetée car techniquement incompatible avec notre hébergement serverless éphémère et les limitations drastiques des tâches planifiées sur l'offre gratuite.
* **Une lecture qui enregistre elle-même la résolution dans la base (Read-triggered Write)** : Rejetée car elle violerait le principe de séparation des responsabilités (CQRS) ; une lecture (GET) doit rester idempotente et sans effet de bord sur le stockage.
* **Un tirage aléatoire classique via `Math.random()` lors de l'application de l'événement** : Rejeté car ce tirage produirait un résultat différent à chaque reconstruction de l'état en mémoire, violant le principe de base de l'Event Sourcing.

## Réexamen



Cette décision devra être réévaluée si la plateforme évolue (par exemple, passage à un hébergement permettant des workers permanents ou des services de planification de tâches à bas coût) ou si les besoins métiers (comme la nécessité absolue de clore proprement toutes les expéditions abandonnées pour générer un classement exhaustif au TD8) rendent cette approche "paresseuse" insuffisante.

## Usage de l'IA générative



Outil utilisé : Gemini.
Nature de sa contribution : Aide à la structuration et à la synthèse technique de l'ADR en respectant scrupuleusement le format Markdown imposé et les directives architecturales fournies dans l'énoncé. La validation repose sur une vérification humaine de la cohérence avec les contraintes d'Event Sourcing.