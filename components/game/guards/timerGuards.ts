import { type GameContext } from '../gameTypes'

export const isTimerEnabled = ({ context }: { context: GameContext }) =>
  context.timerDuration > 0 && context.pacingDelay > 0

export const needsTimerSync = ({ context }: { context: GameContext }) =>
  !!context.timerSyncInput

export const isTimerExpired = ({ context }: { context: GameContext }) =>
  context.timerSyncInput?.newExpiresAt && new Date(context.timerSyncInput.newExpiresAt) < new Date()

export const isTimerExtensionNeeded = ({ context }: { context: GameContext }) =>
  context.timerSyncInput?.action === 'extend'

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
