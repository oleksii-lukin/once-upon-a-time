import { type GameContext } from '../gameTypes'

/**
 * XState guards for game rules phase management
 */

/**
 * Checks if the rules explanation phase is not yet finished (can still play cards)
 */
export const isRulesNotFinished = ({ context }: { context: GameContext }) =>
  context.canPlayMoreCards
