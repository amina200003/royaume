# Bilan technique de Royaumes

- Date : 2026-10-27
- Version examinée : rendu final (comparé à l'étiquette `td11-fin`)
- Auteur : Amina

Ce bilan dresse l'état technique du projet au terme de son développement, à partir de ses
décisions d'architecture, de ses indicateurs de qualité, de sa dette technique et de ses
revues. Il s'adresse à la personne qui reprendrait le projet.

## 1. Le système livré

| Élément | Valeur à `td11-fin` | Valeur au rendu |
| --- | --- | --- |
| Modules métier | 6 (`system`, `realm`, `dungeon`, `ranking`, `market`, `tavern`) | 7 (+ `forge`) |
| Briques de la plateforme | 9 (`auth`, `cron`, `db`, `event-store`, `http`, `outbox`, `privacy`, `projection`, `realtime`) | 9 (inchangées) |
| Lignes de code, hors tests | ~7 792 lignes | 8 699 lignes (+907 lignes) |
| Fichiers de test, nombre de tests | 32 fichiers, 229 tests | 34 fichiers (+2), 260 tests (+31) |
| Commits | 87 | 87+ |
| Hébergement | Vercel (Francfort), base Neon (Francfort) | Vercel (Francfort), base Neon (Francfort) |

| Module | Stockage | Lignes, hors tests |
| --- | --- | --- |
| `realm` | Event Sourcing | 1 016 |
| `forge` | Event Sourcing, projection de l'inventaire (`forge.inventory`), saga | 907 |
| `dungeon` | Event Sourcing, projection des expéditions ouvertes | 1 921 |
| `market` | Event Sourcing, projection des offres, saga | 1 153 |
| `ranking` | Projection du journal | 646 |
| `tavern` | Tables ordinaires (`tavern.messages`, `tavern.presence`) | 604 |
| `system` | Aucun | 64 |

## 2. Les décisions d'architecture

| ADR | Décision | Mise à l'épreuve | Bilan |
| --- | --- | --- | --- |
| [0001](adr/0001-monolithe-modulaire.md) | Monolithe modulaire | Extraction du Village (TD11) et ajout du module Forge sans modifier la plateforme | Confirmé : l'ajout d'un 7e module (`forge`) n'a demandé que son câblage dans `create-api.ts` |
| [0002](adr/0002-event-sourcing-village.md) | Event Sourcing pour le Village | Prélèvements inter-modules (Marché et Forge) et production continue | Confirmé : le modèle *decider* garantit l'idempotence des transferts et le calcul exact des stocks |
| [0003](adr/0003-server-sent-events.md) | Server-Sent Events alimentés par le journal | Canaux individuels (`village-*`, `forge-*`), discrets (`dungeon-*`) et globaux (`ranking`, `market`) | Confirmé à l'échelle du projet ; limite connue sur la fréquence de lecture en base |
| [0004](adr/0004-manches-simultanees.md) | Manches simultanées et échéances paresseuses | Combats multijoueurs du Donjon et durée de fabrication de la Forge | Confirmé : aucune tâche de fond n'est nécessaire en environnement serverless |
| [0005](adr/0005-intelligence-artificielle.md) | Intelligence artificielle déterministe | Compagnons et stratégies des monstres vérifiés par simulation | Confirmé : reproductibilité totale grâce à la graine enregistrée dans l'événement |
| [0006](adr/0006-cqrs-projections.md) | CQRS et projections rattrapées à la lecture | Projections `ranking`, `dungeon`, `market` et `forge-inventory` | Confirmé : séparation nette entre écriture (flux) et modèles de lecture SQL |
| [0007](adr/0007-saga-boite-envoi.md) | Saga orchestrée et boîte d'envoi | Échanges du Marché et prélèvement des ressources de la Forge auprès du Village | Confirmé : réutilisation directe des sujets `realm.withdraw` et du distributeur transactionnel |
| [0008](adr/0008-donnees-personnelles.md) | Taverne sans Event Sourcing, réécriture ciblée du journal | Export et effacement RGPD étendus au module Forge (`personal-data.ts`) | Confirmé : chaque module déclare ses données personnelles sans coupler la plateforme |
| [0009](adr/0009-extraction-village.md) | Extraction du Village, préparée mais non déployée | Tests de contrat `village-service.test.ts` | Confirmé comme preuve des frontières ; 3 dettes (DT-008 à DT-010) à lever avant déploiement réel |
| [0010](adr/0010-module-forge.md) | Module Forge : Event Sourcing, échéances paresseuses et saga avec le Village | 19 tests du domaine (`forge.test.ts`) et 12 tests d'API/intégration (`forge-api.test.ts`) | Confirmé : s'intègre au Village uniquement par son langage publié et respecte toutes les fonctions d'aptitude |

## 3. La qualité

| Caractéristique | Indicateur | Valeur à `td11-fin` | Valeur au rendu | Appréciation |
| --- | --- | --- | --- | --- |
| Adéquation fonctionnelle | Tests réussis ; couverture des domaines (`src/modules/*/domain/**`) | 229 / 229 tests réussis ; ~90 % lignes des domaines | 260 / 260 tests réussis (+31) ; 90,6 % des lignes des domaines (89,5 % sur `forge`, 100 % des fonctions) | Excellente : chaque règle métier de la fiche de cadrage et chaque route d'API est couverte |
| Efficacité des performances | Débit et p99 des lectures ; respect du budget (`perf/budget.json`) | p99 < 500 ms sous 20 connexions, 0 erreur | p99 < 500 ms sous 20 connexions, 0 erreur | Conforme au budget ; les lectures de la Forge portent sur un flux individuel ou une table indexée (`inventory_player_idx`) |
| Fiabilité | Tests de concurrence, de reprise et d'idempotence ; messages abandonnés | Verrouillage optimiste (`withOptimisticRetry`), `FOR UPDATE SKIP LOCKED`, idempotence des transferts | Idempotence vérifiée sur `ConfirmCrafting` et `RefuseCrafting` dans la Forge | Solide : aucun doublon de boîte d'envoi ne peut prélever deux fois ou démarrer deux fabrications |
| Sécurité | Exigences des revues de sécurité | 40 exigences vérifiées (Auth, Donjon, Marché) + contrôle d'accès par défaut | Routes `/api/forge/*` protégées par `requireUser`, entrées validées par Zod (`StartCraftingInput`), canal `forge-<userId>` isolé | Conforme : un joueur n'agit qu'en son propre nom et ne peut ni lire ni écouter la forge d'un autre joueur |
| Maintenabilité | Règles d'architecture (`dependency-cruiser`) ; fonctions d'aptitude ; lint (`biome`) | 7 règles, 158 modules analysés, 0 violation ; 2 fonctions d'aptitude | 7 règles, 169 modules analysés (+11), 543 dépendances, 0 violation ; 2 fonctions d'aptitude réussies ; 0 erreur Biome/TypeScript | Très élevée : la configuration de `.dependency-cruiser.cjs` et `architecture.test.ts` est restée intacte |
| Flexibilité | Extraction d'un module ; changement de base entre local et production | PGlite en local/test, Neon en production ; Village extractible | Le module Forge dialogue avec le Village uniquement par messages (`realm.withdraw`), compatible avec le Village extrait | Démontrée : l'ajout de la Forge n'a modifié aucune ligne du module Village ni de la plateforme |

## 4. La dette technique

| Indicateur | Valeur à `td11-fin` | Valeur au rendu |
| --- | --- | --- |
| Entrées consignées (total historique) | 10 (DT-001 à DT-010) | 13 (+ DT-011 à DT-013 pour la Forge) |
| Entrées remboursées, dont à l'échéance prévue | 7 (DT-001 à DT-007) | 7 (DT-001 à DT-007) |
| Entrées ouvertes | 3 (DT-008 à DT-010) | 6 (DT-008 à DT-013) |

Analyse :

Les six entrées ouvertes dans [`docs/qualite/dette-technique.md`](qualite/dette-technique.md) sont toutes explicites, localisées par un commentaire `// DETTE TECHNIQUE` dans le code et associées à une échéance précise :

- **DT-008 à DT-010** concernent exclusivement le service Village extrait (migrations propres, pagination du flux `/events`, distribution périodique de sa boîte d'envoi) et n'ont aucun impact tant que le Village s'exécute dans le processus principal en production (ADR 0009).
- **DT-011** concerne la reconstruction (`rebuild`) de la projection `forge-inventory` après l'effacement RGPD d'un compte : la table `forge.inventory` est bien purgée lors de `DELETE /api/account`, mais les événements `ItemCollected` du flux `forge-<playerId>` ne sont pas marqués comme effacés. À rembourser avant tout changement de version de `inventoryProjection`.
- **DT-012** porte sur le maintien simultané de l'inventaire dans l'état rejoué (`ForgeState.inventory`) et dans la projection `forge.inventory` sans instantané (*snapshot*). À rembourser lorsque les objets seront utilisés par d'autres modules ou que les flux individuels dépasseront plusieurs centaines d'événements.
- **DT-013** porte sur l'annulation d'une fabrication pendant la phase transitoire `reserving` sans message de compensation vers le Village. Sans effet en exécution locale synchrone (où l'annulation ne rembourse pas les ressources par règle métier), elle devra être traitée avant toute extraction du Village en production ou introduction d'un remboursement partiel.

## 5. Les revues

| Revue | Exigences | Conformes | Non conformes ou en risque accepté | Actions ouvertes |
| --- | --- | --- | --- | --- |
| [Sécurité de l'authentification](qualite/revue-securite-authentification.md) | 16 (S1–S16) | 16 | 0 | Aucune (toutes les routes `/api/forge/*` et le canal `forge-*` suivent S10, S11, S16) |
| [Sécurité du Donjon](qualite/revue-securite-donjon.md) | 14 (D1–D14) | 14 | 0 | Aucune |
| [Sécurité du Marché](qualite/revue-securite-marche.md) | 10 (M1–M10) | 10 | 0 | Aucune (la saga de la Forge applique les mêmes principes M1, M5, M6, M7) |
| [Conformité au RGPD](rgpd/revue-conformite.md) | 10 (R1–R10) | 10 | 0 (DT-011 consignée en cas de `rebuild`) | Rembourser DT-011 avant changement de version de `inventoryProjection` |

## 6. Risques et recommandations

| N° | Risque | Signe avant-coureur | Recommandation |
| --- | --- | --- | --- |
| 1 | **Charge de lecture du temps réel (SSE)** : chaque flux ouvert interroge `platform.events` toutes les 500 ms (ADR 0003), multiplié par le nouveau canal `forge-<userId>` | Augmentation du temps de réponse p99 de la base Neon ou épuisement du pool de connexions au-delà de quelques dizaines de joueurs simultanés | Mutualiser la lecture du journal par un diffuseur unique en mémoire par instance ou s'appuyer sur `LISTEN / NOTIFY` PostgreSQL |
| 2 | **Allongement des flux individuels (`village-*`, `forge-*`) et du temps d'effacement RGPD** (DT-012, ADR 0008) | Hausse de la latence sur `POST /api/forge/craft` ou `DELETE /api/account` lorsque le journal dépasse plusieurs dizaines de milliers d'événements | Introduire des instantanés (*snapshots*) périodiques par flux et un index dédié aux flux d'un joueur pour l'effacement |
| 3 | **Contention lors de l'exécution massivement parallèle des tests PGlite** | Dépassement occasionnel du délai de 10 s dans les hooks `beforeEach` (`createTestDatabase`) ou sur le test temporel `stream-api.test.ts` (`maxStreamMs: 150`) lorsque 34 travailleurs démarrent simultanément | Exécuter Vitest avec `--maxWorkers=2` (ou `isolate: false`) sur les postes à nombre de cœurs limité et augmenter la marge temporelle de `stream-api.test.ts` |
| 4 | **Incohérence de `forge.inventory` après un `rebuild` post-effacement** (DT-011) | Réapparition de lignes liées à un `playerId` effacé lors d'une montée de version de `inventoryProjection` | Filtrer les joueurs présents dans `platform.erasures` (ou réécrire `ItemCollected`) lors de l'application de la projection |

## 7. Conclusion

L'ajout du module **La Forge** (`forge`) confirme la tenue de l'architecture en monolithe modulaire de Royaumes : le nouveau contexte délimité a été conçu, testé et intégré de bout en bout (domaine pur *decider*, saga par boîte d'envoi avec le Village, projection SQL, temps réel SSE, conformité RGPD et interface React) sans aucune modification de la plateforme technique ni du module Village, et en respectant l'intégralité des règles de `dependency-cruiser` et des fonctions d'aptitude. Le système passe de 229 à **260 tests automatisés** (pour **169 modules** vérifiés), avec une dette technique maîtrisée et documentée.

## Usage de l'IA générative

Outil utilisé : Antigravity (Gemini). Nature de sa contribution : collecte des métriques du dépôt (lignes de code par module, couverture v8 des domaines, résultats de `dependency-cruiser` et de `vitest`) et rédaction structurée de ce bilan technique. Vérification : contrôle manuel des chiffres face aux sorties de `pnpm lint:archi`, `vitest --coverage` et du registre `docs/qualite/dette-technique.md`.
