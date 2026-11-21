import { type GameContext } from '../gameTypes'

export const canPlayCard = ({ context }: { context: GameContext }) =>
  !context.inFlightHandId && context.canPlayMoreCards
