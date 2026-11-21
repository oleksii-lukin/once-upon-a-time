import { type GameMode, type Player, type PlayedCardWithCard } from '@/types/model'
import { type CardData } from '@/utils/gameUtils'
import {
  tutorialStorytellingMachine,
  simpleStorytellingMachine,
  fullStorytellingMachine,
  soloStorytellingMachine,
} from './ruleVariants'
import { playCardActor } from './actors/playCardActor'
import { drawCardsActor } from './actors/drawCardsActor'
import { passTurnActor } from './actors/passTurnActor'
import { confirmCardActor } from './actors/confirmCardActor'
import { finalizeWinActor } from './actors/finalizeWinActor'
import { objectActor } from './actors/objectActor'
import { exchangeCardActor } from './actors/exchangeCardActor'
import { timerSyncActor } from './actors/timerSyncActor'
import { timerExtensionActor } from './actors/timerExtensionActor'

// Re-export actor types from their respective files
export { type PlayCardActorInput, type PlayCardActorOutput } from './actors/playCardActor'
export { type DrawCardsActorInput } from './actors/drawCardsActor'
export { type PassTurnActorInput } from './actors/passTurnActor'
export { type ConfirmCardActorInput } from './actors/confirmCardActor'
export { type FinalizeWinActorInput } from './actors/finalizeWinActor'
export { type ObjectActorInput } from './actors/objectActor'
export { type ExchangeCardActorInput } from './actors/exchangeCardActor'
export { type TimerSyncInput, type TimerSyncOutput } from './actors/timerSyncActor'
export { type TimerExtensionInput, type TimerExtensionOutput } from './actors/timerExtensionActor'

/**
 * Main context interface for the XState game machine.
 * Contains all state information needed to manage a game session,
 * including player data, game flow, error handling, and UI state.
 */
export interface GameContext {
  /** The current game session ID - null when no game is active */
  gameSessionId: string | null
  /** The lobby ID this game belongs to - null when no game is active */
  lobbyId: string | null
  /** The current game mode (tutorial, simple, full, solo storytelling) */
  gameMode: GameMode
  /** General error message for display to users - null when no error */
  error: string | null
  /** Last database persistence error - null when no persistence error */
  lastPersistenceError: string | null
  /** ID of the player whose turn it currently is - null when game not started */
  currentPlayerId: string | null
  /** Optimistic UI: Shows card instantly on click while database saves in background */
  /** Prevents UI delay - card appears immediately, then syncs with real database record */
  optimisticCard: CardData | null
  /** ID of the hand being processed for card operations - null when none in flight */
  inFlightHandId: string | null
  /** ID of the most recently played card - used for pacing and objections */
  lastPlayedCardId: string | null
  /** Whether the current storyteller can still play cards this turn (Inverted rulesFinished) */
  canPlayMoreCards: boolean
  /** Array of all players in the current game session */
  players: Player[]
  /** ID of the player who will take the next turn - null when not determined */
  nextPlayerId: string | null
  /** The duration in seconds to wait before confirming a card (0 if disabled) */
  pacingDelay: number
  /** Timer duration in seconds for each turn (0 if disabled) */
  timerDuration: number
  /** Queue: ID of card currently awaiting database confirmation */
  pendingConfirmCardId: string | null
  /** Queue: Whether a turn pass is awaiting database idle */
  pendingPassTurn: boolean
  /** Temporary timer sync input for actor invocation */
  timerSyncInput?: {
    gameSessionId: string
    isEnabled: boolean
    duration: number
    currentPlayerId: string | null
    action: 'start' | 'stop' | 'sync' | 'extend'
    pacingDelay: number
    newExpiresAt?: string
  }
}

/**
 * Union type of all possible events that can be sent to the game machine.
 */
