/**
 * Domaine de la Forge, selon le modèle decider :
 *   decide(état, commande, maintenant) -> événements ou erreur métier
 *   evolve(état, événement)            -> nouvel état
 * Ce fichier est écrit en TypeScript pur : il n'importe que le catalogue du domaine.
 */
import { type Amounts, CATALOG, type RecipeId } from './catalog'

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

/** Un objet fabriqué, dans l'inventaire du joueur. */
export interface CraftedItem {
  recipeId: RecipeId
  craftedAt: number
}

/** La fabrication en cours, si elle existe. */
export interface OngoingCrafting {
  recipeId: RecipeId
  /** Identifiant du mouvement de ressources demandé au Village. */
  transferId: string
  /** Phase de la fabrication. */
  phase: 'reserving' | 'crafting'
  startedAt: number
  /** Instant auquel l'objet sera prêt (défini quand phase = 'crafting'). */
  endsAt: number
}

export interface ForgeState {
  /** Faux tant que la forge n'a jamais été utilisée. */
  initialized: boolean
  /** La fabrication en cours, ou null. */
  ongoing: OngoingCrafting | null
  /** L'inventaire : les objets fabriqués et récupérés. */
  inventory: CraftedItem[]
  /** Ressources manquantes lors du dernier refus du Village, ou null. */
  lastRefusal: Amounts | null
  /**
   * Mouvements de ressources déjà traités, par identifiant.
   * Rend les réponses du Village idempotentes.
   */
  transfers: Record<string, 'confirmed' | 'refused'>
}

/** État initial : aucune fabrication, inventaire vide. */
export const initialState: ForgeState = {
  initialized: false,
  ongoing: null,
  inventory: [],
  lastRefusal: null,
  transfers: {},
}

// ---------------------------------------------------------------------------
// Événements : des faits accomplis, nommés au participe passé
// ---------------------------------------------------------------------------

export type ForgeEvent =
  | {
      type: 'CraftingRequested'
      data: { recipeId: RecipeId; transferId: string; cost: Amounts; at: number }
    }
  | {
      type: 'CraftingStarted'
      data: { transferId: string; startedAt: number; endsAt: number }
    }
  | {
      type: 'CraftingRefused'
      data: { transferId: string; missing: Amounts; at: number }
    }
  | {
      type: 'CraftingCancelled'
      data: { recipeId: RecipeId; at: number }
    }
  | {
      type: 'ItemCollected'
      data: { recipeId: RecipeId; at: number }
    }

// ---------------------------------------------------------------------------
// Commandes : des intentions, nommées à l'impératif
// ---------------------------------------------------------------------------

export type ForgeCommand =
  | { type: 'RequestCrafting'; recipeId: RecipeId; transferId: string }
  | { type: 'ConfirmCrafting'; transferId: string }
  | { type: 'RefuseCrafting'; transferId: string; missing: Amounts }
  | { type: 'CancelCrafting' }
  | { type: 'CollectItem' }

// ---------------------------------------------------------------------------
// Résultat d'une décision : des événements, ou une erreur métier
// ---------------------------------------------------------------------------

export type DomainError =
  | { code: 'UNKNOWN_RECIPE' }
  | { code: 'ALREADY_CRAFTING' }
  | { code: 'NOTHING_TO_CANCEL' }
  | { code: 'NOTHING_TO_COLLECT' }
  | { code: 'CRAFTING_NOT_FINISHED' }
  | { code: 'CRAFTING_REFUSED'; missing: Amounts }

export type Decision = { ok: true; events: ForgeEvent[] } | { ok: false; error: DomainError }

// ---------------------------------------------------------------------------
// evolve : applique un événement, sans aucune vérification
// ---------------------------------------------------------------------------

export function evolve(state: ForgeState, event: ForgeEvent): ForgeState {
  switch (event.type) {
    case 'CraftingRequested':
      return {
        ...state,
        initialized: true,
        lastRefusal: null,
        ongoing: {
          recipeId: event.data.recipeId,
          transferId: event.data.transferId,
          phase: 'reserving',
          startedAt: event.data.at,
          endsAt: 0,
        },
      }

    case 'CraftingStarted':
      return {
        ...state,
        lastRefusal: null,
        ongoing: state.ongoing
          ? {
              ...state.ongoing,
              phase: 'crafting',
              startedAt: event.data.startedAt,
              endsAt: event.data.endsAt,
            }
          : null,
        transfers: { ...state.transfers, [event.data.transferId]: 'confirmed' },
      }

    case 'CraftingRefused':
      return {
        ...state,
        ongoing: null,
        lastRefusal: event.data.missing,
        transfers: { ...state.transfers, [event.data.transferId]: 'refused' },
      }

    case 'CraftingCancelled':
      return {
        ...state,
        ongoing: null,
      }

    case 'ItemCollected':
      return {
        ...state,
        ongoing: null,
        inventory: [
          ...state.inventory,
          { recipeId: event.data.recipeId, craftedAt: event.data.at },
        ],
      }
  }
}

