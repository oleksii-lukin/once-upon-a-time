import { playCardActor } from './actors/playCardActor'

// Re-export actor types
export { type PlayCardActorInput, type PlayCardActorOutput } from './actors/playCardActor'

/**
 * Minimal context for the snapshot game machine
 */
export interface GameContext {
  /** The current game session ID */
  gameSessionId: string | null
  /** ID of the player whose turn it currently is */
  currentPlayerId: string | null
  /** ID of the hand being processed for card operations */
  inFlightHandId: string | null
}

/**
 * Minimal event types for the snapshot
 */
export type GameEvent
  = | { type: 'START_GAME', gameSessionId: string, currentPlayerId: string }
  | { type: 'PLAY_CARD', cardId: string, position: number }
  | { type: 'CARD_PLAYED', playedCardId: string }

export type GameActors =
  | { src: 'playCardActor', logic: typeof playCardActor, id: string }
