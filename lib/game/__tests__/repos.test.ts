import { describe, it, expect } from 'vitest'
import {
  handRepo,
  playedCardsRepo,
  drawPileRepo,
  sessionRepo,
  lobbyRepo,
  playersRepo,
  type GameClient,
} from '../repos'

/**
 * Fake Supabase client: records every builder call so tests can assert the
 * exact query shape each repository produces. Answered with canned results.
 */

type Result = { data?: any, error?: any }

function fakeClient(result: Result = { data: null, error: null }) {
  const calls: Array<{ method: string, args: any[] }> = []

  const makeBuilder = (): any => {
    const builder: any = {}
    for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'limit', 'in']) {
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

  return { client: client as unknown as GameClient, calls }
}

const SESSION = '11111111-1111-4111-8111-111111111111'
const PLAYER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CARD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('handRepo', () => {
  it('removeCard deletes by session/player/card and selects the removed rows', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 'h1', position: 3 }], error: null })

    const res = await handRepo.removeCard(client, {
      gameSessionId: SESSION,
      playerId: PLAYER,
      cardId: CARD,
    })

    expect(res.data).toHaveLength(1)
    expect(calls).toEqual([
      { method: 'from', args: ['player_hands'] },
      { method: 'delete', args: [] },
      { method: 'select', args: ['id, position'] },
      { method: 'eq', args: ['game_session_id', SESSION] },
      { method: 'eq', args: ['player_id', PLAYER] },
      { method: 'eq', args: ['card_id', CARD] },
      { method: 'await', args: [] },
    ])
  })

  it('insertCard inserts a single hand row', async () => {
    const { client, calls } = fakeClient({ error: null })
    const row = { game_session_id: SESSION, player_id: PLAYER, card_id: CARD, position: 0 }

    await handRepo.insertCard(client, row)

    const insert = calls.find(c => c.method === 'insert')!
    expect(insert.args[0]).toEqual(row)
  })

  it('insertCards inserts a batch', async () => {
    const { client, calls } = fakeClient({ error: null })
    const rows = [
      { game_session_id: SESSION, player_id: PLAYER, card_id: CARD, position: 999 },
      { game_session_id: SESSION, player_id: PLAYER, card_id: OTHER, position: 1000 },
    ]

    await handRepo.insertCards(client, rows)

    const insert = calls.find(c => c.method === 'insert')!
    expect(insert.args[0]).toEqual(rows)
  })
})

describe('playedCardsRepo', () => {
  it('insertPending inserts with PENDING status and returns the joined row', async () => {
    const row = { id: 'pc-1', cards: { id: CARD } }
    const { client, calls } = fakeClient({ data: row, error: null })

    const res = await playedCardsRepo.insertPending(client, {
      game_session_id: SESSION,
      player_id: PLAYER,
      card_id: CARD,
      position: 2,
    })

    expect(res.data).toEqual(row)
    const insert = calls.find(c => c.method === 'insert')!
    expect(insert.args[0]).toMatchObject({
      game_session_id: SESSION,
      player_id: PLAYER,
      card_id: CARD,
      position: 2,
      status: 'PENDING',
    })
    expect(calls.find(c => c.method === 'select')!.args[0]).toBe('*, cards(*)')
    expect(calls.some(c => c.method === 'single')).toBe(true)
  })

  it('confirm updates status by id', async () => {
    const { client, calls } = fakeClient({ error: null })
    await playedCardsRepo.confirm(client, 'pc-1')

    const update = calls.find(c => c.method === 'update')!
    expect(update.args[0]).toEqual({ status: 'CONFIRMED' })
    expect(calls.find(c => c.method === 'eq')!.args).toEqual(['id', 'pc-1'])
  })

  it('removeById deletes by id', async () => {
    const { client, calls } = fakeClient({ error: null })
    await playedCardsRepo.removeById(client, 'pc-1')

    expect(calls.map(c => c.method)).toContain('delete')
    expect(calls.find(c => c.method === 'eq')!.args).toEqual(['id', 'pc-1'])
  })
})

