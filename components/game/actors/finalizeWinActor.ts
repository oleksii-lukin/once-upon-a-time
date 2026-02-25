import { fromPromise } from 'xstate'
import { createClient } from '@/utils/supabase/client'
import { validateUUID } from '../validation'

const supabase = createClient()

/**
 * Input interface for the finalizeWinActor
 * Handles finalizing a game win and updating game/lobby status
 */
export interface FinalizeWinActorInput {
  /** The game session ID - must be a valid UUID */
  gameSessionId: string
  /** The winner player ID - must be a valid UUID */
  winnerId: string
  /** The lobby ID - must be a valid UUID */
  lobbyId: string
}

/**
 * Validates FinalizeWinActorInput parameters
 * @param input - The input to validate
 * @throws Error if any parameter is invalid
 */
export function validateFinalizeWinActorInput(input: unknown): asserts input is FinalizeWinActorInput {
  if (!input || typeof input !== 'object') {
    throw new Error('FinalizeWinActorInput must be an object')
  }

  const typedInput = input as Record<string, unknown>

  validateUUID(typedInput.gameSessionId, 'gameSessionId')
  validateUUID(typedInput.winnerId, 'winnerId')
  validateUUID(typedInput.lobbyId, 'lobbyId')
}

/**
 * Actor that handles finalizing a game win and completing the game session.
 *
 * This actor performs the critical end-game operations that officially conclude
 * a game session by recording the winner and updating both the game session
 * and lobby status to reflect the completed state.
 *
 * ## Functionality
 * Performs two key database operations:
 * 1. Updates the game session with the winner and sets status to 'COMPLETED'
 * 2. Updates the associated lobby status to 'finished'
 *
 * ## Database Operations
 * - Updates `game_sessions` table with `winner_id` and `status = 'COMPLETED'`
 * - Updates `lobbies` table with `status = 'finished'`
 * - Operations are performed sequentially to ensure proper state transitions
 *
 * ## Input Parameters
 * @param input.gameSessionId - UUID of the game session to finalize
 * @param input.winnerId - UUID of the player who won the game
 * @param input.lobbyId - UUID of the lobby associated with the game session
 *
 * ## Return Value
 * @returns Promise<boolean> - Returns true on successful completion of both operations
 *
 * ## Error Conditions
 * @throws {Error} When input validation fails (missing or invalid parameters)
 * @throws {Error} When the game session update fails
 * @throws {Error} When the lobby update fails
 * @throws {Error} When the game session or lobby records are not found
 * @throws {Error} When the winner ID is not a valid player in the game
 *
 * ## Game Completion Flow
 * This actor is the final step in the game completion sequence:
 * 1. Game determines a winner based on rules
 * 2. Game machine invokes this actor with winner information
 * 3. Database is updated to reflect completed state
 * 4. Players are notified of game completion
 * 5. Lobby becomes available for new games or cleanup
 *
 * ## State Transitions
 * - Game Session: 'IN_PROGRESS' → 'COMPLETED'
 * - Lobby: 'in_game' → 'finished'
 * - Players: Active gameplay → Post-game state
 *
 * ## Integration Notes
 * This actor should be invoked when:
 * - A player achieves the winning condition
 * - Game rules determine a winner through scoring
 * - Game ends due to special win conditions
 * - Administrative game termination with declared winner
 *
 * The parent machine should handle post-completion tasks:
 * - Player notifications and celebrations
 * - Statistics recording and leaderboard updates
 * - Cleanup of temporary game state
 * - Navigation back to lobby or main menu
 *
 * ## Usage Examples
 *
 * ### Standard Win Condition
 * ```typescript
 * // When a player achieves winning condition
 * invoke: {
 *   src: 'finalizeWinActor',
 *   input: ({ context }) => ({
 *     gameSessionId: context.gameSessionId,
 *     winnerId: context.currentPlayerId,
 *     lobbyId: context.lobbyId
 *   }),
 *   onDone: {
 *     target: 'gameCompleted',
 *     actions: [
 *       'celebrateWinner',
 *       'updatePlayerStats',
 *       'notifyAllPlayers'
 *     ]
 *   },
 *   onError: {
 *     target: 'finalizationError',
 *     actions: 'handleFinalizationError'
 *   }
 * }
 * ```
 *
 * ### Scoring-Based Win
 * ```typescript
 * // After calculating final scores
 * const winner = players.reduce((prev, current) =>
 *   prev.score > current.score ? prev : current
 * )
 *
 * invoke: {
 *   src: 'finalizeWinActor',
 *   input: {
 *     gameSessionId: context.gameSessionId,
 *     winnerId: winner.id,
 *     lobbyId: context.lobbyId
 *   }
 * }
 * ```
 *
 * ### Administrative Game End
 * ```typescript
 * // When game is ended by admin or timeout
 * on: {
 *   ADMIN_END_GAME: {
 *     target: 'finalizingGame',
 *     actions: assign({
 *       declaredWinner: ({ event }) => event.winnerId
 *     })
 *   }
 * },
 * states: {
 *   finalizingGame: {
 *     invoke: {
 *       src: 'finalizeWinActor',
 *       input: ({ context }) => ({
 *         gameSessionId: context.gameSessionId,
 *         winnerId: context.declaredWinner,
 *         lobbyId: context.lobbyId
 *       })
 *     }
 *   }
 * }
 * ```
 *
 * ## Post-Completion Considerations
 * After successful finalization:
 * - **Data Persistence**: Game results are permanently recorded
 * - **Lobby Cleanup**: Lobby may need cleanup or reset for new games
 * - **Player State**: Players should be transitioned out of game mode
 * - **Statistics**: Consider updating player statistics and achievements
 * - **Notifications**: All participants should be informed of completion
 *
 * ## Error Recovery
 * If finalization fails:
 * - Game state may be inconsistent
 * - Manual intervention may be required
 * - Consider retry mechanisms for transient failures
 * - Preserve game state for potential recovery
 *
 * @see {@link FinalizeWinActorInput} for input interface details
 * @see {@link validateFinalizeWinActorInput} for validation logic
 */
/**
 * Core logic for finalizing win - separated from XState for reuse
 */
export async function executeFinalizeWin(input: FinalizeWinActorInput): Promise<boolean> {
  // Validate input parameters
  validateFinalizeWinActorInput(input)

  // Update the game session with winner and completion status
  const { error } = await supabase
    .from('game_sessions')
    .update({
      winner_id: input.winnerId,
      status: 'COMPLETED',
    })
    .eq('id', input.gameSessionId)

  if (error) throw error

  // Update the lobby status to finished
  await supabase
    .from('lobbies')
    .update({ status: 'finished' })
    .eq('id', input.lobbyId)

  return true
}

export const finalizeWinActor = fromPromise(async ({ input }: { input: FinalizeWinActorInput }) => {
  return executeFinalizeWin(input)
})
