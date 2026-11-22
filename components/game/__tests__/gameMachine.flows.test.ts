import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { gameMachine } from '../gameMachine'

/**
 * Turn-flow tests for the restructured persistence region: verifies the
 * object / challenge / winning-objection chains hand the right inputs from
 * state to state (draw → updateTurn), which is exactly what the extracted
 * input builders + merged updateTurn state guarantee.
 */

interface ActorCalls {
  draw: Array<{ gameSessionId: string, playerId: string, count: number }>
  passTurn: Array<{ gameSessionId: string, nextPlayerId: string }>
  object: Array<{ playedCardId: string, storytellerId: string, nextPlayerId: string }>
  finalize: Array<{ gameSessionId: string, winnerId: string, lobbyId: string }>
}

const calls: ActorCalls = { draw: [], passTurn: [], object: [], finalize: [] }

const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const P3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const SESSION = '11111111-1111-4111-8111-111111111111'
const LOBBY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

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
    finalizeWinActor: fromPromise(async ({ input }: any) => {
      calls.finalize.push(input)
      return true
    }) as any,
    objectActor: fromPromise(async ({ input }: any) => {
      calls.object.push(input)
      return input
    }) as any,
    exchangeCardActor: fromPromise(async () => true) as any,
    timerSyncActor: fromPromise(async () => ({ success: true })) as any,
    timerExtensionActor: fromPromise(async () => ({ needsExtension: false })) as any,
  },
})

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
  pacingDelay: 2, // keeps the objection window open (real timers, tests send within it)
  timerDuration: 0,
}

beforeEach(() => {
  vi.useRealTimers()
  calls.draw.length = 0
  calls.passTurn.length = 0
  calls.object.length = 0
  calls.finalize.length = 0
})

describe('gameMachine turn flows', () => {
  it('object flow: returns the card to the storyteller and passes the turn', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    // Storyteller plays a card → persistence settles back to idle while the
    // child machine sits in the pacing-delay objection window
    actor.send({ type: 'PLAY_CARD', card: { id: 'card-1' } as any, playedCardsCount: 1 })
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.lastPlayedCardId).toBe('pc-card-1')
      expect(actor.getSnapshot().value).toMatchObject({ active: { persistence: 'idle' } })
    })

    actor.send({
      type: 'OBJECT',
      playedCardId: 'pc-1',
      storytellerId: P1,
      nextPlayerId: P2,
    })

    // object → penalty draw (storyteller) → updateTurn (next player) → idle
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe(P2)
      expect(actor.getSnapshot().value).toMatchObject({ active: { persistence: 'idle' } })
    }, { timeout: 3000 })

    expect(calls.object[0]).toMatchObject({
      playedCardId: 'pc-1',
      storytellerId: P1,
      nextPlayerId: P2,
    })
    expect(calls.draw[0]).toMatchObject({ gameSessionId: SESSION, playerId: P1, count: 1 })
    expect(calls.passTurn[0]).toMatchObject({ gameSessionId: SESSION, nextPlayerId: P2 })
  })

  it('challenge flow: storyteller draws a penalty card and the turn passes', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    actor.send({ type: 'CHALLENGE_STUTTER', storytellerId: P1, nextPlayerId: P2 })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe(P2)
      expect(actor.getSnapshot().value).toMatchObject({ active: { persistence: 'idle' } })
    })

    expect(calls.draw[0]).toMatchObject({ gameSessionId: SESSION, playerId: P1, count: 1 })
    expect(calls.passTurn[0]).toMatchObject({ gameSessionId: SESSION, nextPlayerId: P2 })
  })

  it('objection during the winning sequence sends the game back to active', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    const endingCard = { id: 'card-ending', type: 'ending' } as any
    actor.send({ type: 'WIN_GAME', card: endingCard, playedCardsCount: 6 })

    // winning.playingCard resolves → waiting (pacing window open, timers fake)
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ winning: 'waiting' })
    })

    actor.send({
      type: 'OBJECT',
      playedCardId: 'pc-end',
      storytellerId: P1,
      nextPlayerId: P2,
    })

    // winning.objecting → penalty → updateTurn → back to #gameRoot.active
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe(P2)
      expect(actor.getSnapshot().value).toMatchObject({ active: { persistence: 'idle' } })
    }, { timeout: 3000 })

    expect(calls.draw[0]).toMatchObject({ playerId: P1, count: 1 })
    expect(calls.passTurn[0]).toMatchObject({ nextPlayerId: P2 })
    expect(calls.finalize).toHaveLength(0) // the win was objected, not finalized
  })

  it('rejected interrupt follows turn order, not the stale redirect', async () => {
    // 3 players: P1 narrating, P3 interrupts OUT of turn order, the arbiter
    // rejects (INVALID). A later pass must advance by turn order (P2), not
    // jump to the rejected interrupter (P3) — the parent's context used to
    // keep the stale redirect and leak it into the finished-turn output.
    const actor = createActor(testMachine).start()
    actor.send({
      ...startGameEvent,
      players: [
        { id: P1, role: 'storyteller', turn_order: 0 },
        { id: P2, role: 'player', turn_order: 1 },
        { id: P3, role: 'player', turn_order: 2 },
      ] as any,
    })

    actor.send({ type: 'INTERRUPT', nextPlayerId: P3 })
    actor.send({ type: 'INVALID' })
    actor.send({ type: 'PASS' })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe(P2)
      expect(calls.passTurn[0]).toMatchObject({ gameSessionId: SESSION, nextPlayerId: P2 })
    }, { timeout: 3000 })
  })

  it('win flow without objection finalizes through finalizeWinActor', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    const endingCard = { id: 'card-ending', type: 'ending' } as any
    actor.send({ type: 'WIN_GAME', card: endingCard, playedCardsCount: 6 })

    // Real timers: waiting elapses after the pacing delay (2s), then
    // confirming → finalizing → gameOver
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('gameOver')
    }, { timeout: 4000 })

    expect(calls.finalize[0]).toMatchObject({
      gameSessionId: SESSION,
      winnerId: P1,
      lobbyId: LOBBY,
    })
  })
})

