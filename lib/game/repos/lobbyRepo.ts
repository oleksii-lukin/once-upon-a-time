import { type GameClient } from './client'

/** Data access for the `lobbies` table (game-related writes only). */
export const lobbyRepo = {
  async markFinished(client: GameClient, lobbyId: string) {
    return client
      .from('lobbies')
      .update({ status: 'finished' })
      .eq('id', lobbyId)
  },
}
