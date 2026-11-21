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
    objectActor: fromPromise(async () => {
      return { success: true, storytellerId: 'player-1' } as any
    }),
    exchangeCardActor: mockPromiseActor as any,
    timerSyncActor: mockPromiseActor as any,
    timerExtensionActor: fromPromise(async () => ({ needsExtension: false })) as any,
  },
})

describe('gameMachine - Full Mode Integration', () => {
  const players = [
    { id: 'player-1', role: 'storyteller', turn_order: 0, joined_at: new Date().toISOString() },
    { id: 'player-2', role: 'storyteller', turn_order: 1, joined_at: new Date().toISOString() },
  ]

  const startGameEvent = {
    type: 'START_GAME' as const,
    gameSessionId: 'session-123',
    lobbyId: 'lobby-123',
    mode: 'full' as const,
    currentPlayerId: 'player-1',
    players: players as any,
    pacingDelay: 2, // Enable pacing for objections/interrupts
    timerDuration: 30,
  }

  beforeEach(() => {
    vi.useRealTimers()
  })

  it('should handle INTERRUPT and transition to interrupter', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    // Player 2 interrupts
    actor.send({ type: 'INTERRUPT', nextPlayerId: 'player-2' })

    // Give it a moment to reach the interruption state
    await new Promise(r => setTimeout(r, 100))

    // Send VALID to finish the interruption (parent machine forwards it to child)
    actor.send({ type: 'VALID' })

    // In Full mode, INTERRUPT + VALID should finish ruleFull and transition to player-2
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe('player-2')
    }, { timeout: 3000 })
  })

  it('should handle OBJECT and transition to objector', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    // Player 1 plays card
    const card = { id: 'card-1', name: 'Card 1' }
    actor.send({ type: 'PLAY_CARD', card: card as any, playedCardsCount: 1 })

    // Wait for internal card confirmation cycle to reach pending
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.inFlightHandId).toBe('card-1')
    })

    // Player 2 objects during pacing delay
    actor.send({
      type: 'OBJECT',
      playedCardId: 'card-1',
      storytellerId: 'player-1',
      nextPlayerId: 'player-2'
    })

    // Send VALID to finish the objection
    actor.send({ type: 'VALID' })

    // OBJECT + VALID should finish ruleFull with 'objected' reason and transition to player-2
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.currentPlayerId).toBe('player-2')
    }, { timeout: 3000 })
  })

  it('should continue turn after normal card confirmation', async () => {
    const actor = createActor(testMachine).start()
    actor.send(startGameEvent)

    const card = { id: 'card-1', name: 'Card 1' }
    actor.send({ type: 'PLAY_CARD', card: card as any, playedCardsCount: 1 })

    // Wait for auto-confirm (pacingDelay is 2s)
    await new Promise(r => setTimeout(r, 2500))

    // Should still be player-1, child machine should be back in narrating
    expect(actor.getSnapshot().context.currentPlayerId).toBe('player-1')
    expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'full' } })
  })
})
