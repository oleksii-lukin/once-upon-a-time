import { describe, it, expect, vi } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { gameMachine } from '../gameMachine'
import { mockDeck } from '@/tests/mocks/deck'

// Mock Supabase client
vi.mock('@/utils/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
    })),
  })),
}))

// Mock actors that perform side effects
const mockPromiseActor = fromPromise(async ({ input }: { input: any }) => {
  return { id: input.cardId || 'mock-id', ...input }
})

const testMachine = gameMachine.provide({
  actors: {
    playCardActor: mockPromiseActor,
    drawCardsActor: mockPromiseActor,
    passTurnActor: mockPromiseActor,
    confirmCardActor: mockPromiseActor,
    finalizeWinActor: mockPromiseActor,
  }
})

describe('Solo Mode Workflow', () => {
  it('should complete the game after playing 5 cards and then an ending card', async () => {
    const actor = createActor(testMachine).start()

    // 1. Start game in solo mode
    actor.send({
      type: 'START_GAME',
      gameSessionId: 'session-123',
      lobbyId: 'lobby-123',
      mode: 'solo',
      currentPlayerId: 'player-1',
      players: [
        { id: 'player-1', role: 'storyteller', turn_order: 0, joined_at: new Date().toISOString() } as any
      ],
      pacingDelay: 0
    })

    expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'solo', persistence: 'idle' } })

    // 2. Play 5 normal cards
    const storyCards = mockDeck.filter(c => c.type === 'story').slice(0, 5)

    for (let i = 0; i < 5; i++) {
      actor.send({
        type: 'PLAY_CARD',
        card: storyCards[i],
        playedCardsCount: i
      })

      // Wait for persistence to complete (it's a mock promise so it's fast)
      // In XState 5, we might need to wait for the actor to reach the expected state
      // or use a helper to wait for transitions.

      // For simplicity in this test, we can check the snapshot after each send
      // since our mockPromiseActor resolves immediately.
    }

    // 3. Play ending card
    const endingCard = mockDeck.find(c => c.type === 'ending')!
    actor.send({
      type: 'WIN_GAME',
      card: endingCard,
      playedCardsCount: 5
    })

    // Should transition to winning state
    expect(actor.getSnapshot().value).toMatchObject({ winning: 'playingCard' })

    // Wait for winning state transitions (playingCard -> waiting -> confirming -> finalizing -> gameOver)
    // Since everything is mocked and pacingDelay is 0, it should happen quickly.

    // We might need to wait a bit or use a helper to wait for the final state
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(actor.getSnapshot().value).toBe('gameOver')
  })
})
