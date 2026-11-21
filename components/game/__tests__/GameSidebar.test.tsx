import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render } from '@testing-library/react'
import GameSidebar from '../GameSidebar'
import { type Player } from '@/types/model'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}))

// The sidebar owns no WebRTC logic anymore — the controller lives in
// lib/webrtc; stub the thin hook for rendering tests.
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

const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const players = [
  { id: P1, display_name: 'Ada', role: 'host', user_id: 'u1', guest_id: null } as unknown as Player,
  { id: P2, display_name: 'Bob', role: 'player', user_id: null, guest_id: 'g2' } as unknown as Player,
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', display_name: 'Watcher', role: 'spectator', user_id: null, guest_id: 'g3' } as unknown as Player,
]

describe('GameSidebar', () => {
  it('shows the current storyteller in the turn indicator', () => {
    const { getByText, getAllByText } = render(
      <GameSidebar
        players={players}
        currentPlayerId="u1"
        currentTurnPlayerId={P2}
        lobbyId="lobby-1"
        enableVideoChat={false}
      />,
    )

    expect(getByText('game.current_storyteller')).toBeInTheDocument()
    // 'Bob' appears in the grid and again in the turn indicator
    expect(getAllByText('Bob').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the player grid and the spectators list', () => {
    const { getByText, getAllByText, queryByText } = render(
      <GameSidebar
        players={players}
        currentPlayerId="u1"
        currentTurnPlayerId={P1}
        lobbyId="lobby-1"
        enableVideoChat={false}
      />,
    )

    expect(getByText('Ada')).toBeInTheDocument()
    expect(getAllByText('Bob').length).toBeGreaterThanOrEqual(1)
    expect(getByText('game.spectators')).toBeInTheDocument()
    expect(getByText(/Watcher/)).toBeInTheDocument()
    expect(queryByText('game.waiting_players')).toBeNull()
  })

  it('shows a placeholder when no players have joined', () => {
    const { getByText } = render(
      <GameSidebar players={[]} currentPlayerId={null} currentTurnPlayerId="" lobbyId="lobby-1" enableVideoChat={false} />,
    )

    expect(getByText('game.waiting_players')).toBeInTheDocument()
  })
})
