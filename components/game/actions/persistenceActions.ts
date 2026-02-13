import { assign } from 'xstate'
import { type GameContext, type GameEvent, type GameActors } from '../gameTypes'

/**
 * XState actions for database persistence management
 */

/**
 * Flags that a turn pass is pending database confirmation
 */
export const assignPendingPassTurn = assign<GameContext, GameEvent, any, any, GameActors>({
  pendingPassTurn: true,
})

/**
 * Clears flags for pending pass and card confirmation
 */
export const clearPendingStates = assign<GameContext, GameEvent, any, any, GameActors>({
  pendingConfirmCardId: null,
  pendingPassTurn: false,
})

/**
 * Assigns the last played card ID and clears pending confirmation
 */
export const assignLastPlayedCardAndClearPending = assign<GameContext, any, any, any, GameActors>({
  lastPlayedCardId: ({ event }: { event: any }) => event.output.id,
  pendingConfirmCardId: null,
})

/**
 * Assigns database persistence error and rolls back optimistic state
 */
export const assignPersistenceError = assign<GameContext, any, any, any, GameActors>({
  lastPersistenceError: ({ event }: { event: any }) =>
    (event.error?.message as string) || 'Unknown persistence error',
  inFlightHandId: null,
  optimisticCard: null,
})

/**
 * Full state reset after a successful turn update in the database
 */
export const assignResetAfterTurnUpdate = assign<GameContext, GameEvent, any, any, GameActors>({
  currentPlayerId: ({ context }) => context.nextPlayerId,
  optimisticCard: null,
  inFlightHandId: null,
  lastPlayedCardId: null,
  rulesFinished: false,
  pendingConfirmCardId: null,
  pendingPassTurn: false,
})
