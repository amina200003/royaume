import type { ReactNode } from 'react'

export type EntityKind =
  | 'village'
  | 'wood'
  | 'stone'
  | 'gold'
  | 'sawmill'
  | 'quarry'
  | 'mine'
  | (string & {})

export interface EntityProps {
  kind: EntityKind
  showLabel?: boolean
  className?: string
  children?: ReactNode
}

const ENTITY_CONFIG: Record<string, { label: string; icon: string }> = {
  village: { label: 'Village', icon: '🏰' },
  wood: { label: 'Bois', icon: '🪵' },
  stone: { label: 'Pierre', icon: '🪨' },
  gold: { label: 'Or', icon: '🪙' },
  sawmill: { label: 'Scierie', icon: '🪓' },
  quarry: { label: 'Carrière', icon: '⛏️' },
  mine: { label: 'Mine', icon: '🪙' },
}

export function Entity({ kind, showLabel = false, className, children }: EntityProps) {
  const entity = ENTITY_CONFIG[kind]
  const icon = entity?.icon ?? '📦'
  const label = entity?.label ?? kind

  return (
    <span className={className} title={label}>
      <span>{icon}</span>
      {showLabel && <span> {label}</span>}
      {children}
    </span>
  )
}
