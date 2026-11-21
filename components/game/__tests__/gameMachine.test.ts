import { describe, it, expect, vi } from 'vitest'

// Mock Supabase client before importing anything else
vi.mock('@/utils/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      })),
    })),
  })),
}))

import { createActor, fromPromise, createMachine } from 'xstate'
import { gameMachine } from '../gameMachine'

// Mock actors
const mockRuleMachine = createMachine({
  id: 'mockRule',
  types: {} as {
    context: any,
    events: any,
  },
  initial: 'idle',
  states: {
    idle: {},
  },
})

const mockPromiseActor = fromPromise(async () => ({ success: true }))

const testMachine = gameMachine.provide({
  actors: {
    ruleTutorial: mockRuleMachine as any,
    ruleSimple: mockRuleMachine as any,
    ruleFull: mockRuleMachine as any,
    ruleSolo: mockRuleMachine as any,
    playCardActor: mockPromiseActor as any,
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

describe('gameMachine', () => {
  it('should start in idle state', () => {
    const actor = createActor(testMachine).start()
    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('should transition to active on START_GAME', () => {
    const actor = createActor(testMachine).start()
    actor.send({
      type: 'START_GAME',
      gameSessionId: 'session-123',
      lobbyId: 'lobby-123',
      mode: 'full',
      currentPlayerId: 'player-1',
      players: [
        { id: 'player-1', role: 'storyteller', turn_order: 0, joined_at: new Date().toISOString() } as any,
      ],
      pacingDelay: 0,
      timerDuration: 0,
    } as const)

    expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'full', persistence: 'idle' } })
  })

  it('should handle PLAY_CARD with optimistic update', async () => {
    const actor = createActor(testMachine).start()
    actor.send({
      type: 'START_GAME',
      gameSessionId: 'session-123',
      lobbyId: 'lobby-123',
      mode: 'full',
      currentPlayerId: 'player-1',
      players: [
        { id: 'player-1', role: 'storyteller', turn_order: 0, joined_at: new Date().toISOString() } as any,
      ],
      pacingDelay: 0,
      timerDuration: 0,
    } as const)

    const card = { id: 'card-1', name: 'Test Card', image_url: 'http://test.com/img.png' }

    actor.send({
      type: 'PLAY_CARD',
      card: card as any,
      playedCardsCount: 1,
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.optimisticCard).toMatchObject({
      id: 'card-1',
      status: 'PENDING',
      played_by: 'player-1',
    })
    expect(snapshot.context.inFlightHandId).toBe('card-1')
    expect(snapshot.value).toMatchObject({ active: { rules: 'full', persistence: 'playingCard' } })
  })

  it('should handle different game modes', () => {
    const actor = createActor(testMachine).start()

    // Test simple mode
    actor.send({
      type: 'START_GAME',
      gameSessionId: 'session-123',
      lobbyId: 'lobby-123',
      mode: 'simple',
      currentPlayerId: 'player-1',
      players: [],
    })
    expect(actor.getSnapshot().value).toMatchObject({ active: { rules: 'simple' } })

    // Test solo mode
    const actorSolo = createActor(testMachine).start()
    actorSolo.send({
      type: 'START_GAME',
      gameSessionId: 'session-123',
      lobbyId: 'lobby-123',
      mode: 'solo',
      currentPlayerId: 'player-1',
      players: [],
    })
    expect(actorSolo.getSnapshot().value).toMatchObject({ active: { rules: 'solo' } })
  })
})
