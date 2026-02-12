import { assign } from 'xstate'
import { type GameContext, type GameEvent, type GameActors } from '../gameTypes'

/**
 * Action that assigns the next player
 * 
 * This is a simplified version that just logs the action.
 * In the real version, this would calculate the next player from the players array.
 */
export const assignNextPlayer = assign<GameContext, any, any, any, GameActors>({
  currentPlayerId: ({ context }) => {
    console.log('[assignNextPlayer action] Current player:', context.currentPlayerId)
    // In real version: return getNextPlayerId(context.players, context.currentPlayerId)
    return context.currentPlayerId // Simplified: keep same player
  }
})
