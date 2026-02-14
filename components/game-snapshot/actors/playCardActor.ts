/**
 * Play Card Actor - Simplified snapshot version
 *
 * Handles playing a card from a player's hand to the game table.
 */

import { fromPromise } from 'xstate'

/**
 * Input interface for the playCardActor
 */
export interface PlayCardActorInput {
  /** The game session ID */
  gameSessionId: string
  /** The player ID */
  playerId: string
  /** The card ID */
  cardId: string
  /** The position in the played cards sequence */
  position: number
}

/**
 * Output interface for the playCardActor
 */
export interface PlayCardActorOutput {
  /** The ID of the played card record */
  id: string
  /** The card ID that was played */
  cardId: string
}

/**
 * Actor that handles playing a card from a player's hand to the game table.
 *
 * This is a simplified version that just simulates the database operation.
 */
export const playCardActor = fromPromise(async ({ input }: { input: PlayCardActorInput }) => {
  // Simulate database operation
  console.log('[playCardActor] Playing card:', input)

  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100))

  // Return mock data
  return {
    id: `played-${input.cardId}`,
    cardId: input.cardId,
  } as PlayCardActorOutput
})
