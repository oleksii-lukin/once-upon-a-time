import { assign } from 'xstate'
import { type GameContext, type GameEvent, type GameActors, type EventWithNextPlayerId } from '../gameTypes'

import { getNextPlayerId } from '../utils/playerUtils'

/**
 * XState actions for player turn management
 */

/**
 * Calculates and assigns the next player in turn order
 */
export const assignNextPlayer = assign<GameContext, GameEvent, any, any, GameActors>({
  nextPlayerId: ({ context }) => getNextPlayerId(context.players, context.currentPlayerId)
})

/**
 * Syncs current player from database event
 */
export const assignSyncedCurrentPlayer = assign<GameContext, Extract<GameEvent, { type: 'SYNC_CURRENT_PLAYER' }>, any, any, GameActors>({
  currentPlayerId: ({ event }) => event.currentPlayerId,
})

/**
 * Assigns next player from events that contain nextPlayerId
 * Used for INTERRUPT, OBJECT, and CHALLENGE_STUTTER events
 */
export const assignNextPlayerFromEvent = assign<GameContext, EventWithNextPlayerId, any, any, GameActors>({
  nextPlayerId: ({ event }) => event.nextPlayerId,
})

