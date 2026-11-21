'use client'

import { useState, useCallback, useMemo } from 'react'
import { type Player, type GameSession, type Deck, CardLayout } from '@/types/model'
import PlayerHand from './PlayerHand'
import TableArea from './TableArea'
import GameSidebar from './GameSidebar'
import TurnControls from './TurnControls'
import GameCompletionOverlay from './GameCompletionOverlay'
import CardDetailsOverlay from './CardDetailsOverlay'
import TimerDisplay from './TimerDisplay'
import { useGameActions, useGameSelector } from './useGameEngine'
import { mergeRemoteWithOptimistic, splitHand, computeCardsPlayedCount, findPendingCard } from './utils/viewState'
import { useRouter, useParams } from 'next/navigation'
import { type CardData, type HandCardData, type PlayedCardData } from '@/utils/gameUtils'
import { type GameSettings } from './useGameSettings'

// Default background image URL for game when no deck background is provided
const DEFAULT_BACKGROUND_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAcH00pKK2AxXMqHsTx4miiahShYfItJyRTa5n9HZSy_NfBIUIjJskQWLoLdEPNWqahz6STV7TNRURrekmNyEm86n7xfYHlDTcC4e5sDy-NKJdLWGPSA_o27Aw5uQDhye24irWMHFdDf9DJ4AdmG7AgkYGu2zx1j0NN0Dsu_IpKvv3WeMqZX2Sq0SNUF1qwp-BQtUXNsNd5AKKuAvvy9Uuu2b_45DkEiAUlVWy-97XvQ6sr8zYxK25Wts7TpJ4ulmvq-9Ag9XAhfys'

const TYPE_COLOR_MAP: Record<string, string> = {
  ending: 'bg-rose-500/90 border-rose-400/50',
  protagonist: 'bg-sky-500/90 border-sky-400/50',
  antagonist: 'bg-amber-600/90 border-amber-400/50',
  setting: 'bg-emerald-500/90 border-emerald-400/50',
  object: 'bg-violet-500/90 border-violet-400/50',
  catalyst: 'bg-fuchsia-500/90 border-fuchsia-400/50',
  trait: 'bg-indigo-500/90 border-indigo-400/50',
  character: 'bg-blue-500/90 border-blue-400/50',
  aspect: 'bg-teal-500/90 border-teal-400/50',
  card: 'bg-slate-600/90 border-slate-500/50',
}

interface GameScreenProps {
  lobbyId: string
  players: Player[]
  currentPlayer: Player | undefined
  currentPlayerId: string | null
  isSpectator: boolean
  isAdmin: boolean
  deck: Deck | null
  settings: GameSettings
  gameSession: GameSession | null
  playedCards: PlayedCardData[]
  hand: HandCardData[]
  playerHandCounts: Record<string, number>
  remainingEndingCardsCount: number
}

/**
 * The game screen: pure presentation over (a) data props from the
 * GameView container and (b) the machine through selector/action hooks.
 * Machine events re-render this component only when a selected value
 * actually changes.
 */
