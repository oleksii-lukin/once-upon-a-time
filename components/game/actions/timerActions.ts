import { assign } from 'xstate'
import { type GameContext } from '../gameTypes'

/**
 * XState actions for timer management
 */

export const assignTimerSyncInput = (
  action: 'start' | 'stop' | 'sync' | 'extend',
  isEnabled?: boolean,
  newExpiresAt?: string,
) => assign(({ context }: { context: GameContext }) => ({
  timerSyncInput: {
    gameSessionId: context.gameSessionId!,
    isEnabled: isEnabled ?? context.timerDuration > 0,
    duration: context.timerDuration,
    currentPlayerId: context.currentPlayerId,
    action,
    pacingDelay: context.pacingDelay,
    newExpiresAt,
  },
}))

export const clearTimerSyncInput = assign({
  timerSyncInput: undefined,
})