/** Reconstruit l'état de la forge à partir de la suite de ses événements. */
export function replay(events: ForgeEvent[]): ForgeState {
  return events.reduce(evolve, initialState)
}

// ---------------------------------------------------------------------------
// decide : vérifie une commande et en déduit les événements
// ---------------------------------------------------------------------------

export function decide(state: ForgeState, command: ForgeCommand, now: number): Decision {
  switch (command.type) {
    // Règle 2 : la recette doit exister dans le catalogue.
    // Règle 4 : une seule fabrication à la fois.
    case 'RequestCrafting': {
      if (!(command.recipeId in CATALOG)) {
        return { ok: false, error: { code: 'UNKNOWN_RECIPE' } }
      }
      if (state.ongoing !== null) {
        return { ok: false, error: { code: 'ALREADY_CRAFTING' } }
      }
      const recipe = CATALOG[command.recipeId]
      return {
        ok: true,
        events: [
          {
            type: 'CraftingRequested',
            data: {
              recipeId: command.recipeId,
              transferId: command.transferId,
              cost: recipe.cost,
              at: now,
            },
          },
        ],
      }
    }

    // Réponse du Village : les ressources ont été prélevées → la fabrication commence.
    // Règle 3 + 5 : les ressources sont consommées, le chrono démarre.
    case 'ConfirmCrafting': {
      // Idempotence : un mouvement déjà traité ne produit aucun nouvel événement.
      if (command.transferId in state.transfers) return { ok: true, events: [] }
      if (!state.ongoing || state.ongoing.transferId !== command.transferId) {
        return { ok: true, events: [] }
      }
      const recipe = CATALOG[state.ongoing.recipeId]
      return {
        ok: true,
        events: [
          {
            type: 'CraftingStarted',
            data: {
              transferId: command.transferId,
              startedAt: now,
              endsAt: now + recipe.durationSeconds * 1000,
            },
          },
        ],
      }
    }

    // Réponse du Village : prélèvement refusé → la fabrication est annulée.
    // Règle 3 : pas assez de ressources.
    case 'RefuseCrafting': {
      if (command.transferId in state.transfers) return { ok: true, events: [] }
      if (!state.ongoing || state.ongoing.transferId !== command.transferId) {
        return { ok: true, events: [] }
      }
      return {
        ok: true,
        events: [
          {
            type: 'CraftingRefused',
            data: { transferId: command.transferId, missing: command.missing, at: now },
          },
        ],
      }
    }

    // Règle 6 : le joueur annule une fabrication en cours. Pas de remboursement.
    case 'CancelCrafting': {
      if (!state.ongoing) {
        return { ok: false, error: { code: 'NOTHING_TO_CANCEL' } }
      }
      return {
        ok: true,
        events: [
          {
            type: 'CraftingCancelled',
            data: { recipeId: state.ongoing.recipeId, at: now },
          },
        ],
      }
    }

    // Règle 5 + 7 : l'objet est prêt quand le temps est écoulé, puis ajouté à l'inventaire.
    case 'CollectItem': {
      if (!state.ongoing) {
        return { ok: false, error: { code: 'NOTHING_TO_COLLECT' } }
      }
      if (state.ongoing.phase !== 'crafting') {
        return { ok: false, error: { code: 'CRAFTING_NOT_FINISHED' } }
      }
      if (now < state.ongoing.endsAt) {
        return { ok: false, error: { code: 'CRAFTING_NOT_FINISHED' } }
      }
      return {
        ok: true,
        events: [
          {
            type: 'ItemCollected',
            data: { recipeId: state.ongoing.recipeId, at: now },
          },
        ],
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Vue : l'état présenté au joueur à un instant donné
// ---------------------------------------------------------------------------

export interface ForgeView {
  /** La fabrication en cours, avec sa progression. Null si aucune. */
  crafting: {
    recipeId: RecipeId
    recipeName: string
    phase: 'reserving' | 'crafting'
    startedAt: number
    endsAt: number
    /** Vrai si l'objet est prêt à être récupéré. */
    ready: boolean
  } | null
  /** L'inventaire du joueur. */
  inventory: CraftedItem[]
  /** Ressources manquantes lors du dernier refus, ou null. */
  lastRefusal: Amounts | null
}

export function toView(state: ForgeState, now: number): ForgeView {
  let crafting: ForgeView['crafting'] = null
  if (state.ongoing) {
    const recipe = CATALOG[state.ongoing.recipeId]
    crafting = {
      recipeId: state.ongoing.recipeId,
      recipeName: recipe.name,
      phase: state.ongoing.phase,
      startedAt: state.ongoing.startedAt,
      endsAt: state.ongoing.endsAt,
      ready: state.ongoing.phase === 'crafting' && now >= state.ongoing.endsAt,
    }
  }
  return { crafting, inventory: state.inventory, lastRefusal: state.lastRefusal }
}