export type GameEvent
  = /** System trigger to start a new game session */
    | { type: 'START_GAME', gameSessionId: string, lobbyId: string, mode: GameMode, currentPlayerId: string, players?: Player[], pacingDelay?: number, timerDuration?: number }
  /** Standard player action: play a card from hand */
    | { type: 'PLAY_CARD', card: CardData, playedCardsCount: number }
  /** Manual player action: end turn voluntarily (optionally due to empty hand) */
    | { type: 'PASS', isHandEmpty?: boolean }
  /** Full mode: Directed turn change when a player interrupts another */
    | { type: 'INTERRUPT', nextPlayerId: string }
  /** Full mode: Directed turn change when a player objects to a card */
    | { type: 'OBJECT', playedCardId: string, storytellerId: string, nextPlayerId: string }
  /** Simple/Full mode: Directed turn change when a player challenges a stutter */
    | { type: 'CHALLENGE_STUTTER', storytellerId: string, nextPlayerId: string }
  /** Acknowledgment that a card play has been processed and is ready for rules check */
    | { type: 'CONFIRM_CARD', playedCardId: string }
  /** System/Player action: exchange a card from hand */
    | { type: 'EXCHANGE', cardId: string, isEnding?: boolean }
  /** Triggered when a player meets victory conditions by playing their final card */
    | { type: 'WIN_GAME', card: CardData, playedCardsCount: number }
  /** Handled by persistence to finalize the win in the database */
    | { type: 'FINALIZE_WIN', winnerId: string, lobbyId: string }
  /** Internal: rules child machine has completed its logic */
    | { type: 'RULES_DONE' }
  /** Internal: persistence layer successfully updated the database */
    | { type: 'SYNC_COMPLETE' }
  /** Internal: persistence layer failed to update the database */
    | { type: 'SYNC_ERROR', error: string }
  /** Internal: updates local machine state with new current player from DB */
    | { type: 'SYNC_CURRENT_PLAYER', currentPlayerId: string }
  /** Internal: resets rules state for the next turn */
    | { type: 'RESET_RULES' }
  /** Triggered by timer parallel state when turn time is up */
    | { type: 'TIMER_EXPIRED' }
  /** Syncs timer configuration (enabled/duration) between parallel states */
    | { type: 'SYNC_TIMER', isEnabled: boolean, duration: number }
  /** Internal command to start/restart the turn timer */
    | { type: 'START_TIMER' }
  /** Internal command to stop the turn timer */
    | { type: 'STOP_TIMER' }
  /** Internal command to extend the current turn timer */
    | { type: 'EXTEND_TIMER' }
  /**
   * System-triggered pass (e.g., in Tutorial mode after 1 card is played).
   * Distinct from PASS because it bypasses manual confirmation logic.
   */
    | { type: 'AUTO_PASS' }
  /** signals that a pending action (interrupt/objection) is valid */
    | { type: 'VALID' }
  /** signals that a pending action (interrupt/objection) is invalid */
    | { type: 'INVALID' }
  /**
   * Unified internal event to trigger the persistence layer's turn update sequence.
   * Used after rules complete or when turn changes due to interruptions/objections.
   */
    | { type: 'SYNC_TURN' }

/**
 * Shared event type helpers for common event patterns
 */

/** Events that contain nextPlayerId property */
export type EventWithNextPlayerId = Extract<GameEvent, { nextPlayerId: string }>

export type GameActors
  = | { src: 'ruleTutorial', logic: typeof tutorialStorytellingMachine, id: string }
    | { src: 'ruleSimple', logic: typeof simpleStorytellingMachine, id: string }
    | { src: 'ruleFull', logic: typeof fullStorytellingMachine, id: string }
    | { src: 'ruleSolo', logic: typeof soloStorytellingMachine, id: string }
    | { src: 'playCardActor', logic: typeof playCardActor, id: string }
    | { src: 'drawCardsActor', logic: typeof drawCardsActor, id: string }
    | { src: 'passTurnActor', logic: typeof passTurnActor, id: string }
    | { src: 'confirmCardActor', logic: typeof confirmCardActor, id: string }
    | { src: 'finalizeWinActor', logic: typeof finalizeWinActor, id: string }
    | { src: 'objectActor', logic: typeof objectActor, id: string }
    | { src: 'exchangeCardActor', logic: typeof exchangeCardActor, id: string }
    | { src: 'timerSyncActor', logic: typeof timerSyncActor, id: string }
    | { src: 'timerExtensionActor', logic: typeof timerExtensionActor, id: string }
