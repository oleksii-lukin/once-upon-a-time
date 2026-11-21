import { describe, it, expect, vi } from 'vitest'
import { lobbies, players } from '../repos'
import type { LobbyClient } from '../repos'

/**
 * Fake Supabase client recording builder calls (same pattern as
 * lib/game/__tests__/repos.test.ts).
 */

type Result = { data?: any, error?: any }

function fakeClient(result: Result = { data: null, error: null }) {
  const calls: Array<{ method: string, args: any[] }> = []

  const makeBuilder = (): any => {
    const builder: any = {}
    for (const method of ['select', 'insert', 'eq', 'ilike', 'or']) {
      builder[method] = (...args: any[]) => {
        calls.push({ method, args })
        return builder
      }
    }
    builder.single = () => {
      calls.push({ method: 'single', args: [] })
      return Promise.resolve(result)
    }
    builder.maybeSingle = () => {
      calls.push({ method: 'maybeSingle', args: [] })
      return Promise.resolve(result)
    }
    builder.then = (resolve: any, reject: any) => {
      calls.push({ method: 'await', args: [] })
      return Promise.resolve(result).then(resolve, reject)
    }
    return builder
  }

  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] })
      return makeBuilder()
    },
  }

  return { client: client as unknown as LobbyClient, calls }
}

const LOBBY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const USER = 'user-123'
const GUEST = 'guest-456'

describe('lobbies', () => {
  it('insert returns the created lobby row', async () => {
    const { client } = fakeClient({ data: { id: LOBBY }, error: null })

    const res = await lobbies.insert(client, {
      name: 'Story 123',
      code: 'ABC123',
      created_by: USER,
      status: 'waiting',
      language: 'en',
    })

    expect(res.data).toEqual({ id: LOBBY })
  })

  it('findByCode is a case-insensitive single lookup on code', async () => {
    const { client, calls } = fakeClient({ data: { id: LOBBY }, error: null })

    await lobbies.findByCode(client, 'abc123')

    expect(calls.find(c => c.method === 'ilike')!.args).toEqual(['code', 'abc123'])
    expect(calls.some(c => c.method === 'single')).toBe(true)
  })

  it('findById uses maybeSingle', async () => {
    const { client, calls } = fakeClient({ data: { id: LOBBY }, error: null })

    await lobbies.findById(client, LOBBY)

    expect(calls.find(c => c.method === 'eq')!.args).toEqual(['id', LOBBY])
    expect(calls.some(c => c.method === 'maybeSingle')).toBe(true)
  })
})

describe('players', () => {
  it('findByLobbyAndIdentity matches user and guest for logged-in users', async () => {
    const { client, calls } = fakeClient({ data: null, error: null })

    await players.findByLobbyAndIdentity(client, { lobbyId: LOBBY, userId: USER, guestId: GUEST })

    expect(calls.find(c => c.method === 'eq')!.args).toEqual(['lobby_id', LOBBY])
    expect(calls.find(c => c.method === 'or')!.args).toEqual([`user_id.eq.${USER},guest_id.eq.${GUEST}`])
  })

  it('findByLobbyAndIdentity only matches the guest for anonymous players', async () => {
    const { client, calls } = fakeClient({ data: null, error: null })

    await players.findByLobbyAndIdentity(client, { lobbyId: LOBBY, userId: null, guestId: GUEST })

    expect(calls.find(c => c.method === 'or')!.args).toEqual([`guest_id.eq.${GUEST}`])
  })
})
