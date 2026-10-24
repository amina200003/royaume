# ADR-0008 - Un stockage classique pour la Taverne, et la réécriture ciblée des champs personnels du journal pour l'effacement



* Statut : accepté


* Date : 2026-10-24



## Contexte



* Les messages et la présence au sein de la Taverne sont des données éphémères destinées à disparaître rapidement.
* Les joueurs disposent de droits d'accès, de portabilité et d'effacement (RGPD) qui doivent s'appliquer sur l'intégralité du jeu.
* L'existant contient des données personnelles dupliquées : des noms de joueurs sont copiés dans les événements du Donjon et du Marché, et un nom de village dans ceux du Village, au sein de flux parfois partagés avec d'autres joueurs.
* Cette situation entre en conflit direct avec la règle stricte de l'ajout seul du journal (ADR 0002) et le fonctionnement des projections qui en dépendent (ADR 0006).

## Décision



* Le module de la Taverne n'utilise pas l'Event Sourcing ; il s'appuie sur des tables relationnelles ordinaires dont les lignes sont physiquement supprimées à l'expiration de leur durée de conservation.
* Le canal temps réel de la Taverne est alimenté par une source spécifique fournie directement par le module, et non par le journal d'événements global.
* Le système de présence repose sur l'envoi d'un signal périodique par le client : une ligne est maintenue par joueur présent, et celle-ci est supprimée à son départ explicite ou deux minutes après la réception de son dernier signal.
* Les durées de conservation des données sont appliquées dynamiquement à la lecture, ainsi qu'une fois par jour via la route des tâches planifiées quotidiennes.
* Chaque module de l'application doit déclarer ses données personnelles via un "contributeur" qui standardise trois actions : l'export, la réécriture ciblée de ses événements, et l'effacement de ses tables.
* La procédure d'effacement d'un joueur réécrit uniquement les champs nominatifs personnels au sein de ses événements, via une fonction unique et centralisée de la plateforme. Cette opération est consignée dans un registre d'audit qui ne contient lui-même aucune donnée personnelle.
* Lors de la suppression d'un compte, l'identité racine du joueur est effacée en tout dernier, et chaque étape du processus d'effacement est conçue pour être strictement idempotente.

## Conséquences



### Positives



* Les droits de portabilité et d'effacement peuvent être exercés de manière totalement autonome par le joueur lui-même, sans nécessiter l'intervention d'un administrateur.
* L'effacement ciblé des champs n'altère ni la cohérence des états reconstruits par Event Sourcing, ni l'historique des parties partagées avec les autres joueurs.
* La règle de conservation des données éphémères est garantie de s'appliquer, même en l'absence d'activité sur le module.
* Le développement du module de la Taverne est considérablement simplifié par rapport à une implémentation basée sur l'Event Sourcing.

### Négatives



* Cette décision introduit une exception formelle à la règle de l'ajout seul du journal. Toute modification ou évolution future du système devra respecter strictement cette procédure de réécriture ciblée.
* Le coût en ressources et en temps de l'effacement et de l'export croît de manière linéaire avec la taille globale du journal.
* Il existe désormais une obligation de conformité pour chaque événement futur : tout développeur devra penser à déclarer les nouveaux champs personnels dans le contributeur de son module, faute de quoi ces données échapperont au processus d'effacement.
* L'identifiant technique du joueur est conservé dans le journal : la pseudonymisation légale repose donc entièrement sur la destruction effective et irréversible de tout lien entre cet identifiant et la personne physique.

## Alternatives écartées



* **L'Event Sourcing pour la Taverne** : Rejeté car la complexité inhérente à ce modèle est injustifiée pour des données purement éphémères et sans valeur métier à long terme.
* **La suppression complète des flux du joueur** : Écartée car elle détruirait l'historique partagé et corromprait l'état des autres joueurs ayant interagi avec lui (ex: dans le Donjon ou au Marché).
* **L'effacement cryptographique (Crypto-shredding)** : Rejeté en raison de la complexité excessive de la gestion des clés de chiffrement par joueur dans un environnement serverless sans état.
* **Les références sans copie (stocker un ID et lire le nom à la volée)** : Écartées car cette approche exigerait de réécrire rétroactivement la logique de tous les modules existants et complexifierait les projections actuelles.
* **Un service externe de présence (base clé-valeur en mémoire type Redis)** : Rejeté car cela imposerait l'ajout et la maintenance d'une infrastructure supplémentaire, ce qui contrevient aux contraintes de gratuité et de simplicité du projet.

## Réexamen



Cette décision devra être revue lors de la conception d'un tout nouveau module, pour lequel la stratégie des "références sans copie" devra être privilégiée dès l'origine pour éviter la duplication des noms. Elle devra également être réexaminée si la taille du journal rend l'opération d'effacement trop longue pour s'exécuter dans le temps limite d'une requête HTTP (timeout Vercel), ou si la doctrine légale de la CNIL concernant l'anonymisation des identifiants pseudonymes vient à évoluer de manière plus restrictive.

## Usage de l'IA générative



Outil utilisé : Gemini.
Nature de sa contribution : Structuration des faits bruts en un document d'architecture clair, et rédaction des sections selon le format attendu. La cohérence avec les autres ADR (0002, 0004, 0006) a été prise en compte dans la formulation des conséquences.