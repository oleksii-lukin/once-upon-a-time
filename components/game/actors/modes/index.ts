import { setup } from 'xstate'
import { type GameMode } from '@/types/model'

/**
 * Shared context, events and setup for the storytelling (rules) machine.
 *
 * All game modes run the same machine — the mode only contributes a
 * config block (see MODE_CONFIG), so tutorial/simple/full/solo/fast/main
 * differ by data, not by duplicated statecharts.
 */

/**
 * Shared context interface for the storytelling machine.
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
  /** Reason why the storytelling turn was completed */
  turnCompleteReason?: 'passed' | 'exchanged' | 'interrupted' | 'objected' | 'card_limit_reached'
  /** ID of the player who should take the next turn (used for interruptions/objections) */
  nextPlayerIdOverride?: string
}

/**
 * Union type of all possible events that can occur during storytelling.
 */
export type StorytellingEvent
  = | { type: 'PLAY_CARD', cardId: string }
    | { type: 'PLAY_CARD_ACK', playedCardId: string }
    | { type: 'PASS' }
    | { type: 'EXCHANGE' }
    | { type: 'INTERRUPT', player_id: string, card_id: string }
    | { type: 'OBJECT', player_id: string, played_card_id: string }
    | { type: 'CONFIRM' }
    | { type: 'VALID' }
    | { type: 'INVALID' }

/** Input passed to the storytelling machine on invocation. */
export interface StorytellingInput {
  pacingDelay: number
  mode: GameMode
}

/** Per-mode rules configuration — the only difference between modes. */
export interface StorytellingModeConfig {
  /** Card cap per turn (tutorial=1), null = unlimited */
  maxCardsPerTurn: number | null
  canInterrupt: boolean
  canObject: boolean
}

export const MODE_CONFIG: Record<GameMode, StorytellingModeConfig> = {
  tutorial: { maxCardsPerTurn: 1, canInterrupt: false, canObject: false },
  simple: { maxCardsPerTurn: null, canInterrupt: false, canObject: false },
  fast: { maxCardsPerTurn: null, canInterrupt: false, canObject: false },
  full: { maxCardsPerTurn: null, canInterrupt: true, canObject: true },
  main: { maxCardsPerTurn: null, canInterrupt: true, canObject: true },
  solo: { maxCardsPerTurn: null, canInterrupt: false, canObject: false },
}

/**
 * Shared XState setup configuration for the storytelling machine.
 */
export const storytellingSetup = setup({
  types: {
    context: {} as StorytellingContext,
    events: {} as StorytellingEvent,
    input: {} as StorytellingInput,
  },
  delays: {
    PACING_DELAY: ({ context }) => context.pacingDelay * 1000,
  },
})
