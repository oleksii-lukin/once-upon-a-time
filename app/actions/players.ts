'use server'

import { z } from 'zod'
import { createServiceClient } from '@/utils/supabase/service'
import { requireOwnedPlayer, requireHostOfLobby } from '@/lib/game/authorization'
import type { Database } from '@/supabase/types'
import { type ActionResult } from '@/types/service'

/**
 * Player-scoped server actions — the write path that replaced the direct
 * browser writes to `players` (heartbeat, ready toggle, leave, role
 * switch) once migration 20261122000003 dropped the public write
 * policies. Every action proves the caller owns the row (Clerk session or
 * guest secret cookie) via lib/game/authorization.
 */

const uuid = () => z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'must be a valid UUID')

const inputError = (error: z.ZodError): string =>
  error.issues[0]?.message ?? 'Invalid input'

const TouchSchema = z.object({ playerId: uuid() })

/** Refreshes last_seen_at for the caller's own player row (heartbeat). */
export async function touchPlayer(input: { playerId: string }): Promise<ActionResult<true>> {
  const parsed = TouchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = createServiceClient()

  const owner = await requireOwnedPlayer(supabase, parsed.data.playerId)
  if (!owner.ok) return { ok: false, error: owner.error }

  const { error } = await supabase
    .from('players')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', parsed.data.playerId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

const StatusSchema = z.object({
  playerId: uuid(),
  status: z.enum(['ready', 'not_ready']),
})

/** Ready toggle for the caller's own player row. */
export async function setPlayerStatus(
  input: { playerId: string, status: 'ready' | 'not_ready' },
): Promise<ActionResult<true>> {
  const parsed = StatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = createServiceClient()

  const owner = await requireOwnedPlayer(supabase, parsed.data.playerId)
  if (!owner.ok) return { ok: false, error: owner.error }

  const { error } = await supabase
    .from('players')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.playerId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

const LeaveSchema = z.object({ playerId: uuid() })

/** Removes the caller's own player row (leave lobby). */
export async function leaveLobby(input: { playerId: string }): Promise<ActionResult<true>> {
  const parsed = LeaveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = createServiceClient()

  const owner = await requireOwnedPlayer(supabase, parsed.data.playerId)
  if (!owner.ok) return { ok: false, error: owner.error }

  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', parsed.data.playerId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

const RoleSchema = z.object({
  callerPlayerId: uuid(),
  targetPlayerId: uuid(),
  role: z.enum(['host', 'player', 'spectator']),
})

/**
 * Role switch: a player may change their OWN role (spectator <-> player,
 * forced by allowSpectators/solo settings), while anything touching
 * someone else's row requires being the lobby host (host transfer).
 */
export async function setPlayerRole(
  input: { callerPlayerId: string, targetPlayerId: string, role: 'host' | 'player' | 'spectator' },
): Promise<ActionResult<true>> {
  const parsed = RoleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = createServiceClient()
  const { callerPlayerId, targetPlayerId, role } = parsed.data

  if (callerPlayerId === targetPlayerId) {
    const owner = await requireOwnedPlayer(supabase, callerPlayerId)
    if (!owner.ok) return { ok: false, error: owner.error }
  }
  else {
    const target = await supabase.from('players').select('lobby_id').eq('id', targetPlayerId).maybeSingle()
    if (target.error) return { ok: false, error: target.error.message }
    if (!target.data) return { ok: false, error: 'Target player not found' }
    const host = await requireHostOfLobby(supabase, callerPlayerId, target.data.lobby_id)
    if (!host.ok) return { ok: false, error: host.error }
  }

  const { error } = await supabase
    .from('players')
    .update({ role })
    .eq('id', targetPlayerId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

const HandSchema = z.object({
  gameSessionId: uuid(),
  playerId: uuid(),
})

type HandRow = Database['public']['Tables']['player_hands']['Row'] & {
  cards: Database['public']['Tables']['cards']['Row']
}

/**
 * The caller's own hand (cards included). Replaces the direct
 * player_hands read, which no longer returns anything to guests (the
 * remaining SELECT policy only matches Clerk users' own rows).
 */
export async function getMyHand(
  input: { gameSessionId: string, playerId: string },
): Promise<ActionResult<HandRow[]>> {
  const parsed = HandSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = createServiceClient()

  const owner = await requireOwnedPlayer(supabase, parsed.data.playerId)
  if (!owner.ok) return { ok: false, error: owner.error }

  const { data, error } = await supabase
    .from('player_hands')
    .select('*, cards (*)')
    .eq('game_session_id', parsed.data.gameSessionId)
    .eq('player_id', parsed.data.playerId)
    .order('position')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []) as unknown as HandRow[] }
}
