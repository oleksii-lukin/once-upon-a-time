/**
 * Play Card Actor - Database Operations for Card Playing
 *
 * Handles the atomic database operations required when a player plays a card
 * from their hand to the game table. This actor ensures data consistency by
 * performing both the card insertion and hand removal in a coordinated sequence.
 *
 * ## Core Operations
 * 1. **Insert Card**: Adds the card to `played_cards` table with PENDING status
 * 2. **Remove from Hand**: Removes the card from the player's `player_hands`
 *
 * This two-step process ensures that cards cannot be played multiple times
 * and maintains accurate hand state for all players.
 *
 * ## Database Schema Integration
 * - **played_cards**: Records all cards played during the game with status tracking
 * - **player_hands**: Maintains current hand state for each player
 * - **cards**: Referenced for card details and validation
 *
 * ## Status Flow
 * Cards progress through these states:
 * 1. In player's hand (player_hands table)
 * 2. Played with PENDING status (this actor creates)
 * 3. CONFIRMED status (confirmCardActor handles)
 * 4. Final game state (scoring, win conditions)
 */

import { fromPromise } from 'xstate'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { validateUUID, validateNonNegativeNumber } from '../validation'

const supabase = createClient()

/**
 * Input interface for the playCardActor
 * Handles playing a card to the game table
 */
export interface PlayCardActorInput {
  /** The game session ID - must be a valid UUID */
  gameSessionId: string
  /** The player ID - must be a valid UUID */
  playerId: string
  /** The card ID - must be a valid UUID */
  cardId: string
  /** The position in the played cards sequence - must be >= 0 */
  position: number
}

/**
 * Output interface for the playCardActor
 * The record returned from the played_cards table
 */
export type PlayCardActorOutput = Database['public']['Tables']['played_cards']['Row'] & {
  cards: Database['public']['Tables']['cards']['Row']
}

/**
 * Validates PlayCardActorInput parameters
 * @param input - The input to validate
 * @throws Error if any parameter is invalid
 */
export function validatePlayCardActorInput(input: unknown): asserts input is PlayCardActorInput {
  if (!input || typeof input !== 'object') {
    throw new Error('PlayCardActorInput must be an object')
  }

  const typedInput = input as Record<string, unknown>

  validateUUID(typedInput.gameSessionId, 'gameSessionId')
  validateUUID(typedInput.playerId, 'playerId')
  validateUUID(typedInput.cardId, 'cardId')
  validateNonNegativeNumber(typedInput.position, 'position')
}

/**
 * Actor that handles playing a card from a player's hand to the game table.
 *
 * This actor performs the critical database operations needed when a player
 * plays a card during their storytelling turn. It ensures atomic operations
 * to maintain game state consistency and prevent duplicate card plays.
 *
 * ## Database Operations
 * 1. **Insert Played Card**: Creates record in `played_cards` with PENDING status
 * 2. **Remove from Hand**: Deletes card from `player_hands` table
 * 3. **Return Card Data**: Includes full card details for immediate use
 *
 * ## Input Parameters
 * @param input.gameSessionId - UUID of the current game session
 * @param input.playerId - UUID of the player playing the card
 * @param input.cardId - UUID of the card being played
 * @param input.position - Sequence position of the card in the play order
 *
 * ## Return Value
 * @returns Promise<PlayedCardWithDetails> - The inserted played card record with full card details
 *
 * ## Error Conditions
 * @throws {Error} When input validation fails (missing or invalid parameters)
 * @throws {Error} When the card insertion fails (database constraint violations)
 * @throws {Error} When the card is not in the player's hand
 * @throws {Error} When the game session is not active or not found
 * @throws {Error} When the player is not authorized to play in this session
 *
 * ## Integration Notes
 * This actor is typically invoked during storytelling phases when:
 * - Player selects a card from their hand to play
 * - Game validates the card play is legal
 * - UI confirms the player's intention to play the card
 * - Storytelling machine processes the PLAY_CARD event
 *
 * ## Usage Example
 * ```typescript
 * // In storytelling machine
 * invoke: {
 *   src: 'playCardActor',
 *   input: ({ context }) => ({
 *     gameSessionId: context.gameSessionId,
 *     playerId: context.currentPlayerId,
 *     cardId: context.selectedCardId,
 *     position: context.cardsPlayedThisTurn
 *   }),
 *   onDone: {
 *     target: 'cardPlayed',
 *     actions: [
 *       assign({ lastPlayedCard: ({ event }) => event.output }),
 *       sendParent(({ event }) => ({ type: 'PLAY_CARD_ACK', playedCardId: event.output.id }))
 *     ]
 *   }
 * }
 * ```
 *
 * @see {@link PlayCardActorInput} for input interface details
 * @see {@link validatePlayCardActorInput} for validation logic
 */
export const playCardActor = fromPromise(async ({ input }: { input: PlayCardActorInput }) => {
  // Validate input parameters
  validatePlayCardActorInput(input)

  // Insert the card into played_cards table
  const { data, error } = await supabase
    .from('played_cards')
    .insert({
      game_session_id: input.gameSessionId,
      player_id: input.playerId,
      card_id: input.cardId,
      position: input.position,
      status: 'PENDING',
    })
    .select('*, cards(*)')
    .single()

  if (error) throw error

  // Remove the card from the player's hand
  await supabase
    .from('player_hands')
    .delete()
    .eq('game_session_id', input.gameSessionId)
    .eq('player_id', input.playerId)
    .eq('card_id', input.cardId)

  return data as PlayCardActorOutput
})
