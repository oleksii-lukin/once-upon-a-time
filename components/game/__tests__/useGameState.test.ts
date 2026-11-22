import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGameState } from '../useGameState'

/**
 * Supabase mock: records every query and channel registration so tests can
 * assert on the data pipeline's behavior (what was fetched, when the
 * changefeed triggered a refetch, how overlapping events coalesce).
 *
 * vi.hoisted runs before the vi.mock factory is used, so the shared mock
 * state is available to both the factory and the tests below.
 */

const { queryLog, channelLog, mockClient, handRows } = vi.hoisted(() => {
  interface RecordedQuery {
    table: string
    columns: string
    countHead: boolean
    single: boolean
  }

  interface MockChannel {
    name: string
    handlers: Array<{ table: string, cb: (payload: { new?: unknown }) => void }>
    subscribeCount: number
    removed: boolean
    on: (type: string, config: { table: string }, cb: (payload: { new?: unknown }) => void) => MockChannel
    subscribe: () => MockChannel
  }

  const queryLog: RecordedQuery[] = []
  const channelLog: MockChannel[] = []

  const iso = '2026-01-01T00:00:00.000Z'

  const sessionRow = {
    id: 'sess-1',
    created_at: iso,
    current_turn_player_id: 'p1',
    deck_id: 'deck-1',
    game_mode: 'full',
    is_turn_pending_confirmation: false,
    last_card_played_at: null,
    lobby_id: 'lobby-1',
    status: 'PLAYING',
    storyteller_id: 'p1',
    updated_at: iso,
    winner_id: null,
  }

  const playedRows = [
    { id: 'pc-1', player_id: 'p2', status: 'CONFIRMED', position: 0, played_at: iso, cards: { id: 'card-9', name: 'C9', category: 'setting', type: 'story', translations: null } },
    { id: 'pc-2', player_id: 'p1', status: 'PENDING', position: 1, played_at: iso, cards: { id: 'card-10', name: 'C10', category: 'setting', type: 'story', translations: null } },
  ]

  const handRows = [
    { id: 'h1', player_id: 'p1', position: 0, cards: { id: 'card-1', name: 'C1', category: 'setting', type: 'story', translations: null } },
    { id: 'h2', player_id: 'p1', position: 1, cards: { id: 'card-2', name: 'C2', category: 'ending', type: 'ending', translations: null } },
  ]

  // Equivalent of allHandRows through v_player_hand_counts (endings excluded)
  const allHandCounts = [
    { player_id: 'p1', card_count: 1 },
    { player_id: 'p2', card_count: 2 },
  ]

  const endingCount = 3

  function resultFor(q: RecordedQuery): { data: unknown, count: number | null, error: null } {
    switch (q.table) {
      case 'game_sessions':
        return { data: sessionRow, count: null, error: null }
      case 'played_cards':
        return { data: playedRows, count: null, error: null }
      case 'v_player_hand_counts':
        return { data: allHandCounts, count: null, error: null }
      case 'draw_pile':
        return { data: null, count: endingCount, error: null }
      default:
        return { data: [], count: 0, error: null }
    }
  }

  function makeQuery(table: string) {
    const recorded = (single: boolean): RecordedQuery => ({
      table,
      columns: q.columns,
      countHead: q.countHead,
      single,
    })

    const q: any = {
      columns: '',
      countHead: false,
      select(columns?: string, opts?: { count?: string }) {
        q.columns = columns ?? ''
        q.countHead = opts?.count === 'exact'
        return q
      },
      eq() {
        return q
      },
      order() {
        return q
      },
      single() {
        queryLog.push(recorded(true))
        return Promise.resolve(resultFor(recorded(false)))
      },
      then(resolve: any, reject: any) {
        queryLog.push(recorded(false))
        return Promise.resolve(resultFor(recorded(false))).then(resolve, reject)
      },
    }
    return q
  }

  const mockClient = {
    from: (table: string) => makeQuery(table),
    channel: (name: string) => {
      const channel: MockChannel = {
        name,
        handlers: [],
        subscribeCount: 0,
        removed: false,
        on(type, config, cb) {
          channel.handlers.push({ table: config.table, cb })
          return channel
        },
        subscribe() {
          channel.subscribeCount += 1
          return channel
        },
      }
      channelLog.push(channel)
      return channel
    },
    removeChannel: (channel: any) => {
      channel.removed = true
    },
  }

  return { queryLog, channelLog, mockClient, handRows, allHandCounts }
})

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => mockClient,
}))

