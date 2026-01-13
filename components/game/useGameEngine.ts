import { useState, useCallback, useMemo, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { type CardData, gameMachine } from './gameMachine'
import { useMachine } from '@xstate/react'
import { createBrowserInspector } from '@statelyai/inspect'

const inspector
  = process.env.NODE_ENV === 'development'
    && typeof window !== 'undefined'
    && localStorage.getItem('xstate-inspector') === 'enabled'
    ? createBrowserInspector()
    : null

type Player = Database['public']['Tables']['players']['Row']
type GameSession = Database['public']['Tables']['game_sessions']['Row']

export const useGameEngine = (
  gameSession: GameSession | null,
  currentPlayer: Player | undefined,
  players: Player[],
  fetchGameState: () => Promise<void>,
) => {
  const [state, send] = useMachine(gameMachine, {
    inspect: inspector?.inspect || undefined,
  })
  const supabase = createClient()

  // Initialize machine if session is loaded
  useEffect(() => {
    if (gameSession && currentPlayer && state.value === 'idle') {
      send({
        type: 'START_GAME',
        sessionId: gameSession.id,
        lobbyId: gameSession.lobby_id,
        mode: (gameSession.game_mode as any) || 'full',
        currentPlayerId: currentPlayer.id,
      })
    }
  }, [gameSession, currentPlayer, send, state.value])

  const nextPlayer = useMemo(() => {
    if (!currentPlayer || players.length === 0) return null
    const sortedPlayers = players
      .filter(p => p.role !== 'spectator')
      .sort((a, b) => {
        if (typeof a.turn_order === 'number' && typeof b.turn_order === 'number') {
          return a.turn_order - b.turn_order
        }
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      })
    const currentIndex = sortedPlayers.findIndex(p => p.id === currentPlayer.id)
    if (currentIndex === -1) return null

    const nextIndex = (currentIndex + 1) % sortedPlayers.length
    return sortedPlayers[nextIndex]
  }, [currentPlayer, players])

  const playCard = useCallback(async (card: CardData, playedCardsCount: number) => {
    if (card.type === 'ending') return
    send({ type: 'PLAY_CARD', card, playedCardsCount })
  }, [send])

  const passTurn = useCallback(async () => {
    if (!nextPlayer) return
    send({ type: 'PASS', nextPlayerId: nextPlayer.id })
  }, [send, nextPlayer])

  const interrupt = useCallback(async () => {
    send({ type: 'INTERRUPT' })
  }, [send])

  const objectToCard = useCallback(async (playedCardId: string, storytellerId: string) => {
    if (!nextPlayer) return
    send({ type: 'OBJECT', playedCardId, storytellerId, nextPlayerId: nextPlayer.id })
  }, [send, nextPlayer])

  const challengeStutter = useCallback(async (storytellerId: string) => {
    if (!nextPlayer) return
    send({ type: 'CHALLENGE_STUTTER', storytellerId, nextPlayerId: nextPlayer.id })
  }, [send, nextPlayer])

  const confirmCard = useCallback(async (playedCardId: string) => {
    send({ type: 'CONFIRM_CARD', playedCardId })
  }, [send])

  const winGame = useCallback(async (cardId: string, playedCardsCount: number) => {
    send({ type: 'WIN_GAME', cardId, playedCardsCount })
  }, [send])

  const finalizeWin = useCallback(async (winnerId: string) => {
    if (!gameSession) return
    send({ type: 'FINALIZE_WIN', winnerId, lobbyId: gameSession.lobby_id })
  }, [send, gameSession])

  return {
    state,
    send,
    playCard,
    passTurn,
    interrupt,
    objectToCard,
    challengeStutter,
    confirmCard,
    winGame,
    finalizeWin,
    gameMode: state.context.gameMode,
    optimisticCard: state.context.optimisticCard,
    inFlightHandId: state.context.inFlightHandId,
    isDrawing: state.matches({ active: { persistence: 'passingTurn' } } as any)
      || state.matches({ active: { persistence: 'challengingStutter' } } as any)
      || state.matches({ active: { persistence: 'penaltyForStoryteller' } } as any),
  }
}
