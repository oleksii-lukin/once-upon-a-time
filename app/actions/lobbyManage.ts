'use server'

import { z } from 'zod'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requireHostOfLobby } from '@/lib/game/authorization'
import { LobbySettingsSchema, type LobbySettings } from '@/types/model'
import type { Database } from '@/supabase/types'
import { type ActionResult } from '@/types/service'

/**
 * Lobby management write path (Phase 2): lobby settings/name/deck edits
 * move out of the browser (they relied on the dropped public UPDATE
 * policies) and are host-verified; archive/restore/delete are reserved
 * for Clerk admins.
 */

const uuid = () => z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'must be a valid UUID')

const inputError = (error: z.ZodError): string =>
  error.issues[0]?.message ?? 'Invalid input'

const UpdateLobbySchema = z.object({
  callerPlayerId: uuid(),
  lobbyId: uuid(),
  name: z.string().min(1).max(200).optional(),
  settings: LobbySettingsSchema.partial().optional(),
  gameMode: z.string().max(50).optional(),
  deckId: uuid().nullable().optional(),
})

/** Host-only lobby edits (name, settings, game mode, primary deck). */
export async function updateLobby(
  input: {
    callerPlayerId: string
    lobbyId: string
    name?: string
    settings?: Partial<LobbySettings>
    gameMode?: string
    deckId?: string | null
  },
): Promise<ActionResult<true>> {
  const parsed = UpdateLobbySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = createServiceClient()
  const { callerPlayerId, lobbyId, name, settings, gameMode, deckId } = parsed.data

  const host = await requireHostOfLobby(supabase, callerPlayerId, lobbyId)
  if (!host.ok) return { ok: false, error: host.error }

  const patch: Database['public']['Tables']['lobbies']['Update'] = {}
  if (name !== undefined) patch.name = name
  if (settings !== undefined) {
    patch.settings = settings
    if (gameMode !== undefined) patch.game_mode = gameMode
  }
  if (deckId !== undefined) patch.deck_id = deckId
  if (Object.keys(patch).length === 0) return { ok: true, data: true }

  const { error } = await supabase.from('lobbies').update(patch).eq('id', lobbyId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

const AdminSchema = z.object({
  lobbyId: uuid(),
  action: z.enum(['archive', 'restore', 'delete']),
})

/** Admin-only lobby lifecycle (requires Clerk publicMetadata.is_admin). */
export async function adminLobbyAction(
  input: { lobbyId: string, action: 'archive' | 'restore' | 'delete' },
): Promise<ActionResult<true>> {
  const parsed = AdminSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }

  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'Not signed in' }
  const user = await (await clerkClient()).users.getUser(userId)
  if (user.publicMetadata?.is_admin !== true) {
    return { ok: false, error: 'Admins only' }
  }

  const supabase = createServiceClient()
  const { lobbyId, action } = parsed.data

  if (action === 'delete') {
    const { error } = await supabase.from('lobbies').delete().eq('id', lobbyId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  }

  const { error } = await supabase
    .from('lobbies')
    .update({ deleted_at: action === 'archive' ? new Date().toISOString() : null })
    .eq('id', lobbyId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}
