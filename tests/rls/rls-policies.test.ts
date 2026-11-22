/**
 * RLS integration tests — run against the LOCAL Supabase stack.
 *
 * Unlike the unit suite (which mocks the Supabase client), these tests hit
 * the real PostgREST at http://127.0.0.1:54321 and verify row-level
 * security end-to-end: anon, two distinct authenticated Clerk users, and
 * the service role (used only for fixture setup/teardown).
 *
 * Expected states (documented so a red run is interpretable):
 * - describe('keeps working')            — GREEN before and after every fix
 * - describe('Phase 1 ...')               — RED until the user_profiles /
 *                                           debug_auth_logs fix lands
 * - describe('Phase 2 ...')               — RED until the guest-secret /
 *                                           write-policy lock-down lands
 *
 * Run: pnpm test:rls   (requires `supabase start` + internet for Clerk BAPI)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const REST = 'http://127.0.0.1:54321/rest/v1'
const BAPI = 'https://api.clerk.com/v1'
const USER_A = 'user_38yY1W81zvbGlYWpejDTd1DPiRC' // E2E_USER_EMAIL account
const USER_B = 'user_35y1FHxwT0DFzZgUaf3jciAl6VE' // second account (profile exists)

// --- env -------------------------------------------------------------------
const env: Record<string, string> = {}
for (const line of readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  if (line && !line.startsWith('#') && line.includes('=')) {
    const i = line.indexOf('=')
    env[line.slice(0, i)] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
  }
}
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY!
const anonAuth = `Bearer ${ANON}`
const svcAuth = `Bearer ${SERVICE}`

// --- http helpers ----------------------------------------------------------
interface RestResult {
  status: number
  data: any
  code: string | undefined
}

async function rest(
  auth: string,
  method: string,
  p: string,
  body?: unknown,
  extra?: Record<string, string>,
): Promise<RestResult> {
  const res = await fetch(REST + p, {
    method,
    headers: {
      apikey: auth.slice('Bearer '.length),
      Authorization: auth,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data: any = null
  try {
    data = await res.json()
  }
  catch { /* empty body */ }
  return { status: res.status, data, code: data?.code }
}

/** RLS denial: INSERT raises 42501; UPDATE/DELETE silently affect 0 rows. */
function insertDenied(r: RestResult): boolean {
  return r.status >= 400 && (r.code === '42501' || /row-level security/i.test(String(r.data?.message)))
}
function noRows(r: RestResult): boolean {
  return r.status >= 400 || !(Array.isArray(r.data) && r.data.length > 0)
}

