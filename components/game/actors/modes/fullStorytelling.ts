import { assign, sendParent } from 'xstate'
import { storytellingSetup } from './index'

/**
 * Full storytelling machine implementing the complete rule set with all game mechanics.
 *
 * This is the most sophisticated storytelling mode that includes all advanced features
 * such as player interruptions, card objections, and automatic confirmation timeouts.
 * It provides the full competitive gameplay experience with complex player interactions.
 *
 * ## Features
 * - **Unlimited Cards**: Players can play multiple cards per turn
 * - **Player Interrupts**: Other players can interrupt the storyteller during narration
 * - **Card Objections**: Players can object to played cards within a time window
 * - **Auto-Confirmation**: Cards are automatically confirmed after 5 seconds if no objection
 * - **Complex State Management**: Handles multiple concurrent player actions
 *
 * ## States
 * - **narrating**: Player can play cards, pass, or be interrupted by other players
 * - **cardPlay**: Hierarchical state managing card play acknowledgment and validation
 *   - **awaitingAck**: Waiting for card play confirmation from database
 *   - **pending**: Card played, waiting for objections or auto-confirmation (5s timeout)
 *   - **objecting**: Processing a player objection to the played card
 *   - **confirmed**: Card confirmed, sending confirmation to parent
 * - **interruption**: Processing a player interruption during storytelling
 * - **finished**: Turn completed, sends RULES_DONE to parent
 *
 * ## Context Properties
 * - `cardsPlayedThisTurn`: Tracks number of cards played (unlimited)
 * - `maxCardsPerTurn`: Set to null for unlimited card plays
 * - `canInterrupt`: Always true - enables player interruptions
 * - `canObject`: Always true - enables card objections
 * - `lastPlayedCardId`: ID of the most recently played card for objection handling
 *
 * ## Events Handled
 * - `PLAY_CARD`: Initiates complex card play sequence with validation
 * - `PLAY_CARD_ACK`: Confirms card was successfully added to database
 * - `PASS`: Ends the storytelling turn immediately
 * - `INTERRUPT`: Another player interrupts the current storyteller
 * - `OBJECT`: A player objects to the most recently played card
 * - `CONFIRM`: Manual confirmation of a played card (bypasses timeout)
 * - `VALID`/`INVALID`: Results of interrupt or objection validation
 *
 * ## Error Conditions
 * - If `lastPlayedCardId` is null when trying to confirm a card, sends `SYNC_ERROR` to parent
 * - Objection validation failures result in card confirmation rather than removal
 * - Invalid interruptions return to normal narrating state
 *
 * ## Integration Notes
 * This machine requires careful coordination with the parent game machine:
 * - Parent must handle `CONFIRM_CARD`, `RULES_DONE`, and `SYNC_ERROR` events
 * - Parent should validate interruptions and objections before sending `VALID`/`INVALID`
 * - The 5-second auto-confirmation timeout requires parent to be ready for delayed events
 *
 * ## Usage Example
 * ```typescript
 * // In main game machine
 * invoke: {
 *   src: 'fullStorytellingMachine',
 *   input: ({ context }) => ({
 *     // Context is managed internally by the machine
 *   }),
 *   onDone: {
 *     target: 'evaluateGameState',
 *     actions: 'handleStorytellingComplete'
 *   }
 * },
 * on: {
 *   CONFIRM_CARD: {
 *     actions: 'confirmPlayedCard'
 *   },
 *   SYNC_ERROR: {
 *     actions: 'handleSyncError'
 *   }
 * }
 * ```
 *
 * ## Performance Considerations
 * - The 5-second timeout creates a delayed event that must be handled properly
 * - Multiple concurrent objections should be handled by the parent machine
 * - State transitions can be rapid during objection sequences
 *
 * @see {@link StorytellingContext} for context interface details
 * @see {@link StorytellingEvent} for event type definitions
 * @requires Parent machine must handle CONFIRM_CARD, RULES_DONE, and SYNC_ERROR events
 */