export default function GameScreen({
  lobbyId,
  players,
  currentPlayer,
  currentPlayerId,
  isSpectator,
  isAdmin,
  deck,
  settings,
  gameSession,
  playedCards,
  hand,
  playerHandCounts,
  remainingEndingCardsCount,
}: GameScreenProps) {
  const router = useRouter()
  const params = useParams()
  const lng = params.lng as string
  const [detailsCard, setDetailsCard] = useState<CardData | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const actions = useGameActions(currentPlayer, players)
  const gameMode = useGameSelector(snapshot => snapshot.context.gameMode)
  const optimisticCard = useGameSelector(snapshot => snapshot.context.optimisticCard)
  const inFlightHandId = useGameSelector(snapshot => snapshot.context.inFlightHandId)
  const canPlayMoreCards = useGameSelector(snapshot => snapshot.context.canPlayMoreCards)

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

  // Shared deck view-config for TableArea + PlayerHand (stable identity
  // so memoized children skip re-renders when the deck hasn't changed)
  const deckConfig = useMemo(
    () => (deck
      ? {
          card_back_image_url: deck.card_back_image_url,
          category_images: deck.category_images as Record<string, string> | null,
          card_layout: deck.card_layout as CardLayout,
        }
      : undefined),
    [deck],
  )

  const handleTimerExpire = useCallback(() => {
    if (isMyTurn && gameSession?.status !== 'COMPLETED') {
      actions.passTurn(handSize === 0)
    }
  }, [isMyTurn, gameSession?.status, actions, handSize])

  const timerComponent = settings.timer.isEnabled
    ? (
        <TimerDisplay
          isEnabled={settings.timer.isEnabled}
          duration={settings.timer.duration}
          isMyTurn={!!isMyTurn}
          isAnyonesTurn={!isSpectator && gameSession?.status !== 'COMPLETED'}
          onTimeExpire={handleTimerExpire}
          timerStartedAt={gameSession?.timer_started_at}
          timerExpiresAt={gameSession?.timer_expires_at}
        />
      )
    : null

  const onSelectCard = useCallback((card: CardData) => {
    setSelectedCardId(prev => prev === card.id ? null : card.id)
  }, [])

  const showCardDetails = useCallback((card: CardData) => setDetailsCard(card), [])

  const isEndingSelected = useMemo(
    () => displayedHand.find(c => c.id === selectedCardId)?.type === 'ending',
    [displayedHand, selectedCardId],
  )

  const onPlayCard = useCallback((card: HandCardData) => {
    if (card.type === 'ending' || gameSession?.status === 'COMPLETED') return
    actions.playCard(card, playedCards.length)
  }, [actions, gameSession?.status, playedCards.length])

  const onWin = useCallback(() => {
    const currentEndingCard = endingCard || hand.find(c => c.type === 'ending')
    if (currentEndingCard && gameSession?.status !== 'COMPLETED') {
      actions.winGame(currentEndingCard, playedCards.length)
    }
  }, [endingCard, hand, actions, gameSession?.status, playedCards.length])

  const handlePlaySelected = useCallback(() => {
    if (!selectedCardId) return
    const card = hand.find(c => c.id === selectedCardId)
    if (card) {
      onPlayCard(card)
      setSelectedCardId(null)
    }
  }, [selectedCardId, hand, onPlayCard])

  const cardsPlayedCount = useMemo(
    () => computeCardsPlayedCount(displayedPlayedCards),
    [displayedPlayedCards],
  )

  const pendingCard = findPendingCard(displayedPlayedCards)

  const onPass = useCallback(() => actions.passTurn(handSize === 0), [actions, handSize])
  const onObject = useCallback(
    () => pendingCard && actions.objectToCard(pendingCard.played_card_id!, pendingCard.played_by!),
    [actions, pendingCard],
  )
  const onChallengeStutter = useCallback(
    () => storytellerPlayer && actions.challengeStutter(storytellerPlayer.id),
    [actions, storytellerPlayer],
  )
  const onExchange = useCallback(
    (cardId: string) => actions.exchangeCard(cardId, isEndingSelected),
    [actions, isEndingSelected],
  )

  const winner = gameSession?.winner_id ? players.find(p => p.id === gameSession.winner_id) : undefined

  const handleReturnToLobbies = useCallback(
    () => router.push(`/${lng}/lobbies`),
    [router, lng],
  )

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
          onShowDetails={showCardDetails}
          deck={deckConfig}
        />
        <PlayerHand
          cards={displayedHand}
          onSelectCard={onSelectCard}
          selectedCardId={selectedCardId}
          isMyTurn={isMyTurn}
          onShowDetails={showCardDetails}
          deck={deckConfig}
        />

        {!isSpectator && gameSession?.status !== 'COMPLETED' && (
          <TurnControls
            isMyTurn={!!isMyTurn}
            canInterrupt={!isMyTurn && !!currentPlayer && !pendingCard}
            handSize={handSize}
            selectedCardId={selectedCardId}
            onPlaySelected={handlePlaySelected}
            onPass={onPass}
            onInterrupt={actions.interrupt}
            onWin={onWin}
            isEndingSelected={isEndingSelected}
            canObject={!isMyTurn && !!pendingCard}
            onObject={onObject}
            canChallengeStutter={!isMyTurn && !pendingCard && !!storytellerPlayer}
            onChallengeStutter={onChallengeStutter}
            gameMode={gameMode}
            isPending={!!inFlightHandId}
            canPlayMoreCards={canPlayMoreCards}
            onExchange={onExchange}
            hasRemainingEndingCards={remainingEndingCardsCount > 0}
          />
        )}
      </main>

      <GameSidebar
        players={players}
        currentPlayerId={currentPlayerId}
        currentTurnPlayerId={currentTurnPlayerId || ''}
        lobbyId={lobbyId}
        enableVideoChat={settings.enableVideoChat}
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
          typeColorMap={TYPE_COLOR_MAP}
        />
      )}
    </div>
  )
}
