import { useCallback, useMemo, useEffect } from 'react'
import { type CardData, type HandCardData } from '@/utils/gameUtils'
import { useMachine } from '@xstate/react'
import { createBrowserInspector } from '@statelyai/inspect'
import { gameMachine } from './gameMachine'
import { GameMode, GameSession, Player } from '@/types/model'
import { getSortedPlayers } from './utils/playerUtils'
import { shouldApplyRemoteTurnUpdate, selectLocalActionInFlight } from './utils/reconcile'

const inspector
  = process.env.NODE_ENV === 'development'
    && typeof localStorage !== 'undefined'
    && localStorage.getItem('xstate-inspector') === 'enabled'
    ? createBrowserInspector()
    : null

export const useGameEngine = (
  gameSession: GameSession | null,
  currentPlayer: Player | undefined,
  players: Player[],
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

  // Turn reconciliation — single explicit rule (see utils/reconcile.ts):
  // the DB is authoritative for currentPlayerId, except while a local
  // action is in flight, in which case local state wins until it settles
  // (the effect re-runs on the next snapshot, so the update is not lost).
  useEffect(() => {
    const hasLocalActionInFlight = selectLocalActionInFlight({
      inFlightHandId: state.context.inFlightHandId,
      pendingPassTurn: state.context.pendingPassTurn,
      pendingConfirmCardId: state.context.pendingConfirmCardId,
      persistenceIdle: state.matches({ active: { persistence: 'idle' } }),
      isWinning: state.matches('winning'),
    })

    const remoteTurnPlayerId = gameSession?.current_turn_player_id ?? null
    if (
      remoteTurnPlayerId !== null
      && shouldApplyRemoteTurnUpdate({
        remoteTurnPlayerId,
        machineTurnPlayerId: state.context.currentPlayerId,
        hasLocalActionInFlight,
      })
    ) {
      send({ type: 'SYNC_CURRENT_PLAYER', currentPlayerId: remoteTurnPlayerId })
    }
  }, [gameSession?.current_turn_player_id, state, send])

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
    if (!nextPlayer) return
    send({ type: 'INTERRUPT', nextPlayerId: nextPlayer.id })
  }, [send, nextPlayer])

  const objectToCard = useCallback(async (playedCardId: string, storytellerId: string) => {
    if (!nextPlayer) return
    send({ type: 'OBJECT', playedCardId, storytellerId, nextPlayerId: nextPlayer.id })
  }, [send, nextPlayer])

  const challengeStutter = useCallback(async (storytellerId: string) => {
    if (!nextPlayer) return
    send({ type: 'CHALLENGE_STUTTER', storytellerId, nextPlayerId: nextPlayer.id })
  }, [send, nextPlayer])

  const winGame = useCallback(async (card: CardData, playedCardsCount: number) => {
    send({ type: 'WIN_GAME', card, playedCardsCount })
  }, [send])

  return {
    state,
    send,
    playCard,
    passTurn,
    interrupt,
    objectToCard,
    challengeStutter,
    winGame,
    exchangeCard,
    gameMode: state.context.gameMode,
    currentPlayerId: state.context.currentPlayerId,
    optimisticCard: state.context.optimisticCard,
    inFlightHandId: state.context.inFlightHandId,
    canPlayMoreCards: state.context.canPlayMoreCards,
  }
}
