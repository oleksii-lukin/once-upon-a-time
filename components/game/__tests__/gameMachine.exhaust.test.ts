import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { gameMachine } from '../gameMachine'

/**
 * Deck-exhaustion tests (specs/user-stories/deck-exhaustion.md).
 *
 * An empty draw pile is a legitimate game state, not an error: a draw of
 * 0 cards must not block the pass, the objection penalty, or the
 * challenge penalty. Only an exchange legitimately fails (and then the
 * turn is not consumed).
 */

const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SESSION = '11111111-1111-4111-8111-111111111111'
const LOBBY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const passTurnCalls: Array<{ nextPlayerId: string }> = []
let exchangeFails: boolean

function buildMachine() {
  return gameMachine.provide({
    actors: {
      playCardActor: fromPromise(async ({ input }: any) => ({ id: `pc-${input.cardId}` })) as any,
      // The fixed action returns ok on an empty pile (draw 0), so the
      // mocked actor resolves — the empty-pile semantic lives in the action.
      drawCardsActor: fromPromise(async () => true) as any,
      passTurnActor: fromPromise(async ({ input }: any) => {
        passTurnCalls.push(input)
        return true
      }) as any,
      confirmCardActor: fromPromise(async () => true) as any,
      finalizeWinActor: fromPromise(async () => true) as any,
      objectActor: fromPromise(async ({ input }: any) => input) as any,
      exchangeCardActor: fromPromise(async () => {
        if (exchangeFails) throw new Error('No cards in draw pile')
        return true
      }) as any,
      timerSyncActor: fromPromise(async () => ({ success: true })) as any,
      timerExtensionActor: fromPromise(async () => ({ needsExtension: false })) as any,
    },
  })
}

const players = [
  { id: P1, role: 'storyteller', turn_order: 0 },
  { id: P2, role: 'player', turn_order: 1 },
] as any

const startGameEvent = {
  type: 'START_GAME' as const,
  gameSessionId: SESSION,
  lobbyId: LOBBY,
  mode: 'full' as const,
  currentPlayerId: P1,
  localPlayerId: P1,
  players,
  pacingDelay: 0,
  timerDuration: 0,
}

beforeEach(() => {
  vi.useRealTimers()
  passTurnCalls.length = 0
  exchangeFails = false
})

describe('deck exhaustion', () => {
  it('a pass with an empty pile still passes the turn (draw 0)', async () => {
    const actor = createActor(buildMachine()).start()
    actor.send(startGameEvent)

    actor.send({ type: 'PASS' })

    await vi.waitFor(() => {
      expect(passTurnCalls).toHaveLength(1)
    }, { timeout: 2000 })

    expect(passTurnCalls[0].nextPlayerId).toBe(P2)
    expect(actor.getSnapshot().context.currentPlayerId).toBe(P2)
    expect(actor.getSnapshot().context.lastPersistenceError).toBeNull()
  })

  it('an objection penalty draw with an empty pile still passes the turn to the objector', async () => {
    const actor = createActor(buildMachine()).start()
    actor.send({ ...startGameEvent, pacingDelay: 2 })

    actor.send({ type: 'PLAY_CARD', card: { id: 'card-1', name: 'Card 1' } as any, playedCardsCount: 1 })
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.inFlightHandId).toBe('card-1')
    }, { timeout: 2000 })

    actor.send({
      type: 'OBJECT',
      playedCardId: 'card-1',
      storytellerId: P1,
      nextPlayerId: P2,
    })

    await vi.waitFor(() => {
      expect(passTurnCalls).toHaveLength(1)
    }, { timeout: 2000 })

    expect(passTurnCalls[0].nextPlayerId).toBe(P2)
    expect(actor.getSnapshot().context.currentPlayerId).toBe(P2)
    expect(actor.getSnapshot().context.lastPersistenceError).toBeNull()
  })

  it('a failed exchange (empty pile) does not consume the turn', async () => {
    exchangeFails = true
    const actor = createActor(buildMachine()).start()
    actor.send(startGameEvent)

    actor.send({ type: 'EXCHANGE', cardId: 'card-1' })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.lastPersistenceError).toContain('No cards in draw pile')
    }, { timeout: 2000 })

    // The storyteller keeps the turn: no pass was persisted.
    expect(passTurnCalls).toHaveLength(0)
    expect(actor.getSnapshot().context.currentPlayerId).toBe(P1)
    // The machine stays playable (can retry pass/play).
    expect(actor.getSnapshot().context.canPlayMoreCards).toBe(true)
  })
})
