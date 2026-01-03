'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Database } from '@/supabase/types'
import { createClient } from '@/utils/supabase/client'
import PlayerHand from './PlayerHand'
import TableArea from './TableArea'
import GameSidebar from './GameSidebar'
import TurnControls from './TurnControls'
import { useGameEngine } from './useGameEngine'
import type { Tables } from '@/supabase/types'
import { LobbySettingsSchema, defaultLobbySettings } from '@/types/lobby'

type Lobby = Database['public']['Tables']['lobbies']['Row']
type Player = Database['public']['Tables']['players']['Row']
type CardData = Database['public']['Tables']['cards']['Row'] & { type?: string, played_by?: string }
type GameSession = Database['public']['Tables']['game_sessions']['Row']

interface GameViewProps {
  lobby: Lobby
  players: Player[]
  currentUserId: string | null
  currentGuestId: string | undefined
}

export default function GameView({ lobby, players, currentUserId, currentGuestId }: GameViewProps) {
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [hand, setHand] = useState<CardData[]>([])
  const [playedCards, setPlayedCards] = useState<CardData[]>([])
  const supabase = createClient()

  // Determine current player ID (user or guest)
  const currentPlayerId = currentUserId || currentGuestId || null
  const currentPlayer = useMemo(() => players.find(p =>
    (currentUserId && p.user_id === currentUserId)
    || (currentGuestId && p.guest_id === currentGuestId),
  ), [players, currentUserId, currentGuestId])

  const isSpectator = currentPlayer?.role === 'spectator'
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (currentUserId) {
      const fetchAdminStatus = async () => {
        const { data } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('user_id', currentUserId)
          .single()
        if (data) setIsAdmin(data.is_admin)
      }
      fetchAdminStatus()
    }
  }, [currentUserId, supabase])

  const fetchGameState = useCallback(async () => {
    // Get game session for this lobby
    const { data: session } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('lobby_id', lobby.id)
      .single()

    if (session) {
      setGameSession(session)

      // Fetch played cards
      const { data: playedData } = await supabase
        .from('played_cards')
        .select(`
                    *,
                    cards (*)
                `)
        .eq('game_session_id', session.id)
        .order('played_at')

      if (playedData) {
        type PlayedRow = Tables<'played_cards'> & { cards: Tables<'cards'> }
        const playedCardsWithType = (playedData as PlayedRow[]).map(item => ({
          ...item.cards,
          // Use category if available (e.g. 'Catalyst'), otherwise type (e.g. 'ending'), otherwise 'Card'
          type: item.cards.category || item.cards.type || 'Card',
          played_by: item.player_id,
        }))
        setPlayedCards(playedCardsWithType)
      }

      // Fetch player's hand if we found the current player
      if (currentPlayer) {
        const { data: handData } = await supabase
          .from('player_hands')
          .select(`
                        *,
                        cards (*)
                    `)
          .eq('game_session_id', session.id)
          .eq('player_id', currentPlayer.id)
          .order('position')

        if (handData) {
          type HandRow = Tables<'player_hands'> & { cards: Tables<'cards'> }
          const cardsWithType = (handData as HandRow[]).map(item => ({
            ...item.cards,
            // Use category if available (e.g. 'Catalyst'), otherwise type (e.g. 'ending'), otherwise 'Card'
            type: item.cards.category || item.cards.type || 'Card',
          }))
          setHand(cardsWithType)
        }
      }
    }
  }, [supabase, lobby.id, currentPlayer])

  // Initialize Game Engine Hook
  const { playCard, passTurn, interrupt, winGame, isDrawing } = useGameEngine(
    gameSession,
    currentPlayer,
    players,
    fetchGameState,
  )

  // Initial fetch and subscriptions
  useEffect(() => {
    // Fetch initial state asynchronously to avoid blocking effect setup
    const initializeGame = async () => {
      await fetchGameState()
    }
    initializeGame()

    const channel = supabase
      .channel(`game:${lobby.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `lobby_id=eq.${lobby.id}` },
        (payload) => {
          if (payload.new) setGameSession(payload.new as GameSession)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'played_cards' },
        () => {
          fetchGameState()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_hands' },
        () => {
          fetchGameState()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, lobby.id, fetchGameState])

  // Derived State
  const currentTurnPlayerId = gameSession?.current_turn_player_id
  const isMyTurn = currentTurnPlayerId === currentPlayer?.id
  const storytellerPlayer = players.find(p => p.id === gameSession?.storyteller_id)
  const isStoryteller = storytellerPlayer?.id === currentPlayer?.id

  // Separate Ending Card from Hand for Logic (assuming Ending cards have type 'ending')
  // For now, treat all as playable via Play Card, but Win button logic is specific.
  const storyCards = hand.filter(c => c.type !== 'ending')
  const endingCard = hand.find(c => c.type === 'ending')
  const handSize = storyCards.length // Only story cards count for "Empty Hand" logic usually

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const onSelectCard = (card: CardData) => {
    setSelectedCardId(prev => prev === card.id ? null : card.id)
  }

  const handlePlaySelected = async () => {
    if (!selectedCardId) return
    const card = hand.find(c => c.id === selectedCardId)
    if (card) {
      await onPlayCard(card)
      setSelectedCardId(null)
    }
  }

  const onPlayCard = async (card: CardData) => {
    // Optimistic Update
    setHand(prev => prev.filter(c => c.id !== card.id))
    setPlayedCards(prev => [...prev, { ...card, played_by: currentPlayer?.id }])

    await playCard(card, hand, playedCards.length)
  }

  const onWin = async () => {
    // Find ending card via type='ending' (which we fixed in fetching)
    const currentEndingCard = endingCard || hand.find(c => c.type === 'ending')
    if (currentEndingCard) {
      await winGame(currentEndingCard.id)
    }
    else {
      console.error('No ending card found in hand!')
    }
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background-dark text-white font-display">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{ backgroundImage: 'url(\'https://lh3.googleusercontent.com/aida-public/AB6AXuAcH00pKK2AxXMqHsTx4miiahShYfItJyRTa5n9HZSy_NfBIUIjJskQWLoLdEPNWqahz6STV7TNRURrekmNyEm86n7xfYHlDTcC4e5sDy-NKJdLWGPSA_o27Aw5uQDhye24irWMHFdDf9DJ4AdmG7AgkYGu2zx1j0NN0Dsu_IpKvv3WeMqZX2Sq0SNUF1qwp-BQtUXNsNd5AKKuAvvy9Uuu2b_45DkEiAUlVWy-97XvQ6sr8zYxK25Wts7TpJ4ulmvq-9Ag9XAhfys\')' }}
      >
      </div>

      <main className="flex-1 flex flex-col justify-between overflow-hidden relative z-10">
        <TableArea playedCards={playedCards} storytellerPlayer={storytellerPlayer} players={players} />
        <PlayerHand
          cards={hand}
          onSelectCard={onSelectCard}
          selectedCardId={selectedCardId}
          isMyTurn={isMyTurn}
        />

        {/* Turn Controls inside main area to avoid sidebar overlap */}
        {!isSpectator && (
          <TurnControls
            isMyTurn={!!isMyTurn}
            isStoryteller={!!isStoryteller}
            canInterrupt={!isMyTurn && !!currentPlayer} // Can interrupt if logged in and not my turn
            handSize={handSize}
            selectedCardId={selectedCardId}
            onPlaySelected={handlePlaySelected}
            onPass={passTurn}
            onInterrupt={interrupt}
            onWin={onWin}
          />
        )}
      </main>

      <GameSidebar
        players={players}
        currentPlayerId={currentPlayerId}
        currentTurnPlayerId={currentTurnPlayerId || ''}
        lobbyId={lobby.id}
        enableVideoChat={(() => {
          if (lobby.settings && typeof lobby.settings === 'object') {
            const parsed = LobbySettingsSchema.safeParse(lobby.settings)
            return parsed.success ? parsed.data.enableVideoChat : defaultLobbySettings.enableVideoChat
          }
          return defaultLobbySettings.enableVideoChat
        })()}
        isSpectator={isSpectator}
        isAdmin={isAdmin}
      />
    </div>
  )
}
