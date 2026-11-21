import { type GameClient } from './client'

/** Data access for the `players` table (game-related reads only). */
export const playersRepo = {
  /** Whether a player is a member of the given lobby. */
  async isInLobby(
    client: GameClient,
    params: { playerId: string, lobbyId: string },
  ) {
    return client
      .from('players')
      .select('id')
      .eq('id', params.playerId)
      .eq('lobby_id', params.lobbyId)
      .maybeSingle()
  },
}
