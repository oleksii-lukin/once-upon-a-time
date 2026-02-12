import { assign } from 'xstate'

/**
 * XState actions for game state management
 */

export const assignGameStart = assign(({ event }: { event: { gameSessionId: string, lobbyId: string, mode: string, currentPlayerId: string, players?: any[], pacingDelay?: number, timerDuration?: number } }) => ({
  gameSessionId: event.gameSessionId,
  lobbyId: event.lobbyId,
  gameMode: event.mode,
  currentPlayerId: event.currentPlayerId,
  players: event.players || [],
  pacingDelay: event.pacingDelay || 0,
  timerDuration: event.timerDuration || 0,
}))

export const assignRulesFinished = assign({
  rulesFinished: true,
})

export const resetRulesState = assign({
  rulesFinished: false,
})
