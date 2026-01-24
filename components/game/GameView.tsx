'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { type RealtimePostgresUpdatePayload } from '@supabase/supabase-js'
import { Database } from '@/supabase/types'
import { createClient } from '@/utils/supabase/client'
import PlayerHand from './PlayerHand'
import TableArea from './TableArea'
import GameSidebar from './GameSidebar'
import TurnControls from './TurnControls'
import GameCompletionOverlay from './GameCompletionOverlay'
import { useGameEngine } from './useGameEngine'
import { LobbySettingsSchema, defaultLobbySettings } from '@/types/lobby'
import { useRouter, useParams } from 'next/navigation'
import { type CardData, type HandCardData, type PlayedCardData } from '@/utils/gameUtils'
import { CardLayout } from '@/types/card'

// Default background image URL for game when no deck background is provided
const DEFAULT_BACKGROUND_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAcH00pKK2AxXMqHsTx4miiahShYfItJyRTa5n9HZSy_NfBIUIjJskQWLoLdEPNWqahz6STV7TNRURrekmNyEm86n7xfYHlDTcC4e5sDy-NKJdLWGPSA_o27Aw5uQDhye24irWMHFdDf9DJ4AdmG7AgkYGu2zx1j0NN0Dsu_IpKvv3WeMqZX2Sq0SNUF1qwp-BQtUXNsNd5AKKuAvvy9Uuu2b_45DkEiAUlVWy-97XvQ6sr8zYxK25Wts7TpJ4ulmvq-9Ag9XAhfys'

type Lobby = Database['public']['Tables']['lobbies']['Row']
type Player = Database['public']['Tables']['players']['Row']
type GameSession = Database['public']['Tables']['game_sessions']['Row']
type Deck = Database['public']['Tables']['decks']['Row']

interface GameViewProps {
  lobby: Lobby
  players: Player[]
  currentUserId: string | null
  currentGuestId: string | undefined
}

