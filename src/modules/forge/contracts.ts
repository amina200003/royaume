/**
 * Entrée publique « partagée » du module Forge : utilisable par le serveur
 * comme par l'interface. Elle ne contient que des types, des schémas de
 * validation et des constantes, sans aucun code propre au serveur.
 */
import { z } from 'zod'
import { RECIPES } from './domain/catalog'

export type { Amounts, Recipe, RecipeId, Resource } from './domain/catalog'
export { CATALOG, RECIPES } from './domain/catalog'
export type { CraftedItem, DomainError, ForgeView } from './domain/forge'

/** Corps attendu pour lancer une fabrication. */
export const StartCraftingInput = z.object({
  recipeId: z.enum(RECIPES),
})

/** Préfixe commun aux noms des flux de toutes les forges. */
export const FORGE_STREAM_PREFIX = 'forge-'

/** Nom du flux qui contient les événements de la forge d'un joueur. */
export const forgeStream = (userId: string) => `${FORGE_STREAM_PREFIX}${userId}`

/** Nom du canal temps réel de la forge d'un joueur. */
export const FORGE_CHANNEL_PREFIX = 'forge-'
export const forgeChannel = (userId: string) => `${FORGE_CHANNEL_PREFIX}${userId}`

/** Sujets des messages adressés à la Forge. */
export const FORGE_TOPICS = {
  /** Réponse du Village à un mouvement de ressources. */
  transferResult: 'forge.transfer-result',
} as const
