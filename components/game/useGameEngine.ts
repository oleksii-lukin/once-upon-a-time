import { useCallback, useMemo, useEffect } from 'react'
import { type CardData, type HandCardData } from '@/utils/gameUtils'
import { useMachine } from '@xstate/react'
import { createBrowserInspector } from '@statelyai/inspect'
import { gameMachine } from './gameMachine'
import { GameMode, GameSession, Player } from '@/types/model'
import { getSortedPlayers } from './utils/playerUtils'

const inspector
  = process.env.NODE_ENV === 'development'
    && typeof window !== 'undefined'
    && localStorage.getItem('xstate-inspector') === 'enabled'
    ? createBrowserInspector()
    : null

export const useGameEngine = (
  gameSession: GameSession | null,
  currentPlayer: Player | undefined,
  players: Player[],
  fetchGameState: () => Promise<void>,
  pacingDelay: number = 0,
  timerDuration: number = 0,
) => {
  const [state, send] = useMachine(gameMachine, {
    inspect: inspector?.inspect || undefined,
  })

  // Initialize machine if session is loaded
  useEffect(() => {
    if (gameSession && currentPlayer && state.value === 'idle') {
      send({
        type: 'START_GAME',
        gameSessionId: gameSession.id,
        lobbyId: gameSession.lobby_id,
        mode: gameSession.game_mode as GameMode || 'full',
        currentPlayerId: gameSession.current_turn_player_id || currentPlayer.id,
        players: players,
        pacingDelay: pacingDelay,
        timerDuration: timerDuration,
      })
    }
  }, [gameSession, currentPlayer, players, send, state.value, pacingDelay, timerDuration])

  // Sync currentPlayerId when database updates (for non-active players)
  useEffect(() => {
    if (gameSession?.current_turn_player_id && state.value !== 'idle'
      && state.context.currentPlayerId !== gameSession.current_turn_player_id) {
      console.log('[SYNC] Database current_turn_player_id changed:', {
        machineValue: state.context.currentPlayerId,
        databaseValue: gameSession.current_turn_player_id,
      })
      send({
        type: 'SYNC_CURRENT_PLAYER',
        currentPlayerId: gameSession.current_turn_player_id,
      })
    }
  }, [gameSession?.current_turn_player_id, state.value, state.context.currentPlayerId, send])

  const nextPlayer = useMemo(() => {
    if (!currentPlayer || players.length === 0) return null
    const sortedPlayers = getSortedPlayers(players)
    const currentIndex = sortedPlayers.findIndex(p => p.id === currentPlayer.id)
    if (currentIndex === -1) return null

    const nextIndex = (currentIndex + 1) % sortedPlayers.length
    return sortedPlayers[nextIndex]
  }, [currentPlayer, players])

  const playCard = useCallback(async (card: HandCardData, playedCardsCount: number) => {
    if (card.type === 'ending') return
    send({ type: 'PLAY_CARD', card, playedCardsCount })
  }, [send])

  const passTurn = useCallback(async (isHandEmpty?: boolean) => {
    send({ type: 'PASS', isHandEmpty })
  }, [send])

  const exchangeCard = useCallback(async (cardId: string, isEnding?: boolean) => {
    send({ type: 'EXCHANGE', cardId, isEnding })
  }, [send])

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

  const winGame = useCallback(async (card: CardData, playedCardsCount: number) => {
    send({ type: 'WIN_GAME', card, playedCardsCount })
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
    exchangeCard,
    gameMode: state.context.gameMode,
    currentPlayerId: state.context.currentPlayerId,
    optimisticCard: state.context.optimisticCard,
    inFlightHandId: state.context.inFlightHandId,
    isDrawing: state.matches({ active: { persistence: 'passingTurn' } })
      || state.matches({ active: { persistence: 'exchangingCard' } })
      || state.matches({ active: { persistence: 'challengingStutter' } })
      || state.matches({ active: { persistence: 'penaltyForStoryteller' } }),
  }
}
