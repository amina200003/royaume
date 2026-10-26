# ADR-0009 - L'extraction du Village en service autonome, préparée mais non déployée



* Statut : accepté


* Date : 2026-10-26



## Contexte



L'ADR 0001 posait comme promesse la définition de frontières entre modules suffisamment strictes pour qu'un module puisse, à terme, être extrait. Actuellement, les raisons d'extraire un module (présentées en partie 1.3) ne s'appliquent pas aux besoins réels du jeu. L'inventaire des dépendances du module Village révèle que deux d'entre elles ne passent pas directement par le code : le Classement et le canal temps réel lisent ses événements directement dans le journal commun de l'application.

## Décision



Le module Village est rendu capable de s'exécuter dans un service autonome, doté de sa propre base de données, de son propre journal d'événements et de sa propre boîte d'envoi. L'application principale devient alors une passerelle : elle intègre une version distante du module Village, dont la forme est identique à la version exécutée dans le processus courant.

Les messages de la saga franchissent la frontière entre les systèmes par le biais d'une boîte de réception, sans altérer les garanties de distribution de la boîte d'envoi. Un relais est mis en place pour recopier le flux d'événements publié par le service autonome dans le journal commun de l'application, ce qui permet au Classement et au canal temps réel de continuer à le lire de manière transparente.

Les échanges entre les deux processus sont sécurisés et authentifiés par un secret partagé, qui n'est jamais versionné dans le code source. Cependant, le service autonome n'est pas déployé : en production, le Village continue de s'exécuter au sein de l'application principale.

## Conséquences



### Positives



* Les frontières architecturales sont désormais démontrées par le code, et non plus simplement supposées.


* L'architecture s'appuie sur six tests de contrat qui vérifieront la solidité de ces frontières à chaque nouvelle construction du projet.


* L'extraction reste totalement réversible, ne nécessitant aucune migration complexe de données.


* La boîte de réception et le mécanisme d'authentification entre services créés pour cette extraction sont génériques et réutilisables pour tout autre module.


* Cette démarche permet de mesurer concrètement le coût réel d'une extraction en microservice.



### Négatives



* Il faut désormais maintenir deux chemins d'exécution distincts pour le Village : l'un interne au processus, l'autre distant.


* La copie des événements du Village dans le journal de l'application introduit une cohérence différée (à terme) entre le service et la passerelle.


* Des dettes techniques (consignées en 5.2) doivent obligatoirement être remboursées avant d'envisager tout déploiement réel du service.


* L'authentification par secret partagé présente un risque : en cas de fuite, elle permettrait à un attaquant de se faire passer pour n'importe quel joueur auprès du service.



## Alternatives écartées



* **Déployer le service en production** : Rejeté car aucune des raisons justifiant l'extraction (ex: contraintes d'échelle) ne s'applique aujourd'hui au projet.


* **Ne pas extraire et laisser les frontières à l'état d'hypothèse** : Rejeté car la validation par la preuve (Proof of Concept) garantit la viabilité de l'architecture modulaire.


* **La lecture à distance du flux publié par le Classement et le canal temps réel** : Rejetée au profit d'un relais de copie, car une lecture directe à distance couplerait fortement ces modules à l'infrastructure du nouveau service.


* **Extraire un autre module, comme le Marché** : Rejeté, car la saga du Marché lie intimement son sort à celui du Village ; l'extraction du Village est plus représentative des défis d'isolation.


* **Utiliser un jeton signé (JWT) ou le TLS mutuel (mTLS) pour authentifier les échanges** : Rejeté au profit d'un secret partagé pour des raisons de simplicité immédiate, bien que ces solutions soient plus robustes.



## Réexamen



Cette décision devra être revue si le contexte du projet évolue vers les critères définis en 1.3. Par exemple : si un test de charge montre que le Village dépasse son budget de ressources alors que les autres modules le respectent ; si une seconde équipe de développement arrive et est chargée spécifiquement du Village ; ou s'il apparaît un besoin avéré de déployer les évolutions du Village beaucoup plus fréquemment que le reste du jeu.

## Usage de l'IA générative



Outil utilisé : Gemini. Nature de sa contribution : structuration et rédaction de l'ADR en respectant le format standard imposé par le modèle, à partir des éléments techniques fournis dans l'énoncé.