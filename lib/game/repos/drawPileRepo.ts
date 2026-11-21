import { type GameClient } from './client'

/** Data access for the `draw_pile` table. */
export const drawPileRepo = {
  /** Draws up to `count` cards from the top of the pile. */
  async drawCards(client: GameClient, params: { gameSessionId: string, count: number }) {
    return client
      .from('draw_pile')
      .select('*')
      .eq('game_session_id', params.gameSessionId)
      .order('position', { ascending: true })
      .limit(params.count)
  },

  /**
   * Draws the top card matching a category class.
   * `endingOnly: true` → ending cards; `false` → non-ending cards.
   */
  async drawOne(
    client: GameClient,
    params: { gameSessionId: string, endingOnly: boolean },
  ) {
    let query = client
      .from('draw_pile')
      .select('*, cards!inner(*)')
      .eq('game_session_id', params.gameSessionId)

    if (params.endingOnly) {
      query = query.eq('cards.category', 'ending')
    }
    else {
      query = query.neq('cards.category', 'ending')
    }

    return query
      .order('position', { ascending: true })
      .limit(1)
  },

  async removeById(client: GameClient, pileId: string) {
    return client.from('draw_pile').delete().eq('id', pileId)
  },

  async removeByIds(client: GameClient, pileIds: string[]) {
    return client.from('draw_pile').delete().in('id', pileIds)
  },
}
