import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Server-action tests with a mocked repository layer: verifies the
 * orchestration, input validation and structural ownership checks that
 * live above lib/game/repos.
 */

const repos = vi.hoisted(() => ({
  handRepo: {
    removeCard: vi.fn(),
    insertCard: vi.fn(),
    insertCards: vi.fn(),
  },
  playedCardsRepo: {
    insertPending: vi.fn(),
    confirm: vi.fn(),
    getById: vi.fn(),
    removeById: vi.fn(),
  },
  drawPileRepo: {
    drawCards: vi.fn(),
    drawOne: vi.fn(),
    removeById: vi.fn(),
    removeByIds: vi.fn(),
  },
  sessionRepo: {
    updateTurn: vi.fn(),
    getLobbyId: vi.fn(),
    finalizeWin: vi.fn(),
    updateTimer: vi.fn(),
    getTimerExpiry: vi.fn(),
  },
  lobbyRepo: { markFinished: vi.fn() },
  playersRepo: { isInLobby: vi.fn() },
}))

vi.mock('@/lib/game/repos', () => repos)
vi.mock('@/utils/supabase/service', () => {
  const chain: any = {}
  chain.from = () => chain
  chain.select = () => chain
  chain.eq = () => chain
  chain.maybeSingle = async () => ({
    data: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
    error: null,
  })
  return { createServiceClient: () => chain }
})
vi.mock('@/lib/game/authorization', () => ({
  requireOwnedPlayer: vi.fn(async (_c: unknown, id: string) => ({
    ok: true,
    player: { id },
    lobbyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  })),
  requireMemberOfSession: vi.fn(async () => ({
    ok: true,
    player: { id: 'p' },
    lobbyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  })),
  requireMemberOfLobby: vi.fn(async () => ({
    ok: true,
    player: { id: 'p' },
    lobbyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  })),
  requireHostOfLobby: vi.fn(async () => ({
    ok: true,
    player: { id: 'p', role: 'host' },
    lobbyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  })),
}))

import {
  playCard,
  confirmCard,
  passTurn,
  drawCards,
  exchangeCard,
  objectToCard,
  finalizeWin,
  syncTimer,
  checkTimerExtension,
} from '../game'

const SESSION = '11111111-1111-4111-8111-111111111111'
const PLAYER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CARD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const PLAYED = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const LOBBY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

beforeEach(() => {
  vi.clearAllMocks()

  repos.handRepo.removeCard.mockResolvedValue({ data: [{ id: 'h1', position: 0 }], error: null })
  repos.handRepo.insertCard.mockResolvedValue({ error: null })
  repos.handRepo.insertCards.mockResolvedValue({ error: null })
  repos.playedCardsRepo.insertPending.mockResolvedValue({ data: { id: 'pc-1' }, error: null })
  repos.playedCardsRepo.confirm.mockResolvedValue({ error: null })
  repos.playedCardsRepo.getById.mockResolvedValue({ data: { id: PLAYED, card_id: CARD }, error: null })
  repos.playedCardsRepo.removeById.mockResolvedValue({ error: null })
  repos.drawPileRepo.drawCards.mockResolvedValue({ data: [], error: null })
  repos.drawPileRepo.drawOne.mockResolvedValue({ data: [], error: null })
  repos.drawPileRepo.removeById.mockResolvedValue({ error: null })
  repos.drawPileRepo.removeByIds.mockResolvedValue({ error: null })
  repos.sessionRepo.updateTurn.mockResolvedValue({ error: null })
  repos.sessionRepo.getLobbyId.mockResolvedValue({ data: { lobby_id: LOBBY }, error: null })
  repos.sessionRepo.finalizeWin.mockResolvedValue({ error: null })
  repos.sessionRepo.updateTimer.mockResolvedValue({ error: null })
  repos.sessionRepo.getTimerExpiry.mockResolvedValue({ data: { timer_expires_at: null }, error: null })
  repos.lobbyRepo.markFinished.mockResolvedValue({ error: null })
  repos.playersRepo.isInLobby.mockResolvedValue({ data: { id: PLAYER }, error: null })
})

