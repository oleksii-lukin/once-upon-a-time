import { setup } from 'xstate'

/**
 * Shared context interface for all storytelling mode machines.
 */
export interface StorytellingContext {
  /** Number of cards played in the current turn (starts at 0) */
  cardsPlayedThisTurn: number
  /** Maximum cards allowed per turn (null = unlimited) */
  maxCardsPerTurn: number | null
  /** Whether players can interrupt the current storyteller */
  canInterrupt: boolean
  /** Whether players can object to played cards */
  canObject: boolean
  /** ID of the last card played in this storytelling session (null if none played) */
  lastPlayedCardId: string | null
  /** The duration in seconds to wait before confirming a card */
  pacingDelay: number
}

/**
 * Union type of all possible events that can occur during storytelling modes.
 */
export type StorytellingEvent
  = | { type: 'PLAY_CARD', cardId: string }
    | { type: 'PLAY_CARD_ACK', playedCardId: string }
    | { type: 'PASS' }
    | { type: 'INTERRUPT', player_id: string, card_id: string }
    | { type: 'OBJECT', player_id: string, played_card_id: string }
    | { type: 'CONFIRM' }
    | { type: 'VALID' }
    | { type: 'INVALID' }

/**
 * Shared XState setup configuration for all storytelling machines.
 */
export const storytellingSetup = setup({
  types: {
    context: {} as StorytellingContext,
    events: {} as StorytellingEvent,
    input: {} as { pacingDelay: number },
  },
  delays: {
    PACING_DELAY: ({ context }) => context.pacingDelay * 1000,
  },
})
