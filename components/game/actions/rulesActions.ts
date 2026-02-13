import { assign } from 'xstate'
import { type GameContext, type GameEvent, type GameActors } from '../gameTypes'

/**
 * XState actions for rules state management
 * 
 * These actions manage the canPlayMoreCards flag which controls
 * whether players can continue playing cards in the current turn.
 */

/**
 * Marks rules as finished, preventing further card plays
 * Used when turn is complete or card limit is reached
 */
export const assignRulesFinished = assign<GameContext, GameEvent, any, any, GameActors>({
  canPlayMoreCards: false,
})

/**
 * Resets rules state for a new turn
 * Allows players to play cards again
 */
export const resetRulesFinished = assign<GameContext, GameEvent, any, any, GameActors>({
  canPlayMoreCards: true,
})
