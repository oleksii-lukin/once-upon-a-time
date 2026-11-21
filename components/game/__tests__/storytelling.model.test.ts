import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startChild, type Harness } from './storytellingHarness'

/**
 * Model-based tests for the unified storytelling machine.
 *
 * Instead of hand-picked scenarios, these walk pseudo-random event
 * sequences (seeded PRNG — fully reproducible) for every mode and assert
 * invariants that must hold no matter what happens:
 *
 *  I1  the card count never exceeds the mode's card limit
 *  I2  modes without interrupts never enter `interruption`
 *  I3  modes without objections never enter `cardPlay.objecting`
 *  I4  card counts are monotone non-decreasing
 *  I5  `finished` output reasons come from the known set, and the
 *      next-player override is present exactly for interrupted/objected
 *  I6  only tutorial can finish with `card_limit_reached`
 *
 * Timers are frozen so PACING_DELAY never fires mid-sequence: every
 * assertion sees a deterministic synchronous state.
 */

type Mode = 'tutorial' | 'simple' | 'full' | 'solo'
const MODES: Mode[] = ['tutorial', 'simple', 'full', 'solo']

const VALID_REASONS = ['passed', 'exchanged', 'interrupted', 'objected', 'card_limit_reached'] as const
const ARBITRATED_REASONS = ['interrupted', 'objected']

const EVENTS = [
  { type: 'PLAY_CARD', cardId: 'c1' },
  { type: 'PLAY_CARD', cardId: 'c2' },
  { type: 'PLAY_CARD_ACK', playedCardId: 'p1' },
  { type: 'PLAY_CARD_ACK', playedCardId: 'p2' },
  { type: 'PASS' },
  { type: 'EXCHANGE' },
  { type: 'INTERRUPT', player_id: 'p2', card_id: 'c1' },
  { type: 'OBJECT', player_id: 'p2', played_card_id: 'p1' },
  { type: 'VALID' },
  { type: 'INVALID' },
  { type: 'CONFIRM' },
]

/** Deterministic PRNG so failures are reproducible by seed. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface SequenceState {
  lastCardCount: number
}

function assertMidSequence(mode: Mode, h: Harness, state: SequenceState) {
  const parent = h.parent()
  if (parent.value === 'done') {
    assertFinished(mode, parent.context.result)
    return false // stop the sequence
  }

  const child = h.child()
  expect(child).toBeDefined()
  const ctx = child.context

  // I1 — card limit respected at every step
  if (ctx.maxCardsPerTurn != null) {
    expect(ctx.cardsPlayedThisTurn).toBeLessThanOrEqual(ctx.maxCardsPerTurn)
  }

  // I4 — card count never decreases
  expect(ctx.cardsPlayedThisTurn).toBeGreaterThanOrEqual(state.lastCardCount)
  state.lastCardCount = ctx.cardsPlayedThisTurn

  // I2 — interrupt-disabled modes never enter arbitration
  if (!ctx.canInterrupt) {
    expect(child.value).not.toBe('interruption')
  }

  // I3 — objection-disabled modes never enter the objection state
  if (!ctx.canObject) {
    expect(child.value).not.toEqual({ cardPlay: 'objecting' })
  }

  return true
}

function assertFinished(mode: Mode, result: { reason?: string, nextPlayerId?: string }) {
  // I5 — known reasons, override only from arbitration
  expect(VALID_REASONS).toContain(result.reason)
  if (ARBITRATED_REASONS.includes(result.reason as any)) {
    expect(result.nextPlayerId).toBe('p2')
  }
  else {
    expect(result.nextPlayerId).toBeUndefined()
  }

  // I6 — only tutorial has a card limit
  if (mode === 'tutorial') {
    expect(['passed', 'exchanged', 'card_limit_reached']).toContain(result.reason)
  }
  else {
    expect(result.reason).not.toBe('card_limit_reached')
  }
}

function runSequence(mode: Mode, seed: number) {
  const random = mulberry32(seed)
  const h = startChild(mode, 5) // pacing delay keeps the objection window open
  const state: SequenceState = { lastCardCount: 0 }

  for (let step = 0; step < 40; step++) {
    const event = EVENTS[Math.floor(random() * EVENTS.length)]
    h.send({ ...event })

    if (!assertMidSequence(mode, h, state)) break
  }
}

describe('storytelling machine - model-based invariants', () => {
  beforeEach(() => {
    vi.useFakeTimers() // freeze PACING_DELAY: sequences stay synchronous
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(MODES)('%s: 30 random event sequences hold all invariants', (mode) => {
    for (let seed = 1; seed <= 30; seed++) {
      runSequence(mode, seed)
    }
  })

  it('tutorial sequences can only end via pass, exchange or the card limit', () => {
    // High card-play density: PLAY_CARD/ACK pairs dominate so the card
    // limit is actually reached inside the sequences.
    for (let seed = 100; seed < 120; seed++) {
      const random = mulberry32(seed)
      const h = startChild('tutorial', 5)
      const state: SequenceState = { lastCardCount: 0 }

      for (let step = 0; step < 40; step++) {
        // bias towards playing cards
        const event = random() < 0.7
          ? EVENTS[Math.floor(random() * 4)] // PLAY_CARD / ACK only
          : EVENTS[Math.floor(random() * EVENTS.length)]
        h.send({ ...event })

        if (!assertMidSequence('tutorial', h, state)) break
      }
    }
  })

  it('finishes deterministically on the card limit under card-heavy input', () => {
    // pacingDelay 0: confirmation (and therefore decideNext) is synchronous
    const h = startChild('tutorial', 0)

    h.send({ type: 'PLAY_CARD', cardId: 'c1' })
    h.send({ type: 'PLAY_CARD_ACK', playedCardId: 'p1' })

    expect(h.parent().value).toBe('done')
    expect(h.parent().context.result).toMatchObject({ reason: 'card_limit_reached' })
  })
})
