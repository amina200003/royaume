import { REALM_TOPICS } from '@/modules/realm/contracts'
import { withOptimisticRetry } from '@/platform/event-store/retry'
import type { NewMessage } from '@/platform/outbox/outbox'
import { FORGE_TOPICS } from '../contracts'
import { CATALOG, type RecipeId } from '../domain/catalog'
import {
  type CraftedItem,
  type DomainError,
  decide,
  type ForgeCommand,
  type ForgeEvent,
  type ForgeView,
  toView,
} from '../domain/forge'
import type { ForgeReader } from './forge-reader'
import type { ForgeRepository } from './forge-repository'

export type CommandResult = { ok: true; view: ForgeView } | { ok: false; error: DomainError }

export interface ForgeServiceOptions {
  dispatch?: () => Promise<unknown>
  clock?: () => number
  newId?: () => string
}

/**
 * Traduit les événements de la forge en messages de la boîte d'envoi.
 * Un CraftingRequested déclenche un prélèvement de ressources au Village.
 */
function messagesFor(events: ForgeEvent[], userId: string): NewMessage[] {
  const messages: NewMessage[] = []
  for (const event of events) {
    if (event.type === 'CraftingRequested') {
      messages.push({
        topic: REALM_TOPICS.withdraw,
        payload: {
          transferId: event.data.transferId,
          playerId: userId,
          resources: event.data.cost,
          replyTo: FORGE_TOPICS.transferResult,
        },
      })
    }
  }
  return messages
}

export function createForgeService(
  repo: ForgeRepository,
  reader: ForgeReader,
  options: ForgeServiceOptions = {},
) {
  const { dispatch, clock = () => Date.now(), newId = () => crypto.randomUUID() } = options

  /** Construit un transferId qui encode le userId pour le retrouver à la réponse. */
  function transferId(userId: string): string {
    return `${userId}:${newId()}`
  }

  /** Exécute une commande joueur (craft, cancel, collect). */
  async function execute(userId: string, command: ForgeCommand): Promise<CommandResult> {
    const decision = await withOptimisticRetry(async () => {
      const { state, version } = await repo.load(userId)
      const now = clock()
      const result = decide(state, command, now)
      if (!result.ok) return result

      const messages = messagesFor(result.events, userId)
      await repo.save(userId, version, result.events, messages)
      return result
    })
    if (!decision.ok) return decision

    if (command.type === 'RequestCrafting') {
      await dispatch?.()
    }

    const updated = await repo.load(userId)
    if (
      command.type === 'RequestCrafting' &&
      updated.state.ongoing === null &&
      updated.state.lastRefusal !== null
    ) {
      return {
        ok: false,
        error: { code: 'CRAFTING_REFUSED', missing: updated.state.lastRefusal },
      }
    }
    return { ok: true, view: toView(updated.state, clock()) }
  }

  /** Applique une commande interne (réponse du Village). */
  async function step(userId: string, command: ForgeCommand): Promise<void> {
    await withOptimisticRetry(async () => {
      const { state, version } = await repo.load(userId)
      const now = clock()
      const decision = decide(state, command, now)
      if (!decision.ok) {
        throw new Error(`Forge ${userId} : ${decision.error.code}`)
      }
      await repo.save(userId, version, decision.events)
    })
  }

  /** Renvoie la vue courante de la forge. */
  async function getView(userId: string): Promise<ForgeView> {
    await dispatch?.()
    const { state } = await repo.load(userId)
    return toView(state, clock())
  }

  /** Renvoie l'inventaire lu depuis la projection. */
  async function getInventory(userId: string): Promise<CraftedItem[]> {
    return reader.listInventory(userId)
  }

  /** Renvoie le catalogue complet des recettes. */
  function getRecipes() {
    return Object.values(CATALOG)
  }

  /** Lance une fabrication pour le joueur. */
  function craft(userId: string, recipeId: RecipeId) {
    return execute(userId, {
      type: 'RequestCrafting',
      recipeId,
      transferId: transferId(userId),
    })
  }

  /** Annule la fabrication en cours. */
  function cancel(userId: string) {
    return execute(userId, { type: 'CancelCrafting' })
  }

  /** Récupère l'objet terminé. */
  function collect(userId: string) {
    return execute(userId, { type: 'CollectItem' })
  }

  return { execute, step, getView, getInventory, getRecipes, craft, cancel, collect }
}

export type ForgeService = ReturnType<typeof createForgeService>
