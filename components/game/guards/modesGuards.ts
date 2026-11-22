import { type GameContext } from '../gameTypes'

export const isSoloMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'solo'

export const isTutorialMode = ({ context }: { context: GameContext }) =>
  context.gameMode === 'tutorial'

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

/**
 * Interrupts are only valid in the modes whose MODE_CONFIG enables them
 * (full/main). The child storytelling machine guards the same condition;
 * the parent persistence region must not draw a penalty or pass the turn
 * for an interrupt the mode disallows.
 */
export const canInterruptInMode = ({ context }: { context: GameContext }) =>
  isFullOrMainMode({ context })
