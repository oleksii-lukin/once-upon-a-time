'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { LobbySettingsSchema, defaultLobbySettings, type Tables, type TablesInsert, type PlayedCardWithCard } from '@/types/model'
import { type ActionResult } from '@/types/service'
import { type TimerSyncResult } from '@/lib/game/types'
import {
  handRepo,
  playedCardsRepo,
  drawPileRepo,
  sessionRepo,
  lobbyRepo,
  playersRepo,
} from '@/lib/game/repos'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid = () => z.string().regex(UUID_RE, 'must be a valid UUID')

const inputError = (error: z.ZodError): string =>
  error.issues[0]?.message ?? 'Invalid input'

export async function initializeGame(lobbyId: string) {
  const lobbyIdParsed = z.string().regex(UUID_RE, 'must be a valid UUID').safeParse(lobbyId)
  if (!lobbyIdParsed.success) {
    return { error: 'Invalid lobby ID' }
  }

  const supabase = await createClient()

  // Idempotent start: reuse the lobby's active session if one exists.
  // Repeated Start clicks used to create a new session each time (no
  // uniqueness on lobby_id), which poisoned later `.single()` reads.
  const { data: existing, error: existingError } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('lobby_id', lobbyId)
    .neq('status', 'COMPLETED')
    .maybeSingle()

  if (existingError) {
    // Best effort: the unique index below still guards against duplicates.
    console.error('Error checking existing game session:', existingError)
  }

  if (existing) {
    const { error: statusError } = await supabase
      .from('lobbies')
      .update({ status: 'playing' })
      .eq('id', lobbyId)
    if (statusError) console.error('Error updating lobby status:', statusError)
    return { success: true, gameSessionId: existing.id, reused: true }
  }

  // Get lobby with deck info
  const { data: lobby, error: lobbyError } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', lobbyId)
    .single()

  if (lobbyError || !lobby) {
    console.error('Error fetching lobby:', lobbyError)
    return { error: 'Lobby not found' }
  }

  // Determine which decks to use
  let deckIds: string[] = []
  if (lobby.settings && typeof lobby.settings === 'object') {
    const parsed = LobbySettingsSchema.safeParse(lobby.settings)
    deckIds = parsed.success ? (parsed.data.selectedDecks ?? []) : defaultLobbySettings.selectedDecks
  }

  // Fallback to lobby.deck_id if no settings or empty selectedDecks
  if (deckIds.length === 0 && lobby.deck_id) {
    deckIds = [lobby.deck_id]
  }

  if (deckIds.length === 0) {
    return { error: 'No decks selected' }
  }

  // Get all players in the lobby
  const { data: playersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('lobby_id', lobbyId)
    .neq('role', 'spectator')

  if (playersError || !playersData || playersData.length === 0) {
    console.error('Error fetching players:', playersError)
    return { error: 'No players found' }
  }

  // Shuffle players for random turn order
  const players = [...(playersData as Tables<'players'>[])].sort(() => Math.random() - 0.5)

  // Assign turn order to players
  for (let i = 0; i < players.length; i++) {
    const { error: updateError } = await supabase
      .from('players')
      .update({ turn_order: i })
      .eq('id', players[i].id)

    if (updateError) {
      console.error(`Error updating turn order for player ${players[i].id}:`, updateError)
      // Continue best effort
    }
  }

  // Get all cards from the selected decks
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .in('deck_id', deckIds)

  if (cardsError || !cards || cards.length === 0) {
    console.error('Error fetching cards:', cardsError)
    return { error: 'No cards found in selected decks' }
  }

  // Create game session
  const { data: gameSession, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      lobby_id: lobbyId,
      deck_id: deckIds[0], // Use first selected deck as primary
      current_turn_player_id: players[0].id, // First player in shuffled order starts
      storyteller_id: players[0].id, // First player is storyteller
      game_mode: lobby.game_mode, // Copy game mode from lobby
    })
    .select()
    .single()

  if (sessionError || !gameSession) {
    // Another Start click won the race between the check above and this
    // insert — the unique index rejected ours; reuse the winner's session.
    if ((sessionError as { code?: string } | null)?.code === '23505') {
      const { data: raced } = await supabase
        .from('game_sessions')
        .select('id')
        .eq('lobby_id', lobbyId)
        .neq('status', 'COMPLETED')
        .maybeSingle()
      if (raced) return { success: true, gameSessionId: raced.id, reused: true }
    }
    console.error('Error creating game session:', sessionError)
    return { error: 'Failed to create game session' }
  }

  // Helpers to build typed insert rows
  const pushPlayerHand = (
    arr: TablesInsert<'player_hands'>[],
    params: { game_session_id: string, player_id: string, card_id: string, position?: number },
  ) => {
    arr.push({
      game_session_id: params.game_session_id,
      player_id: params.player_id,
      card_id: params.card_id,
      position: params.position,
    })
  }

  const pushDrawPile = (
    arr: TablesInsert<'draw_pile'>[],
    params: { game_session_id: string, card_id: string, position?: number },
  ) => {
    arr.push({
      game_session_id: params.game_session_id,
      card_id: params.card_id,
      position: params.position,
    })
  }

  // Separate cards into Endings and Story Cards
  // Seed data uses type='ending' and category=NULL for ending cards
  const typedCards = cards as Tables<'cards'>[]
  const endingCards = typedCards.filter(c => c.type === 'ending')
  const storyCards = typedCards.filter(c => c.type !== 'ending')

  if (endingCards.length < players.length) {
    console.error('Not enough ending cards for players')
    return { error: 'Not enough ending cards' }
  }

  // Shuffle both piles
  const shuffledEndings = [...endingCards].sort(() => Math.random() - 0.5)
  const shuffledStory = [...storyCards].sort(() => Math.random() - 0.5)

  // Deal cards to players
  const storyCardsPerPlayer = 5
  const playerHands: TablesInsert<'player_hands'>[] = []
  const drawPile: TablesInsert<'draw_pile'>[] = []

  let storyIndex = 0

  // Deal cards to each player
  for (let i = 0; i < players.length; i++) {
    // 1. Deal 1 Ending Card
    pushPlayerHand(playerHands, {
      game_session_id: gameSession.id,
      player_id: players[i].id,
      card_id: shuffledEndings[i].id,
      position: 999, // Special position or high number to sort last? Or we handle sorting in UI.
    })

    // 2. Deal Story Cards
    for (let j = 0; j < storyCardsPerPlayer; j++) {
      if (storyIndex < shuffledStory.length) {
        pushPlayerHand(playerHands, {
          game_session_id: gameSession.id,
          player_id: players[i].id,
          card_id: shuffledStory[storyIndex].id,
          position: j,
        })
        storyIndex++
      }
    }
  }

  // Remaining Story Cards go to draw pile
  while (storyIndex < shuffledStory.length) {
    pushDrawPile(drawPile, {
      game_session_id: gameSession.id,
      card_id: shuffledStory[storyIndex].id,
      position: storyIndex - (players.length * storyCardsPerPlayer),
    })
    storyIndex++
  }

  // Insert player hands
  if (playerHands.length > 0) {
    const { error: handsError } = await supabase
      .from('player_hands')
      .insert(playerHands)

    if (handsError) {
      console.error('Error dealing cards to players:', handsError)
      return { error: 'Failed to deal cards' }
    }
  }

  // Insert draw pile
  if (drawPile.length > 0) {
    const { error: pileError } = await supabase
      .from('draw_pile')
      .insert(drawPile)

    if (pileError) {
      console.error('Error creating draw pile:', pileError)
      return { error: 'Failed to create draw pile' }
    }
  }

  // Update lobby status to playing
  const { error: statusError } = await supabase
    .from('lobbies')
    .update({ status: 'playing' })
    .eq('id', lobbyId)

  if (statusError) {
    console.error('Error updating lobby status:', statusError)
    // Don't fail the whole operation for this, but log it
  }

  return { success: true, gameSessionId: gameSession.id }
}

