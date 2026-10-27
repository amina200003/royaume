import { describe, expect, it } from 'vitest'
import type { CraftedItem, ForgeView, Recipe } from '@/modules/forge/contracts'
import type { Stock } from '@/modules/realm/contracts'
import { createTestApi } from './testing'

type TestApi = Awaited<ReturnType<typeof createTestApi>>

/** Stock du village d'un joueur. */
async function stockOf(api: TestApi, player = 'alice'): Promise<Stock> {
  const res = await api.get('/api/realm/village', player)
  return ((await res.json()) as { view: { stock: Stock } }).view.stock
}

describe('API du module Forge', () => {
  it('refuse toute requête anonyme (401)', async () => {
    const { get, post } = await createTestApi()

    expect((await get('/api/forge/recipes', null)).status).toBe(401)
    expect((await get('/api/forge/status', null)).status).toBe(401)
    expect((await get('/api/forge/inventory', null)).status).toBe(401)
    expect((await post('/api/forge/craft', { recipeId: 'wooden-sword' }, null)).status).toBe(401)
    expect((await post('/api/forge/cancel', {}, null)).status).toBe(401)
    expect((await post('/api/forge/collect', {}, null)).status).toBe(401)
  })

  it('renvoie le catalogue des recettes (GET /recipes)', async () => {
    const { get } = await createTestApi()
    const res = await get('/api/forge/recipes')

    expect(res.status).toBe(200)
    const { recipes } = (await res.json()) as { recipes: Recipe[] }
    expect(recipes.length).toBeGreaterThanOrEqual(3)
    expect(recipes.map((r) => r.id)).toContain('wooden-sword')
  })

  it("renvoie l'état initial vide (GET /status et GET /inventory)", async () => {
    const { get } = await createTestApi()

    const statusRes = await get('/api/forge/status')
    expect(statusRes.status).toBe(200)
    expect(await statusRes.json()).toEqual({
      view: { crafting: null, inventory: [], lastRefusal: null },
    })

    const invRes = await get('/api/forge/inventory')
    expect(invRes.status).toBe(200)
    expect(await invRes.json()).toEqual({ inventory: [] })
  })

  it('rejette une recette invalide avant tout appel au service (400)', async () => {
    const { post } = await createTestApi()
    const res = await post('/api/forge/craft', { recipeId: 'magic-wand' })

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_INPUT')
  })

  it("refuse la fabrication si le joueur n'a pas fondé de village (422)", async () => {
    const { post } = await createTestApi()
    const res = await post('/api/forge/craft', { recipeId: 'wooden-sword' })

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: { code: 'CRAFTING_REFUSED', missing: { wood: 30 } },
    })
  })

  it('refuse la fabrication si le stock du village est insuffisant (422)', async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' })

    // L'anneau doré coûte 50 or et 10 pierre ; le village débute avec 0 or.
    const res = await api.post('/api/forge/craft', { recipeId: 'gold-ring' })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: { code: 'CRAFTING_REFUSED', missing: { gold: 50 } },
    })
    expect((await stockOf(api)).stone).toBe(50)
  })

  it('prélève les ressources du village et lance la fabrication (201)', async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' })

    const res = await api.post('/api/forge/craft', { recipeId: 'wooden-sword' })
    expect(res.status).toBe(201)
    const { view } = (await res.json()) as { view: ForgeView }
    expect(view.crafting).toMatchObject({
      recipeId: 'wooden-sword',
      phase: 'crafting',
      ready: false,
    })

    // 100 bois de départ - 30 bois pour l'épée = 70 bois.
    expect((await stockOf(api)).wood).toBe(70)
  })

  it('refuse une seconde fabrication simultanée (409)', async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' })
    await api.post('/api/forge/craft', { recipeId: 'wooden-sword' })

    const second = await api.post('/api/forge/craft', { recipeId: 'stone-shield' })
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({ error: { code: 'ALREADY_CRAFTING' } })
  })

  it("refuse la collecte avant la fin, puis ajoute l'objet à l'inventaire une fois prêt", async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' })
    await api.post('/api/forge/craft', { recipeId: 'wooden-sword' })

    const tooEarly = await api.post('/api/forge/collect', {})
    expect(tooEarly.status).toBe(409)
    expect(await tooEarly.json()).toEqual({ error: { code: 'CRAFTING_NOT_FINISHED' } })

    // L'épée en bois demande 60 secondes (1 minute).
    api.advance(1)

    const statusReady = await api.get('/api/forge/status')
    expect(((await statusReady.json()) as { view: ForgeView }).view.crafting?.ready).toBe(true)

    const collected = await api.post('/api/forge/collect', {})
    expect(collected.status).toBe(200)
    const { view } = (await collected.json()) as { view: ForgeView }
    expect(view.crafting).toBeNull()
    expect(view.inventory).toHaveLength(1)
    expect(view.inventory[0].recipeId).toBe('wooden-sword')

    // La projection de l'inventaire est elle aussi à jour.
    const invRes = await api.get('/api/forge/inventory')
    const { inventory } = (await invRes.json()) as { inventory: CraftedItem[] }
    expect(inventory).toHaveLength(1)
    expect(inventory[0].recipeId).toBe('wooden-sword')
  })

  it('annule une fabrication en cours sans rembourser les ressources', async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' })

    expect((await api.post('/api/forge/cancel', {})).status).toBe(409)

    await api.post('/api/forge/craft', { recipeId: 'wooden-sword' })
    const cancelled = await api.post('/api/forge/cancel', {})
    expect(cancelled.status).toBe(200)
    expect(((await cancelled.json()) as { view: ForgeView }).view.crafting).toBeNull()

    // Les 30 bois restent consommés.
    expect((await stockOf(api)).wood).toBe(70)
  })

  it('autorise uniquement le joueur à écouter le canal temps réel de sa forge', async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' })
    await api.post('/api/forge/craft', { recipeId: 'wooden-sword' })

    const own = await api.get('/api/stream/forge-alice', 'alice')
    expect(own.status).toBe(200)
    expect(await own.text()).toContain('"type":"CraftingStarted"')

    const other = await api.get('/api/stream/forge-alice', 'bob')
    expect(other.status).toBe(403)
  })

  it("inclut la Forge dans l'export et l'effacement des données personnelles", async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' })
    await api.post('/api/forge/craft', { recipeId: 'wooden-sword' })
    api.advance(1)
    await api.post('/api/forge/collect', {})

    const exported = await (await api.get('/api/account/export')).json()
    expect(exported.sections.forge.inventory).toMatchObject([{ recipeId: 'wooden-sword' }])

    const del = await api.api.request('/api/account', {
      method: 'DELETE',
      headers: { 'x-test-user': 'alice' },
    })
    expect(del.status).toBe(200)

    const invAfter = await api.get('/api/forge/inventory', 'bob')
    expect(((await invAfter.json()) as { inventory: CraftedItem[] }).inventory).toEqual([])
  })
})
