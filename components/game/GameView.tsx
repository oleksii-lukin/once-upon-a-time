'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { type Lobby, type Player, Deck, CardLayout, LobbySettingsSchema, defaultLobbySettings } from '@/types/model'
import { createClient } from '@/utils/supabase/client'
import PlayerHand from './PlayerHand'
import TableArea from './TableArea'
import GameSidebar from './GameSidebar'
import TurnControls from './TurnControls'
import GameCompletionOverlay from './GameCompletionOverlay'
import CardDetailsOverlay from './CardDetailsOverlay'
import TimerDisplay from './TimerDisplay'
import { useGameEngine } from './useGameEngine'
import { useGameState } from './useGameState'
import { mergeRemoteWithOptimistic, splitHand, computeCardsPlayedCount, findPendingCard } from './utils/viewState'
import { useRouter, useParams } from 'next/navigation'
import { type CardData, type HandCardData } from '@/utils/gameUtils'

// Default background image URL for game when no deck background is provided
const DEFAULT_BACKGROUND_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAcH00pKK2AxXMqHsTx4miiahShYfItJyRTa5n9HZSy_NfBIUIjJskQWLoLdEPNWqahz6STV7TNRURrekmNyEm86n7xfYHlDTcC4e5sDy-NKJdLWGPSA_o27Aw5uQDhye24irWMHFdDf9DJ4AdmG7AgkYGu2zx1j0NN0Dsu_IpKvv3WeMqZX2Sq0SNUF1qwp-BQtUXNsNd5AKKuAvvy9Uuu2b_45DkEiAUlVWy-97XvQ6sr8zYxK25Wts7TpJ4ulmvq-9Ag9XAhfys'

interface GameViewProps {
  lobby: Lobby
  players: Player[]
  currentUserId: string | null
  currentGuestId: string | undefined
}

