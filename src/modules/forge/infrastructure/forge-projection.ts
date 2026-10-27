import { eq } from 'drizzle-orm'
import type { StoredEvent } from '@/platform/event-store/event-store'
import type { Projection } from '@/platform/projection/projection'
import { FORGE_STREAM_PREFIX } from '../contracts'
import type { ForgeEvent } from '../domain/forge'
import { inventory } from './schema'

/** Extrait le playerId du nom du flux ('forge-<userId>'). */
const playerIdOf = (event: StoredEvent) => event.stream.slice(FORGE_STREAM_PREFIX.length)

export const inventoryProjection: Projection = {
  name: 'forge-inventory',
  version: 1,
  eventTypes: [
    'CraftingRequested',
    'CraftingStarted',
    'CraftingRefused',
    'CraftingCancelled',
    'ItemCollected',
  ],

  async apply(stored, tx) {
    const event = { type: stored.type, data: stored.data } as ForgeEvent
    const playerId = playerIdOf(stored)

    switch (event.type) {
      case 'ItemCollected':
        await tx.insert(inventory).values({
          itemId: `${playerId}-${stored.version}`,
          playerId,
          recipeId: event.data.recipeId,
          craftedAt: event.data.at,
        })
        return
      // Les autres événements ne modifient pas la projection de l'inventaire.
      default:
        return
    }
  },

  async reset(tx) {
    await tx.delete(inventory)
  },
}
