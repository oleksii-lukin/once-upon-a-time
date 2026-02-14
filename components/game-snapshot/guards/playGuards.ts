import { type GameContext } from '../gameTypes'

/**
 * Guard that checks if a card can be played
 *
 * Returns true if no card is currently being processed
 */
export const canPlayCard = ({ context }: { context: GameContext }) => {
  const allowed = !context.inFlightHandId

  console.log('[canPlayCard guard]', {
    allowed,
    inFlightHandId: context.inFlightHandId,
    currentPlayerId: context.currentPlayerId,
  })

  return allowed
}
