'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/client'
import { type CardCategory, type CardType, type GameSession } from '@/types/model'
import { type HandCardData, type PlayedCardData } from '@/utils/gameUtils'

/**
 * Single data pipeline for the active game.
 *
 * Owns ALL game-state fetching (session, played cards, hand, hand counts,
 * ending-card count) and ALL `game:*` realtime subscriptions, so the rest of
 * the UI never talks to Supabase directly. Refetches triggered by the
 * changefeed are serialized: overlapping events coalesce into one queued
 * pass instead of racing each other.
 */

const GameSessionSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  current_turn_player_id: z.string().nullable(),
  deck_id: z.string(),
  game_mode: z.string().nullable(),
  is_turn_pending_confirmation: z.boolean().nullable(),
  last_card_played_at: z.string().nullable(),
  lobby_id: z.string(),
  status: z.string(),
  storyteller_id: z.string().nullable(),
  updated_at: z.string(),
  winner_id: z.string().nullable(),
})

const isValidGameSession = (obj: unknown): obj is GameSession => {
  return GameSessionSchema.safeParse(obj).success
}

interface UseGameStateArgs {
  lobbyId: string
  /** DB id of the local player; undefined for spectators (no hand query) */
  playerId: string | undefined
}

export interface GameState {
  gameSession: GameSession | null
  playedCards: PlayedCardData[]
  hand: HandCardData[]
  playerHandCounts: Record<string, number>
  remainingEndingCardsCount: number
  /** Manually re-run a full fetch (normally triggered by the changefeed) */
  refresh: () => Promise<void>
}

export function useGameState({ lobbyId, playerId }: UseGameStateArgs): GameState {
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [playedCards, setPlayedCards] = useState<PlayedCardData[]>([])
  const [hand, setHand] = useState<HandCardData[]>([])
  const [playerHandCounts, setPlayerHandCounts] = useState<Record<string, number>>({})
  const [remainingEndingCardsCount, setRemainingEndingCardsCount] = useState(0)
  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const { data: session } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('lobby_id', lobbyId)
      .single()

    if (!session) return

    const gameSessionRow = session as GameSession
    setGameSession(gameSessionRow)

    // Secondary reads are independent — run them together to shrink the
    // window where the UI shows a half-stale board.
    const [playedRes, handRes, allHandsRes, endingRes] = await Promise.all([
      supabase
        .from('played_cards')
        .select('*, cards (*)')
        .eq('game_session_id', gameSessionRow.id)
        .order('position', { ascending: true })
        .order('played_at', { ascending: true }),
      playerId
        ? supabase
            .from('player_hands')
            .select('*, cards (*)')
            .eq('game_session_id', gameSessionRow.id)
            .eq('player_id', playerId)
            .order('position')
        : Promise.resolve({ data: null }),
      supabase
        .from('player_hands')
        .select('player_id, cards (type)')
        .eq('game_session_id', gameSessionRow.id),
      supabase
        .from('draw_pile')
        .select('*, cards!inner(category)', { count: 'exact', head: true })
        .eq('game_session_id', gameSessionRow.id)
        .eq('cards.category', 'ending'),
    ])

    if (playedRes.data) {
      const fetchedCards = playedRes.data.map(item => ({
        ...item.cards,
        category: item.cards.category as CardCategory,
        type: item.cards.type as CardType,
        played_by: item.player_id,
        status: item.status,
        played_card_id: item.id,
      }))
      setPlayedCards(fetchedCards as PlayedCardData[])
    }

    if (handRes.data) {
      const cardsWithType = handRes.data.map(item => ({
        ...item.cards,
        category: item.cards.category as CardCategory,
        type: item.cards.type as CardType,
        hand_id: item.id,
        position: item.position,
      }))
      setHand(cardsWithType as HandCardData[])
    }

    if (allHandsRes.data) {
      const counts: Record<string, number> = {}
      allHandsRes.data.forEach((item) => {
        if (item.cards?.type !== 'ending') {
          counts[item.player_id] = (counts[item.player_id] || 0) + 1
        }
      })
      setPlayerHandCounts(counts)
    }

    setRemainingEndingCardsCount(endingRes.count || 0)
  }, [supabase, lobbyId, playerId])

  // Serialized refresh: changefeed events arriving mid-fetch are coalesced
  // into a single follow-up pass instead of overlapping queries.
  const refreshingRef = useRef(false)
  const queuedRef = useRef(false)
  const refresh = useCallback(async () => {
    if (refreshingRef.current) {
      queuedRef.current = true
      return
    }
    refreshingRef.current = true
    try {
      do {
        queuedRef.current = false
        await fetchAll()
      } while (queuedRef.current)
    }
    finally {
      refreshingRef.current = false
    }
  }, [fetchAll])

  // Initial load (and refetch when the room or local player changes)
  useEffect(() => {
    refresh()
  }, [refresh])

  // Single realtime pipeline: session rows apply directly (validated),
  // board changes trigger the serialized refetch.
  useEffect(() => {
    const channel = supabase.channel(`game:${lobbyId}`)

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_sessions', filter: `lobby_id=eq.${lobbyId}` },
      (payload: { new?: unknown }) => {
        if (payload.new && isValidGameSession(payload.new)) setGameSession(payload.new)
      },
    )

    if (gameSession?.id) {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'played_cards', filter: `game_session_id=eq.${gameSession.id}` },
          () => { refresh() },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'player_hands', filter: `game_session_id=eq.${gameSession.id}` },
          () => { refresh() },
        )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, lobbyId, gameSession?.id, refresh])

  return {
    gameSession,
    playedCards,
    hand,
    playerHandCounts,
    remainingEndingCardsCount,
    refresh,
  }
}
