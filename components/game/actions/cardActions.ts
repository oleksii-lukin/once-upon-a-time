import { assign } from 'xstate'
import { type GameContext, type GameEvent, type GameActors } from '../gameTypes'
import { type CardData } from '@/utils/gameUtils'

/**
 * XState actions for card management
 *
 * These actions handle optimistic UI updates, card state tracking,
 * and pending card confirmations during gameplay.
 */

/**
 * Sets optimistic card for immediate UI feedback when playing a card
 * Also sets inFlightHandId to track the card being played
 */
export const assignOptimisticCard = assign<GameContext, Extract<GameEvent, { type: 'PLAY_CARD' }>, any, any, GameActors>({
  optimisticCard: ({ context, event }) => ({
    ...event.card,
    status: 'PENDING' as const,
    played_by: context.currentPlayerId!,
  }),
  inFlightHandId: ({ event }) => (event.card as any).hand_id || event.card.id || null,
})

/**
 * Clears optimistic card after database confirmation
 * In tutorial mode, keeps inFlightHandId to prevent duplicate plays
 */
export const clearOptimisticCard = assign<GameContext, GameEvent, any, any, GameActors>({
  optimisticCard: null,
  inFlightHandId: ({ context }) =>
    context.gameMode === 'tutorial' ? context.inFlightHandId : null,
})

/**
 * Assigns the last played card ID from actor output
 * Used after successful card play to track for pacing/objections
 */
export const assignLastPlayedCardFromEvent = assign<GameContext, any, any, any, GameActors>({
  lastPlayedCardId: ({ event }: { event: any }) => event.output.id,
})

/**
 * Assigns pending confirm card ID for queued confirmation
 * Used when a card needs to be confirmed after pacing delay
 */
export const assignPendingConfirmCard = assign<GameContext, Extract<GameEvent, { type: 'CONFIRM_CARD' }>, any, any, GameActors>({
  pendingConfirmCardId: ({ event }) => event.playedCardId,
})

/**
 * Clears pending confirm card ID after confirmation complete
 */
export const clearPendingConfirmCard = assign<GameContext, GameEvent, any, any, GameActors>({
  pendingConfirmCardId: null,
})
