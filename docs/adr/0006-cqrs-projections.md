# ADR-0006 - Séparer les modèles de lecture du modèle d'écriture, et les tenir à jour par des projections rattrapées à la lecture



* Statut : accepté


* Date : 2026-10-24



## Contexte



* Le besoin actuel nécessite des lectures transversales traversant plusieurs flux, telles que la génération du classement et la liste des expéditions ouvertes. Le calcul de ces vues par rejeu systématique devient trop coûteux et croît linéairement avec l'historique du jeu (dette DT-005).
* Notre hébergement sur Vercel ne permet aucun processus permanent (comme acté dans l'ADR 0004).
* Le journal d'événements existant attribue à chaque événement une position globale croissante, mais qui n'est pas continue (ADR 0002).

## Décision



* Les lectures transversales s'appuient désormais sur des modèles de lecture (Read Models) spécifiques, placés dans le schéma PostgreSQL de leur module respectif, tandis que les décisions métiers s'appuient toujours sur le modèle d'écriture (CQRS).
* Chaque modèle de lecture est tenu à jour par une projection. Le point de reprise de chaque projection est enregistré et suivi dans la table `platform.projections`.
* Une projection est rattrapée au moment de sa consultation (rattrapage à la lecture), au sein d'une seule transaction, le point de reprise étant verrouillé pour éviter les conflits.
* Le rattrapage s'arrête devant une position globale manquante tant que l'événement qui la suit a moins de cinq secondes, afin de tolérer les insertions concurrentes.
* Chaque projection porte une version stricte : une version applicative plus élevée que celle des tables provoque leur reconstruction automatique ; une version moins élevée (en cas de rollback) interdit toute écriture.
* Le classement est annoncé aux navigateurs par un canal global et discret. L'interface cliente relit alors le classement en boucle jusqu'à ce que la projection ait atteint la position annoncée par la notification.

## Conséquences



### Positives



* Le coût de consultation des vues transversales devient constant et totalement indépendant de la taille de l'historique du jeu.
* L'architecture favorise un couplage lâche : les modules écrivent leurs événements sans rien savoir des projections qui les lisent.
* Il est possible de calculer de nouvelles informations pour le passé en créant de nouvelles projections, sans avoir recours à des migrations de données complexes.
* L'absence de tâche de fond ou d'opération manuelle après un déploiement garantit le respect de nos contraintes d'hébergement.

### Négatives



* **Cohérence à terme (Eventual Consistency)** : un modèle de lecture peut accuser quelques secondes de retard sur le journal d'événements.
* La reconstruction ayant lieu pendant une consultation, sa durée est limitée par le timeout des fonctions Vercel : cette opération deviendra impossible au-delà d'une certaine taille du journal.
* Après un retour à une version précédente de l'application (rollback), une projection dont la version avait été augmentée cessera d'avancer jusqu'au déploiement suivant.
* Le Classement dépend fortement du langage publié des autres modules : un événement modifié ou ajouté sans réexamen attentif de ses lecteurs passera inaperçu, comme cela a été observé avec la liste des expéditions ouvertes.

## Alternatives écartées



* **La mise à jour des modèles de lecture directement dans la commande, par le module qui écrit** : Écartée car elle crée un couplage fort entre l'écriture et la lecture, et ralentit les commandes métiers.
* **Une tâche planifiée (cron) ou un processus de fond abonné au journal** : Rejetés car notre infrastructure serverless ne permet pas de processus permanents, et les crons gratuits sont limités à un par jour.
* **Une vue matérialisée de PostgreSQL** : Écartée car le recalcul complet de la vue à chaque rafraîchissement serait trop coûteux en performances.
* **Le maintien du calcul par rejeu (Event Sourcing pur en lecture)** : Rejeté car le coût de calcul croît indéfiniment avec l'historique, rendant les lectures transversales impossibles à terme (DT-005).

## Réexamen



Cette décision devra être réexaminée si le temps de reconstruction complet d'une projection s'approche de la durée maximale d'exécution d'une fonction Vercel. Elle devra également être revue si un nombre trop élevé de consultations simultanées transforme le verrouillage du point de reprise en goulet d'étranglement, ou si une fonctionnalité future exige des lectures avec une cohérence stricte (immédiatement à jour) plutôt qu'une cohérence à terme.

## Usage de l'IA générative



Outil utilisé : Gemini.
Nature de sa contribution : Formalisation et rédaction de l'ADR en respectant le format requis à partir des notes de contexte, de décision et de conséquences fournies.