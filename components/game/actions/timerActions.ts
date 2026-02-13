import { assign } from 'xstate'
import { type GameContext, type GameEvent, type GameActors } from '../gameTypes'

/**
 * XState actions for timer management
 */

/**
 * Starts the timer by raising START_TIMER event
 */
export const assignStartTimer = assign<GameContext, GameEvent, any, any, GameActors>({})

/**
 * Stops the timer by raising STOP_TIMER event
 */
export const assignStopTimer = assign<GameContext, GameEvent, any, any, GameActors>({})

/**
 * Syncs timer state from SYNC_TIMER event
 */
export const assignSyncTimer = assign<GameContext, Extract<GameEvent, { type: 'SYNC_TIMER' }>, any, any, GameActors>({})

/**
 * Assigns timer sync input for extending timer after pacing delay
 * Used when a card is confirmed and timer needs to be extended
 */
export const assignTimerSyncInput = assign<GameContext, any, any, any, GameActors>({
  timerSyncInput: ({ context, event }: { context: GameContext, event: any }) => ({
    gameSessionId: context.gameSessionId!,
    isEnabled: context.timerDuration > 0,
    duration: context.timerDuration,
    currentPlayerId: context.currentPlayerId,
    action: 'extend' as const,
    pacingDelay: context.pacingDelay,
    newExpiresAt: event.output.newExpiresAt,
  }),
})

/**
 * Clears timer sync input after sync is complete
 */
export const clearTimerSyncInput = assign<GameContext, GameEvent, any, any, GameActors>({
  timerSyncInput: undefined,
})
