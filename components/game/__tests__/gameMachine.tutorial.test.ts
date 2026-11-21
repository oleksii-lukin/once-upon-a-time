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

describe('gameMachine - Tutorial Mode Integration', () => {
  const players = [
    { id: 'player-1', role: 'storyteller', turn_order: 0, joined_at: new Date().toISOString() },
    { id: 'player-2', role: 'storyteller', turn_order: 1, joined_at: new Date().toISOString() },
  ]

  const startGameEvent = {
    type: 'START_GAME' as const,
    gameSessionId: 'session-123',
    lobbyId: 'lobby-123',
    mode: 'tutorial' as const,
    currentPlayerId: 'player-1',
    players: players as any,
    pacingDelay: 0, // Disable pacing for simplicity
    timerDuration: 0, // Disable timer
  }

  beforeEach(() => {
    vi.useRealTimers()
  })

  it('should only allow playing one card and then auto-pass', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'tutorial' } })

    const card = { id: 'card-1', name: 'Card 1' }

    // Play first card
    actor.send({ type: 'PLAY_CARD', card: card as any, playedCardsCount: 1 })

    // In Tutorial mode, after 1 card, it should finish and trigger persistence PASS
    // Then it should transition to the next player
    await vi.waitFor(() => {
      // Check if it reached persistence passingTurn
      expect(actor.getSnapshot().context.canPlayMoreCards).toBe(true); // Reset for next turn
    }, { timeout: 2000 })

    // Verify next player is player-2
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe('player-2')
    })
  })

  it('should not allow playing a second card in the same turn', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    const card1 = { id: 'card-1', name: 'Card 1' }
    const card2 = { id: 'card-2', name: 'Card 2' }

    // Play first card
    actor.send({ type: 'PLAY_CARD', card: card1 as any, playedCardsCount: 1 })

    // Immediately try to play second card (might fail guard if still in same turn)
    // Actually, it might be in 'playingCard' persistence state which blocks PLAY_CARD
    actor.send({ type: 'PLAY_CARD', card: card2 as any, playedCardsCount: 2 })

    // Verify only card-1 was processed (optimistic card should be card-1 or null)
    const snapshot = actor.getSnapshot()
    expect(snapshot.context.optimisticCard?.id).not.toBe('card-2')
  })
})