describe('playCard', () => {
  const input = { gameSessionId: SESSION, playerId: PLAYER, cardId: CARD, position: 0 }

  it('inserts the played card and removes it from the hand', async () => {
    const result = await playCard(input)

    expect(result).toEqual({ ok: true, data: { id: 'pc-1' } })
    expect(repos.playedCardsRepo.insertPending).toHaveBeenCalledTimes(1)
    expect(repos.handRepo.removeCard).toHaveBeenCalledWith(expect.anything(), {
      gameSessionId: SESSION,
      playerId: PLAYER,
      cardId: CARD,
    })
    expect(repos.playedCardsRepo.removeById).not.toHaveBeenCalled()
  })

  it('rolls the inserted card back when it was not in the hand', async () => {
    repos.handRepo.removeCard.mockResolvedValue({ data: [], error: null })

    const result = await playCard(input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not in the player\'s hand')
    expect(repos.playedCardsRepo.removeById).toHaveBeenCalledWith(expect.anything(), 'pc-1')
  })

  it('rolls the inserted card back when the hand delete fails', async () => {
    repos.handRepo.removeCard.mockResolvedValue({ data: null, error: { message: 'db down' } })

    const result = await playCard(input)

    expect(result).toEqual({ ok: false, error: 'db down' })
    expect(repos.playedCardsRepo.removeById).toHaveBeenCalledWith(expect.anything(), 'pc-1')
  })

  it('rejects invalid input before touching repositories', async () => {
    const result = await playCard({ ...input, gameSessionId: 'not-a-uuid' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('valid UUID')
    expect(repos.playedCardsRepo.insertPending).not.toHaveBeenCalled()
    expect(repos.handRepo.removeCard).not.toHaveBeenCalled()
  })
})

describe('confirmCard', () => {
  it('confirms the played card', async () => {
    const result = await confirmCard({ playedCardId: PLAYED, callerPlayerId: PLAYER })
    expect(result).toEqual({ ok: true, data: true })
    expect(repos.playedCardsRepo.confirm).toHaveBeenCalledWith(expect.anything(), PLAYED)
  })

  it('surfaces repository errors', async () => {
    repos.playedCardsRepo.confirm.mockResolvedValue({ error: { message: 'db down' } })
    const result = await confirmCard({ playedCardId: PLAYED, callerPlayerId: PLAYER })
    expect(result).toEqual({ ok: false, error: 'db down' })
  })
})

describe('passTurn', () => {
  const input = { gameSessionId: SESSION, nextPlayerId: OTHER, callerPlayerId: PLAYER }

  it('verifies lobby membership and advances the turn', async () => {
    const result = await passTurn(input)

    expect(result).toEqual({ ok: true, data: true })
    expect(repos.playersRepo.isInLobby).toHaveBeenCalledWith(expect.anything(), {
      playerId: OTHER,
      lobbyId: LOBBY,
    })
    expect(repos.sessionRepo.updateTurn).toHaveBeenCalledWith(expect.anything(), {
      gameSessionId: SESSION,
      nextPlayerId: OTHER,
    })
  })

  it('fails when the session does not exist', async () => {
    repos.sessionRepo.getLobbyId.mockResolvedValue({ data: null, error: null })

    const result = await passTurn(input)

    expect(result).toEqual({ ok: false, error: 'Game session not found' })
    expect(repos.sessionRepo.updateTurn).not.toHaveBeenCalled()
  })

  it('fails closed when the next player is not in the lobby', async () => {
    repos.playersRepo.isInLobby.mockResolvedValue({ data: null, error: null })

    const result = await passTurn(input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not in this lobby')
    expect(repos.sessionRepo.updateTurn).not.toHaveBeenCalled()
  })

  it('fails open when the membership read itself errors (best effort)', async () => {
    repos.playersRepo.isInLobby.mockResolvedValue({ data: null, error: { message: 'read timeout' } })

    const result = await passTurn(input)

    expect(result).toEqual({ ok: true, data: true })
    expect(repos.sessionRepo.updateTurn).toHaveBeenCalled()
  })
})

describe('drawCards', () => {
  const input = { gameSessionId: SESSION, playerId: PLAYER, callerPlayerId: PLAYER, count: 2 }

  it('inserts drawn cards with high positions and clears them from the pile', async () => {
    repos.drawPileRepo.drawCards.mockResolvedValue({
      data: [{ id: 'pile-1', card_id: CARD }, { id: 'pile-2', card_id: OTHER }],
      error: null,
    })

    const result = await drawCards(input)

    expect(result).toEqual({ ok: true, data: true })
    expect(repos.handRepo.insertCards).toHaveBeenCalledWith(expect.anything(), [
      { game_session_id: SESSION, player_id: PLAYER, card_id: CARD, position: 999 },
      { game_session_id: SESSION, player_id: PLAYER, card_id: OTHER, position: 1000 },
    ])
    expect(repos.drawPileRepo.removeByIds).toHaveBeenCalledWith(expect.anything(), ['pile-1', 'pile-2'])
  })

  it('succeeds with draw 0 when the pile is empty (deck exhaustion is not an error)', async () => {
    const result = await drawCards(input)

    expect(result).toEqual({ ok: true, data: true })
    expect(repos.handRepo.insertCards).not.toHaveBeenCalled()
    expect(repos.drawPileRepo.removeByIds).not.toHaveBeenCalled()
  })
})

describe('exchangeCard', () => {
  const input = { gameSessionId: SESSION, playerId: PLAYER, cardId: CARD }

  it('swaps a held card for the top matching pile card', async () => {
    repos.drawPileRepo.drawOne.mockResolvedValue({ data: [{ id: 'pile-1', card_id: OTHER }], error: null })

    const result = await exchangeCard(input)

    expect(result).toEqual({ ok: true, data: true })
    expect(repos.drawPileRepo.drawOne).toHaveBeenCalledWith(expect.anything(), {
      gameSessionId: SESSION,
      endingOnly: false,
    })
    expect(repos.handRepo.insertCard).toHaveBeenCalledWith(expect.anything(), {
      game_session_id: SESSION,
      player_id: PLAYER,
      card_id: OTHER,
      position: 999,
    })
    expect(repos.drawPileRepo.removeById).toHaveBeenCalledWith(expect.anything(), 'pile-1')
  })

  it('does not add a card when the exchanged card is not in the hand', async () => {
    repos.drawPileRepo.drawOne.mockResolvedValue({ data: [{ id: 'pile-1', card_id: OTHER }], error: null })
    repos.handRepo.removeCard.mockResolvedValue({ data: [], error: null })

    const result = await exchangeCard(input)

    expect(result.ok).toBe(false)
    expect(repos.handRepo.insertCard).not.toHaveBeenCalled()
    expect(repos.drawPileRepo.removeById).not.toHaveBeenCalled()
  })
})

describe('objectToCard', () => {
  const input = { gameSessionId: SESSION, playedCardId: PLAYED, storytellerId: PLAYER, nextPlayerId: OTHER, callerPlayerId: PLAYER }

  it('returns the card to the storyteller and removes the played row', async () => {
    const result = await objectToCard(input)

    expect(result).toEqual({ ok: true, data: input })
    expect(repos.handRepo.insertCard).toHaveBeenCalledWith(expect.anything(), {
      game_session_id: SESSION,
      player_id: PLAYER,
      card_id: CARD,
      position: 0,
    })
    expect(repos.playedCardsRepo.removeById).toHaveBeenCalledWith(expect.anything(), PLAYED)
  })

  it('fails when the played card does not exist', async () => {
    repos.playedCardsRepo.getById.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const result = await objectToCard(input)

    expect(result).toEqual({ ok: false, error: 'not found' })
    expect(repos.handRepo.insertCard).not.toHaveBeenCalled()
  })
})

describe('finalizeWin', () => {
  const input = { gameSessionId: SESSION, winnerId: PLAYER, lobbyId: LOBBY, callerPlayerId: PLAYER }

  it('finalizes the session and marks the lobby finished', async () => {
    const result = await finalizeWin(input)

    expect(result).toEqual({ ok: true, data: true })
    expect(repos.sessionRepo.finalizeWin).toHaveBeenCalledWith(expect.anything(), {
      gameSessionId: SESSION,
      winnerId: PLAYER,
    })
    expect(repos.lobbyRepo.markFinished).toHaveBeenCalledWith(expect.anything(), LOBBY)
  })

  it('fails when the session belongs to another lobby', async () => {
    repos.sessionRepo.getLobbyId.mockResolvedValue({ data: { lobby_id: 'other-lobby' }, error: null })

    const result = await finalizeWin(input)

    expect(result.ok).toBe(false)
    expect(repos.sessionRepo.finalizeWin).not.toHaveBeenCalled()
  })

  it('fails when the winner is not a player of the lobby', async () => {
    repos.playersRepo.isInLobby.mockResolvedValue({ data: null, error: null })

    const result = await finalizeWin(input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not a player')
    expect(repos.sessionRepo.finalizeWin).not.toHaveBeenCalled()
  })
})

describe('syncTimer', () => {
  const base = {
    gameSessionId: SESSION,
    isEnabled: true,
    duration: 10,
    currentPlayerId: PLAYER,
    callerPlayerId: PLAYER,
    action: 'start' as const,
    pacingDelay: 10,
  }

  it('extends the duration to at least pacingDelay + 5 when starting', async () => {
    const result = await syncTimer(base)

    expect(result.ok).toBe(true)
    expect(repos.sessionRepo.updateTimer).toHaveBeenCalledWith(
      expect.anything(),
      SESSION,
      expect.objectContaining({
        timer_enabled: true,
        timer_duration: 15, // pacingDelay 10 + 5 buffer > duration 10
        timer_started_at: expect.any(String),
        timer_expires_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    )
  })

  it('stops the timer by clearing its timestamps', async () => {
    const result = await syncTimer({ ...base, action: 'stop' })

    expect(result.ok).toBe(true)
    expect(repos.sessionRepo.updateTimer).toHaveBeenCalledWith(
      expect.anything(),
      SESSION,
      expect.objectContaining({
        timer_started_at: null,
        timer_expires_at: null,
      }),
    )
  })

  it('is a no-op (successful) when starting with the timer disabled', async () => {
    const result = await syncTimer({ ...base, isEnabled: false })

    expect(result).toEqual({ ok: true, data: { success: true } })
    expect(repos.sessionRepo.updateTimer).not.toHaveBeenCalled()
  })

  it('returns the failure instead of throwing when the write fails', async () => {
    repos.sessionRepo.updateTimer.mockResolvedValue({ error: { message: 'db down' } })

    const result = await syncTimer(base)

    expect(result).toEqual({ ok: false, error: 'db down' })
  })
})

describe('checkTimerExtension', () => {
  it('returns the current expiry timestamp', async () => {
    repos.sessionRepo.getTimerExpiry.mockResolvedValue({
      data: { timer_expires_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    })

    const result = await checkTimerExtension({ gameSessionId: SESSION })

    expect(result).toEqual({ ok: true, data: '2026-01-01T00:00:00.000Z' })
  })

  it('returns null when no timer is set', async () => {
    const result = await checkTimerExtension({ gameSessionId: SESSION })
    expect(result).toEqual({ ok: true, data: null })
  })

  it('surfaces read errors so the actor can fail soft', async () => {
    repos.sessionRepo.getTimerExpiry.mockResolvedValue({ data: null, error: { message: 'db down' } })

    const result = await checkTimerExtension({ gameSessionId: SESSION })

    expect(result).toEqual({ ok: false, error: 'db down' })
  })
})
