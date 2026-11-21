import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types'

/**
 * Data-access layer for lobby tables (create/join flows).
 *
 * Same contract as lib/game/repos: the Supabase client is passed in by
 * the caller (server actions in app/actions/lobby), never created at
 * module scope. Raw Supabase results are returned so the caller controls
 * error handling.
 */
export type LobbyClient = SupabaseClient<Database>

export const lobbies = {
  async insert(
    client: LobbyClient,
    row: { name: string, code: string, created_by: string, status: 'waiting', language: string },
  ) {
    return client.from('lobbies').insert(row).select().single()
  },

  /** Case-insensitive lookup by invite code. */
  async findByCode(client: LobbyClient, code: string) {
    return client
      .from('lobbies')
      .select('*')
      .ilike('code', code)
      .single()
  },

  async findById(client: LobbyClient, lobbyId: string) {
    return client
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .maybeSingle()
  },
}

export const players = {
  async insert(
    client: LobbyClient,
    row: {
      lobby_id: string
      user_id: string | null
      guest_id: string | null
      role: 'host' | 'player'
      status: 'ready' | 'not_ready'
      display_name: string
      avatar_url: string | null
    },
  ) {
    return client.from('players').insert(row)
  },

  /** Finds an existing membership of this user (or guest) in the lobby. */
  async findByLobbyAndIdentity(
    client: LobbyClient,
    params: { lobbyId: string, userId: string | null, guestId: string },
  ) {
    return client
      .from('players')
      .select('*')
      .eq('lobby_id', params.lobbyId)
      .or(
        params.userId
          ? `user_id.eq.${params.userId},guest_id.eq.${params.guestId}`
          : `guest_id.eq.${params.guestId}`,
      )
      .maybeSingle()
  },
}
