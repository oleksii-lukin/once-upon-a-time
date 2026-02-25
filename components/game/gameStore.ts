import { create } from 'zustand'
import { type GameMode, type Player } from '@/types/model'
import { type CardData } from '@/utils/gameUtils'
import { type PlayedCardData } from './types'
import { executePlayCard } from './actors/playCardActor'
import { executeDrawCards } from './actors/drawCardsActor'
import { executePassTurn } from './actors/passTurnActor'
import { executeConfirmCard } from './actors/confirmCardActor'
import { executeFinalizeWin } from './actors/finalizeWinActor'
import { executeObject } from './actors/objectActor'
import { executeExchangeCard } from './actors/exchangeCardActor'
import { executeTimerSync } from './actors/timerSyncActor'
import { executeTimerExtension } from './actors/timerExtensionActor'

export type MainState = 'idle' | 'active' | 'winning' | 'gameOver'
export type RulesState = 'narrating' | 'awaitingAck' | 'pending' | 'objecting' | 'interruption' | 'finished' | 'decideMode'
export type PersistenceState = 'idle' | 'playingCard' | 'passingTurn' | 'exchangingCard' | 'updateTurn' | 'objecting' | 'penaltyForStoryteller' | 'updateTurnFromObject' | 'challengingStutter' | 'updateTurnFromChallenge' | 'confirmingCard'

export interface GameStoreState {
  // Context (from GameContext)
  gameSessionId: string | null
  lobbyId: string | null
  gameMode: GameMode
  error: string | null
  lastPersistenceError: string | null
  currentPlayerId: string | null
  optimisticCard: (CardData & { status?: string; played_by?: string }) | null
  inFlightHandId: string | null
  lastPlayedCardId: string | null
  canPlayMoreCards: boolean
  players: Player[]
  nextPlayerId: string | null
  pacingDelay: number
  timerDuration: number
  pendingConfirmCardId: string | null
  pendingPassTurn: boolean
  timerSyncInput?: {
    gameSessionId: string
    isEnabled: boolean
    duration: number
    currentPlayerId: string | null
    action: 'start' | 'stop' | 'sync' | 'extend'
    pacingDelay: number
    newExpiresAt?: string
  }

  // Rules Context (from StorytellingContext)
  cardsPlayedThisTurn: number
  maxCardsPerTurn: number | null
  canInterrupt: boolean
  canObject: boolean

  // State Trackers
  mainState: MainState
  rulesState: RulesState
  persistenceState: PersistenceState

  // Timeout storage
  pacingTimeoutId: ReturnType<typeof setTimeout> | null
}

export interface GameStoreActions {
  // Game Lifecycle
  startGame: (params: {
    gameSessionId: string
    lobbyId: string
    mode: GameMode
    currentPlayerId: string
    players: Player[]
    pacingDelay: number
    timerDuration: number
  }) => void

  resetRules: () => void

  // Persistence Actions
  playCard: (card: CardData, playedCardsCount: number) => Promise<void>
  passTurn: (isHandEmpty?: boolean) => Promise<void>
  exchangeCard: (cardId: string, isEnding?: boolean) => Promise<void>
  objectToCard: (playedCardId: string, storytellerId: string, nextPlayerId: string) => Promise<void>
  challengeStutter: (storytellerId: string, nextPlayerId: string) => Promise<void>
  confirmCard: (playedCardId: string) => Promise<void>
  winGame: (card: CardData, playedCardsCount: number) => Promise<void>
  finalizeWin: (winnerId: string, lobbyId: string) => Promise<void>

  // Internal Logic / Rules Events
  playCardAck: (playedCardId: string) => void
  handleRulesDone: () => void
  interrupt: (nextPlayerId?: string) => void
  object: (playedCardId: string, storytellerId: string, nextPlayerId?: string) => void
  confirm: () => void
  valid: () => void
  invalid: () => void
  syncCurrentPlayer: (currentPlayerId: string) => void
  autoPass: () => Promise<void>