/* ------------------------------------------------------------------ *
 * Gameplay mutations — the only write path for game tables.
 *
 * Called by the xstate actors (components/game/actors), these validate
 * their input (zod), orchestrate the repository layer under lib/game,
 * and enforce structural ownership (card-in-hand, lobby membership)
 * server-side. They return an ActionResult instead of throwing: Next.js
 * masks thrown server-action errors in production, which would turn
 * every persistence failure into an opaque message.
 * ------------------------------------------------------------------ */

const PlayCardSchema = z.object({
  gameSessionId: uuid(),
  playerId: uuid(),
  cardId: uuid(),
  position: z.number().int().min(0),
})

export async function playCard(
  input: { gameSessionId: string, playerId: string, cardId: string, position: number },
): Promise<ActionResult<PlayedCardWithCard>> {
  const parsed = PlayCardSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()
  const values = parsed.data

  // Insert first (preserves the historical order of writes); a rejected
  // play rolls the inserted row back instead of orphaning it.
  const inserted = await playedCardsRepo.insertPending(supabase, {
    game_session_id: values.gameSessionId,
    player_id: values.playerId,
    card_id: values.cardId,
    position: values.position,
  })
  if (inserted.error) return { ok: false, error: inserted.error.message }
  const playedRow = inserted.data as PlayedCardWithCard

  const removed = await handRepo.removeCard(supabase, {
    gameSessionId: values.gameSessionId,
    playerId: values.playerId,
    cardId: values.cardId,
  })
  if (removed.error || (removed.data?.length ?? 0) === 0) {
    await playedCardsRepo.removeById(supabase, playedRow.id)
    return {
      ok: false,
      error: removed.error?.message ?? 'Card is not in the player\'s hand',
    }
  }

  return { ok: true, data: playedRow }
}

