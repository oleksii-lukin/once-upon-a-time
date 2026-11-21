import { type GameContext } from '../gameTypes'

export const canPlayCard = ({ context }: { context: GameContext }) => {
  const allowed = !context.inFlightHandId && context.canPlayMoreCards
  console.log('[PLAY_CARD GUARD]', {
    allowed,
    inFlightHandId: context.inFlightHandId,
    canPlayMoreCards: context.canPlayMoreCards,
    currentPlayerId: context.currentPlayerId,
    gameMode: context.gameMode,
  })
  return allowed
}

export const isRulesFinished = ({ context }: { context: GameContext }) =>
  !context.canPlayMoreCards
