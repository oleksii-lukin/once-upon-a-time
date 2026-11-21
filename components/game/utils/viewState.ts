import { type CardData, type HandCardData, type PlayedCardData } from '@/utils/gameUtils'

/**
 * Pure view-state derivations for the game screen.
 *
 * Everything here is a total function: remote (DB) state plus the machine's
 * local overlay in → renderable state out. No React, no I/O, no timers —
 * which makes the merge rules unit-testable in isolation.
 */

/** Game state as fetched from the database (authoritative). */
export interface RemoteGameState {
  playedCards: PlayedCardData[]
  hand: HandCardData[]
}

/** Local overlay produced by the state machine while an action is in flight. */
export interface LocalOverlay {
  /** Optimistic card rendered before the DB write is acknowledged */
  optimisticCard: CardData | null
  /** hand row id of the card currently being written, if any */
  inFlightHandId: string | null
}

export interface MergedGameState {
  /** Table area: remote played cards plus the optimistic one, deduplicated */
  playedCards: PlayedCardData[]
  /** Player hand minus in-flight and already-played cards */
  hand: HandCardData[]
}

/**
 * Merges authoritative remote state with the machine's optimistic overlay.
 *
 * Dedup rule for played cards: the optimistic card is added only when no
 * remote record exists with the same card id AND the same player — once the
 * changefeed delivers the real row, the optimistic copy disappears.
 *
 * Hand rule: a card leaves the hand when its hand row is being written
 * (inFlightHandId) or when a played record for that card id exists.
 */
export function mergeRemoteWithOptimistic(
  remote: RemoteGameState,
  local: LocalOverlay,
): MergedGameState {
  const playedCards = [...remote.playedCards]

  const optimistic = local.optimisticCard as PlayedCardData | null
  if (optimistic && !playedCards.some(c => c.id === optimistic.id && c.played_by === optimistic.played_by)) {
    playedCards.push(optimistic)
  }

  const hand = remote.hand.filter(c =>
    c.hand_id !== local.inFlightHandId
    && !playedCards.some(pc => pc.id === c.id),
  )

  return { playedCards, hand }
}

/** Splits a merged hand into story cards, the ending card, and their count. */
export function splitHand(hand: HandCardData[]): {
  storyCards: HandCardData[]
  endingCard: HandCardData | undefined
  handSize: number
} {
  const storyCards = hand.filter(c => c.type !== 'ending')
  const endingCard = hand.find(c => c.type === 'ending')
  return { storyCards, endingCard, handSize: storyCards.length }
}

/**
 * Per-player count of played cards, excluding REVERTED records.
 * Used by the completion overlay for scoring display.
 */
export function computeCardsPlayedCount(playedCards: PlayedCardData[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const card of playedCards) {
    if (card.played_by && card.status !== 'REVERTED') {
      counts[card.played_by] = (counts[card.played_by] || 0) + 1
    }
  }
  return counts
}

/** The card currently awaiting storyteller confirmation, if any. */
export function findPendingCard(playedCards: PlayedCardData[]): PlayedCardData | undefined {
  return playedCards.find(c => c.status === 'PENDING')
}
