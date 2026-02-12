import { type GameContext } from '../gameTypes'

export const canPlayCard = ({ context }: { context: GameContext }) => {
  const allowed = !context.inFlightHandId && !context.rulesFinished
  console.log('[PLAY_CARD GUARD]', {
    allowed,
    inFlightHandId: context.inFlightHandId,
    rulesFinished: context.rulesFinished,
    currentPlayerId: context.currentPlayerId,
    gameMode: context.gameMode,
  })
  return allowed
}

export const isRulesFinished = ({ context }: { context: GameContext }) =>
  context.rulesFinished
