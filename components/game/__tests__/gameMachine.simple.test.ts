import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { gameMachine } from '../gameMachine'

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

// Mock common actors
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

describe('gameMachine - Simple Mode Integration', () => {
  const players = [
    { id: 'player-1', role: 'storyteller', turn_order: 0, joined_at: new Date().toISOString() },
    { id: 'player-2', role: 'storyteller', turn_order: 1, joined_at: new Date().toISOString() },
  ]

  const startGameEvent = {
    type: 'START_GAME' as const,
    gameSessionId: 'session-123',
    lobbyId: 'lobby-123',
    mode: 'simple' as const,
    currentPlayerId: 'player-1',
    players: players as any,
    pacingDelay: 0,
    timerDuration: 30,
  }

  beforeEach(() => {
    vi.useRealTimers()
  })

  it('should allow playing multiple cards and manual pass', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    const card1 = { id: 'card-1', name: 'Card 1' }
    const card2 = { id: 'card-2', name: 'Card 2' }

    // Play first card
    actor.send({ type: 'PLAY_CARD', card: card1 as any, playedCardsCount: 1 })
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'simple' } })
    })

    // Play second card
    actor.send({ type: 'PLAY_CARD', card: card2 as any, playedCardsCount: 2 })
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'simple' } })
    })

    // Manual pass
    actor.send({ type: 'PASS' })
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe('player-2')
    })
  })

  it('should not respond to INTERRUPT in simple mode', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    actor.send({ type: 'INTERRUPT', nextPlayerId: 'player-2' })

    // In Simple mode, INTERRUPT is forwarded but ignored by ruleSimple machine
    // Wait for event to be processed
    await new Promise(r => setTimeout(r, 50))

    // Should still be in simple rules with player-1
    expect(actor.getSnapshot().context.currentPlayerId).toBe('player-1')
    expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'simple' } })
  })
})
