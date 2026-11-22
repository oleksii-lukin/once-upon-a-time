import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { gameMachine } from '../gameMachine'

/**
 * Turn-order tests for 3–4 players (specs/user-stories/multiplayer-turn-order.md):
 * consecutive passes must rotate through the whole table, and a directed
 * action (objection / interrupt) must hand the turn to its ACTOR — not to
 * the storyteller's turn-order successor.
 */

interface ActorCalls {
  draw: Array<{ gameSessionId: string, playerId: string, count: number }>
  passTurn: Array<{ gameSessionId: string, nextPlayerId: string }>
}

const calls: ActorCalls = { draw: [], passTurn: [] }

const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const P3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const P4 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const SESSION = '11111111-1111-4111-8111-111111111111'
const LOBBY = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const testMachine = gameMachine.provide({
  actors: {
    playCardActor: fromPromise(async ({ input }: any) => ({ id: `pc-${input.cardId}` })) as any,
    drawCardsActor: fromPromise(async ({ input }: any) => {
      calls.draw.push(input)
      return true
    }) as any,
    passTurnActor: fromPromise(async ({ input }: any) => {
      calls.passTurn.push(input)
      return true
    }) as any,
    confirmCardActor: fromPromise(async () => true) as any,
    finalizeWinActor: fromPromise(async () => true) as any,
    objectActor: fromPromise(async ({ input }: any) => input) as any,
    exchangeCardActor: fromPromise(async () => true) as any,
    timerSyncActor: fromPromise(async () => ({ success: true })) as any,
    timerExtensionActor: fromPromise(async () => ({ needsExtension: false })) as any,
  },
})

function makePlayers(ids: string[]) {
  return ids.map((id, i) => ({ id, role: i === 0 ? 'storyteller' : 'player', turn_order: i })) as any
}

function startGame(playerIds: string[], overrides: Record<string, unknown> = {}) {
  return {
    type: 'START_GAME' as const,
    gameSessionId: SESSION,
    lobbyId: LOBBY,
    mode: 'full' as const,
    currentPlayerId: playerIds[0],
    players: makePlayers(playerIds),
    pacingDelay: 0,
    timerDuration: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useRealTimers()
  calls.draw.length = 0
  calls.passTurn.length = 0
})

describe('3–4 player turn order', () => {
  it('consecutive passes rotate through all four players and wrap around', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGame([P1, P2, P3, P4]))

    for (const expected of [P2, P3, P4, P1]) {
      actor.send({ type: 'PASS' })
      await vi.waitFor(() => {
        expect(actor.getSnapshot().context.currentPlayerId).toBe(expected)
      }, { timeout: 2000 })
    }

    expect(calls.passTurn.map(c => c.nextPlayerId)).toEqual([P2, P3, P4, P1])
    // One draw per pass (5 draws would mean a double-fire).
    expect(calls.draw).toHaveLength(4)
  })

  it('an objection by the third player hands them the turn, not the successor', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGame([P1, P2, P3], { pacingDelay: 2 }))

    actor.send({ type: 'PLAY_CARD', card: { id: 'card-1', name: 'Card 1' } as any, playedCardsCount: 1 })
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.inFlightHandId).toBe('card-1')
    }, { timeout: 2000 })

    // P3 objects while P1 is the storyteller. The successor of P1 would be
    // P2 — the objector (actor) must take the turn instead.
    actor.send({
      type: 'OBJECT',
      playedCardId: 'card-1',
      storytellerId: P1,
      nextPlayerId: P3,
    })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe(P3)
    }, { timeout: 2000 })

    expect(calls.passTurn.at(-1)?.nextPlayerId).toBe(P3)
    // The victim (P1) drew the penalty card.
    expect(calls.draw.at(-1)?.playerId).toBe(P1)
  })

  it('an interrupt auto-validates: the interrupter takes the turn and the victim draws a penalty', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGame([P1, P2, P3]))

    // P2 interrupts P1's turn. No manual VALID must be required.
    actor.send({ type: 'INTERRUPT', nextPlayerId: P2 })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe(P2)
    }, { timeout: 2000 })

    expect(calls.passTurn.at(-1)?.nextPlayerId).toBe(P2)
    // The victim (P1) drew the penalty card — the interrupt is not free.
    expect(calls.draw.at(-1)?.playerId).toBe(P1)
    expect(actor.getSnapshot().context.lastPersistenceError).toBeNull()
  })

  it('an interrupt in a mode without interrupts is ignored (no penalty, no turn change)', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGame([P1, P2, P3], { mode: 'fast' }))

    actor.send({ type: 'INTERRUPT', nextPlayerId: P2 })
    await new Promise(r => setTimeout(r, 50))

    expect(actor.getSnapshot().context.currentPlayerId).toBe(P1)
    expect(calls.draw).toHaveLength(0)
    expect(calls.passTurn).toHaveLength(0)
  })
})
