/**
 * Entrée publique « partagée » du module Classement : utilisable par le serveur
 * comme par l'interface.
 */

/** Préfixe utilisé pour les canaux/flux des expéditions (games) */
export const GAME_CHANNEL_PREFIX = 'dungeon-'

/** Ligne du classement, telle qu'elle est présentée aux joueurs. */
export interface RankingEntry {
  rank: number
  playerId: string
  /** Nom du joueur, ou à défaut nom de son village. */
  label: string
  gamesPlayed: number
  gamesWon: number
  /** Or rapporté des expéditions gagnées. */
  gold: number
  /** Nombre d'améliorations de bâtiments du village. */
  upgrades: number
  /** Or rapporté par la meilleure expédition gagnée. */
  bestLoot: number
}

/** Classement renvoyé par l'API. */
export interface Ranking {
  /**
   * Position du journal jusqu'à laquelle le classement est à jour. L'interface la compare
   * à la position des événements annoncés par le canal du classement.
   */
  position: number
  entries: RankingEntry[]
}

/** Nombre de joueurs présentés par le classement. */
export const RANKING_SIZE = 20

/** Nom du canal temps réel du classement, qui ne correspond à aucun flux du journal. */
export const RANKING_CHANNEL = 'ranking'

/**
 * Représente une expédition en attente de joueurs,
 * telle qu'elle est renvoyée par l'API.
 */
export interface OpenGame {
  /** L'identifiant de l'expédition (ex: "7f3a") */
  gameId: string

  /** Le nom du joueur ayant créé l'expédition */
  hostName: string

  /** Le nombre actuel de héros (joueurs + compagnons) dans l'expédition */
  heroCount: number

  /**
   * Date de création (souvent un timestamp en millisecondes ou une chaîne ISO
   * dans les contrats d'API, à adapter selon votre choix)
   */
  createdAt: number // ou string, ou Date
}
