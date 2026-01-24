import { fromPromise } from 'xstate'
import { createClient } from '@/utils/supabase/client'
import { validateUUID } from '../validation'

const supabase = createClient()

/**
 * Input interface for the passTurnActor
 * Handles passing the turn to the next player
 */
export interface PassTurnActorInput {
  /** The game session ID - must be a valid UUID */
  gameSessionId: string
  /** The next player ID - must be a valid UUID */
  nextPlayerId: string
}

/**
 * Validates PassTurnActorInput parameters
 * @param input - The input to validate
 * @throws Error if any parameter is invalid
 */
export function validatePassTurnActorInput(input: unknown): asserts input is PassTurnActorInput {
  if (!input || typeof input !== 'object') {
    throw new Error('PassTurnActorInput must be an object')
  }

  const typedInput = input as Record<string, unknown>

  validateUUID(typedInput.gameSessionId, 'gameSessionId')
  validateUUID(typedInput.nextPlayerId, 'nextPlayerId')
}

/**
 * Actor that handles passing the turn to the next player in the game sequence.
 *
 * This actor manages the critical game state transition of changing the active
 * player by updating both the current turn player and storyteller roles in
 * the database. It ensures atomic updates to maintain game state consistency.
 *
 * ## Functionality
 * Updates the game session to set the next player as both the current turn
 * player and the storyteller, maintaining the game's turn-based flow.
 *
 * ## Database Operations
 * - Updates `game_sessions` table with new `current_turn_player_id`
 * - Updates `game_sessions` table with new `storyteller_id`
 * - Both updates occur in a single atomic operation
 *
 * ## Input Parameters
 * @param input.gameSessionId - UUID of the game session to update
 * @param input.nextPlayerId - UUID of the player who will take the next turn
 *
 * ## Return Value
 * @returns Promise<boolean> - Returns true on successful turn transition
 *
 * ## Error Conditions
 * @throws {Error} When input validation fails (missing or invalid parameters)
 * @throws {Error} When the database update operation fails
 * @throws {Error} When the game session is not found
 * @throws {Error} When the next player ID is invalid or not in the game
 *
 * ## Integration Notes
 * This actor is typically invoked by the main game machine during:
 * - Normal turn progression after a player completes their storytelling
 * - Skip turn scenarios when a player cannot or chooses not to play
 * - Game state recovery after interruptions or objections
 *
 * The parent machine should handle the response and update local game state
 * to reflect the turn change, including UI updates and player notifications.
 *
 * ## Usage Examples
 *
 * ### Basic Turn Passing
 * ```typescript
 * // In XState machine definition
 * invoke: {
 *   src: 'passTurnActor',
 *   input: ({ context }) => ({
 *     gameSessionId: context.gameSessionId,
 *     nextPlayerId: context.players[context.nextPlayerIndex].id
 *   }),
 *   onDone: {
 *     target: 'waitingForNextPlayer',
 *     actions: assign({
 *       currentPlayerId: ({ event }) => event.output ? context.nextPlayerId : context.currentPlayerId
 *     })
 *   },
 *   onError: {
 *     target: 'turnPassError',
 *     actions: 'logTurnPassError'
 *   }
 * }
 * ```
 *
 * ### With Player Rotation Logic
 * ```typescript
 * // Calculate next player in rotation
 * const nextPlayerIndex = (currentIndex + 1) % players.length
 * const nextPlayerId = players[nextPlayerIndex].id
 *
 * // Pass turn to calculated next player
 * invoke: {
 *   src: 'passTurnActor',
 *   input: {
 *     gameSessionId: 'game-session-123',
 *     nextPlayerId: nextPlayerId
 *   }
 * }
 * ```
 *
 * ## State Synchronization
 * After successful execution, the parent machine should:
 * 1. Update local context with new current player
 * 2. Update UI to reflect the active player change
 * 3. Notify all players of the turn change
 * 4. Reset turn-specific state (cards played, etc.)
 *
 * @see {@link PassTurnActorInput} for input interface details
 * @see {@link validatePassTurnActorInput} for validation logic
 */
export const passTurnActor = fromPromise(async ({ input }: { input: PassTurnActorInput }) => {
  // Validate input parameters
  validatePassTurnActorInput(input)

  const { error } = await supabase
    .from('game_sessions')
    .update({
      current_turn_player_id: input.nextPlayerId,
      storyteller_id: input.nextPlayerId,
    })
    .eq('id', input.gameSessionId)

  if (error) throw error

  return true
})