describe('drawPileRepo', () => {
  it('drawCards orders by position and limits the count', async () => {
    const { client, calls } = fakeClient({ data: [], error: null })
    await drawPileRepo.drawCards(client, { gameSessionId: SESSION, count: 3 })

    expect(calls.find(c => c.method === 'eq')!.args).toEqual(['game_session_id', SESSION])
    expect(calls.find(c => c.method === 'order')!.args).toEqual(['position', { ascending: true }])
    expect(calls.find(c => c.method === 'limit')!.args).toEqual([3])
  })

  it('drawOne filters endings when endingOnly is set', async () => {
    const { client, calls } = fakeClient({ data: [], error: null })
    await drawPileRepo.drawOne(client, { gameSessionId: SESSION, endingOnly: true })

    expect(calls.some(c => c.method === 'neq')).toBe(false)
    expect(calls.find(c => c.method === 'eq' && c.args[0] === 'cards.category')!.args)
      .toEqual(['cards.category', 'ending'])
    expect(calls.find(c => c.method === 'limit')!.args).toEqual([1])
  })

  it('drawOne excludes endings otherwise', async () => {
    const { client, calls } = fakeClient({ data: [], error: null })
    await drawPileRepo.drawOne(client, { gameSessionId: SESSION, endingOnly: false })

    expect(calls.find(c => c.method === 'neq')!.args).toEqual(['cards.category', 'ending'])
  })

  it('removeByIds deletes by id set', async () => {
    const { client, calls } = fakeClient({ error: null })
    await drawPileRepo.removeByIds(client, ['p1', 'p2'])

    expect(calls.find(c => c.method === 'in')!.args).toEqual(['id', ['p1', 'p2']])
  })
})

describe('sessionRepo', () => {
  it('updateTurn sets both current player and storyteller', async () => {
    const { client, calls } = fakeClient({ error: null })
    await sessionRepo.updateTurn(client, { gameSessionId: SESSION, nextPlayerId: OTHER })

    expect(calls.find(c => c.method === 'update')!.args[0]).toEqual({
      current_turn_player_id: OTHER,
      storyteller_id: OTHER,
    })
    expect(calls.find(c => c.method === 'eq')!.args).toEqual(['id', SESSION])
  })

  it('getLobbyId selects lobby_id with maybeSingle', async () => {
    const { client, calls } = fakeClient({ data: { lobby_id: 'l1' }, error: null })
    const res = await sessionRepo.getLobbyId(client, SESSION)

    expect(res.data).toEqual({ lobby_id: 'l1' })
    expect(calls.find(c => c.method === 'select')!.args[0]).toBe('lobby_id')
    expect(calls.some(c => c.method === 'maybeSingle')).toBe(true)
  })

  it('finalizeWin updates winner and status', async () => {
    const { client, calls } = fakeClient({ error: null })
    await sessionRepo.finalizeWin(client, { gameSessionId: SESSION, winnerId: PLAYER })

    expect(calls.find(c => c.method === 'update')!.args[0]).toEqual({
      winner_id: PLAYER,
      status: 'COMPLETED',
    })
  })

  it('updateTimer applies only the provided timer fields', async () => {
    const { client, calls } = fakeClient({ error: null })
    await sessionRepo.updateTimer(client, SESSION, {
      timer_started_at: null,
      timer_expires_at: null,
      updated_at: '2026-01-01T00:00:00.000Z',
    })

    expect(calls.find(c => c.method === 'update')!.args[0]).toEqual({
      timer_started_at: null,
      timer_expires_at: null,
      updated_at: '2026-01-01T00:00:00.000Z',
    })
  })

  it('getTimerExpiry reads the expiry column', async () => {
    const { client, calls } = fakeClient({ data: { timer_expires_at: 'x' }, error: null })
    const res = await sessionRepo.getTimerExpiry(client, SESSION)

    expect(res.data).toEqual({ timer_expires_at: 'x' })
    expect(calls.find(c => c.method === 'select')!.args[0]).toBe('timer_expires_at')
  })
})

describe('lobbyRepo / playersRepo', () => {
  it('markFinished updates lobby status', async () => {
    const { client, calls } = fakeClient({ error: null })
    await lobbyRepo.markFinished(client, 'lobby-1')

    expect(calls.find(c => c.method === 'update')!.args[0]).toEqual({ status: 'finished' })
    expect(calls.find(c => c.method === 'eq')!.args).toEqual(['id', 'lobby-1'])
  })

  it('isInLobby checks player id and lobby id', async () => {
    const { client, calls } = fakeClient({ data: { id: PLAYER }, error: null })
    const res = await playersRepo.isInLobby(client, { playerId: PLAYER, lobbyId: 'lobby-1' })

    expect(res.data).toEqual({ id: PLAYER })
    expect(calls.find(c => c.method === 'eq')!.args).toEqual(['id', PLAYER])
    expect(calls.filter(c => c.method === 'eq')[1].args).toEqual(['lobby_id', 'lobby-1'])
  })
})