export default function GameView({ lobby, players, currentUserId, currentGuestId }: GameViewProps) {
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [hand, setHand] = useState<HandCardData[]>([])
  const [playedCards, setPlayedCards] = useState<PlayedCardData[]>([])
  const [playerHandCounts, setPlayerHandCounts] = useState<Record<string, number>>({})
  const [deck, setDeck] = useState<Deck | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const lng = params.lng as string
  const fetchGameStateRef = useRef<() => Promise<void>>(null)

  // Determine if current player
  const currentPlayer = useMemo(() => players.find(p =>
    (currentUserId && p.user_id === currentUserId)
    || (currentGuestId && p.guest_id === currentGuestId),
  ), [players, currentUserId, currentGuestId])

  const currentPlayerId = currentUserId || currentGuestId || null
  const isSpectator = currentPlayer?.role === 'spectator'
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (lobby.deck_id) {
      const fetchDeck = async () => {
        const { data } = await supabase
          .from('decks')
          .select('*')
          .eq('id', lobby.deck_id!)
          .single()
        if (data) setDeck(data)
      }
      fetchDeck()
    }
  }, [lobby.deck_id, supabase])

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
        .select(`*, cards (*)`)
        .eq('game_session_id', session.id)
        .order('position', { ascending: true })
        .order('played_at', { ascending: true })

      if (playedData) {
        const fetchedCards: PlayedCardData[] = playedData.map(item => ({
          ...item.cards,
          type: item.cards.category ?? 'card',
          played_by: item.player_id,
          status: item.status,
          played_card_id: item.id,
        }))
        setPlayedCards(fetchedCards)
      }

      // Fetch player's hand
      if (currentPlayer) {
        const { data: handData } = await supabase
          .from('player_hands')
          .select(`*, cards (*)`)
          .eq('game_session_id', session.id)
          .eq('player_id', currentPlayer.id)
          .order('position')

        if (handData) {
          const cardsWithType: HandCardData[] = handData.map(item => ({
            ...item.cards,
            type: item.cards.category ?? 'card',
            hand_id: item.id,
            position: item.position,
          }))
          setHand(cardsWithType)
        }
      }

      // Fetch all hand counts
      const { data: allHandsData } = await supabase
        .from('player_hands')
        .select(`player_id, cards (type)`)
        .eq('game_session_id', session.id)

      if (allHandsData) {
        const counts: Record<string, number> = {}
        allHandsData.forEach((item) => {
          if (item.cards?.type !== 'ending') {
            counts[item.player_id] = (counts[item.player_id] || 0) + 1
          }
        })
        setPlayerHandCounts(counts)
      }
    }
  }, [supabase, lobby.id, currentPlayer])

  useEffect(() => {
    fetchGameStateRef.current = fetchGameState
  }, [fetchGameState])

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

  // Initialize Game Engine Hook
  const {
    state,
    playCard,
    passTurn,
    interrupt,
    objectToCard,
    challengeStutter,
    confirmCard,
    winGame,
    finalizeWin,
    isDrawing,
    optimisticCard,
    inFlightHandId,
    gameMode,
  } = useGameEngine(
    gameSession,
    currentPlayer,
    players,
    fetchGameState,
  )

  // Subscriptions
  useEffect(() => {
    fetchGameState()

    const channel = supabase.channel(`game:${lobby.id}`)
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `lobby_id=eq.${lobby.id}` },
        (payload: RealtimePostgresUpdatePayload<GameSession>) => {
          if (payload.new) setGameSession(payload.new)
        },
      )

    if (gameSession?.id) {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'played_cards', filter: `game_session_id=eq.${gameSession.id}` },
          () => { fetchGameStateRef.current?.() },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'player_hands', filter: `game_session_id=eq.${gameSession.id}` },
          () => { fetchGameStateRef.current?.() },
        )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, lobby.id, gameSession?.id])

  // Derived State
  const currentTurnPlayerId = gameSession?.current_turn_player_id
  const isMyTurn = currentTurnPlayerId === currentPlayer?.id
  const storytellerPlayer = players.find(p => p.id === gameSession?.storyteller_id)
  const isStoryteller = storytellerPlayer?.id === currentPlayer?.id

  const displayedPlayedCards = useMemo(() => {
    const all = [...playedCards]
    if (optimisticCard) {
      const opt = optimisticCard as PlayedCardData
      if (!all.some(c => c.id === opt.id && c.played_by === opt.played_by)) {
        all.push(opt)
      }
    }
    return all
  }, [playedCards, optimisticCard])

  const displayedHand = useMemo(() => {
    return hand.filter(c => c.hand_id !== inFlightHandId)
  }, [hand, inFlightHandId])

  const storyCards = displayedHand.filter(c => c.type !== 'ending')
  const endingCard = displayedHand.find(c => c.type === 'ending')
  const handSize = storyCards.length
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const onSelectCard = (card: CardData) => {
    setSelectedCardId(prev => prev === card.id ? null : card.id)
  }

  const isEndingSelected = useMemo(() => {
    return displayedHand.find(c => c.id === selectedCardId)?.type === 'ending'
  }, [displayedHand, selectedCardId])

  const onPlayCard = (card: HandCardData) => {
    if (card.type === 'ending' || gameSession?.status === 'COMPLETED') return
    playCard(card, playedCards.length)
  }

  const onWin = () => {
    const currentEndingCard = endingCard || hand.find(c => c.type === 'ending')
    if (currentEndingCard && gameSession?.status !== 'COMPLETED') {
      winGame(currentEndingCard.id, playedCards.length)
    }
  }

  const handlePlaySelected = () => {
    if (!selectedCardId) return
    const card = hand.find(c => c.id === selectedCardId)
    if (card) {
      onPlayCard(card)
      setSelectedCardId(null)
    }
  }

  const cardsPlayedCount = useMemo(() => {
    const counts: Record<string, number> = {}
    playedCards.forEach((card) => {
      if (card.played_by && card.status !== 'REVERTED') {
        counts[card.played_by] = (counts[card.played_by] || 0) + 1
      }
    })
    return counts
  }, [playedCards])

  const pendingCard = useMemo(() => displayedPlayedCards.find(c => c.status === 'PENDING'), [displayedPlayedCards])

  // Storyteller confirmation and ending validation is now handled by the state machine
  const winner = gameSession?.winner_id ? players.find(p => p.id === gameSession.winner_id) : undefined

  const handleReturnToLobbies = () => router.push(`/${lng}/lobbies`)

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background-dark text-white font-display">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{
          backgroundImage: deck?.bg_image_url
            ? `url('${deck.bg_image_url}')`
            : `url('${DEFAULT_BACKGROUND_IMAGE}')`,
        }}
      >
      </div>

      <main className="flex-1 flex flex-col justify-between overflow-hidden relative z-10">
        <TableArea
          playedCards={displayedPlayedCards}
          storytellerPlayer={storytellerPlayer}
          players={players}
          deck={
            deck
              ? {
                card_back_image_url: deck.card_back_image_url,
                category_images: deck.category_images as Record<string, string> | null,
                card_layout: deck.card_layout as CardLayout,
              }
              : undefined
          }
        />
        <PlayerHand
          cards={displayedHand}
          onSelectCard={onSelectCard}
          selectedCardId={selectedCardId}
          isMyTurn={isMyTurn}
          deck={
            deck
              ? {
                card_back_image_url: deck.card_back_image_url,
                category_images: deck.category_images as Record<string, string> | null,
                card_layout: deck.card_layout as CardLayout,
              }
              : undefined
          }
        />

        {!isSpectator && gameSession?.status !== 'COMPLETED' && (
          <TurnControls
            isMyTurn={!!isMyTurn}
            isStoryteller={!!isStoryteller}
            canInterrupt={!isMyTurn && !!currentPlayer && !pendingCard}
            handSize={handSize}
            selectedCardId={selectedCardId}
            onPlaySelected={handlePlaySelected}
            onPass={passTurn}
            onInterrupt={interrupt}
            onWin={onWin}
            isEndingSelected={isEndingSelected}
            canObject={!isMyTurn && !!pendingCard}
            onObject={() => pendingCard && objectToCard(pendingCard.played_card_id!, pendingCard.played_by!)}
            canChallengeStutter={!isMyTurn && !pendingCard && !!storytellerPlayer}
            onChallengeStutter={() => storytellerPlayer && challengeStutter(storytellerPlayer.id)}
            gameMode={gameMode}
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
        playerHandCounts={playerHandCounts}
      />

      {gameSession?.status === 'COMPLETED' && (
        <GameCompletionOverlay winner={winner} players={players} cardsPlayedCount={cardsPlayedCount} onReturnToLobbies={handleReturnToLobbies} />
      )}
    </div>
  )
}
