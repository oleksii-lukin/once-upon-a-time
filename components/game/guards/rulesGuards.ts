import { type GameContext } from '../gameTypes'

/**
 * XState guards for game rules and phase management
 */

/**
 * Checks if the rules explanation phase is not yet finished
 */
export const isRulesNotFinished = ({ context }: { context: GameContext }) =>
  !context.rulesFinished

/**
 * Checks if a player can pass their turn (rules must be finished)
 */
export const canPassTurn = ({ context }: { context: GameContext }) =>
  context.rulesFinished

/**
 * Checks if a player can play a card (alias for rules not finished check in some contexts)
 */
export const isRulesPhaseActive = ({ context }: { context: GameContext }) =>
  !context.rulesFinished
