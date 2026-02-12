import { assign } from 'xstate'
import { type CardData } from '@/utils/gameUtils'

/**
 * XState actions for card management
 */

export const assignOptimisticCard = (card: CardData, currentPlayerId: string) =>
  assign({
    optimisticCard: {
      ...card,
      status: 'PENDING' as const,
      played_by: currentPlayerId,
    },
  })

export const assignLastPlayedCard = (cardId: string) =>
  assign({
    lastPlayedCardId: cardId,
  })

export const assignPendingConfirmCard = (playedCardId: string) =>
  assign({
    pendingConfirmCardId: playedCardId,
  })

export const clearPendingConfirmCard = assign({
  pendingConfirmCardId: null,
})
