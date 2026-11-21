import { type GameClient } from './client'

/** Data access for the `played_cards` table. */
export const playedCardsRepo = {
  /** Inserts a played card in PENDING state and returns it with card details. */
  async insertPending(
    client: GameClient,
    row: { game_session_id: string, player_id: string, card_id: string, position: number },
  ) {
    return client
      .from('played_cards')
      .insert({ ...row, status: 'PENDING' as const })
      .select('*, cards(*)')
      .single()
  },

  /** Marks a played card as CONFIRMED. Deliberately idempotent: re-confirming is not an error. */
  async confirm(client: GameClient, playedCardId: string) {
    return client
      .from('played_cards')
      .update({ status: 'CONFIRMED' as const })
      .eq('id', playedCardId)
  },

  async getById(client: GameClient, playedCardId: string) {
    return client
      .from('played_cards')
      .select('*')
      .eq('id', playedCardId)
      .single()
  },

  async removeById(client: GameClient, playedCardId: string) {
    return client.from('played_cards').delete().eq('id', playedCardId)
  },
}
