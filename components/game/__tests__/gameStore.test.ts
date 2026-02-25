import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
vi.mock('@/utils/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'mock-id' }, error: null })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
          in: vi.fn(() => Promise.resolve({ error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [{ id: 'card-1', card_id: 'card-1' }], error: null })),
          })),
          single: vi.fn(() => Promise.resolve({ data: { id: 'card-1', card_id: 'card-1' }, error: null })),
        })),
      })),
    })),
  })),
}))

// Mock actors to avoid actual DB calls if they were not mocked by Supabase mock
vi.mock('../actors/playCardActor', () => ({
  executePlayCard: vi.fn(async () => ({ id: 'played-card-id' })),
}))
vi.mock('../actors/drawCardsActor', () => ({
  executeDrawCards: vi.fn(async () => true),
}))
vi.mock('../actors/passTurnActor', () => ({
  executePassTurn: vi.fn(async () => true),
}))

import { useGameStore } from '../gameStore'

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState())
  })

  it('should start in idle state', () => {
    const state = useGameStore.getState()
    expect(state.mainState).toBe('idle')
  })

  it('should transition to active on startGame', () => {
    const store = useGameStore.getState()
    store.startGame({
      gameSessionId: 'session-123',
      lobbyId: 'lobby-123',
      mode: 'full',
      currentPlayerId: 'player-1',
      players: [
        { id: 'player-1', role: 'storyteller', turn_order: 0, joined_at: new Date().toISOString() } as any,
      ],
      pacingDelay: 0,
    })

    const state = useGameStore.getState()
    expect(state.mainState).toBe('active')
    expect(state.gameMode).toBe('full')
  })

  it('should handle playCard with optimistic update', async () => {
    const store = useGameStore.getState()
    store.startGame({
      gameSessionId: 'session-123',
      lobbyId: 'lobby-123',
      mode: 'full',
      currentPlayerId: 'player-1',
      players: [
        { id: 'player-1', role: 'storyteller', turn_order: 0, joined_at: new Date().toISOString() } as any,
      ],
      pacingDelay: 0,
    })

    const card = { id: 'card-1', name: 'Test Card', image_url: 'http://test.com/img.png' }

    // Use await for the async action
    await useGameStore.getState().playCard(card as any, 1)

    const state = useGameStore.getState()
    expect(state.optimisticCard).toMatchObject({
      id: 'card-1',
      status: 'PENDING',
      played_by: 'player-1',
    })
    // Note: rulesState becomes pending -> narrating (since pacingDelay is 0)
    // Wait, playCard calls playCardAck, which calls confirm(), which sets rulesState to narrating
    expect(state.rulesState).toBe('narrating')
  })

  it('should handle different game modes', () => {
    const store = useGameStore.getState()

    // Test simple mode
    store.startGame({
      gameSessionId: 'session-123',
      lobbyId: 'lobby-123',
      mode: 'simple',
      currentPlayerId: 'player-1',
      players: [],
      pacingDelay: 0,
    })
    expect(useGameStore.getState().gameMode).toBe('simple')

    // Test solo mode
    store.startGame({
      gameSessionId: 'session-123',
      lobbyId: 'lobby-123',
      mode: 'solo',
      currentPlayerId: 'player-1',
      players: [],
      pacingDelay: 0,
    })
    expect(useGameStore.getState().gameMode).toBe('solo')
  })
})
