import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Lobby server-action tests with a mocked repository layer: verifies
 * orchestration, zod input validation and the create/join flows that
 * replaced the duplicated logic in CreateLobbyButton, CreateLobbyLink,
 * LobbyList and InviteHandler.
 */

const repos = vi.hoisted(() => ({
  lobbies: {
    insert: vi.fn(),
    findByCode: vi.fn(),
    findById: vi.fn(),
  },
  players: {
    insert: vi.fn(),
    findByLobbyAndIdentity: vi.fn(),
  },
}))

vi.mock('@/lib/lobby/repos', () => repos)
vi.mock('@/utils/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({})),
}))
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user-123' })),
}))
vi.mock('@/lib/auth/guest-server', () => ({
  getServerGuestId: vi.fn(async () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  getServerGuestSecret: vi.fn(async () => 'guest-secret'),
  hashGuestSecret: vi.fn((secret: string) => `hash:${secret}`),
}))

import { createLobby, joinLobby } from '../lobby'

const LOBBY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const USER = 'user-123'
const GUEST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const creator = {
  userId: USER,
  guestId: GUEST,
  displayName: 'Ada Lovelace',
  avatarUrl: 'https://x/y.png',
}

beforeEach(() => {
  vi.clearAllMocks()
  repos.lobbies.insert.mockResolvedValue({ data: { id: LOBBY }, error: null })
  repos.lobbies.findByCode.mockResolvedValue({ data: { id: LOBBY }, error: null })
  repos.lobbies.findById.mockResolvedValue({ data: { id: LOBBY }, error: null })
  repos.players.insert.mockResolvedValue({ error: null })
  repos.players.findByLobbyAndIdentity.mockResolvedValue({ data: null, error: null })
})

describe('createLobby', () => {
  it('creates the lobby and adds the creator as host', async () => {
    const result = await createLobby({ language: 'en', creator })

    expect(result).toEqual({ ok: true, data: { id: LOBBY } })

    expect(repos.lobbies.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'waiting',
      language: 'en',
      created_by: USER,
    }))
    expect(repos.players.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      lobby_id: LOBBY,
      user_id: USER,
      guest_id: null,
      role: 'host',
      status: 'ready',
      display_name: 'Ada Lovelace',
    }))
  })

  it('falls back to the guest id as creator for anonymous hosts', async () => {
    await createLobby({
      language: 'ru',
      creator: { ...creator, userId: null },
    })

    expect(repos.lobbies.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      created_by: GUEST,
      language: 'ru',
    }))
    expect(repos.players.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      user_id: null,
      guest_id: GUEST,
    }))
  })

  it('reports lobby creation failures with a code', async () => {
    repos.lobbies.insert.mockResolvedValue({ data: null, error: { message: 'db down' } })

    const result = await createLobby({ language: 'en', creator })

    expect(result).toEqual({ ok: false, error: 'db down', code: 'create_failed' })
    expect(repos.players.insert).not.toHaveBeenCalled()
  })

  it('reports host insertion failures', async () => {
    repos.players.insert.mockResolvedValue({ error: { message: 'fk violated' } })

    const result = await createLobby({ language: 'en', creator })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('host_insert_failed')
  })

  it('rejects unsupported languages before touching repositories', async () => {
    const result = await createLobby({ language: 'xx', creator })

    expect(result.ok).toBe(false)
    expect(repos.lobbies.insert).not.toHaveBeenCalled()
  })
})

describe('joinLobby', () => {
  const joiner = creator

  it('joins by code when not yet a member', async () => {
    const result = await joinLobby({ code: 'ABC123', joiner })

    expect(result).toEqual({ ok: true, data: { lobbyId: LOBBY, alreadyMember: false } })
    expect(repos.lobbies.findByCode).toHaveBeenCalledWith(expect.anything(), 'ABC123')
    expect(repos.players.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      lobby_id: LOBBY,
      user_id: USER,
      guest_id: null,
      role: 'player',
      status: 'not_ready',
      display_name: 'Ada Lovelace',
    }))
  })

  it('joins by lobby id', async () => {
    const result = await joinLobby({ lobbyId: LOBBY, joiner })

    expect(result).toEqual({ ok: true, data: { lobbyId: LOBBY, alreadyMember: false } })
    expect(repos.lobbies.findById).toHaveBeenCalledWith(expect.anything(), LOBBY)
  })

  it('reports code lookups that find nothing as lobby_not_found', async () => {
    repos.lobbies.findByCode.mockResolvedValue({
      data: null,
      error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
    })

    const result = await joinLobby({ code: 'NOPE12', joiner })

    expect(result).toEqual({ ok: false, error: 'Lobby not found', code: 'lobby_not_found' })
    expect(repos.players.insert).not.toHaveBeenCalled()
  })

  it('reports real read failures separately from not-found', async () => {
    repos.lobbies.findByCode.mockResolvedValue({
      data: null,
      error: { message: 'network down', code: 'XX000' },
    })

    const result = await joinLobby({ code: 'ABC123', joiner })

    expect(result).toEqual({ ok: false, error: 'network down', code: 'read_failed' })
  })

  it('skips the insert for existing members but reports success', async () => {
    repos.players.findByLobbyAndIdentity.mockResolvedValue({ data: { id: 'p1' }, error: null })

    const result = await joinLobby({ code: 'ABC123', joiner })

    expect(result).toEqual({ ok: true, data: { lobbyId: LOBBY, alreadyMember: true } })
    expect(repos.players.insert).not.toHaveBeenCalled()
  })

  it('reports join insertion failures', async () => {
    repos.players.insert.mockResolvedValue({ error: { message: 'unique violation' } })

    const result = await joinLobby({ code: 'ABC123', joiner })

    expect(result).toEqual({ ok: false, error: 'unique violation', code: 'join_failed' })
  })

  it('requires exactly one of lobbyId or code', async () => {
    const neither = await joinLobby({ joiner })
    expect(neither.ok).toBe(false)

    const both = await joinLobby({ lobbyId: LOBBY, code: 'ABC123', joiner })
    expect(both.ok).toBe(false)

    expect(repos.lobbies.findByCode).not.toHaveBeenCalled()
    expect(repos.lobbies.findById).not.toHaveBeenCalled()
  })

  it('rejects empty display names', async () => {
    const result = await joinLobby({
      code: 'ABC123',
      joiner: { ...joiner, displayName: '' },
    })

    expect(result.ok).toBe(false)
    expect(repos.players.insert).not.toHaveBeenCalled()
  })
})
