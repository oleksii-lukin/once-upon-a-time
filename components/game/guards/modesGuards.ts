import { type GameContext } from '../gameTypes'

export const isSoloMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'solo'

export const isTutorialMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'tutorial'

export const isSimpleMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'simple'

export const isFullMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'full'
