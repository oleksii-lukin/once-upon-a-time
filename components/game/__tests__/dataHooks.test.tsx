import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { defaultLobbySettings } from '@/types/model'
import { useDeck } from '../useDeck'
import { useGameSettings } from '../useGameSettings'
import { useIsAdmin } from '../useIsAdmin'

beforeEach(() => {
  vi.clearAllMocks()
})

// Mock Supabase client: resolves decks / user_profiles queries
const { supabaseMock } = vi.hoisted(() => {
  function makeQuery(result: { data: any, error: any }) {
    const q: any = {
      select: () => q,
      eq: () => q,
      single: () => Promise.resolve(result),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    }
    return q
  }

  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === 'decks') return makeQuery({ data: { id: 'deck-1', bg_image_url: 'bg.png' }, error: null })
      if (table === 'user_profiles') return makeQuery({ data: { is_admin: true }, error: null })
      return makeQuery({ data: null, error: null })
    }),
  }
  return { supabaseMock }
})

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => supabaseMock,
}))

describe('useDeck', () => {
  it('fetches the deck for the lobby', async () => {
    const { result } = renderHook(() => useDeck('deck-1'))

    await waitFor(() => {
      expect(result.current?.id).toBe('deck-1')
    })
    expect(supabaseMock.from).toHaveBeenCalledWith('decks')
  })

  it('returns null and skips the query without a deck id', () => {
    const { result } = renderHook(() => useDeck(null))

    expect(result.current).toBeNull()
    expect(supabaseMock.from).not.toHaveBeenCalled()
  })
})

describe('useIsAdmin', () => {
  it('reads the admin flag from the profile row', async () => {
    const { result } = renderHook(() => useIsAdmin('user-1'))

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('is false for guests without a user id and skips the query', () => {
    const { result } = renderHook(() => useIsAdmin(null))

    expect(result.current).toBe(false)
    expect(supabaseMock.from).not.toHaveBeenCalled()
  })
})

describe('useGameSettings', () => {
  const validSettings = {
    timerPerTurn: true,
    timerPerTurnDuration: 45,
    enablePacingDelay: true,
    pacingDelayDuration: 3,
    enableVideoChat: false,
  }

  it('derives timer, pacing and video chat from valid settings', () => {
    const { result } = renderHook(() => useGameSettings(validSettings))

    expect(result.current).toEqual({
      timer: { isEnabled: true, duration: 45 },
      pacing: { isEnabled: true, duration: 3 },
      enableVideoChat: false,
    })
  })

  it('zeroes durations when the toggles are off', () => {
    const { result } = renderHook(() => useGameSettings({
      ...validSettings,
      timerPerTurn: false,
      enablePacingDelay: false,
    }))

    expect(result.current.timer).toEqual({ isEnabled: false, duration: 0 })
    expect(result.current.pacing).toEqual({ isEnabled: false, duration: 0 })
  })

  it('falls back to defaults for missing or invalid settings', () => {
    const { result, rerender } = renderHook(
      ({ settings }: { settings: unknown }) => useGameSettings(settings),
      { initialProps: { settings: undefined as unknown } },
    )

    expect(result.current.enableVideoChat).toBe(defaultLobbySettings.enableVideoChat)
    expect(result.current.timer.isEnabled).toBe(false)

    rerender({ settings: { totally: 'wrong' } })
    expect(result.current.timer).toEqual({ isEnabled: false, duration: 0 })
    expect(result.current.pacing).toEqual({ isEnabled: false, duration: 0 })
  })
})
