import { eq } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { PersonalDataContributor } from '@/platform/privacy/privacy'
import type { ForgeService } from './application/forge-service'
import { inventory } from './infrastructure/schema'

/**
 * Données personnelles de la Forge : l'inventaire et l'historique de fabrication
 * du joueur, liés à son identifiant.
 */
export function createForgePersonalData(service: ForgeService, db: Db): PersonalDataContributor {
  return {
    name: 'forge',

    async export(playerId) {
      const view = await service.getView(playerId)
      return {
        inventory: view.inventory,
        crafting: view.crafting,
      }
    },

    // DETTE TECHNIQUE (docs/qualite/dette-technique.md, DT-011) : l'effacement supprime les
    // lignes de la projection forge.inventory mais ne réécrit pas les événements ItemCollected
    // du flux forge-<playerId> ; une reconstruction (rebuild) de la projection recréerait ces
    // lignes sous l'identifiant pseudonymisé.
    async erase(playerId) {
      await db.delete(inventory).where(eq(inventory.playerId, playerId))
    },
  }
}
