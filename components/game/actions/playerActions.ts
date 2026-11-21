import { assign, type DoneActorEvent } from 'xstate'
import { type GameContext, type GameEvent, type GameActors, type EventWithNextPlayerId } from '../gameTypes'

import { getNextPlayerId } from '../utils/playerUtils'

/**
 * XState actions for player turn management
 */

/**
 * Calculates and assigns the next player in turn order
 */
export const assignNextPlayer = assign<GameContext, GameEvent, undefined, GameEvent, GameActors>({
  nextPlayerId: ({ context }) => getNextPlayerId(context.players, context.currentPlayerId!),
})

/**
 * Assigns next player from events that contain nextPlayerId
 * Used for INTERRUPT, OBJECT, and CHALLENGE_STUTTER events
 */
export const assignNextPlayerFromEvent = assign<GameContext, EventWithNextPlayerId, undefined, GameEvent, GameActors>({
  nextPlayerId: ({ event }) => event.nextPlayerId,
})

/**
 * Assigns next player from child actor output.
 *
 * A valid interruption/objection carries its directed next player in the
 * child's output (nextPlayerIdOverride). Everything else — a rejected
 * arbitration (override cleared), an event the child ignored because the
 * mode disallows it, or an ordinary pass — must follow plain turn order.
 * The old fallback to `context.nextPlayerId` trusted a value that any
 * directed event sets optimistically, so a rejected redirect leaked into
 * the next turn and corrupted the turn order.
 */
export const assignNextPlayerFromActorOutput = assign<GameContext, DoneActorEvent<{ nextPlayerId?: string }>, undefined, GameEvent, GameActors>({
  nextPlayerId: ({ context, event }) => {
    const output = event.output

    if (output?.nextPlayerId) {
      return output.nextPlayerId
    }

    return getNextPlayerId(context.players, context.currentPlayerId!)
  },
})
