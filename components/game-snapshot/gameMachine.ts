import { assign, setup, assertEvent, type DoneActorEvent, type ErrorActorEvent } from 'xstate'
import { playCardActor } from './actors/playCardActor'
import { canPlayCard } from './guards/playGuards'
import { assignNextPlayer } from './actions/playerActions'
import {
  type PlayCardActorInput,
  type PlayCardActorOutput,
} from './gameTypes'
import { type GameContext, type GameEvent, type GameActors } from './gameTypes'

/**
 * Minimal Game Machine Snapshot
 *
 * This is a simplified version of the game machine with:
 * - 1 actor (playCardActor)
 * - 1 guard (canPlayCard)
 * - 1 action (assignNextPlayer)
 * - Minimal context (3 parameters)
 * - Basic state flow (idle -> active -> idle)
 */
export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actors: {
    playCardActor,
  },
  guards: {
    canPlayCard,
  },
}).createMachine({
  id: 'gameSnapshot',
  context: {
    gameSessionId: null,
    currentPlayerId: null,
    inFlightHandId: null,
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        START_GAME: {
          target: 'active',
          actions: assign({
            gameSessionId: ({ event }) => event.gameSessionId,
            currentPlayerId: ({ event }) => event.currentPlayerId,
          }),
        },
      },
    },
    active: {
      on: {
        PLAY_CARD: {
          guard: 'canPlayCard',
          target: 'playingCard',
          actions: assign({
            inFlightHandId: ({ event }) => event.cardId,
          }),
        },
      },
    },
    playingCard: {
      invoke: {
        src: 'playCardActor',
        id: 'playCardActor',
        input: ({ context, event }): PlayCardActorInput => {
          assertEvent(event, 'PLAY_CARD')
          if (!context.gameSessionId) throw new Error('Game session ID is missing')
          if (!context.currentPlayerId) throw new Error('Current player ID is missing')

          return {
            gameSessionId: context.gameSessionId,
            playerId: context.currentPlayerId,
            cardId: event.cardId,
            position: event.position,
          }
        },
        onDone: {
          target: 'active',
          actions: [
            ({ event }) => console.log('[playCardActor done]', event.output),
            assign({
              inFlightHandId: null,
            }),
            assignNextPlayer,
          ],
        },
        onError: {
          target: 'active',
          actions: [
            ({ event }) => console.error('[playCardActor error]', event.error),
            assign({
              inFlightHandId: null,
            }),
          ],
        },
      },
    },
  },
})
