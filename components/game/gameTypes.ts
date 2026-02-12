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
  /** Whether the rules explanation phase has been completed */
  rulesFinished: boolean
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
  = | { type: 'START_GAME', gameSessionId: string, lobbyId: string, mode: GameMode, currentPlayerId: string, players?: Player[], pacingDelay?: number, timerDuration?: number }
  | { type: 'PLAY_CARD', card: CardData, playedCardsCount: number }
  | { type: 'PASS', isHandEmpty?: boolean }
  | { type: 'INTERRUPT' }
  | { type: 'OBJECT', playedCardId: string, storytellerId: string, nextPlayerId: string }
  | { type: 'CHALLENGE_STUTTER', storytellerId: string, nextPlayerId: string }
  | { type: 'CONFIRM_CARD', playedCardId: string }
  | { type: 'EXCHANGE', cardId: string, isEnding?: boolean }
  | { type: 'WIN_GAME', card: CardData, playedCardsCount: number }
  | { type: 'FINALIZE_WIN', winnerId: string, lobbyId: string }
  | { type: 'RULES_DONE' }
  | { type: 'SYNC_COMPLETE' }
  | { type: 'SYNC_ERROR', error: string }
  | { type: 'SYNC_CURRENT_PLAYER', currentPlayerId: string }
  | { type: 'RESET_RULES' }
  | { type: 'TIMER_EXPIRED' }
  | { type: 'SYNC_TIMER', isEnabled: boolean, duration: number }
  | { type: 'START_TIMER' }
  | { type: 'STOP_TIMER' }
  | { type: 'EXTEND_TIMER' }

export type GameActors =
  | { src: 'ruleTutorial', logic: typeof tutorialStorytellingMachine, id: string }
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
