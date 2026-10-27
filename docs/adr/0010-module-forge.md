# ADR-0010 - Ajout du module Forge : Event Sourcing, échéances paresseuses et saga avec le Village

- Statut : accepté
- Date : 2026-10-27

## Contexte

Le jeu a besoin d'un nouveau débouché stratégique pour les ressources produites par le Village (bois, pierre, or) : permettre au joueur de fabriquer des objets à partir d'un catalogue de recettes, chacune ayant un coût en ressources et une durée de fabrication.

Ce nouveau module (`forge`) doit s'intégrer au monolithe modulaire existant (ADR 0001) en respectant ses contraintes strictes :

- Le domaine doit rester pur, sans dépendance technique ni importation interne d'un autre module.
- Le prélèvement des ressources nécessaires à une fabrication concerne le module `realm` (Village), dont l'état ne peut pas être modifié directement par un autre module.
- L'application est déployée dans un environnement sans état persistant en mémoire (serverless) : une durée de fabrication ne peut donc pas reposer sur un minuteur en mémoire (`setTimeout`).
- Le module doit participer à la portabilité et à l'effacement des données personnelles (RGPD, ADR 0008).

## Décision

Le module `forge` est implémenté comme un contexte borné autonome dans `src/modules/forge/`, structuré selon l'architecture hexagonale (domaine pur, application, infrastructure, API Hono, interface React) et assemblé dans la racine de composition `src/bootstrap/create-api.ts`.

1. **Stockage par Event Sourcing et projection CQRS** : l'état de la forge d'un joueur est conservé sous forme d'événements dans le flux `forge-<userId>` selon le modèle *decider* (`decide`, `evolve`, `replay`). Une projection (`forge-inventory`) alimente en complément la table `forge.inventory` (schéma PostgreSQL dédié `forge`) pour la lecture dédiée de l'inventaire (`GET /api/forge/inventory`).
2. **Communication inter-modules par saga et boîte d'envoi (ADR 0007)** : le lancement d'une fabrication enregistre l'événement `CraftingRequested` (état `reserving`) et dépose, dans la même transaction, un message sur le sujet publié `realm.withdraw` avec `replyTo: 'forge.transfer-result'`. À la réception de la réponse du Village (`TransferResult`), la Forge confirme le démarrage (`CraftingStarted`, état `crafting`) ou annule la demande (`CraftingRefused`) en retenant les ressources manquantes. L'identifiant de transfert (`<userId>:<uuid>`) assure l'idempotence du traitement.
3. **Échéances paresseuses pour la durée de fabrication** : aucune tâche de fond ne surveille la fin d'une fabrication. L'instant de fin (`endsAt = startedAt + durationSeconds * 1000`) est enregistré dans `CraftingStarted` ; la disponibilité de l'objet (`ready`) est évaluée à la lecture (`toView(state, now)`) et vérifiée par le domaine lors de la commande `CollectItem` (`now >= endsAt`).
4. **Données personnelles** : le contributeur `personal-data.ts` exporte la vue de la forge du joueur (inventaire et fabrication en cours) et supprime les lignes de `forge.inventory` lors de l'effacement d'un compte.

## Conséquences

### Positives

- **Découplage total avec le Village** : la Forge n'utilise que le langage publié de `realm` (`REALM_TOPICS.withdraw` et `TransferResult`), ce qui reste compatible avec l'extraction du Village en service autonome (ADR 0009).
- **Aucune tâche de fond requise** : le calcul paresseux de la fin de fabrication à partir de l'horloge injectée (`clock`) fonctionne sans processus résident et permet des tests déterministes instantanés.
- **Traçabilité et idempotence** : le journal d'événements conserve l'historique complet des fabrications, annulations et refus, et ignore les réponses dupliquées de la boîte d'envoi.
- **Respect des fonctions d'aptitude** : toutes les règles de `dependency-cruiser` et les tests d'architecture passent sans modification de leur configuration.

### Négatives

- **Fabrication en deux étapes techniques** : même si la distribution immédiate de la boîte d'envoi rend la réservation quasi synchrone en exécution locale, le modèle du domaine doit gérer la phase transitoire `reserving` et le cas d'un refus asynchrone.
- **Collecte explicite par le joueur** : l'objet n'entre dans l'inventaire (`ItemCollected`) qu'au moment où le joueur déclenche la collecte une fois le délai écoulé.

## Alternatives écartées

- **Stockage uniquement en tables relationnelles classiques (CRUD)** : écarté car le cycle de vie d'une fabrication (demande, confirmation ou refus asynchrone du Village, annulation, collecte) s'exprime naturellement sous forme d'événements et de machine à états (*decider*), en cohérence avec `realm` et `market`.
- **Appel direct au service ou au dépôt du Village depuis la Forge** : écarté car il violerait l'encapsulation des modules (`module-encapsulation` dans `.dependency-cruiser.cjs`) et empêcherait l'exécution du Village en service extrait.
- **Minuteur serveur ou tâche planifiée pour terminer les fabrications** : écarté car incompatible avec un hébergement serverless sans état et inutile dès lors que l'échéance est déterministe (`now >= endsAt`).
- **Remboursement des ressources en cas d'annulation** : écarté par choix de conception métier (règle 6 de la fiche de cadrage) afin de donner un poids stratégique à l'engagement d'une fabrication et d'éviter un second mouvement de ressources (`realm.deposit`).

## Réexamen

Cette décision devra être réexaminée si d'autres modules (comme le Donjon ou le Marché) doivent consommer, équiper ou échanger les objets fabriqués : la Forge devra alors exposer à son tour un langage publié dans `contracts.ts` et des gestionnaires de messages dans `messages.ts` pour permettre le transfert ou l'utilisation d'objets de l'inventaire.

## Usage de l'IA générative

Outil utilisé : Antigravity (Gemini). Nature de sa contribution : aide au cadrage, génération incrémentale du code du module (`domain`, `application`, `infrastructure`, `api`, `ui`) et des tests, ainsi que la rédaction de cet ADR. Vérification : exécution complète de `pnpm verify` (Biome, TypeScript, Dependency Cruiser ).