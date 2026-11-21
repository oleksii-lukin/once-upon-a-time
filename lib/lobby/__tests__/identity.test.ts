import { describe, it, expect, vi } from 'vitest'
import { resolvePlayerIdentity } from '../identity'

// The guest generator touches browser storage; the resolver's contract is
// what matters here (Clerk user wins, guest falls back to seeded identity).
vi.mock('@/lib/auth/guestIdentity', () => ({
  getGuestIdentity: vi.fn(() => ({
    name: 'Brave Fox',
    animal: 'Fox',
    emoji: '🦊',
    color: '#123456',
  })),
}))

describe('resolvePlayerIdentity', () => {
  it('uses Clerk fields for a logged-in user', () => {
    const identity = resolvePlayerIdentity(
      { fullName: 'Ada Lovelace', username: 'ada', imageUrl: 'https://x/y.png' },
      'guest-1',
    )

    expect(identity).toEqual({
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://x/y.png',
    })
  })

  it('falls back to username, then Player', () => {
    expect(resolvePlayerIdentity({ username: 'ada' }, 'g').displayName).toBe('ada')
    expect(resolvePlayerIdentity({}, 'g').displayName).toBe('Player')
    expect(resolvePlayerIdentity({ fullName: null, username: null }, 'g').displayName).toBe('Player')
  })

  it('builds an emoji avatar for guests', () => {
    const identity = resolvePlayerIdentity(null, 'guest-1')

    expect(identity).toEqual({
      displayName: 'Brave Fox',
      avatarUrl: 'emoji:🦊:#123456',
    })
  })

  it('treats a missing user the same as null', () => {
    expect(resolvePlayerIdentity(undefined, 'guest-1').displayName).toBe('Brave Fox')
  })
})
