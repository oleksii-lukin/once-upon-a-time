import { type GameClient } from './client'

/** Data access for the `player_hands` table. */
export const handRepo = {
  /**
   * Removes one card from a player's hand.
   * Returns the deleted rows so callers can verify the card was actually held.
   */
  async removeCard(
    client: GameClient,
    params: { gameSessionId: string, playerId: string, cardId: string },
  ) {
    return client
      .from('player_hands')
      .delete()
      .select('id, position')
      .eq('game_session_id', params.gameSessionId)
      .eq('player_id', params.playerId)
      .eq('card_id', params.cardId)
  },

  async insertCard(
    client: GameClient,
    row: { game_session_id: string, player_id: string, card_id: string, position: number },
  ) {
    return client.from('player_hands').insert(row)
  },

  async insertCards(
    client: GameClient,
    rows: Array<{ game_session_id: string, player_id: string, card_id: string, position: number }>,
  ) {
    return client.from('player_hands').insert(rows)
  },
}
