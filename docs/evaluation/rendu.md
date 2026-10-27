# Rendu de l'évaluation

- Auteur : Amina
- Module : `forge` (La Forge)
- Adresse du déploiement [:https://vercel.com/amina-cf92/royaume](https://vercel.com/amina-cf92/royaume)
- Fiche de cadrage : [fiche-cadrage.md](fiche-cadrage.md)

## Exigences minimales

| N° | Fichiers principaux | Tests qui la vérifient |
| --- | --- | --- |
| E1 | `src/modules/forge/domain/catalog.ts`, `src/modules/forge/domain/forge.ts`, `src/modules/forge/application/forge-service.ts`, `src/modules/forge/application/forge-repository.ts`, `src/modules/forge/application/forge-reader.ts`, `src/modules/forge/infrastructure/event-store-forge-repository.ts`, `src/modules/forge/infrastructure/schema.ts`, `src/modules/forge/infrastructure/forge-projection.ts`, `src/modules/forge/infrastructure/drizzle-forge-reader.ts`, `src/modules/forge/api.ts`, `src/modules/forge/index.ts`, `src/modules/forge/contracts.ts`, `src/modules/forge/ui.tsx` | `pnpm lint:archi` (règles `module-encapsulation`, `outside-uses-public-entries`, `application-ignores-infrastructure`, `client-without-server-code`), `src/bootstrap/forge-api.test.ts` |
| E2 | `src/bootstrap/create-api.ts`, `app/(jeu)/forge/page.tsx`, `src/ui/app-shell.tsx`, `src/ui/entity.tsx` | `src/bootstrap/forge-api.test.ts` (appels sur `/api/forge/*` et `/api/stream/forge-*`) |
| E3 | `src/modules/forge/domain/catalog.ts`, `src/modules/forge/domain/forge.ts` (`decide`, `evolve`, `replay`, `toView`) | `src/modules/forge/domain/forge.test.ts` (19 tests unitaires), `pnpm lint:archi` (règle `pure-domain`) |
| E4 | `src/modules/forge/infrastructure/event-store-forge-repository.ts`, `src/modules/forge/infrastructure/schema.ts`, `src/modules/forge/infrastructure/forge-projection.ts`, `src/modules/forge/infrastructure/drizzle-forge-reader.ts`, `drizzle/0015_forge.sql` | `src/bootstrap/architecture.test.ts` (« range chaque table dans le schéma d'une brique de la plateforme ou d'un module »), `src/bootstrap/forge-api.test.ts` (`GET /api/forge/inventory`) |
| E5 | `src/bootstrap/create-api.ts` (`app.use('/forge/*', requireUser(auth))`), `src/modules/forge/api.ts` (`c.var.userId`, `validateJson(StartCraftingInput)`), `src/modules/forge/contracts.ts`, `src/modules/forge/index.ts` (`channelPolicy`) | `src/bootstrap/forge-api.test.ts` (« refuse toute requête anonyme (401) », « rejette une recette invalide avant tout appel au service (400) », « autorise uniquement le joueur à écouter le canal temps réel de sa forge ») |
| E6 | `src/modules/forge/application/forge-service.ts` (émission du message `REALM_TOPICS.withdraw` dans la boîte d'envoi), `src/modules/forge/messages.ts` (réception de `FORGE_TOPICS.transferResult`), `src/bootstrap/create-api.ts` (`dispatcher.register(forge.handlers)`) | `src/bootstrap/forge-api.test.ts` (« refuse la fabrication si le joueur n'a pas fondé de village (422) », « refuse la fabrication si le stock du village est insuffisant (422) », « prélève les ressources du village et lance la fabrication (201) ») |
| E7 | `src/modules/forge/personal-data.ts`, `src/bootstrap/create-api.ts` (enregistrement dans `createPrivacyService`) | `src/bootstrap/architecture.test.ts` (« déclare les données personnelles de chaque module qui conserve des données »), `src/bootstrap/forge-api.test.ts` (« inclut la Forge dans l'export et l'effacement des données personnelles »), `src/bootstrap/privacy-api.test.ts` |
| E8 | `src/modules/forge/domain/forge.test.ts`, `src/bootstrap/forge-api.test.ts` | `src/modules/forge/domain/forge.test.ts` (19 tests couvrant les 8 règles métier et l'idempotence), `src/bootstrap/forge-api.test.ts` (12 tests couvrant les 6 routes HTTP, le canal SSE et le RGPD) |
| E9 | `.dependency-cruiser.cjs` (non modifié), `src/bootstrap/architecture.test.ts` (non modifié) | `pnpm lint:archi` (169 modules, 543 dépendances, 0 violation), `src/bootstrap/architecture.test.ts` (2/2 tests réussis) |
| E10 | `drizzle/0015_forge.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0015_snapshot.json`, `package.json` (`vercel-build`) | `pnpm verify`, `pnpm db:migrate`, `pnpm build` |

## Écarts avec la fiche de cadrage

Aucun écart fonctionnel : l'ensemble des 8 règles métier, le stockage par Event Sourcing doublé de la projection `forge.inventory`, la communication par boîte d'envoi avec le Village (`realm.withdraw` / `forge.transfer-result`) et les routes ont été réalisés conformément à la [fiche de cadrage](fiche-cadrage.md).

Précision d'implémentation intégrée à la fiche :

- Afin de matérialiser le passage d'un objet terminé (dont l'échéance est évaluée paresseusement à la lecture, règle 5) vers l'inventaire persisté et projeté (règle 7), la commande explicite `CollectItem` (`POST /api/forge/collect`) a été ajoutée aux côtés de `POST /api/forge/craft` et `POST /api/forge/cancel`.

## Indicateurs au rendu

| Indicateur | À l'étiquette `td11-fin` | Au rendu |
| --- | --- | --- |
| Nombre de tests | 229 tests (32 fichiers) | 260 tests (34 fichiers, soit +31 tests) |
| Couverture des lignes (domaines `src/modules/*/domain/**`) | ~90 % | 90,61 % (dont 89,47 % des lignes et 100 % des fonctions sur `src/modules/forge/domain/`) |
| Violations des règles d'architecture (`pnpm lint:archi`) | 0 (158 modules) | 0 (169 modules, 543 dépendances) |

## Documentation associée mise à jour

- Décision d'architecture : [ADR 0010 — Ajout du module Forge](../adr/0010-module-forge.md) et [index des ADR](../adr/README.md)
- Architecture C4 et diagramme de séquence Mermaid : [docs/architecture.md](../architecture.md)
- Registre de la dette technique (`DT-011` à `DT-013`) : [docs/qualite/dette-technique.md](../qualite/dette-technique.md)
- Bilan technique global : [docs/bilan-technique.md](../bilan-technique.md)
- Documentation générale du projet : [README.md](../../README.md)

## Usage de l'IA générative

- **Outil utilisé** : Antigravity (Gemini).
- **Nature de la contribution** :
  - *Cadrage et documentation* : structuration initiale de `fiche-cadrage.md`, rédaction de l'`ADR 0010`, mise à jour des diagrammes Mermaid dans `docs/architecture.md`, du `README.md`, du registre `dette-technique.md` et du `bilan-technique.md`.
  - *Code du module (`src/modules/forge/`) et câblage* : génération étape par étape des couches `domain`, `contracts`, `application`, `infrastructure`, `api`, `messages`, `personal-data` et `ui`, ainsi que le montage dans `src/bootstrap/create-api.ts` et la navigation (`app/(jeu)/forge/page.tsx`, `src/ui/app-shell.tsx`).
  - *Tests* : rédaction des 19 tests unitaires du domaine (`forge.test.ts`) et des 12 tests d'intégration de l'API (`forge-api.test.ts`).
- **Vérification des résultats** :
  - Détection et correction d'une violation `pure-domain` signalée par `dependency-cruiser` (suppression de l'importation de `@/modules/realm/contracts` depuis `forge/domain/` au profit d'un type local `Amounts`).
  - Génération propre de la migration `drizzle/0015_forge.sql` par `drizzle-kit generate`.
  - Exécution et validation complète de `pnpm lint` (Biome), `pnpm typecheck` (`tsc --noEmit`), `pnpm lint:archi` (`dependency-cruiser`) et de la suite de tests Vitest (34 fichiers, 260 tests réussis).
