'use client'

import { useMemo } from 'react'
import { type Lobby, type Player } from '@/types/model'
import { GameEngineProvider } from './useGameEngine'
import { useGameState } from './useGameState'
import { useDeck } from './useDeck'
import { useGameSettings } from './useGameSettings'
import { useIsAdmin } from './useIsAdmin'
import GameScreen from './GameScreen'

interface GameViewProps {
  lobby: Lobby
  players: Player[]
  currentUserId: string | null
  currentGuestId: string | undefined
}

/**
 * Container for the active game: gathers data (session, deck, settings,
 * admin flag) and mounts the machine lifecycle provider. Rendering is
 * delegated entirely to GameScreen — this component only re-renders on
 * data changes, never on machine events (those are handled by selectors
 * inside GameScreen).
 */
export default function GameView({ lobby, players, currentUserId, currentGuestId }: GameViewProps) {
  const currentPlayer = useMemo(() => players.find(p =>
    (currentUserId && p.user_id === currentUserId)
    || (currentGuestId && p.guest_id === currentGuestId),
  ), [players, currentUserId, currentGuestId])

  const currentPlayerId = currentUserId || currentGuestId || null
  const isSpectator = currentPlayer?.role === 'spectator'

  // Single game-state data pipeline (fetch + realtime subscriptions)
  const {
    gameSession,
    playedCards,
    hand,
    playerHandCounts,
    remainingEndingCardsCount,
  } = useGameState({ lobbyId: lobby.id, playerId: currentPlayer?.id })

  const deck = useDeck(lobby.deck_id)
  const settings = useGameSettings(lobby.settings)
  const isAdmin = useIsAdmin(currentUserId)

  return (
    <GameEngineProvider
      gameSession={gameSession}
      currentPlayer={currentPlayer}
      players={players}
      pacingDelay={settings.pacing.duration}
      timerDuration={settings.timer.duration}
    >
      <GameScreen
        lobbyId={lobby.id}
        players={players}
        currentPlayer={currentPlayer}
        currentPlayerId={currentPlayerId}
        isSpectator={isSpectator}
        isAdmin={isAdmin}
        deck={deck}
        settings={settings}
        gameSession={gameSession}
        playedCards={playedCards}
        hand={hand}
        playerHandCounts={playerHandCounts}
        remainingEndingCardsCount={remainingEndingCardsCount}
      />
    </GameEngineProvider>
  )
}