export const fullStorytellingMachine = storytellingSetup.createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QDMCuAbdBlALgewCcBPHMTASwDsoA6SgQwIPpyqgGIAFAGQEEBNAPoBhXgCUAIgG0ADAF1EoAA55Y5VnkqKQAD0QBGABwB2GgCYAbAFYLZqwBoQRRGZkyahgMzefv7wBYAX0DHNExcQhIydDY6RmZWai5eLCxZBSQQFTUNLUy9BH0LU0sbO0dnBGMZQxoavz8gkJAw7HxiUgpqOKYWNnYASQA5ABUAUTExAFVOEfTtbPVyTW0C-QBOEutbBycDTzNg0Iw2yM6Y7oBjRghOdHoidghNMBpYHBZX1oiO6Njrgi3e5EeaZRa5VYGYxbMq7SpWQzrDwNRpHFonH5RLq0AFAh40egAd3oS2ovEuAGsuHwhKJJIJeMIANKg5SqJYrfKIKxGcyefyeYxwlz+Kw0Tw2aH1VHNb7tLEXHE3O74pRgSgQfoAeQAQgApMbCObyBbsiFchCGSw0fQydaC4UITzrMV2NFys5-K7K4E0NUa-rCLVDABiAzEAFlWVkzcs8qAClaLDa7Q6Ki4LLVpSjvMZ3Rj5ed-j7VerNUkdO9PgTkKQCAAKKxuGQASnYHt+2JouJVRD9ZbY0fBcchluttvtQvTCDMrhoCJzPiax3Cha9SsBvZoeAARgArMCXRIcABqvG4A2kJrBsc5CYM-n0Zg8VknjqbSIXi8F+dXnq7Pa+ruB5Hv0wxnheV4ZGyOQjhatqGPoNAClOexOoYtReN+P6ygW-6KjQVB1gQqBKLk7AQZeQ63vGuiIP4hj+MhaZoYi85Yd+v6nJ2BFEWATCkeR4HnlR14wRytFrJs5jbOUrFIVYwTNJQeAQHA2gdgqbCmrBd50QgAC0FjTkZXGYkW3QML0x46RJo7+GY07rMu6J-jxxabsCtnmveTrWq+LGVPonjuF+i4uZpFkbnifZEiSx7khS3lwb5gpMQFqGVJYtRhTmea4W5Wnep5pYBtQyV6QU1SmBOgUZjlHF5WZa4ASWfbAYeNk3rpkmIC6SKlDs07OmKQrNfhHkxd2mjIOQBAALaQBVvWFGYwXzm+05rVmjUohFeHud0fECWRKUxj1o78ulm1oes7jZou42HbQs2UOQsAABZLd1dnwTySLGIhcmVAxYrYbmSmBEAA */
  id: 'fullStorytelling',
  initial: 'narrating',
  context: {
    cardsPlayedThisTurn: 0,
    maxCardsPerTurn: null,
    canInterrupt: true,
    canObject: true,
    lastPlayedCardId: null,
  },
  states: {
    narrating: {
      on: {
        PLAY_CARD: 'cardPlay',
        PASS: 'finished',
        INTERRUPT: 'interruption',
      },
    },
    cardPlay: {
      initial: 'awaitingAck',
      states: {
        awaitingAck: {
          on: {
            PLAY_CARD_ACK: {
              target: 'pending',
              actions: assign({ lastPlayedCardId: ({ event }) => event.playedCardId }),
            },
          },
        },
        pending: {
          on: {
            OBJECT: 'objecting',
            CONFIRM: 'confirmed',
          },
          after: {
            5000: 'confirmed',
          },
        },
        objecting: {
          on: {
            VALID: '#fullStorytelling.finished',
            INVALID: 'confirmed',
          },
        },
        confirmed: {
          type: 'final',
          entry: sendParent(({ context }) => {
            if (!context.lastPlayedCardId) return { type: 'SYNC_ERROR', error: 'No card to confirm' }
            return {
              type: 'CONFIRM_CARD',
              playedCardId: context.lastPlayedCardId,
            }
          }),
        },
      },
      onDone: 'narrating',
    },
    interruption: {
      on: {
        VALID: 'finished',
        INVALID: 'narrating',
      },
    },
    finished: {
      type: 'final',
      entry: sendParent({ type: 'RULES_DONE' }),
    },
  },
})
