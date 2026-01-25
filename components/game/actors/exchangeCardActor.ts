/**
 * Exchange Card Actor - Database Operations for Exchanging a Card
 *
 * Handles discarding a card and drawing a new one in a single operation.
 */

import { fromPromise } from 'xstate'
import { createClient } from '@/utils/supabase/client'
import { validateUUID } from '../validation'

const supabase = createClient()

export interface ExchangeCardActorInput {
  gameSessionId: string
  playerId: string
  cardId: string
  isEnding?: boolean
}

export function validateExchangeCardActorInput(input: unknown): asserts input is ExchangeCardActorInput {
  if (!input || typeof input !== 'object') {
    throw new Error('ExchangeCardActorInput must be an object')
  }

  const typedInput = input as Record<string, unknown>

  validateUUID(typedInput.gameSessionId, 'gameSessionId')
  validateUUID(typedInput.playerId, 'playerId')
  validateUUID(typedInput.cardId, 'cardId')
}

export const exchangeCardActor = fromPromise(async ({ input }: { input: ExchangeCardActorInput }) => {
  validateExchangeCardActorInput(input)

  // 1. Get one matching card from draw pile
  let query = supabase
    .from('draw_pile')
    .select('*, cards!inner(*)')
    .eq('game_session_id', input.gameSessionId)

  if (input.isEnding) {
    query = query.eq('cards.category', 'ending')
  }
  else {
    query = query.neq('cards.category', 'ending')
  }

  const { data: drawCards, error: drawError } = await query
    .order('position', { ascending: true })
    .limit(1)

  if (drawError || !drawCards || drawCards.length === 0) {
    throw drawError || new Error('No cards in draw pile')
  }

  const newCard = drawCards[0]

  // 2. Delete the old card from hand
  const { error: deleteError } = await supabase
    .from('player_hands')
    .delete()
    .eq('game_session_id', input.gameSessionId)
    .eq('player_id', input.playerId)
    .eq('card_id', input.cardId)

  if (deleteError) throw deleteError

  // 3. Add the new card to hand
  const { error: insertError } = await supabase
    .from('player_hands')
    .insert({
      game_session_id: input.gameSessionId,
      player_id: input.playerId,
      card_id: newCard.card_id,
      position: 999, // Use high position
    })

  if (insertError) throw insertError

  // 4. Remove drawn card from pile
  await supabase
    .from('draw_pile')
    .delete()
    .eq('id', newCard.id)

  return true
})
