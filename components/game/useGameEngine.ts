import { useCallback, useMemo, useEffect } from 'react'
import { type CardData, type HandCardData } from '@/utils/gameUtils'
import { GameMode, GameSession, Player } from '@/types/model'
import { useGameStore } from './gameStore'
import { getSortedPlayers } from './utils/playerUtils'

export const useGameEngine = (
  gameSession: GameSession | null,
  currentPlayer: Player | undefined,
  players: Player[],
  fetchGameState: () => Promise<void>,
  pacingDelay: number = 0,
  timerDuration: number = 0,
) => {
  const store = useGameStore()

  // Compatibility layer for XState-like state object
  const state = useMemo(() => {
    const value = store.mainState === 'active'
      ? { active: { rules: store.rulesState, persistence: store.persistenceState } }
      : store.mainState

    return {
      value,
      context: {
        gameSessionId: store.gameSessionId,
        lobbyId: store.lobbyId,
        gameMode: store.gameMode,
        error: store.error,
        lastPersistenceError: store.lastPersistenceError,
        currentPlayerId: store.currentPlayerId,
        optimisticCard: store.optimisticCard,
        inFlightHandId: store.inFlightHandId,
        lastPlayedCardId: store.lastPlayedCardId,
        canPlayMoreCards: store.canPlayMoreCards,
        players: store.players,
        nextPlayerId: store.nextPlayerId,
        pacingDelay: store.pacingDelay,
        timerDuration: store.timerDuration,
      },
      matches: (path: any): boolean => {
        if (typeof path === 'string') {
          return store.mainState === path
        }
        if (typeof path === 'object') {
          if (path.active) {
            if (store.mainState !== 'active') return false
            if (path.active.rules) return store.rulesState === path.active.rules
            if (path.active.persistence) return store.persistenceState === path.active.persistence
            return true
          }
        }
        return false
      },
    }
  }, [store])

  // Initialize store if session is loaded
  useEffect(() => {
    if (gameSession && currentPlayer && store.mainState === 'idle') {
      store.startGame({
        gameSessionId: gameSession.id,
        lobbyId: gameSession.lobby_id,
        mode: gameSession.game_mode as GameMode || 'full',
        currentPlayerId: gameSession.current_turn_player_id || currentPlayer.id,
        players: players,
        pacingDelay: pacingDelay,
        timerDuration: timerDuration,
      })
    }
  }, [gameSession, currentPlayer, players, store, pacingDelay, timerDuration])

  // Sync currentPlayerId when database updates (for non-active players)
  useEffect(() => {
    if (gameSession?.current_turn_player_id && store.mainState !== 'idle'
      && store.currentPlayerId !== gameSession.current_turn_player_id) {
      console.log('[SYNC] Database current_turn_player_id changed:', {
        storeValue: store.currentPlayerId,
        databaseValue: gameSession.current_turn_player_id,
      })
      store.syncCurrentPlayer(gameSession.current_turn_player_id)
    }
  }, [gameSession?.current_turn_player_id, store])

  const nextPlayerId = useMemo(() => store.calculateNextPlayerId(), [store])

  const playCard = useCallback(async (card: HandCardData, playedCardsCount: number) => {
    if (card.type === 'ending') return
    await store.playCard(card, playedCardsCount)
  }, [store])

  const passTurn = useCallback(async (isHandEmpty?: boolean) => {
    await store.passTurn(isHandEmpty)
  }, [store])

  const exchangeCard = useCallback(async (cardId: string, isEnding?: boolean) => {
    await store.exchangeCard(cardId, isEnding)
  }, [store])

  const interrupt = useCallback(async () => {
    const nextId = store.calculateNextPlayerId()
    if (!nextId) return
    // In new machine, INTERRUPT takes nextPlayerId
    store.interrupt(nextId)
  }, [store])

  const objectToCard = useCallback(async (playedCardId: string, storytellerId: string) => {
    const nextId = store.calculateNextPlayerId()
    if (!nextId) return
    await store.objectToCard(playedCardId, storytellerId, nextId)
  }, [store])

  const challengeStutter = useCallback(async (storytellerId: string) => {
    const nextId = store.calculateNextPlayerId()
    if (!nextId) return
    await store.challengeStutter(storytellerId, nextId)
  }, [store])

  const confirmCard = useCallback(async (playedCardId: string) => {
    await store.confirmCard(playedCardId)
  }, [store])

  const winGame = useCallback(async (card: CardData, playedCardsCount: number) => {
    await store.winGame(card, playedCardsCount)
  }, [store])

  const finalizeWin = useCallback(async (winnerId: string) => {
    if (!gameSession) return
    await store.finalizeWin(winnerId, gameSession.lobby_id)
  }, [store, gameSession])

  const send = useCallback(async (event: any) => {
    switch (event.type) {
      case 'START_GAME':
        store.startGame({
          gameSessionId: event.gameSessionId,
          lobbyId: event.lobbyId,
          mode: event.mode,
          currentPlayerId: event.currentPlayerId,
          players: event.players || [],
          pacingDelay: event.pacingDelay || 0,
          timerDuration: event.timerDuration || 0,
        })
        break
      case 'PLAY_CARD':
        await store.playCard(event.card, event.playedCardsCount)
        break
      case 'PASS':
        await store.passTurn(event.isHandEmpty)
        break
      case 'INTERRUPT':
        store.interrupt()
        break
      case 'OBJECT':
        await store.objectToCard(event.playedCardId, event.storytellerId, event.nextPlayerId)
        break
      case 'CHALLENGE_STUTTER':
        await store.challengeStutter(event.storytellerId, event.nextPlayerId)
        break
      case 'CONFIRM_CARD':
        await store.confirmCard(event.playedCardId)
        break
      case 'EXCHANGE':
        await store.exchangeCard(event.cardId, event.isEnding)
        break
      case 'WIN_GAME':
        await store.winGame(event.card, event.playedCardsCount)
        break
      case 'FINALIZE_WIN':
        await store.finalizeWin(event.winnerId, event.lobbyId)
        break
      case 'RULES_DONE':
        store.handleRulesDone()
        break
      case 'RESET_RULES':
        store.resetRules()
        break
      case 'SYNC_CURRENT_PLAYER':
        store.syncCurrentPlayer(event.currentPlayerId)
        break
      case 'AUTO_PASS':
        await store.autoPass()
        break
      case 'START_TIMER':
        await store.startTimer()
        break
      case 'STOP_TIMER':
        await store.stopTimer()
        break
      case 'EXTEND_TIMER':
        await store.extendTimer()
        break
      case 'SYNC_TIMER':
        await store.syncTimer(event.isEnabled, event.duration)
        break
      default:
        console.warn('useGameEngine: unhandled event type:', event.type)
    }
  }, [store])

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
    gameMode: store.gameMode,
    currentPlayerId: store.currentPlayerId,
    optimisticCard: store.optimisticCard,
    inFlightHandId: store.inFlightHandId,
    canPlayMoreCards: store.canPlayMoreCards,
    isDrawing: store.persistenceState === 'passingTurn'
      || store.persistenceState === 'exchangingCard'
      || store.persistenceState === 'challengingStutter'
      || store.persistenceState === 'penaltyForStoryteller',
  }
}
