import { describe, it, expect } from 'vitest'
import { type HandCardData, type PlayedCardData } from '@/utils/gameUtils'
import {
  mergeRemoteWithOptimistic,
  splitHand,
  computeCardsPlayedCount,
  findPendingCard,
} from '../utils/viewState'

function makeHandCard(id: string, type: 'story' | 'ending' = 'story'): HandCardData {
  return {
    id,
    name: id,
    type,
    category: type === 'ending' ? 'ending' : 'setting',
    hand_id: `hand-${id}`,
    position: 0,
  } as unknown as HandCardData
}

function makePlayedCard(
  id: string,
  playedBy: string,
  status: PlayedCardData['status'] = 'CONFIRMED',
): PlayedCardData {
  return {
    id,
    name: id,
    type: 'story',
    category: 'setting',
    played_by: playedBy,
    status,
    played_card_id: `pc-${id}`,
  } as unknown as PlayedCardData
}

describe('mergeRemoteWithOptimistic', () => {
  it('returns remote content unchanged when there is no local overlay', () => {
    const remote = {
      playedCards: [makePlayedCard('c1', 'p1')],
      hand: [makeHandCard('c2'), makeHandCard('c3')],
    }

    const merged = mergeRemoteWithOptimistic(remote, { optimisticCard: null, inFlightHandId: null })

    expect(merged.playedCards).toHaveLength(1)
    expect(merged.hand).toHaveLength(2)
    // does not mutate the inputs
    expect(remote.playedCards).toHaveLength(1)
    expect(remote.hand).toHaveLength(2)
  })

  it('appends the optimistic card when no remote record exists yet', () => {
    const optimistic = makePlayedCard('c9', 'p1', 'PENDING')
    const merged = mergeRemoteWithOptimistic(
      { playedCards: [], hand: [] },
      { optimisticCard: optimistic, inFlightHandId: null },
    )

    expect(merged.playedCards).toHaveLength(1)
    expect(merged.playedCards[0].id).toBe('c9')
  })

  it('deduplicates once the changefeed delivered the real record', () => {
    const remoteRow = makePlayedCard('c9', 'p1', 'PENDING')
    const optimistic = makePlayedCard('c9', 'p1', 'PENDING')

    const merged = mergeRemoteWithOptimistic(
      { playedCards: [remoteRow], hand: [] },
      { optimisticCard: optimistic, inFlightHandId: null },
    )

    expect(merged.playedCards).toHaveLength(1)
    expect(merged.playedCards[0]).toBe(remoteRow)
  })

  it('keeps the optimistic card when a different player played a card with the same id', () => {
    const remoteRow = makePlayedCard('c9', 'p2')
    const optimistic = makePlayedCard('c9', 'p1', 'PENDING')

    const merged = mergeRemoteWithOptimistic(
      { playedCards: [remoteRow], hand: [] },
      { optimisticCard: optimistic, inFlightHandId: null },
    )

    expect(merged.playedCards).toHaveLength(2)
  })

  it('removes the in-flight card from the hand before the DB confirms', () => {
    const card = makeHandCard('c1')
    const merged = mergeRemoteWithOptimistic(
      { playedCards: [], hand: [card, makeHandCard('c2')] },
      { optimisticCard: null, inFlightHandId: card.hand_id },
    )

    expect(merged.hand.map(c => c.id)).toEqual(['c2'])
  })

  it('removes cards from the hand once they appear on the table', () => {
    const merged = mergeRemoteWithOptimistic(
      {
        playedCards: [makePlayedCard('c1', 'p1')],
        hand: [makeHandCard('c1'), makeHandCard('c2')],
      },
      { optimisticCard: null, inFlightHandId: null },
    )

    expect(merged.hand.map(c => c.id)).toEqual(['c2'])
  })

  it('removes the optimistically played card from the hand immediately', () => {
    const merged = mergeRemoteWithOptimistic(
      { playedCards: [], hand: [makeHandCard('c1'), makeHandCard('c2')] },
      { optimisticCard: makePlayedCard('c1', 'p1', 'PENDING'), inFlightHandId: null },
    )

    expect(merged.hand.map(c => c.id)).toEqual(['c2'])
    expect(merged.playedCards.map(c => c.id)).toEqual(['c1'])
  })
})

describe('splitHand', () => {
  it('separates the ending card and counts only story cards', () => {
    const { storyCards, endingCard, handSize } = splitHand([
      makeHandCard('c1'),
      makeHandCard('end', 'ending'),
      makeHandCard('c2'),
    ])

    expect(storyCards.map(c => c.id)).toEqual(['c1', 'c2'])
    expect(endingCard?.id).toBe('end')
    expect(handSize).toBe(2)
  })

  it('handles a hand without an ending card', () => {
    const { endingCard, handSize } = splitHand([makeHandCard('c1')])

    expect(endingCard).toBeUndefined()
    expect(handSize).toBe(1)
  })
})

describe('computeCardsPlayedCount', () => {
  it('counts per player and excludes reverted records', () => {
    const counts = computeCardsPlayedCount([
      makePlayedCard('c1', 'p1'),
      makePlayedCard('c2', 'p1'),
      makePlayedCard('c3', 'p2'),
      makePlayedCard('c4', 'p2', 'REVERTED'),
    ])

    expect(counts).toEqual({ p1: 2, p2: 1 })
  })

  it('ignores records without a player', () => {
    const counts = computeCardsPlayedCount([makePlayedCard('c1', '')])
    expect(counts).toEqual({})
  })
})

describe('findPendingCard', () => {
  it('finds the card awaiting confirmation', () => {
    const pending = makePlayedCard('c2', 'p1', 'PENDING')
    expect(findPendingCard([makePlayedCard('c1', 'p2'), pending])).toBe(pending)
  })

  it('returns undefined when everything is confirmed', () => {
    expect(findPendingCard([makePlayedCard('c1', 'p2', 'CONFIRMED')])).toBeUndefined()
  })
})
