import { asc, eq } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { ForgeReader } from '../application/forge-reader'
import type { RecipeId } from '../domain/catalog'
import type { CraftedItem } from '../domain/forge'
import { inventoryProjection } from './forge-projection'
import { inventory } from './schema'

export function createDrizzleForgeReader(db: Db, projections: ProjectionRunner): ForgeReader {
  return {
    async listInventory(playerId) {
      await projections.catchUp(inventoryProjection)
      const rows = await db
        .select()
        .from(inventory)
        .where(eq(inventory.playerId, playerId))
        .orderBy(asc(inventory.craftedAt))

      return rows.map(
        (row): CraftedItem => ({
          recipeId: row.recipeId as RecipeId,
          craftedAt: row.craftedAt,
        }),
      )
    },
  }
}
