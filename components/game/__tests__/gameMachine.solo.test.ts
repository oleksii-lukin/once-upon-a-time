import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { gameMachine } from '../gameMachine'
import { type GameContext, type GameEvent, type GameActors } from '../gameTypes'

// Mock Supabase client
vi.mock('@/utils/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: {}, error: null }))
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      })),
    })),
  })),
}))

// Mock common actors with any casting to bypass strict types in tests
const mockPromiseActor = fromPromise(async () => ({ success: true }))

const testMachine = gameMachine.provide({
  actors: {
    playCardActor: fromPromise(async ({ input }: any) => {
      return { id: input.cardId } as any
    }),
    drawCardsActor: mockPromiseActor as any,
    passTurnActor: mockPromiseActor as any,
    confirmCardActor: mockPromiseActor as any,
    finalizeWinActor: mockPromiseActor as any,
    objectActor: mockPromiseActor as any,
    exchangeCardActor: mockPromiseActor as any,
    timerSyncActor: mockPromiseActor as any,
    timerExtensionActor: fromPromise(async () => ({ needsExtension: false })) as any,
  },
})

describe('gameMachine - Solo Mode Integration', () => {
  const defaultPlayer = {
    id: 'player-1',
    role: 'storyteller',
    turn_order: 0,
    joined_at: new Date().toISOString()
  }

  const startGameEvent = {
    type: 'START_GAME' as const,
    gameSessionId: 'session-123',
    lobbyId: 'lobby-123',
    mode: 'solo' as const,
    currentPlayerId: 'player-1',
    players: [defaultPlayer as any],
    pacingDelay: 2,
    timerDuration: 30,
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should play multiple cards and track count', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    const card1 = { id: 'card-1', name: 'Card 1' }
    const card2 = { id: 'card-2', name: 'Card 2' }

    // Play first card
    actor.send({ type: 'PLAY_CARD', card: card1 as any, playedCardsCount: 1 })

    // In Solo mode + pacing delay 2s, it goes through cardPlay.pending
    expect(actor.getSnapshot().context.optimisticCard?.id).toBe('card-1')

    // Fast-forward pacing delay
    vi.advanceTimersByTime(2500)

    // Should now be back in narrating state in the child actor
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'solo' } })
    })

    // Play second card
    actor.send({ type: 'PLAY_CARD', card: card2 as any, playedCardsCount: 2 })
    vi.advanceTimersByTime(2500)

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'solo' } })
    })
  })

  it('should confirm card immediately if pacing delay is 0', async () => {
    const actor = createActor(testMachine).start()
    actor.send({ ...startGameEvent, pacingDelay: 0 })

    const card = { id: 'card-1', name: 'Card 1' }
    actor.send({ type: 'PLAY_CARD', card: card as any, playedCardsCount: 1 })

    // If delay is 0, ruleSolo goes to confirmed immediately and sends CONFIRM_CARD
    // Parent handles CONFIRM_CARD and persistence goes to confirmingCard -> idle
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'solo' } })
    })
  })

  it('should pass turn and trigger persistence', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    actor.send({ type: 'PASS' })

    // PASS in ruleSolo triggers onDone in parent, which resets and triggers PASS to persistence
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({
        active: {
          persistence: 'passingTurn'
        }
      })
    })
  })

  it('should handle EXCHANGE and trigger exchangingCard in persistence', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    // EXCHANGE is handled by child machine and also triggers persistence update
    actor.send({ type: 'EXCHANGE', cardId: 'card-1' })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({
        active: {
          persistence: 'exchangingCard'
        }
      })
    })
  })

  it('should start timer when beginning turn', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    // START_GAME triggers START_TIMER (via initial transition or explicitly)
    // In gameMachine, START_GAME -> active.rules.decideMode -> .solo
    // Persistence.idle handles START_GAME by doing nothing specially?
    // Wait, timer state handles it?

    await vi.waitFor(() => {
      const context = actor.getSnapshot().context
      expect(context.timerSyncInput).toMatchObject({
        action: 'start',
        isEnabled: true,
        duration: 30
      })
    })
  })

  it('should handle timer expiration by auto-passing', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    actor.send({ type: 'TIMER_EXPIRED' })

    // TIMER_EXPIRED causes parent to raise PASS
    // This triggers persistence passingTurn, which then finishes and resets back to solo rules
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({
        active: {
          rules: 'solo',
          persistence: 'idle'
        }
      })
    })
  })

  it('should disable timer if timerDuration is 0', async () => {
    const actor = createActor(testMachine).start()
    actor.send({ ...startGameEvent, timerDuration: 0 })

    await vi.waitFor(() => {
      const context = actor.getSnapshot().context
      expect(context.timerSyncInput).toMatchObject({
        isEnabled: false
      })
    })
  })
})