// --- Clerk BAPI ------------------------------------------------------------
async function bapi(method: string, p: string, body?: unknown): Promise<any> {
  const res = await fetch(BAPI + p, {
    method,
    headers: {
      Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      // Clerk's Cloudflare blocks non-browser default UAs (error 1010)
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Clerk BAPI ${method} ${p} -> ${res.status}: ${await res.text()}`)
  return res.json().catch(() => null)
}

async function mintSessionToken(userId: string): Promise<string> {
  const sessions = await bapi('GET', `/sessions?user_id=${userId}&status=active`)
  let sid = sessions?.[0]?.id
  if (!sid) sid = (await bapi('POST', '/sessions', { user_id: userId })).id
  return (await bapi('POST', `/sessions/${sid}/tokens`)).jwt
}

// --- reachability ----------------------------------------------------------
let reachable = false
try {
  const r = await fetch(`${REST}/user_profiles?select=user_id&limit=1`, { headers: { apikey: ANON } })
  reachable = r.ok
}
catch { /* supabase not running */ }

// --- fixtures --------------------------------------------------------------
type Fixture = {
  deckId: string
  lobbyId: string
  playerId: string
  sessionId: string
  cardId: string
  handId: string
  playedId: string
  pileId: string
}
let fx: Fixture

async function svcInsert(table: string, row: Record<string, unknown>): Promise<any> {
  const r = await rest(svcAuth, 'POST', `/${table}`, row)
  if (r.status >= 400) throw new Error(`fixture insert ${table} failed: ${JSON.stringify(r.data)}`)
  return Array.isArray(r.data) ? r.data[0] : r.data
}
async function svcDelete(table: string, id: string): Promise<void> {
  // user_profiles is keyed by user_id, not id
  const col = table === 'user_profiles' ? 'user_id' : 'id'
  await rest(svcAuth, 'DELETE', `/${table}?${col}=eq.${id}`)
}
async function svcPatch(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const col = table === 'user_profiles' ? 'user_id' : 'id'
  await rest(svcAuth, 'PATCH', `/${table}?${col}=eq.${id}`, patch)
}

describe.skipIf(!reachable)('RLS against local Supabase', () => {
  let tokenA = ''
  let tokenB = ''

  beforeAll(async () => {
    // rest() expects full `Bearer <jwt>` strings (it derives the apikey
    // header by stripping the prefix) — wrap the raw session tokens.
    tokenA = `Bearer ${await mintSessionToken(USER_A)}`
    tokenB = `Bearer ${await mintSessionToken(USER_B)}`

    // Full game-state fixture created with the service role (bypasses RLS,
    // so probes below can start from a known-good state).
    const deck = await svcInsert('decks', { name: 'rls-test-deck', created_by: 'system', is_active: true })
    const lobby = await svcInsert('lobbies', {
      name: 'rls-test-lobby',
      code: `RLS${Date.now().toString(36).toUpperCase().slice(-4)}`,
      created_by: 'rls-fixture',
      status: 'waiting',
    })
    const player = await svcInsert('players', {
      lobby_id: lobby.id,
      guest_id: crypto.randomUUID(),
      display_name: 'RLS Fixture',
      role: 'player',
      status: 'not_ready',
    })
    const session = await svcInsert('game_sessions', {
      lobby_id: lobby.id,
      deck_id: deck.id,
      status: 'ACTIVE',
    })
    const cardRes = await rest(anonAuth, 'GET', '/cards?select=id&limit=1')
    const cardId = cardRes.data[0].id
    const hand = await svcInsert('player_hands', {
      game_session_id: session.id,
      player_id: player.id,
      card_id: cardId,
      position: 0,
    })
    const played = await svcInsert('played_cards', {
      game_session_id: session.id,
      player_id: player.id,
      card_id: cardId,
      position: 0,
    })
    const pile = await svcInsert('draw_pile', {
      game_session_id: session.id,
      card_id: cardId,
      position: 99,
    })
    fx = {
      deckId: deck.id,
      lobbyId: lobby.id,
      playerId: player.id,
      sessionId: session.id,
      cardId,
      handId: hand.id,
      playedId: played.id,
      pileId: pile.id,
    }
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await svcDelete('draw_pile', fx.pileId)
    await svcDelete('played_cards', fx.playedId)
    await svcDelete('player_hands', fx.handId)
    await svcDelete('game_sessions', fx.sessionId)
    await svcDelete('players', fx.playerId)
    await svcDelete('lobbies', fx.lobbyId)
    await svcDelete('decks', fx.deckId)
  })

  // ------------------------------------------------------------------ keeps working
  describe('keeps working (must stay green through every phase)', () => {
    it('anon can SELECT user_profiles (public read)', async () => {
      const r = await rest(anonAuth, 'GET', '/user_profiles?select=user_id&limit=1')
      expect(r.status).toBe(200)
      expect(Array.isArray(r.data)).toBe(true)
    })

    it('authenticated user can UPDATE their own profile', async () => {
      const original = await rest(anonAuth, 'GET', `/user_profiles?user_id=eq.${USER_A}&select=bio`)
      const prevBio = original.data?.[0]?.bio ?? null
      try {
        const r = await rest(tokenA, 'PATCH', `/user_profiles?user_id=eq.${USER_A}`, { bio: 'rls-self-edit-probe' })
        expect(r.status).toBe(200)
        expect(r.data?.length).toBe(1)
        const readBack = await rest(anonAuth, 'GET', `/user_profiles?user_id=eq.${USER_A}&select=bio`)
        expect(readBack.data?.[0]?.bio).toBe('rls-self-edit-probe')
      }
      finally {
        await svcPatch('user_profiles', USER_A, { bio: prevBio })
      }
    })

    it('anon can SELECT lobbies, players and game board tables (public read)', async () => {
      for (const table of ['lobbies', 'players', 'game_sessions', 'played_cards', 'draw_pile']) {
        const r = await rest(anonAuth, 'GET', `/${table}?select=id&limit=1`)
        expect(r.status, table).toBe(200)
      }
    })
  })

  // ------------------------------------------------------------------ Phase 1
  describe('Phase 1: user_profiles ownership + debug_auth_logs', () => {
    it('anon INSERT into user_profiles is denied', async () => {
      const fakeId = `user_rlsprobe${Date.now()}`
      const r = await rest(anonAuth, 'POST', '/user_profiles', { user_id: fakeId, display_name: 'probe' })
      // desired: denied; if it slipped through, remove the row and fail
      if (!insertDenied(r) && Array.isArray(r.data) && r.data[0]) await svcDelete('user_profiles', fakeId)
      expect(insertDenied(r)).toBe(true)
    })

    it('anon UPDATE of any user_profiles row is denied', async () => {
      // read current value first and write it back unchanged, so a pre-fix
      // pass (where the probe succeeds) cannot corrupt data
      const original = await rest(anonAuth, 'GET', `/user_profiles?user_id=eq.${USER_B}&select=display_name`)
      const prevName = original.data?.[0]?.display_name ?? null
      const r = await rest(anonAuth, 'PATCH', `/user_profiles?user_id=eq.${USER_B}`, { display_name: prevName })
      expect(noRows(r)).toBe(true)
    })

    it('authenticated user A cannot UPDATE user B\'s profile', async () => {
      const original = await rest(anonAuth, 'GET', `/user_profiles?user_id=eq.${USER_B}&select=display_name`)
      const prevName = original.data?.[0]?.display_name ?? null
      const r = await rest(tokenA, 'PATCH', `/user_profiles?user_id=eq.${USER_B}`, { display_name: prevName })
      if (!noRows(r)) await svcPatch('user_profiles', USER_B, { display_name: prevName })
      expect(noRows(r)).toBe(true)
    })

    it('authenticated user A cannot set is_admin on their own profile', async () => {
      const r = await rest(tokenA, 'PATCH', `/user_profiles?user_id=eq.${USER_A}`, { is_admin: true })
      const readBack = await rest(anonAuth, 'GET', `/user_profiles?user_id=eq.${USER_A}&select=is_admin`)
      const stillFalse = readBack.data?.[0]?.is_admin === false
      // pre-fix this succeeds — restore immediately so no admin account lingers
      if (!stillFalse) await svcPatch('user_profiles', USER_A, { is_admin: false })
      expect(insertDenied(r) || noRows(r)).toBe(true)
      expect(stillFalse).toBe(true)
    })

    it('anon INSERT into debug_auth_logs is denied', async () => {
      const r = await rest(anonAuth, 'POST', '/debug_auth_logs', { auth_role: 'rls-probe', auth_uid: 'rls-probe' })
      if (r.status < 400) await rest(svcAuth, 'DELETE', '/debug_auth_logs?auth_uid=eq.rls-probe')
      expect(insertDenied(r)).toBe(true)
    })

    it('anon cannot read debug_auth_logs rows', async () => {
      const r = await rest(anonAuth, 'GET', '/debug_auth_logs?select=id&limit=50')
      expect(r.status).toBe(200)
      expect(r.data ?? []).toEqual([])
    })
  })

  // ------------------------------------------------------------------ Phase 2
  describe('Phase 2: guest write path locked down', () => {
    it('anon INSERT into players is denied', async () => {
      const r = await rest(anonAuth, 'POST', '/players', {
        lobby_id: fx.lobbyId,
        guest_id: crypto.randomUUID(),
        display_name: 'probe',
        role: 'player',
        status: 'not_ready',
      })
      if (!insertDenied(r) && Array.isArray(r.data) && r.data[0]) await svcDelete('players', r.data[0].id)
      expect(insertDenied(r)).toBe(true)
    })

    it('anon UPDATE of a players row is denied', async () => {
      const r = await rest(anonAuth, 'PATCH', `/players?id=eq.${fx.playerId}`, { status: 'ready' })
      if (!noRows(r)) await svcPatch('players', fx.playerId, { status: 'not_ready' })
      expect(noRows(r)).toBe(true)
    })

    it('anon DELETE of a players row is denied', async () => {
      const sacrificial = await svcInsert('players', {
        lobby_id: fx.lobbyId,
        guest_id: crypto.randomUUID(),
        display_name: 'sacrificial',
        role: 'player',
        status: 'not_ready',
      })
      const r = await rest(anonAuth, 'DELETE', `/players?id=eq.${sacrificial.id}`)
      if (!noRows(r)) await svcDelete('players', sacrificial.id) // pre-fix: gone anyway
      expect(noRows(r)).toBe(true)
    })

    it('authenticated user A cannot UPDATE players directly either', async () => {
      const r = await rest(tokenA, 'PATCH', `/players?id=eq.${fx.playerId}`, { status: 'ready' })
      if (!noRows(r)) await svcPatch('players', fx.playerId, { status: 'not_ready' })
      expect(noRows(r)).toBe(true)
    })

    it('anon INSERT into lobbies is denied', async () => {
      const r = await rest(anonAuth, 'POST', '/lobbies', {
        name: 'rls-probe-lobby',
        code: `PRB${Date.now().toString(36).toUpperCase().slice(-4)}`,
        created_by: 'rls-probe',
        status: 'waiting',
      })
      if (!insertDenied(r) && Array.isArray(r.data) && r.data[0]) await svcDelete('lobbies', r.data[0].id)
      expect(insertDenied(r)).toBe(true)
    })

    it('anon UPDATE of a lobbies row is denied', async () => {
      const r = await rest(anonAuth, 'PATCH', `/lobbies?id=eq.${fx.lobbyId}`, { status: 'playing' })
      if (!noRows(r)) await svcPatch('lobbies', fx.lobbyId, { status: 'waiting' })
      expect(noRows(r)).toBe(true)
    })

    it('anon DELETE of a lobbies row is denied', async () => {
      const sacrificial = await svcInsert('lobbies', {
        name: 'rls-sacrificial-lobby',
        code: `SAC${Date.now().toString(36).toUpperCase().slice(-4)}`,
        created_by: 'rls-sacrificial',
        status: 'waiting',
      })
      const r = await rest(anonAuth, 'DELETE', `/lobbies?id=eq.${sacrificial.id}`)
      if (!noRows(r)) await svcDelete('lobbies', sacrificial.id)
      expect(noRows(r)).toBe(true)
    })

    it('anon INSERT into game_sessions is denied', async () => {
      const r = await rest(anonAuth, 'POST', '/game_sessions', {
        lobby_id: fx.lobbyId,
        deck_id: fx.deckId,
        status: 'ACTIVE',
      })
      if (!insertDenied(r) && Array.isArray(r.data) && r.data[0]) await svcDelete('game_sessions', r.data[0].id)
      expect(insertDenied(r)).toBe(true)
    })

    it('anon UPDATE of a game_sessions row is denied', async () => {
      const r = await rest(anonAuth, 'PATCH', `/game_sessions?id=eq.${fx.sessionId}`, { status: 'COMPLETED' })
      if (!noRows(r)) await svcPatch('game_sessions', fx.sessionId, { status: 'ACTIVE' })
      expect(noRows(r)).toBe(true)
    })

    it('anon cannot read other players\' hands (player_hands rows hidden)', async () => {
      const r = await rest(anonAuth, 'GET', '/player_hands?select=id&limit=50')
      expect(r.status).toBe(200)
      expect(r.data ?? []).toEqual([])
    })

    it('anon INSERT/UPDATE/DELETE on player_hands is denied', async () => {
      const ins = await rest(anonAuth, 'POST', '/player_hands', {
        game_session_id: fx.sessionId,
        player_id: fx.playerId,
        card_id: fx.cardId,
        position: 7,
      })
      if (!insertDenied(ins) && Array.isArray(ins.data) && ins.data[0]) await svcDelete('player_hands', ins.data[0].id)
      expect(insertDenied(ins)).toBe(true)

      const upd = await rest(anonAuth, 'PATCH', `/player_hands?id=eq.${fx.handId}`, { position: 5 })
      if (!noRows(upd)) await svcPatch('player_hands', fx.handId, { position: 0 })
      expect(noRows(upd)).toBe(true)

      const del = await rest(anonAuth, 'DELETE', `/player_hands?id=eq.${fx.handId}`)
      if (!noRows(del)) {
        await svcInsert('player_hands', {
          game_session_id: fx.sessionId,
          player_id: fx.playerId,
          card_id: fx.cardId,
          position: 0,
        }).then(r => (fx.handId = r.id))
      }
      expect(noRows(del)).toBe(true)
    })

    it('anon INSERT/UPDATE/DELETE on played_cards is denied', async () => {
      const ins = await rest(anonAuth, 'POST', '/played_cards', {
        game_session_id: fx.sessionId,
        player_id: fx.playerId,
        card_id: fx.cardId,
        position: 9,
      })
      if (!insertDenied(ins) && Array.isArray(ins.data) && ins.data[0]) await svcDelete('played_cards', ins.data[0].id)
      expect(insertDenied(ins)).toBe(true)

      const upd = await rest(anonAuth, 'PATCH', `/played_cards?id=eq.${fx.playedId}`, { position: 3 })
      if (!noRows(upd)) await svcPatch('played_cards', fx.playedId, { position: 0 })
      expect(noRows(upd)).toBe(true)

      const del = await rest(anonAuth, 'DELETE', `/played_cards?id=eq.${fx.playedId}`)
      if (!noRows(del)) {
        const again = await svcInsert('played_cards', {
          game_session_id: fx.sessionId,
          player_id: fx.playerId,
          card_id: fx.cardId,
          position: 0,
        })
        fx.playedId = again.id
      }
      expect(noRows(del)).toBe(true)
    })

    it('anon INSERT/UPDATE/DELETE on draw_pile is denied', async () => {
      const ins = await rest(anonAuth, 'POST', '/draw_pile', {
        game_session_id: fx.sessionId,
        card_id: fx.cardId,
        position: 100,
      })
      if (!insertDenied(ins) && Array.isArray(ins.data) && ins.data[0]) await svcDelete('draw_pile', ins.data[0].id)
      expect(insertDenied(ins)).toBe(true)

      const upd = await rest(anonAuth, 'PATCH', `/draw_pile?id=eq.${fx.pileId}`, { position: 50 })
      if (!noRows(upd)) await svcPatch('draw_pile', fx.pileId, { position: 99 })
      expect(noRows(upd)).toBe(true)

      const del = await rest(anonAuth, 'DELETE', `/draw_pile?id=eq.${fx.pileId}`)
      if (!noRows(del)) {
        const again = await svcInsert('draw_pile', {
          game_session_id: fx.sessionId,
          card_id: fx.cardId,
          position: 99,
        })
        fx.pileId = again.id
      }
      expect(noRows(del)).toBe(true)
    })

    it('anon can read hand counts via v_player_hand_counts view', async () => {
      const r = await rest(anonAuth, 'GET', '/v_player_hand_counts?select=player_id&game_session_id=eq.' + fx.sessionId)
      expect(r.status, JSON.stringify(r.data)).toBe(200)
      expect(Array.isArray(r.data)).toBe(true)
    })
  })
})

describe.skipIf(reachable)('RLS suite (skipped)', () => {
  it('local Supabase is not reachable — run `supabase start` first', () => {
    console.warn('SKIPPED: local Supabase REST not reachable at ' + REST)
  })
})
