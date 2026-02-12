import { assign } from 'xstate'
import { type GameContext, type GameEvent, type GameActors } from '../gameTypes'

import { getNextPlayerId } from '../utils/playerUtils'

export const assignNextPlayer = assign<GameContext, GameEvent, any, any, GameActors>({
  nextPlayerId: ({ context }) => getNextPlayerId(context.players, context.currentPlayerId)
})

export const assignSyncedCurrentPlayer = assign<GameContext, Extract<GameEvent, { type: 'SYNC_CURRENT_PLAYER' }>, any, any, GameActors>({
  currentPlayerId: ({ event }) => event.currentPlayerId,
})
