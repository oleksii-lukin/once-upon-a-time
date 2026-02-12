import { type GameContext } from '../gameTypes'

export const isTimerEnabled = ({ context }: { context: GameContext }) =>
  context.timerDuration > 0 && context.pacingDelay > 0

export const needsTimerSync = ({ context }: { context: GameContext }) =>
  !!context.timerSyncInput

export const isTimerExpired = ({ context }: { context: GameContext }) =>
  context.timerSyncInput?.newExpiresAt && new Date(context.timerSyncInput.newExpiresAt) < new Date()

export const isTimerExtensionNeeded = ({ context }: { context: GameContext }) =>
  context.timerSyncInput?.action === 'extend'
