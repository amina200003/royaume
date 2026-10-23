/**
 * Définition des événements du domaine Game (Expédition)
 */

export interface GameCreated {
  type: 'GameCreated'
  data: {
    hostName: string
    at: Date // ou string/number selon comment vous stockez la date
  }
}

export interface PlayerJoined {
  type: 'PlayerJoined'
  data: Record<string, unknown> // À adapter selon les vraies données de votre événement
}

export interface CompanionAdded {
  type: 'CompanionAdded'
  data: Record<string, unknown>
}

export interface GameStarted {
  type: 'GameStarted'
  data: Record<string, unknown>
}

export interface GameEnded {
  type: 'GameEnded'
  data: Record<string, unknown>
}

/**
 * Union de tous les événements possibles pour une expédition.
 * C'est ce type qui est importé par votre projection.
 */
export type GameEvent = GameCreated | PlayerJoined | CompanionAdded | GameStarted | GameEnded
