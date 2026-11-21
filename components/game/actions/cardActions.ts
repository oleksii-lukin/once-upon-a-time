import { assign, type DoneActorEvent } from 'xstate'
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
export const assignOptimisticCard = assign<GameContext, Extract<GameEvent, { type: 'PLAY_CARD' }>, undefined, GameEvent, GameActors>({
  optimisticCard: ({ context, event }) => ({
    ...event.card,
    status: 'PENDING' as const,
    played_by: context.currentPlayerId!,
  }),
  inFlightHandId: ({ event }) =>
    (event.card as unknown as { hand_id?: string }).hand_id || event.card.id || null,
})

/**
 * Clears optimistic card after database confirmation
 * In tutorial mode, keeps inFlightHandId to prevent duplicate plays
 */
export const clearOptimisticCard = assign<GameContext, GameEvent, undefined, GameEvent, GameActors>({
  optimisticCard: null,
  inFlightHandId: ({ context }) =>
    context.gameMode === 'tutorial' ? context.inFlightHandId : null,
})

/**
 * Assigns the last played card ID from actor output
 * Used after successful card play to track for pacing/objections
 */
export const assignLastPlayedCardFromEvent = assign<GameContext, DoneActorEvent<{ id: string }>, undefined, GameEvent, GameActors>({
  lastPlayedCardId: ({ event }) => event.output.id,
})

/**
 * Assigns pending confirm card ID for queued confirmation
 * Used when a card needs to be confirmed after pacing delay
 */
export const assignPendingConfirmCard = assign<GameContext, Extract<GameEvent, { type: 'CONFIRM_CARD' }>, undefined, GameEvent, GameActors>({
  pendingConfirmCardId: ({ event }) => event.playedCardId,
})
