# Fiche de cadrage : La Forge

- Auteur : Amina
- Date : 2026-10-27
- Nom technique du module : `forge` (en anglais)

## L'idée

Le joueur peut fabriquer des objets utiles à partir de **recettes** prédéfinies, en
consommant des ressources (bois, pierre, or) de son village. Chaque recette indique les
ressources nécessaires et le temps de fabrication. Le joueur lance une fabrication, les
ressources sont immédiatement prélevées de son village, puis l'objet peut être récupéré à
l'issue du temps de fabrication.

La Forge donne un **débouché concret aux ressources** produites par le village et
introduit un choix stratégique : le joueur doit arbitrer entre améliorer ses bâtiments
(module `realm`) et fabriquer des objets. Elle ouvre aussi la voie à de futurs usages
des objets (équipement pour le donjon, échange au marché…).

## Les règles métier

1. Un joueur ne peut fabriquer un objet que si son village peut fournir les ressources
   requises (un joueur sans village a un stock nul, le prélèvement est donc refusé).
2. Le catalogue de recettes est fixe et connu du domaine. Chaque recette définit un
   identifiant, un nom, les ressources requises (`Amounts`) et une durée de
   fabrication en secondes.
3. Lorsqu'un joueur lance une fabrication, les ressources requises sont **prélevées**
   de son village. Si le village n'a pas assez de ressources, la fabrication est
   refusée.
4. Une seule fabrication à la fois par joueur (file d'attente de taille 1). Une
   nouvelle fabrication ne peut être lancée que si la précédente est récupérée ou
   annulée.
5. La fabrication a une durée : l'objet n'est **prêt** à être récupéré qu'une fois le
   temps écoulé (calculé à la lecture et lors de la commande `CollectItem`).
6. Le joueur peut **annuler** une fabrication en cours. Les ressources ne sont **pas**
   remboursées (elles sont perdues).
7. Lorsqu'une fabrication terminée est récupérée (`CollectItem`), l'objet est ajouté à
   l'**inventaire** du joueur. L'inventaire est une liste d'objets fabriqués, sans
   limite de taille.
8. Le joueur peut consulter son inventaire et l'état de la fabrication en cours.

## Les commandes et les lectures

| Action du joueur             | Commande ou lecture           | Route envisagée        |
| ---------------------------- | ----------------------------- | ---------------------- |
| Voir les recettes            | Lecture (catalogue statique)  | `GET /forge/recipes`   |
| Voir la fabrication en cours | Lecture                       | `GET /forge/status`    |
| Voir l'inventaire            | Lecture (projection)          | `GET /forge/inventory` |
| Lancer une fabrication       | Commande `RequestCrafting`    | `POST /forge/craft`    |
| Annuler la fabrication       | Commande `CancelCrafting`     | `POST /forge/cancel`   |
| Récupérer l'objet terminé    | Commande `CollectItem`        | `POST /forge/collect`  |

## Le stockage envisagé

**Journal d'événements** (Event Sourcing, modèle decider) complété par une table de
projection dans le schéma `forge` (`forge.inventory`), cohérent avec le module `market`.
Les événements du domaine :

- `CraftingRequested { recipeId, transferId, cost, at }`
- `CraftingStarted { transferId, startedAt, endsAt }`
- `CraftingRefused { transferId, missing, at }`
- `CraftingCancelled { recipeId, at }`
- `ItemCollected { recipeId, at }`

Le flux est par joueur (`forge-<userId>`), comme le village.

L'inventaire est également projeté dans la table `forge.inventory` à partir des
événements `ItemCollected`.

## La communication avec les modules existants

| Module  | Direction     | Moyen                                                                                                     |
| ------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `realm` | Forge → Realm | Message outbox sur le sujet `realm.withdraw` pour prélever les ressources au lancement d'une fabrication. |
| `realm` | Realm → Forge | Message de réponse (`TransferResult`) sur le sujet `forge.transfer-result` pour confirmer ou refuser le prélèvement. |

La Forge utilise le **langage publié** du module `realm` (`REALM_TOPICS.withdraw`,
`TransferRequest`, `TransferResult`) sans jamais importer de code interne au village.
Le patron est le même que celui du module `market` (saga : réservation → confirmation
ou refus).

## Les données personnelles

- Inventaire du joueur (liste d'objets fabriqués, table `forge.inventory`) — lié à
  l'identifiant joueur.
- Historique des fabrications (événements du flux `forge-<userId>`) — lié à
  l'identifiant joueur.

Le module implémente le contrat `PersonalDataContributor` (`personal-data.ts`) pour
l'export et l'effacement.
