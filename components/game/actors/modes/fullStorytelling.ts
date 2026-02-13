import { assign, sendParent } from 'xstate'
import { storytellingSetup, type StorytellingEvent } from './index'

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
  /** @xstate-layout N4IgpgJg5mDOIC5QDMCuAbdBlALgewCcBPHMTASwDsoA6SgQwIPpyqgGIAFAGQEEBNAPoBhXgCUAIgG0ADAF1EoAA55Y5VnkqKQAD0QBGABwBmGgDYArGYBMAFivXrATgu2zAGhBFE1mTJomxs4W+iEA7C6GhgC+0Z5omLiEJGTobHSMzKzUXLxYWLIKSCAqahpaxXoI+mamljb2NsFunt4IYRamMibWVt3dRrHxGNj4xKQU1BlMLGzsAJIAcgAqAKJiYgCqnMuF2qXq5JraVfpOdQ6Nji4tXgbG+jROz8-6YdZh3bYy1kMgCaNkhM0lMAMaMCCcdD0IjsCCaMA0WA4FiIgFJcapdLggiQ6FEPbFA7lE4GMIXBoOZoeO4IWq2ALGIJmGRWfS9YxhP7osYpSa0HF4mE0egAd3oh2ovFBAGsuHwhKJJIJeMIANKE5SqQ7HSqICwyR5OGSU3yGMJmC2tHxuALdD7WTnWfT6ey-OL-EYYvkggUQqHCpRgSgQOYAeQAQgApVbCXbyfbakl69rPGhhQzsiIWCwfWyGJzWhC2b40OzPWyOlkPYwyLkenlArFg-34mhBkNzYRhxYAMXmYgAspqSkmjhVQFUIk505mPi5c2F84Xac7DDRukFjU5DPYnGZuV7ecDsa3A8HQzkR8Tx6TUzOM1mF3mC0XrGZ1xYeoZ3wazrVD0SY9mz9XEAyIdsLzmHRkVREVkFIAgAApOFVJYAHFBAkVYFQASnYRtMX5GhBXAyDO2oa8x11SdEGnWcnxzF8VzaB4GS-IJyU5FkC30QDASI30SLPCC8AAIwAKzAUFsg4AA1XhuHmaQEyJaiJ10AxKzCGh9BkJxbGMKxd05Wx9CLHN2J6MxbHeXdOgPBsjybYjSLbcSpJkuYlgUpSVKKLUylvFM9KcaxdPNHMzEsCxjWMQwi0M0xAnfKIXEsYxbH470TymKhEIIVAlHKdhfOUqigpozTi0+dN6jsE0zLrS0iwLGgOKCeKjDMY1d2y4DiPysAmCKkqfMU8rVMCnUNNOc5zEuKkbhpNpM3avwNpNV0TA6WIPUoPAIDgbRCJ9NhE0q2bEAAWhWm7HOGICXKEhgZlki6ZrvSsi3ml5njspkDQsfrntPMD8Q+5NaIQB4zACQzyTCfRTKaiwi2R-wOOcfTHRdRwHs9J7BLBoUILFCVZOlGVIeC6HjBs+HOU5ZGl1Rt9ao-IIrAzCx3k5EHiZbcHzwoqAaaqqpLRnX8bCZT5Aesdn-E56xM0ynqfisAWzqF0maA86T3rUy67ycJddP0szc05jMwkS0sl1eMJp2Ryttdy0C9dBTRkHIAgAFtIHFq7qkdcLvhsQw+nsVwEtXZ10yZZwGmRpwXXrR6BJ12ghpG4radHE2UyZBkTMRlmSz0tHaWNDdAnzTkdx6nr3ZAmhfcochYAACyD43PpCzpHnsB4DJNMwjFuNpOn8Jkgl3dl2TMrK9qAA */
  id: 'fullStorytelling',
  initial: 'narrating',
  context: ({ input }) => ({
    cardsPlayedThisTurn: 0,
    maxCardsPerTurn: null,
    canInterrupt: true,
    canObject: true,
    lastPlayedCardId: null,
    pacingDelay: input.pacingDelay,
    turnCompleteReason: undefined,
  }),
  states: {
    narrating: {
      on: {
        PLAY_CARD: 'cardPlay',
        PASS: {
          target: 'finished',
          actions: assign({ turnCompleteReason: 'passed' as const }),
        },
        EXCHANGE: {
          target: 'finished',
          actions: assign({ turnCompleteReason: 'exchanged' as const }),
        },
        INTERRUPT: {
          target: 'interruption',
          actions: assign({ nextPlayerIdOverride: ({ event }) => (event as Extract<StorytellingEvent, { type: 'INTERRUPT' }>).player_id }),
        },
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
          always: { target: 'confirmed', guard: ({ context }) => context.pacingDelay <= 0 },
          on: {
            OBJECT: {
              target: 'objecting',
              actions: assign({ nextPlayerIdOverride: ({ event }) => (event as Extract<StorytellingEvent, { type: 'OBJECT' }>).player_id }),
            },
            CONFIRM: 'confirmed',
          },
          after: {
            PACING_DELAY: 'confirmed',
          },
        },
        objecting: {
          on: {
            VALID: {
              target: '#fullStorytelling.finished',
              actions: assign({ turnCompleteReason: 'objected' as const }),
            },
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
        VALID: {
          target: 'finished',
          actions: assign({ turnCompleteReason: 'interrupted' as const }),
        },
        INVALID: 'narrating',
      },
    },
    finished: {
      type: 'final',
      output: ({ context }) => ({
        type: 'TURN_COMPLETE' as const,
        reason: context.turnCompleteReason || 'passed',
        nextPlayerId: context.nextPlayerIdOverride,
      }),
    },
  },
})
