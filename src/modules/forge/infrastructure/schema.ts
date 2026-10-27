import { bigint, index, pgSchema, text } from 'drizzle-orm/pg-core'

export const forge = pgSchema('forge')

export const inventory = forge.table(
  'inventory',
  {
    /** Identifiant unique de l'objet fabriqué (clé primaire). */
    itemId: text('item_id').primaryKey(),
    /** Joueur propriétaire. */
    playerId: text('player_id').notNull(),
    /** Identifiant de la recette utilisée. */
    recipeId: text('recipe_id').notNull(),
    /** Instant de fabrication (millisecondes). */
    craftedAt: bigint('crafted_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('inventory_player_idx').on(t.playerId)],
)
