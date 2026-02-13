import { assign } from 'xstate'
import { type GameContext, type GameEvent, type GameActors } from '../gameTypes'

/**
 * XState actions for game state management
 */

/**
 * Initializes the game context from the START_GAME event
 */
export const assignGameStart = assign<GameContext, Extract<GameEvent, { type: 'START_GAME' }>, any, any, GameActors>({
  gameSessionId: ({ event }) => event.gameSessionId,
  lobbyId: ({ event }) => event.lobbyId,
  gameMode: ({ event }) => event.mode,
  currentPlayerId: ({ event }) => event.currentPlayerId,
  players: ({ event }) => event.players || [],
  pacingDelay: ({ event }) => event.pacingDelay || 0,
  timerDuration: ({ event }) => event.timerDuration || 0,
})