// The own hand now arrives via a server action instead of a direct query.
vi.mock('@/app/actions/players', () => ({
  getMyHand: vi.fn(async () => ({ ok: true, data: handRows })),
}))

const sessionQueries = () => queryLog.filter(q => q.table === 'game_sessions')
const latestChannelWith = (table: string) =>
  [...channelLog].reverse().find(c => c.handlers.some(h => h.table === table))

describe('useGameState', () => {
  beforeEach(() => {
    queryLog.length = 0
    channelLog.length = 0
  })

  it('loads session, board, hand and counters on mount', async () => {
    const { result } = renderHook(() => useGameState({ lobbyId: 'lobby-1', playerId: 'p1' }))

    await waitFor(() => {
      expect(result.current.gameSession?.id).toBe('sess-1')
      expect(result.current.playedCards).toHaveLength(2)
      expect(result.current.hand).toHaveLength(2)
      expect(result.current.playerHandCounts).toEqual({ p1: 1, p2: 2 })
      expect(result.current.remainingEndingCardsCount).toBe(3)
    })

    // row mapping
    expect(result.current.playedCards[0]).toMatchObject({
      played_card_id: 'pc-1',
      played_by: 'p2',
      status: 'CONFIRMED',
      id: 'card-9',
    })
    expect(result.current.hand[0]).toMatchObject({ hand_id: 'h1', id: 'card-1' })
    expect(sessionQueries()).toHaveLength(1)
  })

  it('skips the hand-row fetch for spectators but keeps hand counts', async () => {
    const { result } = renderHook(() => useGameState({ lobbyId: 'lobby-1', playerId: undefined }))

    await waitFor(() => {
      expect(result.current.remainingEndingCardsCount).toBe(3)
      expect(result.current.playerHandCounts).toEqual({ p1: 1, p2: 2 })
    })

    const countQueries = queryLog.filter(q => q.table === 'v_player_hand_counts')
    expect(countQueries).toHaveLength(1)
    expect(countQueries[0].columns).not.toContain('*')
    // no direct player_hands reads at all — the action path is for members only
    expect(queryLog.filter(q => q.table === 'player_hands')).toHaveLength(0)
  })

  it('re-fetches on changefeed events and coalesces overlapping triggers', async () => {
    const { result } = renderHook(() => useGameState({ lobbyId: 'lobby-1', playerId: 'p1' }))

    // settle the initial load completely
    await waitFor(() => {
      expect(result.current.remainingEndingCardsCount).toBe(3)
      expect(sessionQueries()).toHaveLength(1)
    })

    // the effect re-subscribes once the session id is known — take the
    // channel that actually carries board handlers
    const channel = latestChannelWith('played_cards')
    expect(channel).toBeDefined()
    const playedHandler = channel!.handlers.find(h => h.table === 'played_cards')!

    // three events in the same tick → exactly one queued follow-up pass
    act(() => {
      playedHandler.cb({})
      playedHandler.cb({})
      playedHandler.cb({})
    })

    await waitFor(() => {
      expect(sessionQueries()).toHaveLength(3) // initial + first pass + one queued pass
    })

    // give any (buggy) extra pass a chance to run, then confirm the count
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    expect(sessionQueries()).toHaveLength(3)
  })

  it('applies valid game_sessions payloads directly without a refetch', async () => {
    const { result } = renderHook(() => useGameState({ lobbyId: 'lobby-1', playerId: 'p1' }))

    await waitFor(() => {
      expect(result.current.gameSession?.id).toBe('sess-1')
    })

    const channel = latestChannelWith('game_sessions')!
    const sessionHandler = channel.handlers.find(h => h.table === 'game_sessions')!

    const before = sessionQueries().length

    act(() => {
      sessionHandler.cb({
        new: { ...result.current.gameSession, current_turn_player_id: 'p9' },
      })
    })

    await waitFor(() => {
      expect(result.current.gameSession?.current_turn_player_id).toBe('p9')
    })
    expect(sessionQueries()).toHaveLength(before)
  })

  it('ignores invalid game_sessions payloads', async () => {
    const { result } = renderHook(() => useGameState({ lobbyId: 'lobby-1', playerId: 'p1' }))

    await waitFor(() => {
      expect(result.current.gameSession?.id).toBe('sess-1')
    })

    const channel = latestChannelWith('game_sessions')!
    const sessionHandler = channel.handlers.find(h => h.table === 'game_sessions')!

    act(() => {
      sessionHandler.cb({ new: { totally: 'wrong' } })
    })

    expect(result.current.gameSession?.id).toBe('sess-1')
  })
})
