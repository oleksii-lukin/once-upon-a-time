import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGameEngine } from '../useGameEngine'
import { type GameSession, type Player } from '@/types/model'
import { type CardData } from '@/utils/gameUtils'

/**
 * Wiring test for the turn-reconciliation effect: verifies that the pure
 * rule from utils/reconcile.ts is actually applied by useGameEngine when
 * the DB's current_turn_player_id changes.
 */

const { mockClient } = vi.hoisted(() => {
  function makeQuery(table: string) {
    const q: any = {
      columns: '',
      select(columns?: string) {
        q.columns = columns ?? ''
        return q
      },
      insert() {
        return q
      },
      update() {
        return q
      },
      delete() {
        return q
      },
      eq() {
        return q
      },
      order() {
        return q
      },
      limit() {
        return q
      },
      in() {
        return q
      },
      single() {
        // The win-flow's playCardActor insert must hang so the machine
        // stays in the in-flight `winning` state deterministically.
        if (table === 'played_cards') {
          return new Promise(() => {})
        }
        return Promise.resolve({ data: null, error: null })
      },
      then(resolve: any, reject: any) {
        return Promise.resolve({ data: [], count: null, error: null }).then(resolve, reject)
      },
    }
    return q
  }

  return {
    mockClient: {
      from: (table: string) => makeQuery(table),
    },
  }
})

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => mockClient,
}))

// Valid UUIDs so actor input validation passes and real actors run against
// the mock client.
const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const WIN_CARD_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function makeSession(turnPlayerId: string): GameSession {
  return {
    id: SESSION_ID,
    lobby_id: 'lobby-1',
    game_mode: 'full',
    current_turn_player_id: turnPlayerId,
    status: 'PLAYING',
    storyteller_id: turnPlayerId,
  } as unknown as GameSession
}

const players = [
  { id: P1, role: 'storyteller', turn_order: 0 },
  { id: P2, role: 'player', turn_order: 1 },
] as unknown as Player[]

const currentPlayer = players[0]

const winCard = { id: WIN_CARD_ID, type: 'ending' } as unknown as CardData

describe('useGameEngine - turn reconciliation wiring', () => {
  it('adopts the remote turn when no local action is in flight', async () => {
    const { result, rerender } = renderHook(
      ({ session }: { session: GameSession }) =>
        useGameEngine(session, currentPlayer, players, 0, 0),
      { initialProps: { session: makeSession(P1) } },
    )

    // machine started with the initial (matching) remote value
    await waitFor(() => {
      expect(result.current.currentPlayerId).toBe(P1)
    })

    // remote turn changes while the local player is idle → machine follows
    rerender({ session: makeSession(P2) })

    await waitFor(() => {
      expect(result.current.currentPlayerId).toBe(P2)
    })
  })

  it('keeps local state while a local action is in flight', async () => {
    const { result, rerender } = renderHook(
      ({ session }: { session: GameSession }) =>
        useGameEngine(session, currentPlayer, players, 0, 0),
      { initialProps: { session: makeSession(P1) } },
    )

    await waitFor(() => {
      expect(result.current.currentPlayerId).toBe(P1)
    })

    // enter the win flow: playCardActor's DB insert never resolves, so the
    // machine stays in the in-flight `winning` state
    act(() => {
      result.current.winGame(winCard, 0)
    })
    await waitFor(() => {
      expect(result.current.inFlightHandId).toBe(WIN_CARD_ID)
    })

    // remote turn changes mid-action → local state wins
    rerender({ session: makeSession(P2) })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30))
    })

    expect(result.current.currentPlayerId).toBe(P1)
    expect(result.current.state.matches('winning')).toBe(true)
  })
})
