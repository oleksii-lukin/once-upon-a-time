import { fromPromise } from 'xstate'
import { createClient } from '@/utils/supabase/client'

const supabase = createClient()

/**
 * Input interface for the timerSyncActor
 * Handles synchronizing timer state across all players
 */
export interface TimerSyncInput {
  /** The game session ID - must be a valid UUID */
  gameSessionId: string
  /** Whether the timer is enabled */
  isEnabled: boolean
  /** Timer duration in seconds */
  duration: number
  /** Current player ID - must be a valid UUID */
  currentPlayerId: string | null
  /** Action to perform: start, stop, or sync */
  action: 'start' | 'stop' | 'sync' | 'extend'
  /** Pacing delay duration in seconds (for timer extension logic) */
  pacingDelay?: number
  /** Specific expiration timestamp (for extend action) */
  newExpiresAt?: string
}

/**
 * Output interface for the timerSyncActor
 * Contains the result of the timer synchronization operation
 */
export interface TimerSyncOutput {
  /** Whether the operation was successful */
  success: boolean
  /** When the timer was started (ISO string) */
  timerStartedAt?: string
  /** When the timer expires (ISO string) */
  timerExpiresAt?: string
  /** Error message if operation failed */
  error?: string
}

/**
 * Validates TimerSyncInput parameters
 * @param input - The input to validate
 * @throws Error if any parameter is invalid
 */
export function validateTimerSyncInput(input: unknown): asserts input is TimerSyncInput {
  if (!input || typeof input !== 'object') {
    throw new Error('TimerSyncInput must be an object')
  }

  const typedInput = input as Record<string, unknown>

  if (!typedInput.gameSessionId || typeof typedInput.gameSessionId !== 'string') {
    throw new Error('gameSessionId is required and must be a string')
  }

  if (typeof typedInput.isEnabled !== 'boolean') {
    throw new Error('isEnabled must be a boolean')
  }

  if (typeof typedInput.duration !== 'number' || typedInput.duration < 0) {
    throw new Error('duration must be a non-negative number')
  }

  if (typedInput.currentPlayerId !== null && typeof typedInput.currentPlayerId !== 'string') {
    throw new Error('currentPlayerId must be null or a string')
  }

  if (!['start', 'stop', 'sync', 'extend'].includes(typedInput.action as string)) {
    throw new Error('action must be one of: start, stop, sync, extend')
  }
}

/**
 * Timer synchronization actor for managing turn timers across all players
 *
 * ## Purpose
 * Ensures all players see the same timer countdown by storing timer state
 * in the database and broadcasting changes via Supabase realtime.
 *
 * ## Actions
 * - **start**: Begin timer for current player with specified duration
 * - **stop**: Clear timer (when turn ends or game completes)
 * - **sync**: Update timer settings without changing timestamps
 *
 * ## Database Updates
 * Updates game_sessions table with:
 * - timer_enabled: Whether timer is active
 * - timer_duration: Duration in seconds
 * - timer_started_at: When current timer started
 * - timer_expires_at: When current timer expires
 *
 * @param input - Timer synchronization parameters
 * @returns Promise<TimerSyncOutput> - Operation result
 */
/**
 * Core logic for timer synchronization - separated from XState for reuse
 */
export async function executeTimerSync(input: TimerSyncInput): Promise<TimerSyncOutput> {
  // Validate input parameters
  validateTimerSyncInput(input)

  const { gameSessionId, isEnabled, duration, currentPlayerId, action, pacingDelay = 0 } = input
  const now = new Date().toISOString()

  try {
    if (action === 'start' && isEnabled && currentPlayerId) {
      // Calculate the minimum time needed (pacing delay + 5 seconds buffer)
      const minimumTimeNeeded = pacingDelay + 5
      let finalDuration = duration

      // If duration is less than minimum needed, extend it
      if (duration < minimumTimeNeeded) {
        finalDuration = minimumTimeNeeded
      }

      // Start timer for current player with potentially extended duration
      const expiresAt = new Date(Date.now() + finalDuration * 1000).toISOString()

      const { error } = await supabase
        .from('game_sessions')
        .update({
          timer_enabled: true,
          timer_duration: finalDuration, // Store the actual duration used
          timer_started_at: now,
          timer_expires_at: expiresAt,
          updated_at: now,
        })
        .eq('id', gameSessionId)

      if (error) throw error

      return {
        success: true,
        timerStartedAt: now,
        timerExpiresAt: expiresAt,
      }
    }
    else if (action === 'stop') {
      // Stop timer
      const { error } = await supabase
        .from('game_sessions')
        .update({
          timer_started_at: null,
          timer_expires_at: null,
          updated_at: now,
        })
        .eq('id', gameSessionId)

      if (error) throw error

      return {
        success: true,
      }
    }
    else if (action === 'extend' && isEnabled) {
      // Extend current timer without changing start time
      const finalExpiresAt = input.newExpiresAt || new Date(Date.now() + (pacingDelay + 5) * 1000).toISOString()
      const { error } = await supabase
        .from('game_sessions')
        .update({
          timer_expires_at: finalExpiresAt,
          updated_at: now,
        })
        .eq('id', gameSessionId)

      if (error) throw error

      return {
        success: true,
        timerExpiresAt: finalExpiresAt,
      }
    }
    else if (action === 'sync') {
      // Just update timer settings without changing timestamps
      const { error } = await supabase
        .from('game_sessions')
        .update({
          timer_enabled: isEnabled,
          timer_duration: duration,
          updated_at: now,
        })
        .eq('id', gameSessionId)

      if (error) throw error

      return {
        success: true,
      }
    }

    return {
      success: true,
    }
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export const timerSyncActor = fromPromise(async ({ input }: { input: TimerSyncInput }): Promise<TimerSyncOutput> => {
  return executeTimerSync(input)
})
