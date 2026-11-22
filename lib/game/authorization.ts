import { type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types'
import { verifyPlayerOwnership } from '@/lib/auth/verifyPlayer'

/**
 * Caller authorization for game/lobby server actions (Phase 2).
 *
 * The public write policies are gone — actions run with the service role,
 * so every mutation must first establish that the caller is allowed to
 * act. Two levels are used:
 * - ownership (verifyPlayerOwnership): the caller IS the row's player —
 *   for actions that act on the caller's own row (play, exchange, ready,
 *   leave, heartbeat, own hand)
 * - membership: the caller owns some player row in the given lobby —
 *   for actions that legitimately act on behalf of the table (turn flow,
 *   timer sync, penalties drawn for another player)
 */

type Client = SupabaseClient<Database>

export type AuthzOk<T> = { ok: true, player: T, lobbyId: string }
export type AuthzFail = { ok: false, error: string }
export type AuthzResult<T> = AuthzOk<T> | AuthzFail

type PlayerRow = Database['public']['Tables']['players']['Row']

const fail = (error: string): AuthzFail => {
  // Denials are security-relevant — keep them visible in the server log.
  console.warn('[authz] denied:', error)
  return { ok: false, error }
}

/** Fetch a player row and require the caller to own it. */
export async function requireOwnedPlayer(
  supabase: Client,
  playerId: string,
): Promise<AuthzResult<PlayerRow>> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .maybeSingle()
  if (error) return fail(error.message)
  if (!data) return fail('Player not found')
  if (!(await verifyPlayerOwnership(data))) return fail('Not authorized to act as this player')
  return { ok: true, player: data, lobbyId: data.lobby_id }
}

/**
 * Require the caller to own a player row in the lobby of the given game
 * session. Returns the caller's row plus the session's lobby id.
 */
export async function requireMemberOfSession(
  supabase: Client,
  callerPlayerId: string,
  gameSessionId: string,
): Promise<AuthzResult<PlayerRow>> {
  const session = await supabase
    .from('game_sessions')
    .select('lobby_id')
    .eq('id', gameSessionId)
    .maybeSingle()
  if (session.error) return fail(session.error.message)
  if (!session.data) return fail('Game session not found')
  return requireMemberOfLobby(supabase, callerPlayerId, session.data.lobby_id)
}

export async function requireMemberOfLobby(
  supabase: Client,
  callerPlayerId: string,
  lobbyId: string,
): Promise<AuthzResult<PlayerRow>> {
  const owned = await requireOwnedPlayer(supabase, callerPlayerId)
  if (!owned.ok) return owned
  if (owned.lobbyId !== lobbyId) return fail('Caller is not a member of this lobby')
  return owned
}

/** Membership + the row must be the lobby's current host. */
export async function requireHostOfLobby(
  supabase: Client,
  callerPlayerId: string,
  lobbyId: string,
): Promise<AuthzResult<PlayerRow>> {
  const member = await requireMemberOfLobby(supabase, callerPlayerId, lobbyId)
  if (!member.ok) return member
  if (member.player.role !== 'host') return fail('Only the host can do that')
  return member
}
