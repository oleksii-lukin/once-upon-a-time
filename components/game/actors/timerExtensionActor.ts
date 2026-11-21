import { fromPromise } from 'xstate'
import { createClient } from '@/utils/supabase/client'

const supabase = createClient()

/**
 * Input interface for the timerExtensionActor
 * Checks if timer needs extension for pacing delay
 */
export interface TimerExtensionInput {
  /** The game session ID - must be a valid UUID */
  gameSessionId: string
  /** Timer duration in seconds */
  timerDuration: number
  /** Pacing delay duration in seconds */
  pacingDelay: number
}

/**
 * Output interface for the timerExtensionActor
 * Contains whether timer extension is needed
 */
export interface TimerExtensionOutput {
  /** Whether timer extension is needed */
  needsExtension: boolean
  /** The new expiration timestamp if extension is needed */
  newExpiresAt?: string
}

/**
 * Validates TimerExtensionInput parameters
 * @param input - The input to validate
 * @throws Error if any parameter is invalid
 */
export function validateTimerExtensionInput(input: unknown): asserts input is TimerExtensionInput {
  if (!input || typeof input !== 'object') {
    throw new Error('TimerExtensionInput must be an object')
  }

  const typedInput = input as Record<string, unknown>

  if (!typedInput.gameSessionId || typeof typedInput.gameSessionId !== 'string') {
    throw new Error('gameSessionId is required and must be a string')
  }

  if (typeof typedInput.timerDuration !== 'number' || typedInput.timerDuration < 0) {
    throw new Error('timerDuration must be a non-negative number')
  }

  if (typeof typedInput.pacingDelay !== 'number' || typedInput.pacingDelay < 0) {
    throw new Error('pacingDelay must be a non-negative number')
  }
}

/**
 * Timer extension actor for checking if timer needs extension for pacing delay
 *
 * ## Purpose
 * Checks if the current remaining time is sufficient for the pacing delay.
 * If not, signals that timer extension is needed.
 *
 * ## Logic
 * - Gets current timer state from database
 * - Calculates remaining time
 * - Compares with minimum needed (pacing delay + 5 seconds buffer)
 * - Returns whether extension is needed
 *
 * @param input - Timer extension check parameters
 * @returns Promise<TimerExtensionOutput> - Whether extension is needed
 */
export const timerExtensionActor = fromPromise(async ({ input }: { input: TimerExtensionInput }): Promise<TimerExtensionOutput> => {
  // Validate input parameters
  validateTimerExtensionInput(input)

  const { gameSessionId, timerDuration, pacingDelay } = input

  // Only check extension if both timer and pacing delay are enabled
  if (timerDuration <= 0 || pacingDelay <= 0) {
    return { needsExtension: false }
  }

  try {
    // Get current timer state from database
    const { data: gameSession } = await supabase
      .from('game_sessions')
      .select('timer_expires_at')
      .eq('id', gameSessionId)
      .single()

    if (!gameSession?.timer_expires_at) {
      return { needsExtension: false }
    }

    const now = new Date().getTime()
    const expires = new Date(gameSession.timer_expires_at).getTime()
    const remainingTime = Math.max(0, Math.ceil((expires - now) / 1000))

    // Calculate minimum time needed (pacing delay + 5 seconds buffer)
    const minimumTimeNeeded = pacingDelay + 5

    // If remaining time is less than minimum needed, extension is required
    const needsExtension = remainingTime > 0 && remainingTime < minimumTimeNeeded
    let newExpiresAt: string | undefined

    if (needsExtension) {
      // Calculate new expiration: current time + minimum time needed
      newExpiresAt = new Date(now + minimumTimeNeeded * 1000).toISOString()
    }

    return { needsExtension, newExpiresAt }
  }
  catch (error) {
    console.error('Error checking timer extension:', error)
    return { needsExtension: false }
  }
})
