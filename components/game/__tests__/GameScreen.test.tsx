import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import GameScreen from '../GameScreen'
import { GameEngineProvider } from '../useGameEngine'
import { type GameSession, type Player } from '@/types/model'
import { type HandCardData, type PlayedCardData } from '@/utils/gameUtils'
import { type GameSettings } from '../useGameSettings'

/**
 * Integration smoke for the game screen: container data props + engine
 * provider + machine + mocked server actions + board rendering. Covers
 * the Phase 1/4 pipeline end to end (selection → PLAY_CARD → optimistic
 * board, PASS → persistence chain → passTurn server action).
 */

const { mockActions } = vi.hoisted(() => ({
  mockActions: {
    playCard: vi.fn(async () => ({ ok: true, data: { id: 'pc-new' } })),
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'en' }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : ''} alt={alt} {...rest} />
  ),
}))

// The sidebar's video system is out of scope for this smoke test
vi.mock('../useWebRTC', () => ({
  default: () => ({
    localStream: null,
    remoteStreams: {},
    devices: [],
    selectedAudioDeviceId: '',
    selectedVideoDeviceId: '',
    toggleAudio: vi.fn(),
    toggleVideo: vi.fn(),
    switchDevice: vi.fn(),
  }),
}))

// Valid UUIDs: actor input validation enforces them.
const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const STORY_CARD_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ENDING_CARD_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const PLAYED_CARD_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const players = [
  { id: P1, display_name: 'Ada', role: 'host', turn_order: 0, user_id: 'u1', guest_id: null } as unknown as Player,
  { id: P2, display_name: 'Bob', role: 'player', turn_order: 1, user_id: null, guest_id: 'g2' } as unknown as Player,
]

const currentPlayer = players[0]

const gameSession = {
  id: SESSION_ID,
  lobby_id: 'lobby-1',
  game_mode: 'full',
  current_turn_player_id: P1,
  storyteller_id: P1,
  status: 'PLAYING',
  winner_id: null,
  timer_started_at: null,
  timer_expires_at: null,
} as unknown as GameSession

const settings: GameSettings = {
  timer: { isEnabled: false, duration: 0 },
  pacing: { isEnabled: false, duration: 0 },
  enableVideoChat: false,
}

const storyCard = {
  id: STORY_CARD_ID,
  name: 'Story Card',
  category: 'setting',
  type: 'story',
  hand_id: 'hand-1',
  position: 0,
} as unknown as HandCardData

const endingCard = {
  id: ENDING_CARD_ID,
  name: 'Ending Card',
  category: 'ending',
  type: 'ending',
  hand_id: 'hand-2',
  position: 1,
} as unknown as HandCardData

const playedCard = {
  id: PLAYED_CARD_ID,
  name: 'Played Earlier',
  category: 'setting',
  type: 'story',
  played_by: P2,
  status: 'CONFIRMED',
  played_card_id: 'pc-0',
} as unknown as PlayedCardData

function renderScreen() {
  return render(
    <GameEngineProvider
      gameSession={gameSession}
      currentPlayer={currentPlayer}
      players={players}
      pacingDelay={0}
      timerDuration={0}
    >
      <GameScreen
        lobbyId="lobby-1"
        players={players}
        currentPlayer={currentPlayer}
        currentPlayerId="u1"
        isSpectator={false}
        isAdmin={false}
        deck={null}
        settings={settings}
        gameSession={gameSession}
        playedCards={[playedCard]}
        hand={[storyCard, endingCard]}
        playerHandCounts={{ [P1]: 2, [P2]: 3 }}
        remainingEndingCardsCount={1}
      />
    </GameEngineProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GameScreen', () => {
  it('renders the board, the hand and the storyteller controls', () => {
    const { getByText, getAllByText } = renderScreen()

    // table area shows the previously played card
    expect(getByText('Played Earlier')).toBeInTheDocument()
    // hand shows both cards
    expect(getByText('Story Card')).toBeInTheDocument()
    expect(getByText('Ending Card')).toBeInTheDocument()
    // my turn → pass control available (full mode label)
    expect(getByText('game.pass_turn_btn')).toBeInTheDocument()
    // 'Ada' appears in the table area and in the sidebar grid
    expect(getAllByText('Ada').length).toBeGreaterThanOrEqual(1)
  })

  it('enables play only after selecting a card, then dispatches PLAY_CARD', async () => {
    const { getByText } = renderScreen()

    const playButton = getByText('game.play_card_btn')
    expect(playButton).toBeDisabled()

    fireEvent.click(getByText('Story Card'))
    expect(playButton).not.toBeDisabled()

    fireEvent.click(playButton)

    await waitFor(() => {
      expect(mockActions.playCard).toHaveBeenCalledWith(
        expect.objectContaining({ cardId: STORY_CARD_ID }),
      )
    })
  })

  it('runs the full pass chain: machine → draw → passTurn server action', async () => {
    const { getByText } = renderScreen()

    fireEvent.click(getByText('game.pass_turn_btn'))

    await waitFor(() => {
      expect(mockActions.drawCards).toHaveBeenCalledWith(
        expect.objectContaining({ gameSessionId: SESSION_ID, playerId: P1, count: 1 }),
      )
      expect(mockActions.passTurn).toHaveBeenCalledWith(
        expect.objectContaining({ gameSessionId: SESSION_ID, nextPlayerId: P2 }),
      )
    })
  })
})
