import { describe, expect, it } from 'vitest'
import { CATALOG, RECIPES, type RecipeId } from './catalog'
import { decide, type ForgeEvent, initialState, replay, toView } from './forge'

// Instant de référence et conversions.
const T0 = Date.UTC(2026, 0, 1)
const seconds = (n: number) => n * 1000

/** Applique une décision supposée acceptée et renvoie ses événements. */
function eventsOf(decision: ReturnType<typeof decide>): ForgeEvent[] {
  if (!decision.ok) throw new Error(`Décision refusée : ${decision.error.code}`)
  return decision.events
}

// ---------------------------------------------------------------------------
// Raccourcis pour les scénarios courants
// ---------------------------------------------------------------------------

/** Événement : fabrication demandée pour une épée en bois. */
const requested: ForgeEvent = {
  type: 'CraftingRequested',
  data: { recipeId: 'wooden-sword', transferId: 'tx-1', cost: { wood: 30 }, at: T0 },
}

/** Événement : fabrication confirmée (ressources prélevées). */
const started: ForgeEvent = {
  type: 'CraftingStarted',
  data: { transferId: 'tx-1', startedAt: T0, endsAt: T0 + seconds(60) },
}

// ---------------------------------------------------------------------------
// Règle 2 : le catalogue est connu et fixe
// ---------------------------------------------------------------------------

