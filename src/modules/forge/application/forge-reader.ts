import type { CraftedItem } from '../domain/forge'

export interface ForgeReader {
  listInventory(playerId: string): Promise<CraftedItem[]>
}
