import { type GameContext } from '../gameTypes'

/**
 * XState guards for game rules and phase management
 */

/**
 * Checks if the rules explanation phase is not yet finished (can still play cards)
 */
export const isRulesNotFinished = ({ context }: { context: GameContext }) =>
  context.canPlayMoreCards

/**
 * Checks if a player can pass their turn (cannot play more cards)
 */
export const canPassTurn = ({ context }: { context: GameContext }) =>
  !context.canPlayMoreCards

/**
 * Checks if a player can play a card (alias for rules not finished check in some contexts)
 */
export const isRulesPhaseActive = ({ context }: { context: GameContext }) =>
  context.canPlayMoreCards