describe('Forge - catalogue', () => {
  it('refuse une recette inconnue', () => {
    const decision = decide(
      initialState,
      {
        type: 'RequestCrafting',
        recipeId: 'unknown' as unknown as RecipeId,
        transferId: 'tx-1',
      },
      T0,
    )
    expect(decision).toEqual({ ok: false, error: { code: 'UNKNOWN_RECIPE' } })
  })

  it('accepte chaque recette du catalogue', () => {
    for (const recipeId of RECIPES) {
      const decision = decide(
        initialState,
        {
          type: 'RequestCrafting',
          recipeId,
          transferId: `tx-${recipeId}`,
        },
        T0,
      )
      expect(decision.ok).toBe(true)
      expect(CATALOG[recipeId].durationSeconds).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Règle 3 : les ressources sont prélevées ; refus si insuffisantes
// ---------------------------------------------------------------------------

describe('Forge - prélèvement des ressources', () => {
  it('demande un prélèvement au Village au lancement', () => {
    const events = eventsOf(
      decide(
        initialState,
        {
          type: 'RequestCrafting',
          recipeId: 'wooden-sword',
          transferId: 'tx-1',
        },
        T0,
      ),
    )

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      type: 'CraftingRequested',
      data: { recipeId: 'wooden-sword', transferId: 'tx-1', cost: { wood: 30 }, at: T0 },
    })
  })

  it('annule la fabrication si le Village refuse le prélèvement', () => {
    const state = replay([requested])
    const events = eventsOf(
      decide(
        state,
        {
          type: 'RefuseCrafting',
          transferId: 'tx-1',
          missing: { wood: 10 },
        },
        T0,
      ),
    )

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('CraftingRefused')
    expect(replay([requested, ...events]).ongoing).toBeNull()
  })

  it('lance la fabrication quand le Village confirme le prélèvement', () => {
    const state = replay([requested])
    const events = eventsOf(
      decide(
        state,
        {
          type: 'ConfirmCrafting',
          transferId: 'tx-1',
        },
        T0,
      ),
    )

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('CraftingStarted')

    const after = replay([requested, ...events])
    expect(after.ongoing?.phase).toBe('crafting')
  })
})

// ---------------------------------------------------------------------------
// Règle 4 : une seule fabrication à la fois
// ---------------------------------------------------------------------------

describe('Forge - file unique', () => {
  it('refuse une fabrication si une autre est en cours', () => {
    const state = replay([requested])
    const decision = decide(
      state,
      {
        type: 'RequestCrafting',
        recipeId: 'stone-shield',
        transferId: 'tx-2',
      },
      T0,
    )

    expect(decision).toEqual({ ok: false, error: { code: 'ALREADY_CRAFTING' } })
  })

  it('permet une nouvelle fabrication après annulation', () => {
    const cancelled: ForgeEvent = {
      type: 'CraftingCancelled',
      data: { recipeId: 'wooden-sword', at: T0 },
    }
    const state = replay([requested, cancelled])
    const decision = decide(
      state,
      {
        type: 'RequestCrafting',
        recipeId: 'stone-shield',
        transferId: 'tx-2',
      },
      T0,
    )

    expect(decision.ok).toBe(true)
  })

  it('permet une nouvelle fabrication après collecte', () => {
    const collected: ForgeEvent = {
      type: 'ItemCollected',
      data: { recipeId: 'wooden-sword', at: T0 + seconds(60) },
    }
    const state = replay([requested, started, collected])
    const decision = decide(
      state,
      {
        type: 'RequestCrafting',
        recipeId: 'stone-shield',
        transferId: 'tx-2',
      },
      T0 + seconds(60),
    )

    expect(decision.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Règle 5 : la fabrication a une durée ; l'objet n'est prêt qu'après
// ---------------------------------------------------------------------------

describe('Forge - durée de fabrication', () => {
  it('refuse la collecte avant la fin du temps', () => {
    const state = replay([requested, started])
    const decision = decide(state, { type: 'CollectItem' }, T0 + seconds(30))

    expect(decision).toEqual({ ok: false, error: { code: 'CRAFTING_NOT_FINISHED' } })
  })

  it('permet la collecte une fois le temps écoulé', () => {
    const state = replay([requested, started])
    const decision = decide(state, { type: 'CollectItem' }, T0 + seconds(60))

    expect(decision.ok).toBe(true)
    const events = eventsOf(decision)
    expect(events[0].type).toBe('ItemCollected')
  })

  it('indique « prêt » dans la vue quand le temps est écoulé', () => {
    const state = replay([requested, started])

    expect(toView(state, T0 + seconds(30)).crafting?.ready).toBe(false)
    expect(toView(state, T0 + seconds(60)).crafting?.ready).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Règle 6 : annulation sans remboursement
// ---------------------------------------------------------------------------

describe('Forge - annulation', () => {
  it('annule une fabrication en cours', () => {
    const state = replay([requested, started])
    const events = eventsOf(decide(state, { type: 'CancelCrafting' }, T0 + seconds(10)))

    expect(events[0].type).toBe('CraftingCancelled')
    expect(replay([requested, started, ...events]).ongoing).toBeNull()
  })

  it("refuse d'annuler quand il n'y a rien en cours", () => {
    const decision = decide(initialState, { type: 'CancelCrafting' }, T0)
    expect(decision).toEqual({ ok: false, error: { code: 'NOTHING_TO_CANCEL' } })
  })
})

// ---------------------------------------------------------------------------
// Règle 7 : l'objet est ajouté à l'inventaire après collecte
// ---------------------------------------------------------------------------

describe('Forge - inventaire', () => {
  it("ajoute l'objet à l'inventaire après collecte", () => {
    const collectTime = T0 + seconds(60)
    const collected: ForgeEvent = {
      type: 'ItemCollected',
      data: { recipeId: 'wooden-sword', at: collectTime },
    }
    const state = replay([requested, started, collected])

    expect(state.inventory).toEqual([{ recipeId: 'wooden-sword', craftedAt: collectTime }])
  })

  it("accumule les objets dans l'inventaire", () => {
    const collected1: ForgeEvent = {
      type: 'ItemCollected',
      data: { recipeId: 'wooden-sword', at: T0 + seconds(60) },
    }
    const requested2: ForgeEvent = {
      type: 'CraftingRequested',
      data: {
        recipeId: 'stone-shield',
        transferId: 'tx-2',
        cost: { wood: 20, stone: 40 },
        at: T0 + seconds(70),
      },
    }
    const started2: ForgeEvent = {
      type: 'CraftingStarted',
      data: { transferId: 'tx-2', startedAt: T0 + seconds(70), endsAt: T0 + seconds(190) },
    }
    const collected2: ForgeEvent = {
      type: 'ItemCollected',
      data: { recipeId: 'stone-shield', at: T0 + seconds(190) },
    }

    const state = replay([requested, started, collected1, requested2, started2, collected2])
    expect(state.inventory).toHaveLength(2)
    expect(state.inventory[0].recipeId).toBe('wooden-sword')
    expect(state.inventory[1].recipeId).toBe('stone-shield')
  })
})

// ---------------------------------------------------------------------------
// Règle 8 : le joueur peut consulter fabrication et inventaire (via la vue)
// ---------------------------------------------------------------------------

describe('Forge - vue', () => {
  it("montre l'état de la fabrication en cours", () => {
    const state = replay([requested, started])
    const view = toView(state, T0 + seconds(30))

    expect(view.crafting).not.toBeNull()
    expect(view.crafting?.recipeId).toBe('wooden-sword')
    expect(view.crafting?.recipeName).toBe('Épée en bois')
    expect(view.crafting?.phase).toBe('crafting')
    expect(view.crafting?.ready).toBe(false)
  })

  it('montre un inventaire vide au début', () => {
    const view = toView(initialState, T0)
    expect(view.crafting).toBeNull()
    expect(view.inventory).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Idempotence des réponses du Village
// ---------------------------------------------------------------------------

describe('Forge - idempotence', () => {
  it('ignore une confirmation déjà traitée', () => {
    const state = replay([requested, started])
    const events = eventsOf(
      decide(
        state,
        {
          type: 'ConfirmCrafting',
          transferId: 'tx-1',
        },
        T0 + seconds(5),
      ),
    )

    expect(events).toHaveLength(0)
  })

  it('ignore un refus déjà traité', () => {
    const refused: ForgeEvent = {
      type: 'CraftingRefused',
      data: { transferId: 'tx-1', missing: { wood: 10 }, at: T0 },
    }
    const state = replay([requested, refused])
    const events = eventsOf(
      decide(
        state,
        {
          type: 'RefuseCrafting',
          transferId: 'tx-1',
          missing: { wood: 10 },
        },
        T0 + seconds(5),
      ),
    )

    expect(events).toHaveLength(0)
  })
})
