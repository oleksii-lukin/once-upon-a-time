import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initializeGame } from '../game'
import { mockDeck } from '@/tests/mocks/deck'

// A better way to mock Supabase chaining
const createMockSupabase = () => {
  const mock: any = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    neq: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  }

  mock.from.mockReturnValue(mock)
  mock.select.mockReturnValue(mock)
  mock.eq.mockReturnValue(mock)
  mock.in.mockReturnValue(mock)
  mock.neq.mockReturnValue(mock)
  mock.insert.mockReturnValue(mock)
  mock.update.mockReturnValue(mock)
  mock.single.mockReturnValue(mock)

  return mock
}

const mockSupabase = createMockSupabase()

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

describe('initializeGame', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset defaults
    mockSupabase.from.mockReturnValue(mockSupabase)
    mockSupabase.select.mockReturnValue(mockSupabase)
    mockSupabase.eq.mockReturnValue(mockSupabase)
    mockSupabase.in.mockReturnValue(mockSupabase)
    mockSupabase.neq.mockReturnValue(mockSupabase)
    mockSupabase.insert.mockReturnValue(mockSupabase)
    mockSupabase.update.mockReturnValue(mockSupabase)
    mockSupabase.single.mockReturnValue(mockSupabase)

    // Mock Math.random to be deterministic for testing
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
  })

  it('should deal cards correctly for a solo player', async () => {
    // Sequence of calls:
    // 1. lobby fetch: .from('lobbies').select('*').eq('id', lobbyId).single()
    // 2. players fetch: .from('players').select('*').eq('lobby_id', lobbyId).neq('role', 'spectator')
    // 3. turn order update: .from('players').update({ turn_order: i }).eq('id', player.id)
    // 4. cards fetch: .from('cards').select('*').in('deck_id', deckIds)
    // 5. session create: .from('game_sessions').insert({ ... }).select().single()
    // 6. hands insert: .from('player_hands').insert(playerHands)
    // 7. pile insert: .from('draw_pile').insert(drawPile)
    // 8. lobby status update: .from('lobbies').update({ status: 'playing' }).eq('id', lobbyId)

    // Setup return values for each "final" call in the chains

    // 1. lobby fetch
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'lobby-1', deck_id: 'deck-1', game_mode: 'solo', settings: {} },
      error: null
    })

    // 2. players fetch (via .neq)
    mockSupabase.neq.mockResolvedValueOnce({
      data: [{ id: 'player-1', role: 'player', lobby_id: 'lobby-1', joined_at: new Date().toISOString() }],
      error: null
    })

    // 3. turn order update (via .eq)
    // First two .eq calls return mockSupabase (for chains 1 and 2), then it should resolve.
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // lobby fetch
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // players fetch
    mockSupabase.eq.mockResolvedValueOnce({ error: null }) // turn order update

    // 4. cards fetch (via .in)
    mockSupabase.in.mockResolvedValueOnce({
      data: mockDeck,
      error: null
    })

    // 5. session create (via .single)
    // Second .single call should resolve
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'session-1' },
      error: null
    })

    // 6 & 7. inserts (hands and pile)
    // First .insert call returns mock (for session create), then it should resolve
    mockSupabase.insert.mockReturnValueOnce(mockSupabase) // session create
    mockSupabase.insert.mockResolvedValueOnce({ error: null }) // player_hands insert
    mockSupabase.insert.mockResolvedValueOnce({ error: null }) // draw_pile insert

    // 8. lobby status update (via .eq)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    const result = await initializeGame('lobby-1')

    expect(result).toEqual({ success: true, gameSessionId: 'session-1' })

    // Verify card dealing
    const allInsertCalls = mockSupabase.insert.mock.calls

    // Hands insert is usually the one with an array of objects containing player_id
    const handInsert = allInsertCalls.find(call =>
      Array.isArray(call[0]) && call[0].length > 0 && 'player_id' in call[0][0]
    )
    expect(handInsert[0]).toHaveLength(6) // 1 ending + 5 story

    // Pile insert is usually the one with an array of objects containing game_session_id but no player_id
    const drawPileInsert = allInsertCalls.find(call =>
      Array.isArray(call[0]) && call[0].length > 0 && 'game_session_id' in call[0][0] && !('player_id' in call[0][0])
    )
    expect(drawPileInsert[0]).toHaveLength(25) // 30 story cards total - 5 dealt = 25 left
  })
})
