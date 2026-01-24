import { assign, sendParent } from 'xstate'
import { storytellingSetup } from './index'

/**
 * Simple storytelling machine for casual gameplay with basic mechanics.
 *
 * This machine provides a streamlined storytelling experience that removes complex
 * interactions while allowing multiple card plays per turn. It's designed for
 * players who want to focus on storytelling without interruptions or objections.
 *
 * ## Features
 * - **Unlimited Cards**: Players can play multiple cards per turn
 * - **No Interrupts**: Other players cannot interrupt the storyteller
 * - **No Objections**: Card objections are disabled for smooth gameplay
 * - **Streamlined Flow**: Direct progression from narrating to card play and back
 *
 * ## States
 * - **narrating**: Player can play cards or pass their turn
 * - **cardPlay**: Processing card play acknowledgment from parent machine
 * - **finished**: Turn completed, sends RULES_DONE to parent
 *
 * ## Context Properties
 * - `cardsPlayedThisTurn`: Tracks number of cards played (no limit enforced)
 * - `maxCardsPerTurn`: Set to null for unlimited card plays
 * - `canInterrupt`: Always false in simple mode
 * - `canObject`: Always false in simple mode
 * - `lastPlayedCardId`: ID of the most recently played card
 *
 * ## Events Handled
 * - `PLAY_CARD`: Initiates card play sequence, returns to narrating after confirmation
 * - `PLAY_CARD_ACK`: Confirms card was played successfully
 * - `PASS`: Ends the storytelling turn immediately
 *
 * ## Integration Notes
 * This machine is invoked by the main game machine during simple gameplay mode.
 * It maintains a continuous loop allowing multiple card plays until the player
 * chooses to pass. Communication with parent includes:
 * - `CONFIRM_CARD` events sent immediately when cards are played
 * - `RULES_DONE` event sent when player passes their turn
 *
 * ## Usage Example
 * ```typescript
 * // In main game machine
 * invoke: {
 *   src: 'simpleStorytellingMachine',
 *   input: ({ context }) => ({
 *     // Context is managed internally by the machine
 *   }),
 *   onDone: {
 *     target: 'waitingForNextPlayer',
 *     actions: 'processStorytellingComplete'
 *   }
 * }
 * ```
 *
 * @see {@link StorytellingContext} for context interface details
 * @see {@link StorytellingEvent} for event type definitions
 */
export const simpleStorytellingMachine = storytellingSetup.createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwJYFsAOAbMBlALgPYBOAnvmFligHZQB0NAhscU-rVAMQAKAMgEEAmgH0AwgIBKAEQDaABgC6iUBkKoOhGipAAPRAEYA7EfoAmAGwBWC2YCcR43atmDAGhClEZowA561rYuVnYAzEZWBgC+UR6omDgEJOSU1HSMLGwcdLwCuLgKykggahooWjr6CMamljb2jkbOrh5e1fJW9BHyPaGhFgYWA6ExcejYeERkFFSc9ADGLBA8WEykvIKiEjIiAmIA0oU6pSia2sVVNeaBDU4u7p6GNuYALHbvzi++FnauMbEgGiECBwHTxCZJaapTjHdSncrnUBVAC0FlaiFR9B62JxOLMvlGIHBiSmKVm6WYrHYMOKJzOlUQLzM6IQln8+IMZisoSsLx+YRGAOJk2SMzSDEWxGWqzaqjh9IuiH6FnoBhe8gsTKGlgsoQebR8oXoViM9gMdl8zjsnKsVkJwshZPF9AAZrQULAABaQWFlCqKhDK1XqzU6nV6lm+AzG3F8l4GKMa-5RIA */
  id: 'simpleStorytelling',
  initial: 'narrating',
  context: {
    cardsPlayedThisTurn: 0,
    maxCardsPerTurn: null,
    canInterrupt: false,
    canObject: false,
    lastPlayedCardId: null,
  },
  states: {
    narrating: {
      on: {
        PLAY_CARD: 'cardPlay',
        PASS: 'finished',
      },
    },
    cardPlay: {
      on: {
        PLAY_CARD_ACK: {
          actions: [
            assign({ lastPlayedCardId: ({ event }) => event.playedCardId }),
            sendParent(({ event }) => ({ type: 'CONFIRM_CARD', playedCardId: event.playedCardId })),
          ],
          target: 'narrating',
        },
      },
    },
    finished: {
      type: 'final',
      entry: sendParent({ type: 'RULES_DONE' }),
    },
  },
})