  // Timer Actions
  syncTimer: (isEnabled: boolean, duration: number) => Promise<void>
  startTimer: () => Promise<void>
  stopTimer: () => Promise<void>
  extendTimer: () => Promise<void>

  // Helper
  calculateNextPlayerId: () => string | null
}

export type GameStore = GameStoreState & GameStoreActions

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial State
  gameSessionId: null,
  lobbyId: null,
  gameMode: 'full',
  error: null,
  lastPersistenceError: null,
  currentPlayerId: null,
  optimisticCard: null,
  inFlightHandId: null,
  lastPlayedCardId: null,
  canPlayMoreCards: true,
  players: [],
  nextPlayerId: null,
  pacingDelay: 0,
  timerDuration: 0,
  pendingConfirmCardId: null,
  pendingPassTurn: false,

  cardsPlayedThisTurn: 0,
  maxCardsPerTurn: null,
  canInterrupt: false,
  canObject: false,

  mainState: 'idle',
  rulesState: 'decideMode',
  persistenceState: 'idle',
  pacingTimeoutId: null,

  // Helper
  calculateNextPlayerId: () => {
    const { players, currentPlayerId, gameMode } = get()
    if (!currentPlayerId || players.length === 0) return null

    const sortedPlayers = players
      .filter((p: Player) => p.role !== 'spectator')
      .sort((a: Player, b: Player) => {
        if (typeof a.turn_order === 'number' && typeof b.turn_order === 'number') {
          return a.turn_order - b.turn_order
        }
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      })

    const currentIndex = sortedPlayers.findIndex((p: Player) => p.id === currentPlayerId)
    if (currentIndex === -1) return currentPlayerId

    // For solo mode, keep the same player
    if (sortedPlayers.length === 1 || gameMode === 'solo') {
      return currentPlayerId
    }

    const nextIndex = (currentIndex + 1) % sortedPlayers.length
    return sortedPlayers[nextIndex].id
  },

  // Actions
  startGame: async ({ gameSessionId, lobbyId, mode, currentPlayerId, players, pacingDelay, timerDuration }) => {
    set({
      gameSessionId,
      lobbyId,
      gameMode: mode,
      currentPlayerId,
      players,
      pacingDelay,
      timerDuration,
      mainState: 'active',
      rulesState: 'decideMode',
    })
    get().resetRules()

    // Start timer if enabled
    if (timerDuration > 0) {
      await get().startTimer()
    }
  },

  resetRules: () => {
    const state = get()
    const { gameMode } = state

    // Clear any existing timeout
    if (state.pacingTimeoutId) {
      clearTimeout(state.pacingTimeoutId)
    }

    let maxCardsPerTurn: number | null = null
    let canInterrupt = false
    let canObject = false

    if (gameMode === 'tutorial') {
      maxCardsPerTurn = 1
      canInterrupt = false
      canObject = false
    } else if (gameMode === 'simple' || gameMode === 'fast') {
      maxCardsPerTurn = null
      canInterrupt = false
      canObject = false
    } else if (gameMode === 'solo') {
      maxCardsPerTurn = null
      canInterrupt = false
      canObject = false
    } else {
      // full or main
      maxCardsPerTurn = null
      canInterrupt = true
      canObject = true
    }

    set({
      canPlayMoreCards: true,
      cardsPlayedThisTurn: 0,
      maxCardsPerTurn,
      canInterrupt,
      canObject,
      rulesState: 'narrating',
      persistenceState: 'idle',
      optimisticCard: null,
      inFlightHandId: null,
      lastPlayedCardId: null,
      pacingTimeoutId: null,
    })
  },

  playCard: async (card, playedCardsCount) => {
    const state = get()
    if (state.persistenceState !== 'idle' || !state.canPlayMoreCards) return

    // Timer logic from machine: checkingExtension on PLAY_CARD
    if (state.timerDuration > 0 && state.pacingDelay > 0) {
      get().extendTimer()
    }

    set({
      optimisticCard: {
        ...card,
        status: 'PENDING',
        played_by: state.currentPlayerId!,
      },
      inFlightHandId: card.id,
      persistenceState: 'playingCard',
      rulesState: 'awaitingAck',
    })

    try {
      const result = await executePlayCard({
        gameSessionId: state.gameSessionId!,
        playerId: state.currentPlayerId!,
        cardId: card.id,
        position: playedCardsCount,
      })

      set({
        lastPlayedCardId: result.id,
      })

      // Check for pending actions
      const updatedState = get()
      if (updatedState.pendingConfirmCardId) {
        set({
          pendingConfirmCardId: null,
          persistenceState: 'confirmingCard',
        })
        await get().confirmCard(result.id)
      } else {
        set({ persistenceState: 'idle' })
      }

      get().playCardAck(result.id)
    } catch (e: any) {
      set({
        lastPersistenceError: e.message || 'Unknown error',
        inFlightHandId: null,
        optimisticCard: null,
        persistenceState: 'idle',
        rulesState: 'narrating',
      })
    }
  },

  passTurn: async (isHandEmpty) => {
    const state = get()
    if (state.persistenceState !== 'idle') {
      set({ pendingPassTurn: true })
      return
    }
    set({ persistenceState: 'passingTurn' })

    try {
      // Logic from passingTurn state in machine
      let shouldDraw = true
      // Tutorial mode special case
      if (state.gameMode === 'tutorial' && state.lastPlayedCardId !== null && !isHandEmpty) {
        shouldDraw = false
      }

      if (shouldDraw) {
        await executeDrawCards({
          gameSessionId: state.gameSessionId!,
          playerId: state.currentPlayerId!,
          count: 1,
        })
      }

      const nextPlayerId = get().calculateNextPlayerId()
      set({ nextPlayerId, persistenceState: 'updateTurn' })

      await executePassTurn({
        gameSessionId: state.gameSessionId!,
        nextPlayerId: nextPlayerId!,
      })

      set({
        persistenceState: 'idle',
        mainState: 'active',
      })
      get().resetRules()
      if (get().timerDuration > 0) {
        await get().startTimer()
      }
    } catch (e: any) {
      set({
        lastPersistenceError: e.message || 'Unknown error',
        persistenceState: 'idle',
      })
    }
  },

  exchangeCard: async (cardId, isEnding) => {
    const state = get()
    set({ persistenceState: 'exchangingCard' })

    try {
      await executeExchangeCard({
        gameSessionId: state.gameSessionId!,
        playerId: state.currentPlayerId!,
        cardId,
        isEnding,
      })

      const nextPlayerId = get().calculateNextPlayerId()
      set({ nextPlayerId, persistenceState: 'updateTurn' })

      await executePassTurn({
        gameSessionId: state.gameSessionId!,
        nextPlayerId: nextPlayerId!,
      })

      set({ persistenceState: 'idle' })
      get().resetRules()
      if (get().timerDuration > 0) {
        await get().startTimer()
      }
    } catch (e: any) {
      set({
        lastPersistenceError: e.message || 'Unknown error',
        persistenceState: 'idle',
      })
    }
  },

  objectToCard: async (playedCardId, storytellerId, nextPlayerId) => {
    const state = get()
    set({ nextPlayerId, persistenceState: 'objecting' })

    try {
      await executeObject({
        gameSessionId: state.gameSessionId!,
        playedCardId,
        storytellerId,
        nextPlayerId,
      })

      set({ persistenceState: 'penaltyForStoryteller' })
      await executeDrawCards({
        gameSessionId: state.gameSessionId!,
        playerId: storytellerId,
        count: 1,
      })

      set({ persistenceState: 'updateTurnFromObject' })
      await executePassTurn({
        gameSessionId: state.gameSessionId!,
        nextPlayerId: nextPlayerId,
      })

      set({ persistenceState: 'idle' })
      get().resetRules()
      if (get().timerDuration > 0) {
        await get().startTimer()
      }
    } catch (e: any) {
      set({
        lastPersistenceError: e.message || 'Unknown error',
        persistenceState: 'idle',
      })
    }
  },

  challengeStutter: async (storytellerId, nextPlayerId) => {
    const state = get()
    set({ nextPlayerId, persistenceState: 'challengingStutter' })

    try {
      await executeDrawCards({
        gameSessionId: state.gameSessionId!,
        playerId: storytellerId,
        count: 1,
      })

      set({ persistenceState: 'updateTurnFromChallenge' })
      await executePassTurn({
        gameSessionId: state.gameSessionId!,
        nextPlayerId: nextPlayerId,
      })

      set({ persistenceState: 'idle' })
      get().resetRules()
      if (get().timerDuration > 0) {
        await get().startTimer()
      }
    } catch (e: any) {
      set({
        lastPersistenceError: e.message || 'Unknown error',
        persistenceState: 'idle',
      })
    }
  },

  confirmCard: async (playedCardId) => {
    const state = get()
    if (state.persistenceState !== 'idle' && state.persistenceState !== 'playingCard') {
      set({ pendingConfirmCardId: playedCardId })
      return
    }

    set({ persistenceState: 'confirmingCard' })

    try {
      await executeConfirmCard({ playedCardId })
      set({
        persistenceState: 'idle',
        optimisticCard: null,
        inFlightHandId: null,
      })

      // Check for pending pass turn
      if (get().pendingPassTurn) {
        set({ pendingPassTurn: false })
        await get().passTurn()
        return
      }

      // Restart timer in solo mode after confirmation
      const updatedState = get()
      if (updatedState.timerDuration > 0 && updatedState.gameMode === 'solo') {
        await get().startTimer()
      }
    } catch (e: any) {
      set({
        lastPersistenceError: e.message || 'Unknown error',
        persistenceState: 'idle',
      })
    }
  },

  winGame: async (card, playedCardsCount) => {
    const state = get()
    set({
      mainState: 'winning',
      persistenceState: 'playingCard',
      optimisticCard: {
        ...card,
        status: 'PENDING',
        played_by: state.currentPlayerId!,
      },
      inFlightHandId: card.id,
    })

    try {
      const result = await executePlayCard({
        gameSessionId: state.gameSessionId!,
        playerId: state.currentPlayerId!,
        cardId: card.id,
        position: playedCardsCount,
      })

      set({
        lastPlayedCardId: result.id,
        persistenceState: 'idle',
        rulesState: 'pending', // Waiting state in machine
      })

      // Start pacing timeout if needed
      if (state.pacingDelay > 0) {
        const timeoutId = setTimeout(() => {
          get().confirm()
        }, state.pacingDelay * 1000)
        set({ pacingTimeoutId: timeoutId })
      } else {
        get().confirm()
      }
    } catch (e: any) {
      set({
        lastPersistenceError: e.message || 'Unknown error',
        persistenceState: 'idle',
        mainState: 'active',
        optimisticCard: null,
        inFlightHandId: null,
      })
    }
  },

  finalizeWin: async (winnerId, lobbyId) => {
    const state = get()
    try {
      await executeFinalizeWin({
        gameSessionId: state.gameSessionId!,
        winnerId,
        lobbyId,
      })
      set({ mainState: 'gameOver' })
    } catch (e: any) {
      set({ lastPersistenceError: e.message || 'Unknown error' })
    }
  },

  // Internal Rules / Events
  playCardAck: (playedCardId) => {
    const state = get()
    const { gameMode } = state

    set({
      lastPlayedCardId: playedCardId,
    })

    if (gameMode === 'tutorial') {
      set({ cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1 })
    }

    set({ rulesState: 'pending' })

    // Handle pacing delay
    if (state.pacingDelay > 0) {
      if (state.pacingTimeoutId) clearTimeout(state.pacingTimeoutId)
      const timeoutId = setTimeout(() => {
        get().confirm()
      }, state.pacingDelay * 1000)
      set({ pacingTimeoutId: timeoutId })
    } else {
      get().confirm()
    }
  },

  handleRulesDone: () => {
    set({ canPlayMoreCards: false, rulesState: 'finished' })
  },

  interrupt: (nextPlayerId) => {
    const { canInterrupt } = get()
    if (!canInterrupt) return

    if (nextPlayerId) set({ nextPlayerId })
    set({ rulesState: 'interruption' })
  },

  object: (playedCardId, storytellerId, nextPlayerId) => {
    const { canObject } = get()
    if (!canObject) return

    if (nextPlayerId) set({ nextPlayerId })
    // Clear pacing timeout if any
    const state = get()
    if (state.pacingTimeoutId) {
      clearTimeout(state.pacingTimeoutId)
      set({ pacingTimeoutId: null })
    }

    set({ rulesState: 'objecting' })
  },

  confirm: () => {
    const state = get()
    if (!state.lastPlayedCardId) {
      set({ error: 'No card to confirm' })
      return
    }

    // Call persistence action to confirm in DB
    get().confirmCard(state.lastPlayedCardId)

    const updatedState = get()
    const { gameMode, cardsPlayedThisTurn, maxCardsPerTurn, mainState } = updatedState

    if (mainState === 'winning') {
      get().finalizeWin(updatedState.currentPlayerId!, updatedState.lobbyId!)
    } else {
      if (gameMode === 'tutorial' && cardsPlayedThisTurn >= (maxCardsPerTurn || 1)) {
        get().handleRulesDone()
      } else {
        set({ rulesState: 'narrating' })
      }
    }
  },

  valid: () => {
    const { rulesState } = get()
    if (rulesState === 'interruption' || rulesState === 'objecting') {
      get().handleRulesDone()
    }
  },

  invalid: () => {
    const { rulesState } = get()
    if (rulesState === 'interruption') {
      set({ rulesState: 'narrating' })
    } else if (rulesState === 'objecting') {
      get().confirm()
    }
  },

  syncCurrentPlayer: (currentPlayerId) => {
    set({ currentPlayerId })
    // If the turn changed, we should probably reset rules
    get().resetRules()
  },

  autoPass: async () => {
    set({ canPlayMoreCards: false, pendingPassTurn: true })
    if (get().persistenceState === 'idle') {
      set({ pendingPassTurn: false })
      await get().passTurn()
    }
  },

  syncTimer: async (isEnabled, duration) => {
    const state = get()
    if (!state.gameSessionId) return

    await executeTimerSync({
      gameSessionId: state.gameSessionId,
      isEnabled,
      duration,
      currentPlayerId: state.currentPlayerId,
      action: 'sync',
      pacingDelay: state.pacingDelay,
    })
    set({ timerDuration: duration })
  },

  startTimer: async () => {
    const state = get()
    if (!state.gameSessionId || state.timerDuration <= 0) return

    await executeTimerSync({
      gameSessionId: state.gameSessionId,
      isEnabled: true,
      duration: state.timerDuration,
      currentPlayerId: state.currentPlayerId,
      action: 'start',
      pacingDelay: state.pacingDelay,
    })
  },

  stopTimer: async () => {
    const state = get()
    if (!state.gameSessionId) return

    await executeTimerSync({
      gameSessionId: state.gameSessionId,
      isEnabled: true,
      duration: state.timerDuration,
      currentPlayerId: state.currentPlayerId,
      action: 'stop',
      pacingDelay: state.pacingDelay,
    })
  },

  extendTimer: async () => {
    const state = get()
    if (!state.gameSessionId || state.timerDuration <= 0) return

    const { needsExtension, newExpiresAt } = await executeTimerExtension({
      gameSessionId: state.gameSessionId,
      timerDuration: state.timerDuration,
      pacingDelay: state.pacingDelay,
    })

    if (needsExtension) {
      await executeTimerSync({
        gameSessionId: state.gameSessionId,
        isEnabled: true,
        duration: state.timerDuration,
        currentPlayerId: state.currentPlayerId,
        action: 'extend',
        pacingDelay: state.pacingDelay,
        newExpiresAt,
      })
    }
  },
}))
