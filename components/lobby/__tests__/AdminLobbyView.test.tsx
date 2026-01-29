import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AdminLobbyView from '../AdminLobbyView'
import { defaultLobbySettings } from '@/types/lobby'

const mockDecks = [
  { id: 'deck-1', name: 'Deck 1', is_active: true },
  { id: 'deck-2', name: 'Deck 2', is_active: true },
]

// Mock Supabase client
vi.mock('@/utils/supabase/client', () => {
  const mockSupabase = {
    from: vi.fn((table) => ({
      select: vi.fn(() => {
        if (table === 'decks') {
          return {
            eq: vi.fn(() => Promise.resolve({ data: mockDecks, error: null })),
          }
        }
        return {
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        }
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      track: vi.fn().mockReturnThis(),
      presenceState: vi.fn(() => ({})),
    })),
    removeChannel: vi.fn(),
  }
  return {
    createClient: vi.fn(() => mockSupabase),
  }
})

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    text: () => Promise.resolve('<h1>Mock Content</h1>'),
  })
) as any

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ lng: 'en' })),
}))

// Mock i18n
vi.mock('@/app/i18n/client', () => ({
  getTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}))

// Mock components that might be problematic
vi.mock('@/components/common/CopyButton', () => ({
  default: () => <button>Copy</button>,
}))

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ onValueChange, defaultValue, min, max }: any) => (
    <input
      type="range"
      data-testid="mock-slider"
      min={min}
      max={max}
      defaultValue={defaultValue ? defaultValue[0] : min}
      onChange={(e) => onValueChange([parseInt(e.target.value)])}
    />
  ),
}))

// Mock Framer Motion and other UI components if needed
vi.mock('lucide-react', () => ({
  Info: () => <div data-testid="info-icon" />,
  Check: () => <div data-testid="check-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
}))

const mockLobby = {
  id: 'lobby-1',
  code: 'ABCDEF',
  name: 'Test Lobby',
  settings: defaultLobbySettings,
  status: 'waiting',
  created_at: new Date().toISOString(),
  created_by: 'user-1',
  language: 'en',
  deck_id: null,
  game_mode: 'main',
}

const mockPlayers = [
  {
    id: 'player-1',
    lobby_id: 'lobby-1',
    user_id: 'user-1',
    guest_id: null,
    role: 'host',
    status: 'ready',
    display_name: 'Host Player',
    avatar_url: null,
    joined_at: new Date().toISOString(),
    turn_order: 0,
  },
]

describe('AdminLobbyView', () => {
  it('renders correctly with default settings', () => {
    render(
      <AdminLobbyView
        lobby={mockLobby as any}
        initialPlayers={mockPlayers as any}
        userId="user-1"
        guestId={undefined}
      />
    )

    expect(screen.getByText('game_lobby')).toBeDefined()
    expect(screen.getByDisplayValue('Test Lobby')).toBeDefined()
    expect(screen.getByText('main_game_mode')).toBeDefined()
  })

  it('updates settings and disables allow_interrupts when switching to fast mode', async () => {
    render(
      <AdminLobbyView
        lobby={mockLobby as any}
        initialPlayers={mockPlayers as any}
        userId="user-1"
        guestId={undefined}
      />
    )

    const fastModeTab = screen.getByText('fast_game_mode')
    fireEvent.click(fastModeTab)

    const interruptToggle = screen.getByLabelText('allow_interrupts')
    expect(interruptToggle).toBeDisabled()
    expect(interruptToggle).toHaveAttribute('aria-checked', 'false')
  })

  it('updates settings and disables allow_interrupts when switching to solo mode', async () => {
    render(
      <AdminLobbyView
        lobby={mockLobby as any}
        initialPlayers={mockPlayers as any}
        userId="user-1"
        guestId={undefined}
      />
    )

    const soloModeTab = screen.getByText('solo_game_mode')
    fireEvent.click(soloModeTab)

    const interruptToggle = screen.getByLabelText('allow_interrupts')
    expect(interruptToggle).toBeDisabled()
    expect(interruptToggle).toHaveAttribute('aria-checked', 'false')
  })

  it('allows interrupts in main mode', async () => {
    render(
      <AdminLobbyView
        lobby={mockLobby as any}
        initialPlayers={mockPlayers as any}
        userId="user-1"
        guestId={undefined}
      />
    )

    const mainModeTab = screen.getByText('main_game_mode')
    fireEvent.click(mainModeTab)

    const interruptToggle = screen.getByLabelText('allow_interrupts')
    expect(interruptToggle).not.toBeDisabled()
  })

  it('toggles timer_per_turn and updates duration via slider', async () => {
    render(
      <AdminLobbyView
        lobby={mockLobby as any}
        initialPlayers={mockPlayers as any}
        userId="user-1"
        guestId={undefined}
      />
    )

    const timerToggle = screen.getByLabelText('timer_per_turn')
    fireEvent.click(timerToggle)

    // Check if slider and duration display appear
    expect(screen.getByText(/30seconds_abbrev/)).toBeDefined()
    const slider = screen.getByTestId('mock-slider')

    // Change slider value
    fireEvent.change(slider, { target: { value: '60' } })

    expect(screen.getByText(/60seconds_abbrev/)).toBeDefined()
  })

  it('toggles enable_pacing_delay and updates duration via slider', async () => {
    render(
      <AdminLobbyView
        lobby={mockLobby as any}
        initialPlayers={mockPlayers as any}
        userId="user-1"
        guestId={undefined}
      />
    )

    const pacingToggle = screen.getByLabelText('enable_pacing_delay')
    fireEvent.click(pacingToggle)

    expect(screen.getByText(/10seconds_abbrev/)).toBeDefined()
    const slider = screen.getByTestId('mock-slider')

    fireEvent.change(slider, { target: { value: '15' } })

    expect(screen.getByText(/15seconds_abbrev/)).toBeDefined()
  })

  it('renders available decks and allows selection', async () => {
    render(
      <AdminLobbyView
        lobby={mockLobby as any}
        initialPlayers={mockPlayers as any}
        userId="user-1"
        guestId={undefined}
      />
    )

    // Wait for decks to be fetched and rendered
    await waitFor(() => {
      expect(screen.getByText('Deck 1')).toBeDefined()
      expect(screen.getByText('Deck 2')).toBeDefined()
    })

    const deck1Checkbox = screen.getByLabelText('Deck 1')
    fireEvent.click(deck1Checkbox)

    // Check if the deck is selected (this might depend on how the UI reflects selection)
    // In AdminLobbyView, it updates selectedDecks state and adds a class to the label
    const deck1Label = screen.getByText('Deck 1').closest('label')
    expect(deck1Label).toHaveClass('bg-primary/20')
  })

  it('renders correctly for a guest user', () => {
    const guestPlayers = [
      {
        ...mockPlayers[0],
        user_id: null,
        guest_id: 'guest-1',
        display_name: 'Guest Player',
      },
    ]

    render(
      <AdminLobbyView
        lobby={mockLobby as any}
        initialPlayers={guestPlayers as any}
        userId={null}
        guestId="guest-1"
      />
    )

    expect(screen.getByText('Guest Player')).toBeDefined()
    expect(screen.getByText('host')).toBeDefined()
  })
})
