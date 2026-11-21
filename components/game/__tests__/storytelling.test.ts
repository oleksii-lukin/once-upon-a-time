import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for the unified storytelling machine: mode behavior is
 * data (MODE_CONFIG), so these tests form the mode matrix that used to
 * be spread across four separate machine files.
 *
 * The child is run under a minimal parent harness because CONFIRM_CARD
 * is delivered via sendParent (which throws when no parent exists), and
 * because the finished-state output is only observable through the
 * invoke's onDone — exactly how the real game machine consumes it.
 */

import { startChild } from './storytellingHarness'

beforeEach(() => {
  vi.useRealTimers()
})

describe('storytelling machine - tutorial (max 1 card)', () => {
  it('finishes after the first confirmed card with card_limit_reached', () => {
    const h = startChild('tutorial')
    expect(h.child().value).toBe('narrating')

    h.send({ type: 'PLAY_CARD', cardId: 'c1' })
    h.send({ type: 'PLAY_CARD_ACK', playedCardId: 'p1' })

    // pacingDelay 0 → confirm immediately → decideNext hits the card limit
    expect(h.parent().value).toBe('done')
    expect(h.parent().context.result).toMatchObject({ reason: 'card_limit_reached' })
  })

  it('ignores interrupts (canInterrupt is false)', () => {
    const h = startChild('tutorial')
    h.send({ type: 'INTERRUPT', player_id: 'p2', card_id: 'c1' })

    expect(h.child().value).toBe('narrating')
  })
})

describe('storytelling machine - simple (unlimited cards)', () => {
  it('loops back to narrating after each confirmed card', () => {
    const h = startChild('simple')

    h.send({ type: 'PLAY_CARD', cardId: 'c1' })
    h.send({ type: 'PLAY_CARD_ACK', playedCardId: 'p1' })
    expect(h.child().value).toBe('narrating')

    h.send({ type: 'PLAY_CARD', cardId: 'c2' })
    h.send({ type: 'PLAY_CARD_ACK', playedCardId: 'p2' })
    expect(h.child().value).toBe('narrating')
    expect(h.child().context.cardsPlayedThisTurn).toBe(2)
  })

  it('ignores interrupts and objections', () => {
    const h = startChild('simple', 5)

    h.send({ type: 'INTERRUPT', player_id: 'p2', card_id: 'c1' })
    expect(h.child().value).toBe('narrating')

    h.send({ type: 'PLAY_CARD', cardId: 'c1' })
    h.send({ type: 'PLAY_CARD_ACK', playedCardId: 'p1' })
    h.send({ type: 'OBJECT', player_id: 'p2', played_card_id: 'p1' })

    // objection disabled → still sitting in the pacing window
    expect(h.child().value).toMatchObject({ cardPlay: 'pending' })
  })

  it('finishes with reason "passed" on PASS', () => {
    const h = startChild('simple')
    h.send({ type: 'PASS' })

    expect(h.parent().value).toBe('done')
    expect(h.parent().context.result).toMatchObject({ reason: 'passed' })
  })
})

describe('storytelling machine - full (interrupts and objections)', () => {
  it('runs the interrupt arbitration', () => {
    const h = startChild('full')

    h.send({ type: 'INTERRUPT', player_id: 'p2', card_id: 'c1' })
    expect(h.child().value).toBe('interruption')

    // rejected → back to narrating
    h.send({ type: 'INVALID' })
    expect(h.child().value).toBe('narrating')

    // accepted on a second attempt → finished with the override player
    h.send({ type: 'INTERRUPT', player_id: 'p2', card_id: 'c1' })
    h.send({ type: 'VALID' })
    expect(h.parent().value).toBe('done')
    expect(h.parent().context.result).toMatchObject({
      reason: 'interrupted',
      nextPlayerId: 'p2',
    })
  })

  it('runs the objection arbitration inside the pacing window', () => {
    const h = startChild('full', 5)

    h.send({ type: 'PLAY_CARD', cardId: 'c1' })
    h.send({ type: 'PLAY_CARD_ACK', playedCardId: 'p1' })
    expect(h.child().value).toMatchObject({ cardPlay: 'pending' })

    h.send({ type: 'OBJECT', player_id: 'p2', played_card_id: 'p1' })
    expect(h.child().value).toMatchObject({ cardPlay: 'objecting' })

    // accepted → turn over to the objector
    h.send({ type: 'VALID' })
    expect(h.parent().value).toBe('done')
    expect(h.parent().context.result).toMatchObject({
      reason: 'objected',
      nextPlayerId: 'p2',
    })
  })

  it('back to narrating when the objection is rejected', () => {
    const h = startChild('full', 5)

    h.send({ type: 'PLAY_CARD', cardId: 'c1' })
    h.send({ type: 'PLAY_CARD_ACK', playedCardId: 'p1' })
    h.send({ type: 'OBJECT', player_id: 'p2', played_card_id: 'p1' })
    h.send({ type: 'INVALID' })

    // rejected objection still confirms the card and continues the turn
    expect(h.child().value).toBe('narrating')
  })
})

describe('storytelling machine - solo (same config as simple)', () => {
  it('behaves like simple mode: loops and passes', () => {
    const h = startChild('solo')

    h.send({ type: 'PLAY_CARD', cardId: 'c1' })
    h.send({ type: 'PLAY_CARD_ACK', playedCardId: 'p1' })
    expect(h.child().value).toBe('narrating')

    h.send({ type: 'PASS' })
    expect(h.parent().value).toBe('done')
    expect(h.parent().context.result).toMatchObject({ reason: 'passed' })
  })
})
