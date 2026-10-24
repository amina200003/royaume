# ADR-0003 - Les Server-Sent Events, alimentés par le journal d'événements, pour la diffusion en temps réel



* Statut : accepté


* Date : 2026-10-24



## Contexte



Le projet nécessite d'informer les joueurs des changements survenant dans l'application sans rechargement de la page, initialement pour synchroniser les différents onglets d'un même joueur, puis pour coordonner les participants d'une partie du Donjon (prévu au TD6).
Les actions des joueurs transitent déjà par notre API classique au moyen de requêtes HTTP authentifiées.
Notre hébergement (Vercel) impose des contraintes strictes : une durée d'exécution plafonnée pour les fonctions serverless, des instances multiples dépourvues de mémoire partagée, et l'exigence de rester sur une offre gratuite sans infrastructure additionnelle.
Enfin, notre architecture existante (ADR 0002) repose sur un journal d'événements persistant où chaque flux possède des versions strictement croissantes.

## Décision



La diffusion des changements s'opère via des Server-Sent Events (SSE) sur la route `/api/stream/<canal>`.

* Un canal correspond très exactement à un flux de notre journal d'événements. L'identifiant de chaque message transmis est la version de l'événement, ce qui permet au navigateur de reprendre la lecture là où il s'est arrêté grâce à l'en-tête `Last-Event-ID`.
* Le flux effectue une relecture périodique du journal toutes les demi-secondes. Pour respecter les limites de la plateforme d'hébergement, la connexion se ferme d'elle-même au bout de 240 secondes ; le navigateur se chargeant de s'y reconnecter automatiquement.
* L'accès au flux est strictement réservé aux joueurs connectés. Chaque module a la responsabilité de déclarer la règle d'accès associée à ses canaux ; par défaut, un canal ne possédant aucune règle d'accès explicite est refusé.
* L'interface cliente utilise ces notifications comme des déclencheurs : à chaque notification reçue, l'interface relit sa vue complète depuis l'API plutôt que de chercher à appliquer elle-même les données de l'événement localement.

## Conséquences



### Positives



* Les requêtes utilisent du HTTP ordinaire, ce qui garantit une traversée sans encombre des différents équipements réseaux intermédiaires (serveurs mandataires, pare-feu).
* L'authentification profite nativement du mécanisme par cookie de session déjà mis en place, le navigateur l'incluant automatiquement lors de la création de la connexion SSE.
* Le caractère unidirectionnel du SSE couvre parfaitement le besoin sans ajouter de complexité, puisque les actions des joueurs continueront de passer par l'API existante.

### Négatives



* La relecture périodique impose un nombre élevé de requêtes de lecture régulières (toutes les demi-secondes) sur la base de données, multiplié par le nombre de joueurs connectés simultanément.
* La conception induit un délai maximal incompressible d'une demi-seconde pour la réception d'un événement.
* La limitation du temps d'exécution serveur impose des déconnexions/reconnexions forcées toutes les 4 minutes.

## Alternatives écartées



* **Les WebSocket** : Cette approche est incompatible avec l'hébergement retenu. Les fonctions serverless ne sont pas conçues pour des connexions TCP permanentes, la prise en charge était expérimentale, et un serveur dédié nécessiterait une infrastructure supplémentaire permanente, violant nos contraintes de gratuité.
* **L'interrogation périodique (Polling) par le navigateur** : Écartée car elle génère un trafic réseau beaucoup plus lourd en multipliant les requêtes HTTP et leurs en-têtes associées, par rapport à la connexion unique maintenue par les Server-Sent Events.
* **Mécanisme de notification partagé (LISTEN/NOTIFY PostgreSQL, service de messagerie Pub/Sub)** : Ce modèle a été rejeté car il nécessiterait une infrastructure additionnelle ou une configuration base de données complexe, incompatible avec la contrainte d'absence d'infrastructure supplémentaire et le fonctionnement des instances Vercel sans mémoire partagée.

## Réexamen



Cette décision devra être réexaminée en cas d'augmentation significative du nombre de joueurs simultanés rendant la relecture périodique du journal trop impactante pour les performances de la base de données. Elle pourra également être revue si de nouveaux besoins métiers nécessitent une communication bidirectionnelle extrêmement réactive à très faible latence, ou si notre plateforme d'hébergement propose un support natif, stable et gratuit des connexions WebSocket de longue durée.

## Usage de l'IA générative



Outil utilisé : Gemini.
Nature de sa contribution : Formalisation et rédaction de l'ADR en respectant les contraintes structurelles, organisation des faits fournis dans l'énoncé. Le résultat a été vérifié pour garantir sa cohérence technique et son adéquation stricte avec la consigne de formatage.