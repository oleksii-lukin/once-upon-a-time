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
    maybeSingle: vi.fn(),
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
  mock.maybeSingle.mockReturnValue(mock)

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
    mockSupabase.single.mockReturnValue(mockSupabase)
    mockSupabase.maybeSingle.mockReturnValue(mockSupabase)
    mockSupabase.insert.mockReturnValue(mockSupabase)
    mockSupabase.update.mockReturnValue(mockSupabase)

    // Mock Math.random to be deterministic for testing
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
  })

  it('should deal cards correctly for a solo player', async () => {
    // Sequence of calls:
    // 0. existing-session check: .from('game_sessions').select().eq().neq().maybeSingle()
    // 1. lobby fetch: .from('lobbies').select('*').eq('id', lobbyId).single()
    // 2. players fetch: .from('players').select('*').eq('lobby_id', lobbyId).neq('role', 'spectator')
    // 3. turn order update: .from('players').update({ turn_order: i }).eq('id', player.id)
    // 4. cards fetch: .from('cards').select('*').in('deck_id', deckIds)
    // 5. session create: .from('game_sessions').insert({ ... }).select().single()
    // 6. hands insert: .from('player_hands').insert(playerHands)
    // 7. pile insert: .from('draw_pile').insert(drawPile)
    // 8. lobby status update: .from('lobbies').update({ status: 'playing' }).eq('id', lobbyId)

    // Setup return values for each "final" call in the chains

    // 0. existing-session check (via .maybeSingle)
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    mockSupabase.neq.mockReturnValueOnce(mockSupabase) // existing-session check neq

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
    // The eq queue mirrors the call order: session check, lobby fetch,
    // players fetch, turn order update, lobby status update.
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // existing-session check
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

    const result = await initializeGame('11111111-1111-4111-8111-111111111111')

    expect(result).toEqual({ success: true, gameSessionId: 'session-1' })

    // Verify card dealing
    const allInsertCalls = mockSupabase.insert.mock.calls

    // Hands insert is usually the one with an array of objects containing player_id
    const handInsert = allInsertCalls.find((call: any[]) =>
      Array.isArray(call[0]) && call[0].length > 0 && 'player_id' in call[0][0]
    )
    expect(handInsert[0]).toHaveLength(6) // 1 ending + 5 story

    // Pile insert is usually the one with an array of objects containing game_session_id but no player_id
    const drawPileInsert = allInsertCalls.find((call: any[]) =>
      Array.isArray(call[0]) && call[0].length > 0 && 'game_session_id' in call[0][0] && !('player_id' in call[0][0])
    )
    expect(drawPileInsert[0]).toHaveLength(25) // 30 story cards total - 5 dealt = 25 left
  })

  it('reuses the active session instead of creating a duplicate', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: 'session-existing' },
      error: null,
    })

    const result = await initializeGame('11111111-1111-4111-8111-111111111111')

    expect(result).toEqual({ success: true, gameSessionId: 'session-existing', reused: true })
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('returns the winning session when a concurrent start wins the insert race', async () => {
    // 0. existing-session check → none
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockSupabase.neq.mockReturnValueOnce(mockSupabase) // check neq
    // 1. lobby fetch
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'lobby-1', deck_id: 'deck-1', game_mode: 'solo', settings: {} },
      error: null,
    })
    // 2. players fetch
    mockSupabase.neq.mockResolvedValueOnce({
      data: [{ id: 'player-1', role: 'player', lobby_id: 'lobby-1', joined_at: new Date().toISOString() }],
      error: null,
    })
    // eq queue: check, lobby, players, turn order, status update
    mockSupabase.eq.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    // 4. cards fetch
    mockSupabase.in.mockResolvedValueOnce({ data: mockDeck, error: null })
    // 5. session insert → unique violation from the new partial index
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
    // race lookup
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'session-winner' }, error: null })

    const result = await initializeGame('11111111-1111-4111-8111-111111111111')

    expect(result).toEqual({ success: true, gameSessionId: 'session-winner', reused: true })
  })
})
