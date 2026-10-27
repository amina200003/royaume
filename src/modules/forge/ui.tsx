'use client'
import { hc } from 'hono/client'
import { useCallback, useEffect, useState } from 'react'
import { useChannel } from '@/platform/realtime/use-channel'
import { Entity } from '@/ui/entity'
import type { ForgeApi } from './api'
import {
  CATALOG,
  type DomainError,
  type ForgeView,
  forgeChannel,
  type Recipe,
  type RecipeId,
} from './contracts'

/** Client HTTP typé, déduit de la sous-application Hono du module. */
const client = hc<ForgeApi>('/api/forge')

type ApiError = { code: DomainError['code'] | 'INVALID_INPUT'; message?: string }

const ERRORS: Record<ApiError['code'], string> = {
  INVALID_INPUT: 'Saisie invalide.',
  UNKNOWN_RECIPE: 'Recette inconnue.',
  ALREADY_CRAFTING: 'Une fabrication est déjà en cours.',
  NOTHING_TO_CANCEL: 'Aucune fabrication à annuler.',
  NOTHING_TO_COLLECT: 'Aucun objet à récupérer.',
  CRAFTING_NOT_FINISHED: "La fabrication n'est pas encore terminée.",
  CRAFTING_REFUSED: 'Ressources insuffisantes dans votre village (ou village non fondé).',
}

const STATUS_LABELS = {
  connecting: 'Connexion...',
  open: 'Temps réel connecté',
  reconnecting: 'Reconnexion...',
} as const

/** Écran de la Forge : catalogue de recettes, fabrication en cours et inventaire. */
export function ForgeScreen({ userId }: { userId: string }) {
  const [recipes, setRecipes] = useState<Recipe[]>(() => Object.values(CATALOG))
  const [view, setView] = useState<ForgeView | undefined>(undefined)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [statusRes, recipesRes] = await Promise.all([client.status.$get(), client.recipes.$get()])
    if (statusRes.ok) setView((await statusRes.json()).view)
    if (recipesRes.ok) setRecipes((await recipesRes.json()).recipes)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const status = useChannel(forgeChannel(userId), refresh)

  // Mise à jour locale de l'horloge pour le décompte du temps de fabrication.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])

  function handle(body: { view: ForgeView } | { error: ApiError }) {
    if ('error' in body) {
      setError(ERRORS[body.error.code])
    } else {
      setError(null)
      setView(body.view)
    }
  }

  async function craft(recipeId: RecipeId) {
    const res = await client.craft.$post({ json: { recipeId } })
    handle((await res.json()) as { view: ForgeView } | { error: ApiError })
  }

  async function cancel() {
    const res = await client.cancel.$post()
    handle((await res.json()) as { view: ForgeView } | { error: ApiError })
  }

  async function collect() {
    const res = await client.collect.$post()
    handle((await res.json()) as { view: ForgeView } | { error: ApiError })
  }

  const title = (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <h1>
        <Entity kind="forge" /> La Forge
      </h1>
      <span className="status" data-status={status}>
        {STATUS_LABELS[status]}
      </span>
    </div>
  )

  if (view === undefined) return title

  const crafting = view.crafting
  const remainingSeconds =
    crafting && crafting.phase === 'crafting'
      ? Math.max(0, Math.ceil((crafting.endsAt - now) / 1000))
      : 0
  const isReady =
    crafting !== null &&
    (crafting.ready || (crafting.phase === 'crafting' && now >= crafting.endsAt))

  return (
    <>
      {title}

      {error && <p className="error">{error}</p>}

      <section className="panel" aria-label="Fabrication en cours">
        <h2>Atelier</h2>
        {!crafting ? (
          <p className="muted">Aucune fabrication en cours. Choisissez une recette ci-dessous.</p>
        ) : (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              <strong>{crafting.recipeName}</strong>{' '}
              <span className="muted">
                {crafting.phase === 'reserving'
                  ? '— Prélèvement des ressources...'
                  : isReady
                    ? '— Prêt à récupérer !'
                    : `— Reste ${remainingSeconds} s`}
              </span>
            </span>
            <span className="row">
              {isReady && (
                <button type="button" onClick={collect}>
                  Récupérer
                </button>
              )}
              <button type="button" onClick={cancel}>
                Annuler
              </button>
            </span>
          </div>
        )}
      </section>

      <section className="panel buildings" aria-label="Recettes">
        <h2>Recettes</h2>
        {recipes.map((recipe) => (
          <div key={recipe.id} className="building">
            <span>
              <strong>{recipe.name}</strong>{' '}
              <span className="muted">({recipe.durationSeconds} s)</span>
            </span>
            <span className="row">
              {Object.entries(recipe.cost).map(([r, n]) => (
                <span key={r} className="muted">
                  <Entity kind={r} /> {n}
                </span>
              ))}
              <button type="button" disabled={crafting !== null} onClick={() => craft(recipe.id)}>
                Fabriquer
              </button>
            </span>
          </div>
        ))}
      </section>

      <section className="panel" aria-label="Inventaire">
        <h2>Inventaire ({view.inventory.length})</h2>
        {view.inventory.length === 0 ? (
          <p className="muted">Votre inventaire est vide.</p>
        ) : (
          <ul>
            {view.inventory.map((item) => (
              <li key={`${item.recipeId}-${item.craftedAt}`}>
                {CATALOG[item.recipeId]?.name ?? item.recipeId}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
