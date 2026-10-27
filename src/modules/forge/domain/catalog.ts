/**
 * Catalogue de la Forge : recettes de fabrication et valeurs d'équilibrage.
 * Ce fichier ne contient que des données. Les règles qui les utilisent
 * se trouvent dans forge.ts : rééquilibrer la forge ne demande de modifier qu'ici.
 */

/** Ressources consommables par la Forge (« wood », « stone », « gold »). */
export type Resource = 'wood' | 'stone' | 'gold'

/** Quantités de ressources requises ou manquantes. */
export type Amounts = Partial<Record<Resource, number>>

// ---------------------------------------------------------------------------
// Recette
// ---------------------------------------------------------------------------

/** Identifiants des recettes du catalogue. */
export const RECIPES = ['wooden-sword', 'stone-shield', 'gold-ring'] as const
export type RecipeId = (typeof RECIPES)[number]

/** Définition d'une recette : coût en ressources et durée de fabrication. */
export interface Recipe {
  id: RecipeId
  /** Nom affiché au joueur. */
  name: string
  /** Ressources consommées par la fabrication. */
  cost: Amounts
  /** Durée de fabrication, en secondes. */
  durationSeconds: number
}

/** Le catalogue complet des recettes. */
export const CATALOG: Record<RecipeId, Recipe> = {
  'wooden-sword': {
    id: 'wooden-sword',
    name: 'Épée en bois',
    cost: { wood: 30 },
    durationSeconds: 60,
  },
  'stone-shield': {
    id: 'stone-shield',
    name: 'Bouclier de pierre',
    cost: { wood: 20, stone: 40 },
    durationSeconds: 120,
  },
  'gold-ring': {
    id: 'gold-ring',
    name: 'Anneau doré',
    cost: { gold: 50, stone: 10 },
    durationSeconds: 300,
  },
}
