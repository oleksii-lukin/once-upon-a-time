import { type GameContext } from '../gameTypes'

export const isTimerEnabled = ({ context }: { context: GameContext }) =>
  context.timerDuration > 0 && context.pacingDelay > 0

/**
 * Checks if timer should be synced (Solo mode only)
 */
export const shouldSyncTimerForSolo = ({ context }: { context: GameContext }) =>
  context.timerDuration > 0 && context.gameMode === 'solo'

/**
 * Checks if timer extension is needed from actor output
 */
export const needsTimerExtension = ({ event }: { event: any }) =>
  event.output?.needsExtension
