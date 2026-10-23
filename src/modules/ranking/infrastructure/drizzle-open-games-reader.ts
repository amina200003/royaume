import { and, desc, gt, lt } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { OpenGamesReader } from '../application/open-games-reader'
import { MAX_HEROES, OPEN_GAME_MS } from '../domain/content'
import { openGamesProjection } from './open-games-projection'
import { openGames } from './schema'

/** Adaptateur du port OpenGamesReader, fondé sur la table des expéditions ouvertes. */
export function createDrizzleOpenGamesReader(
  db: Db,
  projections: ProjectionRunner,
): OpenGamesReader {
  return {
    async list(now) {
      // Rattrapage à la lecture
      await projections.catchUp(openGamesProjection)

      // 1. On stocke le résultat de la requête
      const games = await db
        .select({
          gameId: openGames.gameId,
          hostName: openGames.hostName,
          heroCount: openGames.heroCount,
          createdAt: openGames.createdAt,
        })
        .from(openGames)
        .where(
          and(
            lt(openGames.heroCount, MAX_HEROES),
            // CORRECTION ERREUR 2 : On convertit le nombre (now - OPEN_GAME_MS) en objet Date
            // car Drizzle attend une Date pour comparer avec une colonne de type timestamp
            gt(openGames.createdAt, new Date(now - OPEN_GAME_MS)),
          ),
        )
        .orderBy(desc(openGames.createdAt))

      // CORRECTION ERREUR 1 : On mappe le résultat pour transformer la Date en nombre (timestamp)
      // afin de respecter l'interface OpenGame définie dans contracts.ts
      return games.map((game) => ({
        ...game,
        createdAt: game.createdAt.getTime(),
      }))
    },
  }
}
