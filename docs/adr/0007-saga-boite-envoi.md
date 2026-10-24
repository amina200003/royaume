# ADR-0007 - Les opérations qui concernent plusieurs modules sont des sagas orchestrées, dont les messages transitent par une boîte d'envoi transactionnelle



* Statut : accepté


* Date : 2026-10-24



## Contexte



* Un échange sur le Marché modifie simultanément les données du Marché et celles de deux villages distincts, avec l'exigence stricte de ne jamais créer ni perdre de ressources.
* La règle d'encapsulation des modules (établie au TD2) et la perspective d'extraire un module dans un microservice doté de sa propre base de données (prévue au TD11) interdisent le couplage fort au niveau de la base.
* L'hébergement serverless ne permet aucun processus permanent exécuté en tâche de fond (conformément à l'ADR 0004).

## Décision



* Une transaction en base de données ne modifie jamais les données de plus d'un seul module.
* Toute opération impliquant plusieurs modules est modélisée sous forme de saga. Ses étapes (compensables, pivot, et reprises jusqu'au succès) sont explicitement identifiées.
* La saga est orchestrée par le module à l'origine de l'opération (le Marché). Les modules participants ignorent l'existence de la saga et se contentent de répondre à l'adresse de retour fournie dans la demande.
* Les messages échangés sont enregistrés dans une boîte d'envoi transactionnelle (`platform.outbox`) au sein de la même transaction que les événements métiers qui les ont déclenchés.
* Le système garantit une distribution au moins une fois (at-least-once) grâce à un mécanisme de bail, de nouvel essai avec recul exponentiel, et d'abandon après dix tentatives infructueuses.
* Chaque gestionnaire de message est strictement idempotent, s'appuyant sur une clé d'idempotence générée et fournie par le demandeur.
* En l'absence de processus permanent, la distribution des messages de la boîte d'envoi est déclenchée lors de chaque commande et chaque consultation du Marché, ainsi que par une tâche planifiée quotidienne protégée par un secret.

## Conséquences



### Positives



* Aucun module n'écrit directement dans les tables ou les données d'un autre, garantissant une isolation parfaite.
* La résilience est assurée : une panne du système à n'importe quel moment du processus ne perd ni ne duplique aucune ressource dans le jeu.
* Le module Village reste totalement agnostique et peut servir d'autres demandeurs à l'avenir sans aucune modification.
* Le flux complet de l'opération complexe (la saga) se lit et se comprend en un seul endroit (l'orchestrateur).

### Négatives



* Les joueurs peuvent observer des états intermédiaires temporaires, comme une offre affichée "en règlement".
* La latence du système dépend de l'activité des joueurs : une saga momentanément interrompue ne reprendra son exécution qu'à la prochaine consultation du Marché, ou au pire le lendemain lors du passage de la tâche planifiée.
* Il est impératif d'écrire des gestionnaires parfaitement idempotents, ce qui ajoute une charge de développement et de tests spécifiques pour gérer les doublons.
* Les messages définitivement abandonnés s'accumulent sans qu'aucun outil ne permette encore de les examiner ou de les rejouer (dette technique DT-007).
* La table de la boîte d'envoi grandit sans limite puisque les messages traités y sont actuellement conservés.

## Alternatives écartées



* **Une transaction unique englobant les données des différents modules** : Rejetée car elle violerait l'encapsulation des modules et empêcherait toute extraction future d'un module vers une base de données séparée.
* **Une transaction distribuée (Validation en deux phases / 2PC)** : Écartée en raison de sa complexité, de son impact négatif sur la disponibilité globale et de son inéquation avec un hébergement serverless.
* **Un appel synchrone direct (API) du Village par le Marché sans boîte d'envoi** : Rejeté car un échec réseau post-commit local entraînerait une perte irrémédiable du message et donc une incohérence des ressources.
* **Une saga chorégraphiée (sans orchestrateur central)** : Écartée car elle disperse la logique du processus métier à travers plusieurs modules, rendant le flux global difficile à tracer et à déboguer.
* **L'utilisation du journal d'événements existant comme boîte d'envoi** : Rejetée pour conserver une séparation claire des responsabilités entre les événements du domaine (qui racontent l'histoire passée) et les messages d'intégration (qui commandent des actions externes).

## Réexamen



Cette décision devra être revue en cas d'extraction effective d'un module vers un service physiquement distinct, ce qui exigerait la mise en place d'une boîte d'envoi par base de données et d'un véritable transport réseau inter-services. Elle devra également être réexaminée si le volume de messages justifie le déploiement d'un courtier de messages dédié (Message Broker), ou si les exigences métier imposent une latence de traitement que la distribution ponctuelle basée sur les requêtes ne peut plus satisfaire.

## Usage de l'IA générative



Outil utilisé : Gemini.
Nature de sa contribution : Structuration et rédaction de l'ADR en respectant le format cible et les informations fournies. Le résultat a été vérifié par rapport aux principes des architectures distribuées (Saga, Transactional Outbox, Idempotence).