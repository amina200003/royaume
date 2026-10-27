# Fiche de cadrage : La Forge

- Auteur : Amina
- Date : 2026-10-27
- Nom technique du module : `forge` (en anglais)

## L'idée

Le joueur peut fabriquer des objets utiles à partir de **recettes** prédéfinies, en
consommant des ressources (bois, pierre, or) de son village. Chaque recette indique les
ressources nécessaires et le temps de fabrication. Le joueur lance une fabrication, les
ressources sont immédiatement prélevées de son village, puis l'objet est prêt à
l'issue du temps de fabrication.

La Forge donne un **débouché concret aux ressources** produites par le village et
introduit un choix stratégique : le joueur doit arbitrer entre améliorer ses bâtiments
(module `realm`) et fabriquer des objets. Elle ouvre aussi la voie à de futurs usages
des objets (équipement pour le donjon, échange au marché…).

## Les règles métier

1. Un joueur ne peut utiliser la forge que s'il a fondé un village.
2. Le catalogue de recettes est fixe et connu du domaine. Chaque recette définit un
   identifiant, un nom, les ressources requises (`Partial<Stock>`) et une durée de
   fabrication en secondes.
3. Lorsqu'un joueur lance une fabrication, les ressources requises sont **prélevées**
   de son village. Si le village n'a pas assez de ressources, la fabrication est
   refusée.
4. Une seule fabrication à la fois par joueur (file d'attente de taille 1). Une
   nouvelle fabrication ne peut être lancée que si la précédente est terminée ou
   annulée.
5. La fabrication a une durée : l'objet n'est **prêt** qu'une fois le temps écoulé
   (calculé à la lecture, comme la production de ressources du village).
6. Le joueur peut **annuler** une fabrication en cours. Les ressources ne sont **pas**
   remboursées (elles sont perdues).
7. Lorsqu'une fabrication est terminée, l'objet est ajouté à l'**inventaire** du
   joueur. L'inventaire est une liste d'objets fabriqués, sans limite de taille.
8. Le joueur peut consulter son inventaire et l'état de la fabrication en cours.

## Les commandes et les lectures

| Action du joueur            | Commande ou lecture          | Route envisagée                |
| --------------------------- | ---------------------------- | ------------------------------ |
| Voir les recettes           | Lecture (catalogue statique) | `GET /forge/recipes`           |
| Lancer une fabrication      | Commande `StartCrafting`     | `POST /forge/craft`            |
| Annuler la fabrication      | Commande `CancelCrafting`    | `POST /forge/cancel`           |
| Voir la fabrication en cours | Lecture                     | `GET /forge/status`            |
| Voir l'inventaire           | Lecture                      | `GET /forge/inventory`         |

## Le stockage envisagé

**Journal d'événements** (Event Sourcing), cohérent avec les modules `realm` et
`market`. Les événements envisagés :

- `CraftingStarted { recipeId, resourcesConsumed, startedAt, endsAt }`
- `CraftingCancelled { recipeId, cancelledAt }`
- `CraftingCompleted { recipeId, completedAt }`
- `ItemCollected { recipeId, collectedAt }`

Le flux est par joueur (`forge-<userId>`), comme le village.

L'inventaire peut être reconstruit par projection des événements `ItemCollected`.

## La communication avec les modules existants

| Module | Direction      | Moyen                                                                 |
| ------ | -------------- | --------------------------------------------------------------------- |
| `realm` | Forge → Realm | Message outbox sur le sujet `realm.withdraw` pour prélever les ressources au lancement d'une fabrication. |
| `realm` | Realm → Forge | Message de réponse (`TransferResult`) sur un sujet `forge.transfer-result` pour confirmer ou refuser le prélèvement. |

La Forge utilise le **langage publié** du module `realm` (`REALM_TOPICS.withdraw`,
`TransferRequest`, `TransferResult`) sans jamais importer de code interne au village.
Le patron est le même que celui du module `market` (saga : réservation → confirmation
ou refus).

## Les données personnelles

- Inventaire du joueur (liste d'objets fabriqués) — lié à l'identifiant joueur.
- Historique des fabrications (événements) — lié à l'identifiant joueur.

Le module implémentera le contrat `PersonalDataContributor` pour l'export et la
suppression.



