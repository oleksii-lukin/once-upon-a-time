import { type GameClient } from './client'

/** Data access for the `game_sessions` table. */
export const sessionRepo = {
  /** Advances the turn: sets both current player and storyteller. */
  async updateTurn(
    client: GameClient,
    params: { gameSessionId: string, nextPlayerId: string },
  ) {
    return client
      .from('game_sessions')
      .update({
        current_turn_player_id: params.nextPlayerId,
        storyteller_id: params.nextPlayerId,
      })
      .eq('id', params.gameSessionId)
  },

  /** Reads the lobby a session belongs to (null when the session does not exist). */
  async getLobbyId(client: GameClient, gameSessionId: string) {
    return client
      .from('game_sessions')
      .select('lobby_id')
      .eq('id', gameSessionId)
      .maybeSingle()
  },

  /** Marks the session completed with a winner. */
  async finalizeWin(
    client: GameClient,
    params: { gameSessionId: string, winnerId: string },
  ) {
    return client
      .from('game_sessions')
      .update({
        winner_id: params.winnerId,
        status: 'COMPLETED',
      })
      .eq('id', params.gameSessionId)
  },

  /** Applies timer fields (start/stop/extend/sync) to the session row. */
  async updateTimer(
    client: GameClient,
    gameSessionId: string,
    fields: {
      timer_enabled?: boolean
      timer_duration?: number
      timer_started_at?: string | null
      timer_expires_at?: string | null
      updated_at: string
    },
  ) {
    return client
      .from('game_sessions')
      .update(fields)
      .eq('id', gameSessionId)
  },

  /** Reads the current timer expiration timestamp. */
  async getTimerExpiry(client: GameClient, gameSessionId: string) {
    return client
      .from('game_sessions')
      .select('timer_expires_at')
      .eq('id', gameSessionId)
      .single()
  },
}
