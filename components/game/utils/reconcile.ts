/**
 * Turn reconciliation: the single, explicit rule deciding when the
 * authoritative DB value (`game_sessions.current_turn_player_id`) is allowed
 * to overwrite the machine's `currentPlayerId`.
 *
 * Rule:
 *  1. The database is authoritative — when it has a value and the machine
 *     disagrees, the machine follows.
 *  2. …except while a local action is in flight: local writes win until the
 *     action settles (optimistic state, pending actor, or non-idle
 *     persistence region). The effect re-runs as soon as the action settles,
 *     so a deferred remote update is never lost.
 */

export interface TurnReconcileInput {
  /** current_turn_player_id from the DB row (null = none/not started) */
  remoteTurnPlayerId: string | null
  /** currentPlayerId currently held in the machine */
  machineTurnPlayerId: string | null
  /** @see selectLocalActionInFlight */
  hasLocalActionInFlight: boolean
}

export function shouldApplyRemoteTurnUpdate(input: TurnReconcileInput): boolean {
  if (!input.remoteTurnPlayerId) return false
  if (input.remoteTurnPlayerId === input.machineTurnPlayerId) return false
  if (input.hasLocalActionInFlight) return false
  return true
}

export interface LocalActionState {
  /** Optimistic card write in progress (hand row being removed) */
  inFlightHandId: string | null
  /** A turn pass is queued behind an unfinished card confirmation */
  pendingPassTurn: boolean
  /** A card confirmation is queued for the persistence region */
  pendingConfirmCardId: string | null
  /** persistence parallel region is running a DB actor (not idle) */
  persistenceIdle: boolean
  /** machine is inside the win-finalization flow */
  isWinning: boolean
}

export function selectLocalActionInFlight(state: LocalActionState): boolean {
  return Boolean(
    state.inFlightHandId
    || state.pendingPassTurn
    || state.pendingConfirmCardId
    || !state.persistenceIdle
    || state.isWinning,
  )
}
