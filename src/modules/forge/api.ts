import { Hono } from 'hono'
import type { AppEnv } from '@/platform/http/types'
import { validateJson } from '@/platform/http/validate'
import type { ForgeService } from './application/forge-service'
import { type DomainError, StartCraftingInput } from './contracts'

const STATUS: Record<DomainError['code'], 404 | 409 | 422> = {
  UNKNOWN_RECIPE: 422,
  ALREADY_CRAFTING: 409,
  NOTHING_TO_CANCEL: 409,
  NOTHING_TO_COLLECT: 409,
  CRAFTING_NOT_FINISHED: 409,
  CRAFTING_REFUSED: 422,
}

export function createForgeApi(service: ForgeService) {
  return new Hono<AppEnv>()
    .get('/recipes', (c) => c.json({ recipes: service.getRecipes() }))

    .get('/status', async (c) => c.json({ view: await service.getView(c.var.userId) }))

    .get('/inventory', async (c) => c.json({ inventory: await service.getInventory(c.var.userId) }))

    .post('/craft', validateJson(StartCraftingInput), async (c) => {
      const { recipeId } = c.req.valid('json')
      const result = await service.craft(c.var.userId, recipeId)
      return result.ok
        ? c.json({ view: result.view }, 201)
        : c.json({ error: result.error }, STATUS[result.error.code])
    })

    .post('/cancel', async (c) => {
      const result = await service.cancel(c.var.userId)
      return result.ok
        ? c.json({ view: result.view })
        : c.json({ error: result.error }, STATUS[result.error.code])
    })

    .post('/collect', async (c) => {
      const result = await service.collect(c.var.userId)
      return result.ok
        ? c.json({ view: result.view })
        : c.json({ error: result.error }, STATUS[result.error.code])
    })
}

export type ForgeApi = ReturnType<typeof createForgeApi>
