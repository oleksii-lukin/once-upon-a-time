import { assign, type DoneActorEvent, type ErrorActorEvent } from 'xstate'
import { type GameContext, type GameEvent, type GameActors } from '../gameTypes'

/**
 * XState actions for database persistence management
 */

/**
 * Flags that a turn pass is pending database confirmation
 */
export const assignPendingPassTurn = assign<GameContext, GameEvent, undefined, GameEvent, GameActors>({
  pendingPassTurn: true,
})

/**
 * Assigns the last played card ID and clears pending confirmation
 */
export const assignLastPlayedCardAndClearPending = assign<GameContext, DoneActorEvent<{ id: string }>, undefined, GameEvent, GameActors>({
  lastPlayedCardId: ({ event }) => event.output.id,
  pendingConfirmCardId: null,
})

/**
 * Assigns database persistence error and rolls back optimistic state
 */
export const assignPersistenceError = assign<GameContext, ErrorActorEvent, undefined, GameEvent, GameActors>({
  lastPersistenceError: ({ event }) => {
    const error = event.error as { message?: string } | undefined
    return error?.message || 'Unknown persistence error'
  },
  inFlightHandId: null,
  optimisticCard: null,
})

/**
 * Full state reset after a successful turn update in the database
 */
export const assignResetAfterTurnUpdate = assign<GameContext, GameEvent, undefined, GameEvent, GameActors>({
  currentPlayerId: ({ context }) => context.nextPlayerId,
  optimisticCard: null,
  inFlightHandId: null,
  lastPlayedCardId: null,
  canPlayMoreCards: true,
  pendingConfirmCardId: null,
  pendingPassTurn: false,
})
