import { type GameContext, type GameEvent } from '../gameTypes'

/**
 * XState guards for database persistence and turn flow
 */

/**
 * Checks if the card that was just saved is the one we are waiting for
 */
export const isPendingCardConfirmed = ({ context, event }: { context: GameContext, event: any }) =>
  context.pendingConfirmCardId === event.output.id

/**
 * Checks if turn should auto-pass in tutorial mode after a card is played
 */
export const shouldAutoPassInTutorial = ({ context, event }: { context: GameContext, event: any }) => {
  const passEvent = event as Extract<GameEvent, { type: 'PASS' }>
  return context.gameMode === 'tutorial'
    && context.lastPlayedCardId !== null
    && !passEvent?.isHandEmpty
}

/**
 * Checks if we are in tutorial mode and rules are finished
 */
export const isTutorialRulesFinished = ({ context }: { context: GameContext }) =>
  context.gameMode === 'tutorial' && context.rulesFinished

/**
 * Checks if we are in tutorial mode and a card has been played
 */
export const isTutorialWithPlayedCard = ({ context }: { context: GameContext }) =>
  context.gameMode === 'tutorial' && context.lastPlayedCardId !== null

/**
 * Checks if there is a pending pass turn queued
 */
export const hasPendingPassTurn = ({ context }: { context: GameContext }) =>
  context.pendingPassTurn

/**
 * Checks if pacing delay is disabled
 */
export const isPacingDisabled = ({ context }: { context: GameContext }) =>
  context.pacingDelay <= 0
