import { describe, it, expect, vi } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import {
  GameEngineProvider,
  useGameSelector,
  useGameActions,
} from '../useGameEngine'
import { type GameSession, type Player } from '@/types/model'
import { type CardData } from '@/utils/gameUtils'

/**
 * Wiring test for the engine provider: verifies the lifecycle effects
 * (START_GAME + the turn-reconciliation rule from utils/reconcile.ts) and
 * that selectors/actions observe the machine correctly.
 */

const { mockActions } = vi.hoisted(() => ({
  mockActions: {
    // The win-flow's playCard must hang so the machine stays in the
    // in-flight `winning` state deterministically.
    playCard: vi.fn(() => new Promise<any>(() => {})),
    confirmCard: vi.fn(async () => ({ ok: true, data: true })),
    passTurn: vi.fn(async () => ({ ok: true, data: true })),
    drawCards: vi.fn(async () => ({ ok: true, data: true })),
    exchangeCard: vi.fn(async () => ({ ok: true, data: true })),
    objectToCard: vi.fn(async () => ({
      ok: true,
      data: { gameSessionId: '', playedCardId: '', storytellerId: '', nextPlayerId: '' },
    })),
    finalizeWin: vi.fn(async () => ({ ok: true, data: true })),
    syncTimer: vi.fn(async () => ({ ok: true, data: { success: true } })),
    checkTimerExtension: vi.fn(async () => ({ ok: true, data: null })),
    initializeGame: vi.fn(async () => ({ success: true })),
  },
}))

vi.mock('@/app/actions/game', () => mockActions)

// Valid UUIDs so actor input validation passes and real actors run against
// the mocked actions.
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

interface EngineApi {
  currentPlayerId: string | null
  inFlightHandId: string | null
  isWinning: boolean
  actions: ReturnType<typeof useGameActions>
}

function Probe({ api }: { api: { current: EngineApi | null } }) {
  api.current = {
    currentPlayerId: useGameSelector(snapshot => snapshot.context.currentPlayerId),
    inFlightHandId: useGameSelector(snapshot => snapshot.context.inFlightHandId),
    isWinning: useGameSelector(snapshot => snapshot.matches('winning')),
    actions: useGameActions(currentPlayer, players),
  }
  return null
}

function renderEngine(session: GameSession) {
  const api: { current: EngineApi | null } = { current: null }
  const view = render(
    <GameEngineProvider
      gameSession={session}
      currentPlayer={currentPlayer}
      players={players}
      pacingDelay={0}
      timerDuration={0}
    >
      <Probe api={api} />
    </GameEngineProvider>,
  )

  const rerenderWithSession = (next: GameSession) => {
    view.rerender(
      <GameEngineProvider
        gameSession={next}
        currentPlayer={currentPlayer}
        players={players}
        pacingDelay={0}
        timerDuration={0}
      >
        <Probe api={api} />
      </GameEngineProvider>,
    )
  }

  return { api, rerenderWithSession }
}

describe('GameEngineProvider - turn reconciliation wiring', () => {
  it('adopts the remote turn when no local action is in flight', async () => {
    const { api, rerenderWithSession } = renderEngine(makeSession(P1))

    // machine started with the initial (matching) remote value
    await waitFor(() => {
      expect(api.current!.currentPlayerId).toBe(P1)
    })

    // remote turn changes while the local player is idle → machine follows
    rerenderWithSession(makeSession(P2))

    await waitFor(() => {
      expect(api.current!.currentPlayerId).toBe(P2)
    })
  })

  it('keeps local state while a local action is in flight', async () => {
    const { api, rerenderWithSession } = renderEngine(makeSession(P1))

    await waitFor(() => {
      expect(api.current!.currentPlayerId).toBe(P1)
    })

    // enter the win flow: playCard hangs (mocked), so the machine stays in
    // the in-flight `winning` state
    act(() => {
      api.current!.actions.winGame(winCard, 0)
    })
    await waitFor(() => {
      expect(api.current!.inFlightHandId).toBe(WIN_CARD_ID)
    })

    // remote turn changes mid-action → local state wins
    rerenderWithSession(makeSession(P2))
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30))
    })

    expect(api.current!.currentPlayerId).toBe(P1)
    expect(api.current!.isWinning).toBe(true)
  })
})
