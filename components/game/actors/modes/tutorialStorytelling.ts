import { assign, sendParent } from 'xstate'
import { storytellingSetup } from './index'

/**
 * Tutorial storytelling machine for new players learning the game mechanics.
 *
 * This machine provides a simplified storytelling experience designed to help new players
 * understand the basic game flow without the complexity of advanced features like
 * interruptions and objections.
 *
 * ## Features
 * - **Card Limit**: Restricted to 1 card per turn to prevent overwhelming new players
 * - **No Interrupts**: Players cannot interrupt the storyteller during their turn
 * - **No Objections**: Card objections are disabled for simplified gameplay
 * - **Linear Flow**: Straightforward progression through narrating → card play → decision → finish
 *
 * ## States
 * - **narrating**: Player can play a card or pass their turn
 * - **cardPlay**: Processing card play acknowledgment from parent machine
 * - **decideNext**: Determining if turn should continue based on card limit
 * - **finished**: Turn completed, sends RULES_DONE to parent
 *
 * ## Context Properties
 * - `cardsPlayedThisTurn`: Tracks cards played (max 1 in tutorial mode)
 * - `maxCardsPerTurn`: Set to 1 to enforce tutorial restrictions
 * - `canInterrupt`: Always false in tutorial mode
 * - `canObject`: Always false in tutorial mode
 * - `lastPlayedCardId`: ID of the most recently played card
 *
 * ## Events Handled
 * - `PLAY_CARD`: Initiates card play sequence
 * - `PLAY_CARD_ACK`: Confirms card was played successfully
 * - `PASS`: Ends the storytelling turn immediately
 *
 * ## Integration Notes
 * This machine is invoked by the main game machine during tutorial gameplay.
 * It communicates with the parent through:
 * - `CONFIRM_CARD` events sent to parent when cards are played
 * - `RULES_DONE` event sent when storytelling turn is complete
 *
 * ## Usage Example
 * ```typescript
 * // In main game machine
 * invoke: {
 *   src: 'tutorialStorytellingMachine',
 *   input: ({ context }) => ({
 *     // Context is managed internally by the machine
 *   }),
 *   onDone: {
 *     target: 'nextGameState',
 *     actions: 'handleStorytellingComplete'
 *   }
 * }
 * ```
 *
 * @see {@link StorytellingContext} for context interface details
 * @see {@link StorytellingEvent} for event type definitions
 */
export const tutorialStorytellingMachine = storytellingSetup.createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBcCuyD2AnAlgQwBsBlTLAT2TAIJwDsoA6WvLLPZOqAYgAUAZAIIBNAPoBhAQCUAIgG0ADAF1EoAA4ZYODhloqQAD0QBGAOwmGAJgBsAVitGLATmsBmGyccAaEGUQX5FgyORlZWACwmYS4WRvIuABxhAL5J3mik+MSkFFQ09EwsbBz0vAJERArKSCDqmtq61YYIpubWdg7OVm4e3r4Ibo4M9o4modZGRmH2KWno2Jkk2DnUnAwAxiwQPAR4ZLyCohIyIgJiANKVerVaODp6TWERDPJWFhFhRo6hNkbxVr3GUJBLo2CzxNzxRLyIwzEDpeaERbkSgrfIQMBrHDogByYH0yC4l2q13q90QZhcDF+kRs8UcoKsJjBAIQzgYYUcnPiozcLle8kcsPhuER2RReUY6MxOLxBNkRiqag0NzujUQEUpApcJkmj3B1nkJhZiXZIXCwRMAt+1hSqRAtAw6Pg1WFCzFuU4V2VpLVCAAtP8fIg-TYgpzwxGIy4hXMRVkluLVsxWOxPcTvbcGqAHhYWcFnh9wiYbDYwjEwjZBXbXaKEx78hssFsdn0lXVM2T+mDnq8IgLEmZKyz-JTC6EXC8vnY-jGMrXkfXJRisWBcfive3VdnECCgtqpr97B56Xn5AxIpzLTY4jF7PFZwj4wvUYwAGZ0HCwAAWkA3KqzBiII4hoMHS8i0jYLhGKCTg2MaRjsuG8RxBMkFmraSRAA */
  id: 'tutorialStorytelling',
  initial: 'narrating',
  context: ({ input }) => ({
    cardsPlayedThisTurn: 0,
    maxCardsPerTurn: 1,
    canInterrupt: false,
    canObject: false,
    lastPlayedCardId: null,
    pacingDelay: input.pacingDelay,
  }),
  states: {
    narrating: {
      on: {
        PLAY_CARD: 'cardPlay',
        PASS: { target: 'finished' },
        EXCHANGE: { target: 'finished' },
      },
    },
    cardPlay: {
      on: {
        PLAY_CARD_ACK: {
          actions: assign({
            lastPlayedCardId: ({ event }) => event.playedCardId,
            cardsPlayedThisTurn: ({ context }) => context.cardsPlayedThisTurn + 1,
          }),
          target: 'waiting',
        },
      },
    },
    waiting: {
      always: { target: 'confirming', guard: ({ context }) => context.pacingDelay <= 0 },
      after: {
        PACING_DELAY: { target: 'confirming' },
      },
    },
    confirming: {
      entry: sendParent(({ context }) => ({ type: 'CONFIRM_CARD', playedCardId: context.lastPlayedCardId! })),
      always: 'decideNext',
    },
    decideNext: {
      always: [
        { target: 'finished', guard: ({ context }) => context.cardsPlayedThisTurn >= (context.maxCardsPerTurn || 1) },
        { target: 'narrating' },
      ],
    },
    finished: {
      type: 'final',
      entry: sendParent({ type: 'RULES_DONE' }),
    },
  },
})
