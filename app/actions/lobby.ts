'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { languages } from '@/app/i18n/settings'
import { type ActionResult } from '@/types/service'
import { lobbies, players } from '@/lib/lobby/repos'

/**
 * Lobby create/join server actions — the only write path for the
 * create-lobby and join-lobby flows. Replaces the duplicated logic that
 * lived in CreateLobbyButton, CreateLobbyLink, LobbyList and
 * InviteHandler (including their copy-pasted Clerk-vs-guest identity
 * blocks, now resolved client-side via lib/lobby/identity and passed in
 * as plain strings).
 */

const uuid = () => z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'must be a valid UUID')

const IdentitySchema = z.object({
  userId: z.string().min(1).nullable(),
  guestId: z.string().min(1),
  displayName: z.string().min(1).max(200),
  avatarUrl: z.string().max(500).nullable(),
})

const inputError = (error: z.ZodError): string =>
  error.issues[0]?.message ?? 'Invalid input'

const CreateLobbySchema = z.object({
  language: z.string().refine(l => languages.includes(l), 'Unsupported language'),
  creator: IdentitySchema,
})

export async function createLobby(
  input: {
    language: string
    creator: { userId: string | null, guestId: string, displayName: string, avatarUrl: string | null }
  },
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateLobbySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()
  const { language, creator } = parsed.data

  const created = await lobbies.insert(supabase, {
    name: `Story ${Math.floor(Math.random() * 1000)}`,
    code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    created_by: creator.userId || creator.guestId,
    status: 'waiting',
    language,
  })
  if (created.error) return { ok: false, error: created.error.message, code: 'create_failed' }
  if (!created.data) return { ok: false, error: 'Failed to create lobby', code: 'create_failed' }

  // Add the creator as host
  const host = await players.insert(supabase, {
    lobby_id: created.data.id,
    user_id: creator.userId || null,
    guest_id: creator.userId ? null : creator.guestId,
    role: 'host',
    status: 'ready',
    display_name: creator.displayName,
    avatar_url: creator.avatarUrl,
  })
  if (host.error) {
    return { ok: false, error: `Failed to add host: ${host.error.message}`, code: 'host_insert_failed' }
  }

  return { ok: true, data: { id: created.data.id } }
}

const JoinLobbySchema = z.object({
  lobbyId: uuid().optional(),
  code: z.string().trim().min(1).max(16).optional(),
  joiner: IdentitySchema,
}).refine(
  d => Boolean(d.lobbyId) !== Boolean(d.code),
  { message: 'Provide exactly one of lobbyId or code' },
)

export async function joinLobby(
  input: {
    lobbyId?: string
    code?: string
    joiner: { userId: string | null, guestId: string, displayName: string, avatarUrl: string | null }
  },
): Promise<ActionResult<{ lobbyId: string, alreadyMember: boolean }>> {
  const parsed = JoinLobbySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()
  const { lobbyId, code, joiner } = parsed.data

  // Resolve the target lobby (by invite code or by id)
  let lobby: { id: string } | null = null
  if (code) {
    const found = await lobbies.findByCode(supabase, code)
    if (!found.data) {
      // .single() reports "no rows" as error PGRST116; anything else is a real failure
      const notFound = !found.error || found.error.code === 'PGRST116'
      return {
        ok: false,
        error: notFound ? 'Lobby not found' : found.error!.message,
        code: notFound ? 'lobby_not_found' : 'read_failed',
      }
    }
    lobby = found.data
  }
  else {
    const found = await lobbies.findById(supabase, lobbyId!)
    if (found.error) return { ok: false, error: found.error.message, code: 'read_failed' }
    if (!found.data) return { ok: false, error: 'Lobby not found', code: 'lobby_not_found' }
    lobby = found.data
  }

  // Already a member? Old flows still navigated — report success.
  const existing = await players.findByLobbyAndIdentity(supabase, {
    lobbyId: lobby.id,
    userId: joiner.userId,
    guestId: joiner.guestId,
  })
  if (existing.error) return { ok: false, error: existing.error.message, code: 'read_failed' }
  if (existing.data) return { ok: true, data: { lobbyId: lobby.id, alreadyMember: true } }

  const joined = await players.insert(supabase, {
    lobby_id: lobby.id,
    user_id: joiner.userId || null,
    guest_id: joiner.userId ? null : joiner.guestId,
    role: 'player',
    status: 'not_ready',
    display_name: joiner.displayName,
    avatar_url: joiner.avatarUrl,
  })
  if (joined.error) return { ok: false, error: joined.error.message, code: 'join_failed' }

  return { ok: true, data: { lobbyId: lobby.id, alreadyMember: false } }
}