export default function GameView({ lobby, players, currentUserId, currentGuestId }: GameViewProps) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [detailsCard, setDetailsCard] = useState<CardData | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const lng = params.lng as string

  // Determine if current player
  const currentPlayer = useMemo(() => players.find(p =>
    (currentUserId && p.user_id === currentUserId)
    || (currentGuestId && p.guest_id === currentGuestId),
  ), [players, currentUserId, currentGuestId])

  const currentPlayerId = currentUserId || currentGuestId || null
  const isSpectator = currentPlayer?.role === 'spectator'
  const [isAdmin, setIsAdmin] = useState(false)

  // Single game-state data pipeline (fetch + realtime subscriptions)
  const {
    gameSession,
    playedCards,
    hand,
    playerHandCounts,
    remainingEndingCardsCount,
  } = useGameState({ lobbyId: lobby.id, playerId: currentPlayer?.id })

  // fetch deck
  useEffect(() => {
    if (lobby.deck_id) {
      const fetchDeck = async () => {
        const { data } = await supabase
          .from('decks')
          .select('*')
          .eq('id', lobby.deck_id!)
          .single()
        if (data) setDeck(data as unknown as Deck)
      }
      fetchDeck()
    }
  }, [lobby.deck_id, supabase])

  // fetch admin status
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

  // Extract timer settings from lobby
  const timerSettings = useMemo(() => {
    if (lobby.settings && typeof lobby.settings === 'object') {
      const parsed = LobbySettingsSchema.safeParse(lobby.settings)
      if (parsed.success) {
        return {
          isEnabled: parsed.data.timerPerTurn,
          duration: parsed.data.timerPerTurn ? parsed.data.timerPerTurnDuration : 0,
        }
      }
    }
    return {
      isEnabled: false,
      duration: 0,
    }
  }, [lobby.settings])

  // Extract pacing settings from lobby
  const pacingSettings = useMemo(() => {
    if (lobby.settings && typeof lobby.settings === 'object') {
      const parsed = LobbySettingsSchema.safeParse(lobby.settings)
      if (parsed.success) {
        return {
          isEnabled: parsed.data.enablePacingDelay,
          duration: parsed.data.enablePacingDelay ? parsed.data.pacingDelayDuration : 0,
        }
      }
    }
    return {
      isEnabled: false,
      duration: 0,
    }
  }, [lobby.settings])

  // Initialize Game Engine Hook
  const {
    playCard,
    passTurn,
    interrupt,
    objectToCard,
    challengeStutter,
    winGame,
    optimisticCard,
    inFlightHandId,
    gameMode,
    exchangeCard,
    canPlayMoreCards,
  } = useGameEngine(
    gameSession,
    currentPlayer,
    players,
    pacingSettings.duration,
    timerSettings.duration,
  )

  // Derived state: authoritative remote data + machine's optimistic overlay
  const currentTurnPlayerId = gameSession?.current_turn_player_id
  const isMyTurn = currentTurnPlayerId === currentPlayer?.id
  const storytellerPlayer = players.find(p => p.id === gameSession?.storyteller_id)

  const displayed = useMemo(
    () => mergeRemoteWithOptimistic(
      { playedCards, hand },
      { optimisticCard, inFlightHandId },
    ),
    [playedCards, hand, optimisticCard, inFlightHandId],
  )
  const displayedPlayedCards = displayed.playedCards
  const displayedHand = displayed.hand

  const { endingCard, handSize } = splitHand(displayedHand)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  // Handle timer expiration - automatically pass turn
  const handleTimerExpire = useCallback(() => {
    if (isMyTurn && gameSession?.status !== 'COMPLETED') {
      passTurn(handSize === 0)
    }
  }, [isMyTurn, gameSession?.status, passTurn, handSize])

  // Create timer component
  const timerComponent = timerSettings.isEnabled
    ? (
        <TimerDisplay
          isEnabled={timerSettings.isEnabled}
          duration={timerSettings.duration}
          isMyTurn={!!isMyTurn}
          isAnyonesTurn={!isSpectator && gameSession?.status !== 'COMPLETED'}
          onTimeExpire={handleTimerExpire}
          timerStartedAt={gameSession?.timer_started_at}
          timerExpiresAt={gameSession?.timer_expires_at}
        />
      )
    : null

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
      winGame(currentEndingCard, playedCards.length)
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

  const cardsPlayedCount = useMemo(
    () => computeCardsPlayedCount(displayedPlayedCards),
    [displayedPlayedCards],
  )

  const pendingCard = findPendingCard(displayedPlayedCards)

  // Storyteller confirmation and ending validation is now handled by the state machine
  const winner = gameSession?.winner_id ? players.find(p => p.id === gameSession.winner_id) : undefined

  const handleReturnToLobbies = () => router.push(`/${lng}/lobbies`)

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background-dark text-white font-display">
      {/* Timer - fixed position at top center, above everything including card details */}
      {timerComponent && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-150">
          {timerComponent}
        </div>
      )}

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
          onShowDetails={card => setDetailsCard(card)}
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
          onShowDetails={(card: HandCardData) => setDetailsCard(card)}
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
            canInterrupt={!isMyTurn && !!currentPlayer && !pendingCard}
            handSize={handSize}
            selectedCardId={selectedCardId}
            onPlaySelected={handlePlaySelected}
            onPass={() => passTurn(handSize === 0)}
            onInterrupt={interrupt}
            onWin={onWin}
            isEndingSelected={isEndingSelected}
            canObject={!isMyTurn && !!pendingCard}
            onObject={() => pendingCard && objectToCard(pendingCard.played_card_id!, pendingCard.played_by!)}
            canChallengeStutter={!isMyTurn && !pendingCard && !!storytellerPlayer}
            onChallengeStutter={() => storytellerPlayer && challengeStutter(storytellerPlayer.id)}
            gameMode={gameMode}
            isPending={!!inFlightHandId}
            canPlayMoreCards={canPlayMoreCards}
            onExchange={cardId => exchangeCard(cardId, isEndingSelected)}
            hasRemainingEndingCards={remainingEndingCardsCount > 0}
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

      {/* Card Details Overlay */}
      {detailsCard && (
        <CardDetailsOverlay
          card={detailsCard}
          onClose={() => setDetailsCard(null)}
          categoryImages={deck?.category_images as Record<string, string> | null}
          typeColorMap={{
            ending: 'bg-rose-500/90 border-rose-400/50',
            protagonist: 'bg-sky-500/90 border-sky-400/50',
            antagonist: 'bg-amber-600/90 border-amber-500/50',
            setting: 'bg-emerald-500/90 border-emerald-400/50',
            object: 'bg-violet-500/90 border-violet-400/50',
            catalyst: 'bg-fuchsia-500/90 border-fuchsia-400/50',
            trait: 'bg-indigo-500/90 border-indigo-400/50',
            character: 'bg-blue-500/90 border-blue-400/50',
            aspect: 'bg-teal-500/90 border-teal-400/50',
            card: 'bg-slate-600/90 border-slate-500/50',
          }}
        />
      )}
    </div>
  )
}
