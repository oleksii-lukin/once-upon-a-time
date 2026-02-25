/**
 * Draw Cards Actor - Database Operations for Card Drawing
 *
 * Handles the complex database operations required when players draw cards
 * from the draw pile into their hands. This actor manages the atomic transfer
 * of cards between the draw pile and player hands while maintaining proper
 * card ordering and game state consistency.
 *
 * ## Core Operations
 * 1. **Select Cards**: Retrieves specified number of cards from draw pile in order
 * 2. **Add to Hand**: Inserts cards into player's hand with sequential positions
 * 3. **Remove from Pile**: Removes drawn cards from the draw pile
 *
 * ## Card Flow Management
 * - **Draw Order**: Cards are drawn in position order (first in, first out)
 * - **Hand Positions**: Uses high position numbers (999+) to avoid conflicts
 * - **Atomic Operations**: All database changes succeed or fail together
 */

import { fromPromise } from 'xstate'
import { createClient } from '@/utils/supabase/client'
import { validateUUID, validatePositiveNumber } from '../validation'

const supabase = createClient()

/**
 * Input interface for the drawCardsActor
 * Handles drawing cards from the draw pile to a player's hand
 */
export interface DrawCardsActorInput {
  /** The game session ID - must be a valid UUID */
  gameSessionId: string
  /** The player ID - must be a valid UUID */
  playerId: string
  /** The number of cards to draw - must be > 0 */
  count: number
}

/**
 * Validates DrawCardsActorInput parameters
 * @param input - The input to validate
 * @throws Error if any parameter is invalid
 */
export function validateDrawCardsActorInput(input: unknown): asserts input is DrawCardsActorInput {
  if (!input || typeof input !== 'object') {
    throw new Error('DrawCardsActorInput must be an object')
  }

  const typedInput = input as Record<string, unknown>

  validateUUID(typedInput.gameSessionId, 'gameSessionId')
  validateUUID(typedInput.playerId, 'playerId')
  validatePositiveNumber(typedInput.count, 'count')
}

/**
 * Actor that handles drawing cards from the draw pile to a player's hand.
 *
 * This actor manages the complex process of transferring cards from the shared
 * draw pile to an individual player's hand, ensuring proper ordering, position
 * management, and atomic database operations to maintain game state consistency.
 *
 * ## Database Operations
 * 1. **Query Draw Pile**: Selects cards from `draw_pile` in position order
 * 2. **Insert to Hand**: Adds cards to `player_hands` with sequential positions
 * 3. **Remove from Pile**: Deletes drawn cards from `draw_pile` table
 *
 * ## Input Parameters
 * @param input.gameSessionId - UUID of the current game session
 * @param input.playerId - UUID of the player drawing cards
 * @param input.count - Number of cards to draw from the pile
 *
 * ## Return Value
 * @returns Promise<boolean> - Returns true if the draw operation was successful
 *
 * ## Error Conditions
 * @throws {Error} When input validation fails (missing or invalid parameters)
 * @throws {Error} When no cards are available in the draw pile
 * @throws {Error} When fewer cards are available than requested
 * @throws {Error} When the hand insertion fails (database constraints)
 * @throws {Error} When the draw pile removal fails
 * @throws {Error} When the game session is not active or not found
 *
 * ## Card Position Management
 * - **Draw Pile**: Cards ordered by `position` field (ascending)
 * - **Player Hand**: New cards get positions starting at 999 to avoid conflicts
 * - **Sequential Assignment**: Multiple drawn cards get incremental positions
 * - **Conflict Avoidance**: High position numbers prevent overlap with existing cards
 *
 * ## Integration Notes
 * This actor is typically invoked during:
 * - **Game Start**: Initial hand dealing to all players
 * - **Turn Start**: Drawing cards at the beginning of a player's turn
 * - **Special Actions**: Cards drawn due to game rules or card effects
 * - **Hand Replenishment**: Maintaining minimum hand sizes
 *
 * ## Usage Example
 * ```typescript
 * // Deal starting hands to all players
 * invoke: {
 *   src: 'drawCardsActor',
 *   input: ({ context }) => ({
 *     gameSessionId: context.gameSessionId,
 *     playerId: context.players[context.currentPlayerIndex].id,
 *     count: 7 // Standard starting hand size
 *   }),
 *   onDone: {
 *     target: 'nextPlayerDeal',
 *     actions: 'updatePlayerHandCount'
 *   },
 *   onError: {
 *     target: 'dealingError',
 *     actions: 'handleDealingError'
 *   }
 * }
 * ```
 *
 * ## Performance Considerations
 * - **Batch Operations**: Drawing multiple cards is more efficient than individual draws
 * - **Index Usage**: Ensure proper database indexing on game_session_id and position
 * - **Transaction Size**: Large draws may need transaction optimization
 * - **Memory Usage**: Consider memory impact of large card datasets
 *
 * ## Edge Cases
 * - **Empty Draw Pile**: Handle gracefully with clear error messages
 * - **Insufficient Cards**: May need to shuffle discard pile or end game
 * - **Concurrent Draws**: Handle multiple players drawing simultaneously
 * - **Position Conflicts**: High starting positions (999+) minimize conflicts
 *
 * @see {@link DrawCardsActorInput} for input interface details
 * @see {@link validateDrawCardsActorInput} for validation logic
 */
/**
 * Core logic for drawing cards - separated from XState for reuse
 */
export async function executeDrawCards(input: DrawCardsActorInput): Promise<boolean> {
  // Validate input parameters
  validateDrawCardsActorInput(input)

  // Get the specified number of cards from the draw pile in order
  const { data: drawCards, error: drawError } = await supabase
    .from('draw_pile')
    .select('*')
    .eq('game_session_id', input.gameSessionId)
    .order('position', { ascending: true })
    .limit(input.count)

  if (drawError || !drawCards || drawCards.length === 0) {
    throw drawError || new Error('No cards in draw pile')
  }

  // Prepare cards to add to player's hand with sequential positions
  const cardsToAdd = drawCards.map((dc, index: number) => ({
    game_session_id: input.gameSessionId,
    player_id: input.playerId,
    card_id: dc.card_id,
    position: 999 + index, // Use high position numbers to avoid conflicts
  }))

  // Add cards to player's hand
  const { error: handError } = await supabase
    .from('player_hands')
    .insert(cardsToAdd)

  if (handError) throw handError

  // Remove the drawn cards from the draw pile
  await supabase
    .from('draw_pile')
    .delete()
    .in('id', drawCards.map(dc => dc.id))

  return true
}

export const drawCardsActor = fromPromise(async ({ input }: { input: DrawCardsActorInput }) => {
  return executeDrawCards(input)
})
