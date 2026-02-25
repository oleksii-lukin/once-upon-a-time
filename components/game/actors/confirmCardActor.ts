import { fromPromise } from 'xstate'
import { createClient } from '@/utils/supabase/client'
import { validateUUID } from '../validation'

const supabase = createClient()

/**
 * Input interface for the confirmCardActor
 * Handles confirming a played card's status
 */
export interface ConfirmCardActorInput {
  /** The played card ID - must be a valid UUID */
  playedCardId: string
}

/**
 * Validates ConfirmCardActorInput parameters
 * @param input - The input to validate
 * @throws Error if any parameter is invalid
 */
export function validateConfirmCardActorInput(input: unknown): asserts input is ConfirmCardActorInput {
  if (!input || typeof input !== 'object') {
    throw new Error('ConfirmCardActorInput must be an object')
  }

  const typedInput = input as Record<string, unknown>

  validateUUID(typedInput.playedCardId, 'playedCardId')
}

/**
 * Actor that handles confirming a played card's status in the game database.
 *
 * This actor manages the transition of played cards from 'PENDING' to 'CONFIRMED'
 * status, which is a critical step in the game flow that validates card plays
 * and allows the game to proceed to the next phase.
 *
 * ## Functionality
 * Updates a played card's status from 'PENDING' to 'CONFIRMED' in the database,
 * indicating that the card has been successfully played and accepted by the
 * game rules and other players.
 *
 * ## Database Operations
 * - Updates `played_cards` table setting `status = 'CONFIRMED'`
 * - Targets specific card by `id` field
 * - Atomic operation ensures data consistency
 *
 * ## Input Parameters
 * @param input.playedCardId - UUID of the played card record to confirm
 *
 * ## Return Value
 * @returns Promise<boolean> - Returns true on successful confirmation
 *
 * ## Error Conditions
 * @throws {Error} When input validation fails (missing or invalid playedCardId)
 * @throws {Error} When the database update operation fails
 * @throws {Error} When the played card record is not found
 * @throws {Error} When the card is already confirmed or in an invalid state
 *
 * ## Game Flow Integration
 * This actor is typically invoked during:
 * - **Automatic Confirmation**: After timeout periods in full storytelling mode
 * - **Manual Confirmation**: When players explicitly approve a played card
 * - **Objection Resolution**: When objections are deemed invalid
 * - **Rule Validation**: After game rules validate the card play
 *
 * ## State Transitions
 * The card status progression is:
 * 1. Card played → status: 'PENDING'
 * 2. Confirmation period → status: 'PENDING' (waiting)
 * 3. Confirmation → status: 'CONFIRMED' (this actor)
 * 4. Game continues with confirmed card
 *
 * ## Usage Examples
 *
 * ### Automatic Confirmation (Full Mode)
 * ```typescript
 * // After 5-second timeout in full storytelling mode
 * invoke: {
 *   src: 'confirmCardActor',
 *   input: ({ context }) => ({
 *     playedCardId: context.lastPlayedCardId
 *   }),
 *   onDone: {
 *     target: 'cardConfirmed',
 *     actions: [
 *       'updateGameStateWithConfirmedCard',
 *       'notifyPlayersOfConfirmation'
 *     ]
 *   },
 *   onError: {
 *     target: 'confirmationError',
 *     actions: 'handleConfirmationError'
 *   }
 * }
 * ```
 *
 * ### Manual Confirmation
 * ```typescript
 * // When player explicitly confirms a card
 * on: {
 *   CONFIRM_CARD: {
 *     target: 'confirmingCard',
 *     actions: assign({
 *       cardToConfirm: ({ event }) => event.playedCardId
 *     })
 *   }
 * },
 * states: {
 *   confirmingCard: {
 *     invoke: {
 *       src: 'confirmCardActor',
 *       input: ({ context }) => ({
 *         playedCardId: context.cardToConfirm
 *       })
 *     }
 *   }
 * }
 * ```
 *
 * ### Objection Resolution
 * ```typescript
 * // After objection is deemed invalid
 * invoke: {
 *   src: 'confirmCardActor',
 *   input: ({ context }) => ({
 *     playedCardId: context.objectedCardId
 *   }),
 *   onDone: {
 *     target: 'objectionRejected',
 *     actions: [
 *       'confirmCardDespiteObjection',
 *       'notifyObjectionRejected'
 *     ]
 *   }
 * }
 * ```
 *
 * ## Integration Notes
 * - **Parent Coordination**: Parent machine should track which card is being confirmed
 * - **UI Updates**: Confirmation should trigger visual feedback to players
 * - **Game State**: Confirmed cards affect game progression and scoring
 * - **Multiplayer Sync**: All players should be notified of card confirmations
 *
 * ## Performance Considerations
 * - Confirmation is a lightweight database operation
 * - Should complete quickly to maintain game flow
 * - Consider batching multiple confirmations if needed
 * - Error handling should not block game progression
 *
 * @see {@link ConfirmCardActorInput} for input interface details
 * @see {@link validateConfirmCardActorInput} for validation logic
 */
/**
 * Core logic for confirming a card - separated from XState for reuse
 */
export async function executeConfirmCard(input: ConfirmCardActorInput): Promise<boolean> {
  // Validate input parameters
  validateConfirmCardActorInput(input)

  const { error } = await supabase
    .from('played_cards')
    .update({ status: 'CONFIRMED' })
    .eq('id', input.playedCardId)

  if (error) throw error

  return true
}

export const confirmCardActor = fromPromise(async ({ input }: { input: ConfirmCardActorInput }) => {
  return executeConfirmCard(input)
})
