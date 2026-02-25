/**
 * Object Actor for XState Game Machine
 *
 * Handles objecting to a played card by returning it to the storyteller's hand
 * and removing it from the played cards table. This actor is invoked when a
 * player objects to a card played by the storyteller.
 *
 * @module objectActor
 */

import { fromPromise } from 'xstate'
import { createClient } from '@/utils/supabase/client'
import { validateUUID } from '../validation'

const supabase = createClient()

/**
 * Input interface for the objectActor
 * Handles objecting to a played card and returning it to the storyteller's hand
 */
export interface ObjectActorInput {
  /** The game session ID - must be a valid UUID */
  gameSessionId: string
  /** The played card ID to object to - must be a valid UUID */
  playedCardId: string
  /** The storyteller player ID - must be a valid UUID */
  storytellerId: string
  /** The next player ID after the objection - must be a valid UUID */
  nextPlayerId: string
}

/**
 * Validates ObjectActorInput parameters
 * @param input - The input to validate
 * @throws Error if any parameter is invalid
 */
export function validateObjectActorInput(input: unknown): asserts input is ObjectActorInput {
  if (!input || typeof input !== 'object') {
    throw new Error('ObjectActorInput must be an object')
  }

  const typedInput = input as Record<string, unknown>

  validateUUID(typedInput.gameSessionId, 'gameSessionId')
  validateUUID(typedInput.playedCardId, 'playedCardId')
  validateUUID(typedInput.storytellerId, 'storytellerId')
  validateUUID(typedInput.nextPlayerId, 'nextPlayerId')
}

/**
 * Actor that handles objecting to a played card
 *
 * This actor performs the following operations:
 * 1. Fetches the played card from the database
 * 2. Returns the card to the storyteller's hand
 * 3. Removes the card from the played cards table
 *
 * @param input - The object actor input parameters
 * @param input.gameSessionId - The game session ID
 * @param input.playedCardId - The ID of the played card to object to
 * @param input.storytellerId - The ID of the storyteller who played the card
 * @param input.nextPlayerId - The ID of the next player after the objection
 *
 * @returns Promise<ObjectActorInput> - Returns the input data when the objection is successfully processed
 *
 * @throws {Error} When the played card is not found or database operations fail
 *
 * @example
 * ```typescript
 * // Used within XState machine
 * invoke: {
 *   src: 'objectActor',
 *   input: {
 *     gameSessionId: 'uuid-123',
 *     playedCardId: 'card-456',
 *     storytellerId: 'player-789',
 *     nextPlayerId: 'player-012'
 *   }
 * }
 * ```
 */
/**
 * Core logic for objecting to a card - separated from XState for reuse
 */
export async function executeObject(input: ObjectActorInput): Promise<ObjectActorInput> {
  // Validate input parameters
  validateObjectActorInput(input)

  // Fetch the played card to get the card_id
  const { data: playedCard, error: fetchError } = await supabase
    .from('played_cards')
    .select('*')
    .eq('id', input.playedCardId)
    .single()

  if (fetchError || !playedCard) {
    throw fetchError || new Error('Played card not found')
  }

  // Return the card to the storyteller's hand
  await supabase
    .from('player_hands')
    .insert({
      game_session_id: input.gameSessionId,
      player_id: input.storytellerId,
      card_id: playedCard.card_id,
      position: 0,
    })

  // Remove the card from played cards
  await supabase
    .from('played_cards')
    .delete()
    .eq('id', input.playedCardId)

  return input
}

export const objectActor = fromPromise(async ({ input }: { input: ObjectActorInput }) => {
  return executeObject(input)
})
