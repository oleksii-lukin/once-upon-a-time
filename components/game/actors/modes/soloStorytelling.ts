import { assign, sendParent } from 'xstate'
import { storytellingSetup } from './index'

/**
 * Solo storytelling machine optimized for single-player gameplay experiences.
 *
 * This machine is designed specifically for solo play scenarios where there are
 * no other players to interact with. It removes all multiplayer-specific features
 * while maintaining the core card play and storytelling mechanics.
 *
 * ## Features
 * - **Unlimited Cards**: Player can play multiple cards per turn without restriction
 * - **No Interrupts**: No other players present to interrupt (optimized for solo)
 * - **No Objections**: No objection mechanics needed in single-player context
 * - **Streamlined Flow**: Direct card play confirmation without validation delays
 * - **Fast Pacing**: Immediate confirmation of actions for responsive solo gameplay
 *
 * ## States
 * - **narrating**: Player can play cards or pass their turn
 * - **cardPlay**: Processing card play acknowledgment with immediate confirmation
 * - **finished**: Storytelling session complete, sends RULES_DONE to parent
 *
 * ## Context Properties
 * - `cardsPlayedThisTurn`: Tracks number of cards played (no limit enforced)
 * - `maxCardsPerTurn`: Set to null for unlimited card plays
 * - `canInterrupt`: Always false - no other players present
 * - `canObject`: Always false - no objection mechanics in solo play
 * - `lastPlayedCardId`: ID of the most recently played card
 *
 * ## Events Handled
 * - `PLAY_CARD`: Initiates card play sequence with immediate return to narrating
 * - `PLAY_CARD_ACK`: Confirms card was played and immediately sends confirmation to parent
 * - `PASS`: Ends the storytelling turn and completes the session
 *
 * ## Solo Play Optimizations
 * - **Immediate Confirmation**: Cards are confirmed instantly without waiting periods
 * - **No Validation Delays**: Removes multiplayer validation steps for faster gameplay
 * - **Simplified State Machine**: Fewer states and transitions for better performance
 * - **Continuous Flow**: Player can chain multiple card plays seamlessly
 *
 * ## Integration Notes
 * This machine is invoked by the main game machine during solo gameplay modes.
 * It provides the fastest possible storytelling experience by eliminating all
 * multiplayer coordination overhead:
 * - `CONFIRM_CARD` events sent immediately upon card play
 * - `RULES_DONE` event sent when player chooses to pass
 * - No error handling needed for player conflicts or timing issues
 *
 * ## Usage Example
 * ```typescript
 * // In main game machine for solo mode
 * invoke: {
 *   src: 'soloStorytellingMachine',
 *   input: ({ context }) => ({
 *     // Context is managed internally by the machine
 *   }),
 *   onDone: {
 *     target: 'soloGameContinue',
 *     actions: 'processSoloStorytellingComplete'
 *   }
 * }
 * ```
 *
 * ## Performance Benefits
 * - **Reduced Latency**: No waiting for other players or validation timeouts
 * - **Simplified Logic**: Fewer conditional branches and state transitions
 * - **Memory Efficient**: Minimal context tracking compared to multiplayer modes
 * - **Responsive UI**: Immediate feedback for all player actions
 *
 * @see {@link StorytellingContext} for context interface details
 * @see {@link StorytellingEvent} for event type definitions
 * @since Added for solo gameplay support in Requirements 1.2, 2.1, 5.1
 */
export const soloStorytellingMachine = storytellingSetup.createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwPYBsUGUAuKBOAntmGmgJYB2UAdBQIZ553aVQDEACgDICCAmgH0AwjwBKAEQDaABgC6iUAAcUsMixQUFIAB6IAjADYA7NQBMBgKwG9pgCymAHHocOjpgDQgCiAMw+L1JYGPk7SAJxhBg62PgC+sZ6oGDj4RCTkVLQMTCxUnDyYmDLySCDKquqapboIhibmVjb2Ti5unt610gFGFtLSURY+MeZ6FvGJ6Fi4hMSkrNQAxgwQHGh0BJy8giISAjxCANLFWuVqZBpaNXVmQU2Ozq4eXvpWZr16fTHBEQYG8QkgCgoCBwLRJKapWYZKAnFRnC7VRAAWgM7WRAQiER84RiPkMtnGIHBKRm6Xm9EYzFYsIq5yqoBq9jRtTCpmoRmkPlMdicHK65kJxOmaTmmSWeBWaw6SjhlUuvleels-Q+0miDlM-WZpiMPmoFl14VGphsDjxgsmJJF0OoADNKGRYAALSA0+H0nQKgzUJUqvrqzWo54IJz6vr9MJdX5mv7-IA */
  id: 'soloStorytelling',
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