describe('last-moment objection race', () => {
  /** Confirm hangs until the test releases it — pins the machine in `confirming`. */
  function buildHangingConfirmMachine() {
    let releaseConfirm!: () => void
    const confirmGate = new Promise<void>((resolve) => { releaseConfirm = resolve })
    const machine = gameMachine.provide({
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
        confirmCardActor: fromPromise(async () => {
          await confirmGate
          return true
        }) as any,
        finalizeWinActor: fromPromise(async () => true) as any,
        objectActor: fromPromise(async ({ input }: any) => {
          calls.object.push(input)
          return input
        }) as any,
        exchangeCardActor: fromPromise(async () => true) as any,
        timerSyncActor: fromPromise(async () => ({ success: true })) as any,
        timerExtensionActor: fromPromise(async () => ({ needsExtension: false })) as any,
      },
    })
    return { machine, releaseConfirm }
  }

  it('an objection arriving while the card is confirming is dropped without wedging', async () => {
    const { machine, releaseConfirm } = buildHangingConfirmMachine()
    const actor = createActor(machine).start()
    // pacingDelay 0: the card goes straight from waiting into confirming
    actor.send({ ...startGameEvent, pacingDelay: 0 })

    actor.send({ type: 'PLAY_CARD', card: { id: 'card-1', name: 'Card 1' } as any, playedCardsCount: 1 })

    // The machine pins itself in confirming (confirm never resolves yet).
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ active: { persistence: 'confirmingCard' } })
    }, { timeout: 2000 })

    // Last-moment objection: the window just closed. It must be dropped —
    // no objecting state, no penalty, no turn change, no wedge.
    actor.send({
      type: 'OBJECT',
      playedCardId: 'card-1',
      storytellerId: P1,
      nextPlayerId: P2,
    })
    await new Promise(r => setTimeout(r, 50))

    expect(actor.getSnapshot().value).toMatchObject({ active: { persistence: 'confirmingCard' } })
    expect(calls.object).toHaveLength(0)
    expect(calls.passTurn).toHaveLength(0)

    // Confirmation completes normally afterwards.
    releaseConfirm()
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ active: { persistence: 'idle' } })
    }, { timeout: 2000 })

    expect(actor.getSnapshot().context.currentPlayerId).toBe(P1)
    expect(actor.getSnapshot().context.lastPersistenceError).toBeNull()
  })
})
