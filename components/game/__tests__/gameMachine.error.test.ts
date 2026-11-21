import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { gameMachine } from '../gameMachine'

/**
 * Error-path tests: every persistence/winning invoke now has an onError
 * transition, so a rejected server action surfaces `lastPersistenceError`
 * and returns the machine to a recoverable state instead of wedging it
 * (previously updateTurn / objecting / penalty / confirmingCard /
 * finalizing had no onError at all).
 */

const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SESSION = '11111111-1111-4111-8111-111111111111'
const LOBBY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const passTurnCalls: Array<{ nextPlayerId: string }> = []

/** Machine whose persistence actors can be made to fail per test. */
function buildMachine(fail: { passTurn?: boolean, object?: boolean, draw?: boolean, confirm?: boolean, finalize?: boolean }) {
  return gameMachine.provide({
    actors: {
      playCardActor: fromPromise(async ({ input }: any) => ({ id: `pc-${input.cardId}` })) as any,
      drawCardsActor: fromPromise(async () => {
        if (fail.draw) throw new Error('draw failed')
        return true
      }) as any,
      passTurnActor: fromPromise(async ({ input }: any) => {
        if (fail.passTurn) throw new Error('passTurn failed')
        passTurnCalls.push(input)
        return true
      }) as any,
      confirmCardActor: fromPromise(async () => {
        if (fail.confirm) throw new Error('confirm failed')
        return true
      }) as any,
      finalizeWinActor: fromPromise(async () => {
        if (fail.finalize) throw new Error('finalize failed')
        return true
      }) as any,
      objectActor: fromPromise(async ({ input }: any) => {
        if (fail.object) throw new Error('object failed')
        return input
      }) as any,
      exchangeCardActor: fromPromise(async () => true) as any,
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
  players,
  pacingDelay: 0,
  timerDuration: 0,
}

beforeEach(() => {
  vi.useRealTimers()
  passTurnCalls.length = 0
})

describe('gameMachine error recovery', () => {
  it('passTurn failure surfaces an error instead of wedging', async () => {
    const actor = createActor(buildMachine({ passTurn: true })).start()
    actor.send(startGameEvent)
    actor.send({ type: 'PASS' })

    await vi.waitFor(() => {
      const snap = actor.getSnapshot()
      expect(snap.value).toMatchObject({ active: { persistence: 'idle' } })
      expect(snap.context.lastPersistenceError).toBe('passTurn failed')
    }, { timeout: 3000 })
    expect(passTurnCalls).toHaveLength(0)
  })

  it('confirmCard failure rolls back the optimistic card and returns to idle', async () => {
    const actor = createActor(buildMachine({ confirm: true })).start()
    actor.send(startGameEvent)

    actor.send({ type: 'PLAY_CARD', card: { id: 'card-1' } as any, playedCardsCount: 1 })
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.lastPlayedCardId).toBe('pc-card-1')
    })

    // With pacing 0 the child confirms immediately → confirmingCard invoke
    // fails → idle + error, optimistic state rolled back.
    await vi.waitFor(() => {
      const snap = actor.getSnapshot()
      expect(snap.value).toMatchObject({ active: { persistence: 'idle' } })
      expect(snap.context.lastPersistenceError).toBe('confirm failed')
      expect(snap.context.optimisticCard).toBeNull()
      expect(snap.context.inFlightHandId).toBeNull()
    }, { timeout: 3000 })
  })

  it('objection persistence failure returns to idle with an error', async () => {
    const actor = createActor(buildMachine({ object: true })).start()
    actor.send(startGameEvent)

    actor.send({ type: 'PLAY_CARD', card: { id: 'card-1' } as any, playedCardsCount: 1 })
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ active: { persistence: 'idle' } })
    })

    actor.send({ type: 'OBJECT', playedCardId: 'pc-1', storytellerId: P1, nextPlayerId: P2 })

    await vi.waitFor(() => {
      const snap = actor.getSnapshot()
      expect(snap.value).toMatchObject({ active: { persistence: 'idle' } })
      expect(snap.context.lastPersistenceError).toBe('object failed')
    }, { timeout: 3000 })
    expect(passTurnCalls).toHaveLength(0)
  })

  it('a failed penalty draw still passes the turn to the objector', async () => {
    const actor = createActor(buildMachine({ draw: true })).start()
    actor.send(startGameEvent)

    actor.send({ type: 'PLAY_CARD', card: { id: 'card-1' } as any, playedCardsCount: 1 })
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ active: { persistence: 'idle' } })
    })

    actor.send({ type: 'OBJECT', playedCardId: 'pc-1', storytellerId: P1, nextPlayerId: P2 })

    // draw fails → skip straight to updateTurn → passTurn still runs
    await vi.waitFor(() => {
      const snap = actor.getSnapshot()
      expect(snap.context.currentPlayerId).toBe(P2)
      expect(snap.value).toMatchObject({ active: { persistence: 'idle' } })
      expect(snap.context.lastPersistenceError).toBe('draw failed')
    }, { timeout: 3000 })
    expect(passTurnCalls[0]).toMatchObject({ gameSessionId: SESSION, nextPlayerId: P2 })
  })

  it('finalizeWin failure returns to active play instead of wedging', async () => {
    const actor = createActor(buildMachine({ finalize: true })).start()
    actor.send(startGameEvent)

    actor.send({ type: 'WIN_GAME', card: { id: 'card-ending', type: 'ending' } as any, playedCardsCount: 6 })

    await vi.waitFor(() => {
      const snap = actor.getSnapshot()
      expect(snap.value).toMatchObject({ active: {} })
      expect(snap.context.lastPersistenceError).toBe('finalize failed')
    }, { timeout: 4000 })
  })

  it('a failed win-card play abandons the win attempt and keeps playing', async () => {
    const failing = gameMachine.provide({
      actors: {
        playCardActor: fromPromise(async () => {
          throw new Error('playCard failed')
        }) as any,
        drawCardsActor: fromPromise(async () => true) as any,
        passTurnActor: fromPromise(async () => true) as any,
        confirmCardActor: fromPromise(async () => true) as any,
        finalizeWinActor: fromPromise(async () => true) as any,
        objectActor: fromPromise(async ({ input }: any) => input) as any,
        exchangeCardActor: fromPromise(async () => true) as any,
        timerSyncActor: fromPromise(async () => ({ success: true })) as any,
        timerExtensionActor: fromPromise(async () => ({ needsExtension: false })) as any,
      },
    })
    const winActor = createActor(failing).start()
    winActor.send(startGameEvent)
    winActor.send({ type: 'WIN_GAME', card: { id: 'card-ending', type: 'ending' } as any, playedCardsCount: 6 })

    await vi.waitFor(() => {
      const snap = winActor.getSnapshot()
      expect(snap.value).toMatchObject({ active: {} })
      expect(snap.context.lastPersistenceError).toBe('playCard failed')
    }, { timeout: 3000 })
  })
})
