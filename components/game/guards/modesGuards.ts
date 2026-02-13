import { type GameContext } from '../gameTypes'

export const isSoloMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'solo'

export const isTutorialMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'tutorial'

export const isSimpleMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'simple'

export const isFullMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'full'

/** 
 * Checks if game is in simple or fast mode 
 */
export const isSimpleOrFastMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'simple' || context.gameMode === 'fast'

/** 
 * Checks if game is in full or main mode 
 */
export const isFullOrMainMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'full' || context.gameMode === 'main'

