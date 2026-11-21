/**
 * Exchange Card Actor - Database Operations for Exchanging a Card
 *
 * Handles discarding a card and drawing a new one in a single operation.
 */

import { fromPromise } from 'xstate'
import { exchangeCard } from '@/app/actions/game'
import { validateUUID } from '../validation'

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

  const result = await exchangeCard({
    gameSessionId: input.gameSessionId,
    playerId: input.playerId,
    cardId: input.cardId,
    isEnding: input.isEnding,
  })
  if (!result.ok) throw new Error(result.error)

  return result.data
})