const ConfirmCardSchema = z.object({ playedCardId: uuid() })

export async function confirmCard(input: { playedCardId: string }): Promise<ActionResult<true>> {
  const parsed = ConfirmCardSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()

  const { error } = await playedCardsRepo.confirm(supabase, parsed.data.playedCardId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

const PassTurnSchema = z.object({
  gameSessionId: uuid(),
  nextPlayerId: uuid(),
})

export async function passTurn(
  input: { gameSessionId: string, nextPlayerId: string },
): Promise<ActionResult<true>> {
  const parsed = PassTurnSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()
  const values = parsed.data

  const session = await sessionRepo.getLobbyId(supabase, values.gameSessionId)
  if (session.error) return { ok: false, error: session.error.message }
  if (!session.data) return { ok: false, error: 'Game session not found' }

  // Ownership: the next player must belong to the session's lobby.
  // Fails closed on a definitive rejection, but stays best-effort when
  // the membership read itself errors (a transient read must not wedge
  // an otherwise valid turn pass).
  const member = await playersRepo.isInLobby(supabase, {
    playerId: values.nextPlayerId,
    lobbyId: session.data.lobby_id,
  })
  if (member.error) {
    console.error('Membership check failed for next player:', member.error.message)
  }
  else if (!member.data) {
    return { ok: false, error: 'Next player is not in this lobby' }
  }

  const { error } = await sessionRepo.updateTurn(supabase, {
    gameSessionId: values.gameSessionId,
    nextPlayerId: values.nextPlayerId,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

const DrawCardsSchema = z.object({
  gameSessionId: uuid(),
  playerId: uuid(),
  count: z.number().int().min(1),
})

export async function drawCards(
  input: { gameSessionId: string, playerId: string, count: number },
): Promise<ActionResult<true>> {
  const parsed = DrawCardsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()
  const values = parsed.data

  const pile = await drawPileRepo.drawCards(supabase, {
    gameSessionId: values.gameSessionId,
    count: values.count,
  })
  if (pile.error || !pile.data || pile.data.length === 0) {
    return { ok: false, error: pile.error?.message ?? 'No cards in draw pile' }
  }

  const rows = pile.data.map((dc, index) => ({
    game_session_id: values.gameSessionId,
    player_id: values.playerId,
    card_id: dc.card_id,
    position: 999 + index, // high positions avoid collisions with dealt cards
  }))
  const inserted = await handRepo.insertCards(supabase, rows)
  if (inserted.error) return { ok: false, error: inserted.error.message }

  // Best-effort pile cleanup (same as before): hand rows are authoritative.
  await drawPileRepo.removeByIds(supabase, pile.data.map(dc => dc.id))

  return { ok: true, data: true }
}

const ExchangeCardSchema = z.object({
  gameSessionId: uuid(),
  playerId: uuid(),
  cardId: uuid(),
  isEnding: z.boolean().optional(),
})

export async function exchangeCard(
  input: { gameSessionId: string, playerId: string, cardId: string, isEnding?: boolean },
): Promise<ActionResult<true>> {
  const parsed = ExchangeCardSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()
  const values = parsed.data

  const drawn = await drawPileRepo.drawOne(supabase, {
    gameSessionId: values.gameSessionId,
    endingOnly: values.isEnding === true,
  })
  if (drawn.error || !drawn.data || drawn.data.length === 0) {
    return { ok: false, error: drawn.error?.message ?? 'No cards in draw pile' }
  }
  const newCard = drawn.data[0]

  // Ownership: verify the exchanged card actually leaves the player's hand
  // BEFORE the new card is added (no compensation needed at this step).
  const removed = await handRepo.removeCard(supabase, {
    gameSessionId: values.gameSessionId,
    playerId: values.playerId,
    cardId: values.cardId,
  })
  if (removed.error) return { ok: false, error: removed.error.message }
  if ((removed.data?.length ?? 0) === 0) {
    return { ok: false, error: 'Card is not in the player\'s hand' }
  }

  const inserted = await handRepo.insertCard(supabase, {
    game_session_id: values.gameSessionId,
    player_id: values.playerId,
    card_id: newCard.card_id,
    position: 999,
  })
  if (inserted.error) return { ok: false, error: inserted.error.message }

  // Best-effort pile cleanup (same as before).
  await drawPileRepo.removeById(supabase, newCard.id)

  return { ok: true, data: true }
}

const ObjectToCardSchema = z.object({
  gameSessionId: uuid(),
  playedCardId: uuid(),
  storytellerId: uuid(),
  nextPlayerId: uuid(),
})

export async function objectToCard(
  input: { gameSessionId: string, playedCardId: string, storytellerId: string, nextPlayerId: string },
): Promise<ActionResult<{ gameSessionId: string, playedCardId: string, storytellerId: string, nextPlayerId: string }>> {
  const parsed = ObjectToCardSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()
  const values = parsed.data

  const fetched = await playedCardsRepo.getById(supabase, values.playedCardId)
  if (fetched.error || !fetched.data) {
    return { ok: false, error: fetched.error?.message ?? 'Played card not found' }
  }

  // Return the card to the storyteller's hand — checked explicitly so a
  // failed return cannot silently swallow the card (the historical flow
  // ignored this error and then deleted the played row).
  const inserted = await handRepo.insertCard(supabase, {
    game_session_id: values.gameSessionId,
    player_id: values.storytellerId,
    card_id: fetched.data.card_id,
    position: 0,
  })
  if (inserted.error) return { ok: false, error: inserted.error.message }

  const removed = await playedCardsRepo.removeById(supabase, values.playedCardId)
  if (removed.error) return { ok: false, error: removed.error.message }

  return { ok: true, data: values }
}

const FinalizeWinSchema = z.object({
  gameSessionId: uuid(),
  winnerId: uuid(),
  lobbyId: uuid(),
})

export async function finalizeWin(
  input: { gameSessionId: string, winnerId: string, lobbyId: string },
): Promise<ActionResult<true>> {
  const parsed = FinalizeWinSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()
  const values = parsed.data

  const session = await sessionRepo.getLobbyId(supabase, values.gameSessionId)
  if (session.error) return { ok: false, error: session.error.message }
  if (!session.data) return { ok: false, error: 'Game session not found' }
  if (session.data.lobby_id !== values.lobbyId) {
    return { ok: false, error: 'Game session does not belong to this lobby' }
  }

  const member = await playersRepo.isInLobby(supabase, {
    playerId: values.winnerId,
    lobbyId: values.lobbyId,
  })
  if (member.error) {
    console.error('Membership check failed for winner:', member.error.message)
  }
  else if (!member.data) {
    return { ok: false, error: 'Winner is not a player in this lobby' }
  }

  const finalized = await sessionRepo.finalizeWin(supabase, {
    gameSessionId: values.gameSessionId,
    winnerId: values.winnerId,
  })
  if (finalized.error) return { ok: false, error: finalized.error.message }

  const lobby = await lobbyRepo.markFinished(supabase, values.lobbyId)
  if (lobby.error) console.error('Failed to mark lobby finished:', lobby.error.message)

  return { ok: true, data: true }
}

const SyncTimerSchema = z.object({
  gameSessionId: uuid(),
  isEnabled: z.boolean(),
  duration: z.number().int().min(0),
  currentPlayerId: uuid().nullable(),
  action: z.enum(['start', 'stop', 'sync', 'extend']),
  pacingDelay: z.number().int().min(0).optional(),
  newExpiresAt: z.string().optional(),
})

export async function syncTimer(
  input: {
    gameSessionId: string
    isEnabled: boolean
    duration: number
    currentPlayerId: string | null
    action: 'start' | 'stop' | 'sync' | 'extend'
    pacingDelay?: number
    newExpiresAt?: string
  },
): Promise<ActionResult<TimerSyncResult>> {
  const parsed = SyncTimerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()
  const values = parsed.data
  const { gameSessionId, isEnabled, duration, currentPlayerId, action, pacingDelay = 0 } = values
  const now = new Date().toISOString()

  if (action === 'start' && isEnabled && currentPlayerId) {
    // Minimum time needed = pacing delay + 5 seconds buffer
    const minimumTimeNeeded = pacingDelay + 5
    const finalDuration = duration < minimumTimeNeeded ? minimumTimeNeeded : duration
    const expiresAt = new Date(Date.now() + finalDuration * 1000).toISOString()

    const { error } = await sessionRepo.updateTimer(supabase, gameSessionId, {
      timer_enabled: true,
      timer_duration: finalDuration,
      timer_started_at: now,
      timer_expires_at: expiresAt,
      updated_at: now,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { success: true, timerStartedAt: now, timerExpiresAt: expiresAt } }
  }

  if (action === 'stop') {
    const { error } = await sessionRepo.updateTimer(supabase, gameSessionId, {
      timer_started_at: null,
      timer_expires_at: null,
      updated_at: now,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { success: true } }
  }

  if (action === 'extend' && isEnabled) {
    const finalExpiresAt = input.newExpiresAt
      || new Date(Date.now() + (pacingDelay + 5) * 1000).toISOString()
    const { error } = await sessionRepo.updateTimer(supabase, gameSessionId, {
      timer_expires_at: finalExpiresAt,
      updated_at: now,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { success: true, timerExpiresAt: finalExpiresAt } }
  }

  if (action === 'sync') {
    const { error } = await sessionRepo.updateTimer(supabase, gameSessionId, {
      timer_enabled: isEnabled,
      timer_duration: duration,
      updated_at: now,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { success: true } }
  }

  return { ok: true, data: { success: true } }
}

const CheckTimerExtensionSchema = z.object({ gameSessionId: uuid() })

/** Reads the current timer expiration (null when unset/session missing). */
export async function checkTimerExtension(
  input: { gameSessionId: string },
): Promise<ActionResult<string | null>> {
  const parsed = CheckTimerExtensionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: inputError(parsed.error) }
  const supabase = await createClient()

  const { data, error } = await sessionRepo.getTimerExpiry(supabase, parsed.data.gameSessionId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data?.timer_expires_at ?? null }
}
