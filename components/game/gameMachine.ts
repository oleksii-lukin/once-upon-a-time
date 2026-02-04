import { assign, setup, sendTo, raise, assertEvent, type DoneActorEvent, type ErrorActorEvent } from 'xstate'
import {
  tutorialStorytellingMachine,
  simpleStorytellingMachine,
  fullStorytellingMachine,
  soloStorytellingMachine,
} from './ruleVariants'
import { Database } from '@/supabase/types'
import { type CardData } from '@/utils/gameUtils'
import { type GameMode } from '@/types/model'
import { playCardActor, type PlayCardActorInput, type PlayCardActorOutput } from './actors/playCardActor'
import { drawCardsActor, type DrawCardsActorInput } from './actors/drawCardsActor'
import { passTurnActor, type PassTurnActorInput } from './actors/passTurnActor'
import { confirmCardActor, type ConfirmCardActorInput } from './actors/confirmCardActor'
import { finalizeWinActor, type FinalizeWinActorInput } from './actors/finalizeWinActor'
import { objectActor, type ObjectActorInput } from './actors/objectActor'
import { exchangeCardActor, type ExchangeCardActorInput } from './actors/exchangeCardActor'

type Player = Database['public']['Tables']['players']['Row']

/**
 * Main context interface for the XState game machine.
 * Contains all state information needed to manage a game session,
 * including player data, game flow, error handling, and UI state.
 */
export interface GameContext {
  /** The current game session ID - null when no game is active */
  gameSessionId: string | null
  /** The lobby ID this game belongs to - null when no game is active */
  lobbyId: string | null
  /** The current game mode (tutorial, simple, full, solo storytelling) */
  gameMode: GameMode
  /** General error message for display to users - null when no error */
  error: string | null
  /** Last database persistence error - null when no persistence error */
  lastPersistenceError: string | null
  /** ID of the player whose turn it currently is - null when game not started */
  currentPlayerId: string | null
  /** Optimistic UI: Shows card instantly on click while database saves in background */
  /** Prevents UI delay - card appears immediately, then syncs with real database record */
  optimisticCard: CardData | null
  /** ID of the hand being processed for card operations - null when none in flight */
  inFlightHandId: string | null
  /** ID of the most recently played card - used for pacing and objections */
  lastPlayedCardId: string | null
  /** Whether the rules explanation phase has been completed */
  rulesFinished: boolean
  /** Array of all players in the current game session */
  players: Player[]
  /** ID of the player who will take the next turn - null when not determined */
  nextPlayerId: string | null
  /** The duration in seconds to wait before confirming a card (0 if disabled) */
  pacingDelay: number
}

/**
 * Union type of all possible events that can be sent to the game machine.
 * Includes game lifecycle events, player actions, error handling, and state synchronization.
 */
export type GameEvent
  = | { type: 'START_GAME', gameSessionId: string, lobbyId: string, mode: GameMode, currentPlayerId: string, players?: Player[], pacingDelay?: number }
    | { type: 'PLAY_CARD', card: CardData, playedCardsCount: number }
    | { type: 'PASS', isHandEmpty?: boolean }
    | { type: 'INTERRUPT' }
    | { type: 'OBJECT', playedCardId: string, storytellerId: string, nextPlayerId: string }
    | { type: 'CHALLENGE_STUTTER', storytellerId: string, nextPlayerId: string }
    | { type: 'CONFIRM_CARD', playedCardId: string }
    | { type: 'EXCHANGE', cardId: string, isEnding?: boolean }
    | { type: 'WIN_GAME', card: CardData, playedCardsCount: number }
    | { type: 'FINALIZE_WIN', winnerId: string, lobbyId: string }
    | { type: 'RULES_DONE' }
    | { type: 'SYNC_COMPLETE' }
    | { type: 'SYNC_ERROR', error: string }
    | { type: 'RESET_RULES' }

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  delays: {
    PACING_DELAY: ({ context }) => context.pacingDelay * 1000,
  },
  actors: {
    // ... (rest of actors)
    ruleTutorial: tutorialStorytellingMachine,
    ruleSimple: simpleStorytellingMachine,
    ruleFull: fullStorytellingMachine,
    ruleSolo: soloStorytellingMachine,
    playCardActor,
    drawCardsActor,
    passTurnActor,
    confirmCardActor,
    finalizeWinActor,
    objectActor,
    exchangeCardActor,
  },
}).createMachine({
  id: 'gameRoot',
  context: {
    gameSessionId: null,
    lobbyId: null,
    gameMode: 'full',
    error: null,
    lastPersistenceError: null,
    currentPlayerId: null,
    optimisticCard: null,
    inFlightHandId: null,
    lastPlayedCardId: null,
    rulesFinished: false,
    players: [],
    nextPlayerId: null,
    pacingDelay: 0,
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        START_GAME: {
          target: 'active',
          actions: assign({
            gameSessionId: ({ event }) => event.gameSessionId,
            lobbyId: ({ event }) => event.lobbyId,
            gameMode: ({ event }) => event.mode,
            currentPlayerId: ({ event }) => event.currentPlayerId,
            players: ({ event }) => event.players || [],
            pacingDelay: ({ event }) => event.pacingDelay || 0,
          }),
        },
      },
    },
    active: {
      on: {
        WIN_GAME: {
          target: 'winning',
          actions: assign({
            optimisticCard: ({ context, event }) => {
              const winEvent = event as { type: 'WIN_GAME', card: CardData, playedCardsCount: number }
              return {
                ...winEvent.card,
                status: 'PENDING',
                played_by: context.currentPlayerId!,
              }
            },
            inFlightHandId: ({ event }) => {
              const winEvent = event as { type: 'WIN_GAME', card: CardData, playedCardsCount: number }
              return winEvent.card.id
            },
          }),
        },
      },
      type: 'parallel',
      states: {
        rules: {
          initial: 'decideMode',
          on: {
            RULES_DONE: { actions: assign({ rulesFinished: true }) },
            PLAY_CARD: {
              guard: ({ context }) => !context.inFlightHandId && !context.rulesFinished,
              actions: [
                assign({
                  optimisticCard: ({ context, event }) => {
                    const playEvent = event as { type: 'PLAY_CARD', card: CardData, playedCardsCount: number }
                    return {
                      ...playEvent.card,
                      status: 'PENDING',
                      played_by: context.currentPlayerId!,
                    }
                  },
                  inFlightHandId: ({ event }) => {
                    const playCardEvent = event as Extract<GameEvent, { type: 'PLAY_CARD' }>
                    // Note: hand_id is not part of CardData type, using card id instead
                    return playCardEvent.card.id || null
                  },
                }),
                sendTo('rulesActor', ({ event }) => {
                  const playCardEvent = event as Extract<GameEvent, { type: 'PLAY_CARD' }>
                  return { type: 'PLAY_CARD', cardId: playCardEvent.card.id }
                }),
              ],
            },
            PASS: {
              actions: [
                assign(({ context }) => {
                  // Calculate nextPlayerId if not provided
                  let calculatedNextPlayerId: string | null = context.currentPlayerId

                  // Auto-calculate next player
                  const players = context.players || []
                  const sortedPlayers = players
                    .filter((p: Player) => p.role !== 'spectator')
                    .sort((a: Player, b: Player) => {
                      if (typeof a.turn_order === 'number' && typeof b.turn_order === 'number') {
                        return a.turn_order - b.turn_order
                      }
                      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
                    })

                  const currentIndex = sortedPlayers.findIndex((p: Player) => p.id === context.currentPlayerId)
                  if (currentIndex === -1) {
                    calculatedNextPlayerId = context.currentPlayerId
                  }
                  else {
                    // For solo mode, keep the same player
                    if (sortedPlayers.length === 1) {
                      calculatedNextPlayerId = context.currentPlayerId
                    }
                    else {
                      const nextIndex = (currentIndex + 1) % sortedPlayers.length
                      calculatedNextPlayerId = sortedPlayers[nextIndex].id
                    }
                  }

                  return {
                    nextPlayerId: calculatedNextPlayerId,
                  }
                }),
                sendTo('rulesActor', { type: 'PASS' }),
              ],
            },
            CHALLENGE_STUTTER: {
              actions: [
                assign({ nextPlayerId: ({ event }) => event.nextPlayerId }),
              ],
            },
            INTERRUPT: {
              actions: sendTo('rulesActor', { type: 'INTERRUPT' }),
            },
            OBJECT: {
              actions: [
                assign({ nextPlayerId: ({ event }) => event.nextPlayerId }), // Persist for post-penalty turn update
                sendTo('rulesActor', ({ event }) => {
                  const objectEvent = event as Extract<GameEvent, { type: 'OBJECT' }>
                  return { type: 'OBJECT', playedCardId: objectEvent.playedCardId, storytellerId: objectEvent.storytellerId }
                }),
              ],
            },
            EXCHANGE: {
              actions: [
                assign(({ context }) => {
                  // Calculate next player
                  const players = context.players || []
                  const sortedPlayers = players
                    .filter((p: Player) => p.role !== 'spectator')
                    .sort((a: Player, b: Player) => {
                      if (typeof a.turn_order === 'number' && typeof b.turn_order === 'number') {
                        return a.turn_order - b.turn_order
                      }
                      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
                    })

                  const currentIndex = sortedPlayers.findIndex((p: Player) => p.id === context.currentPlayerId)
                  let nextPlayerId = context.currentPlayerId
                  if (currentIndex !== -1 && sortedPlayers.length > 1) {
                    const nextIndex = (currentIndex + 1) % sortedPlayers.length
                    nextPlayerId = sortedPlayers[nextIndex].id
                  }

                  return { nextPlayerId }
                }),
                sendTo('rulesActor', { type: 'PASS' }),
              ],
            },
            RESET_RULES: {
              actions: assign({ rulesFinished: false }),
              target: '.decideMode',
            },
          },
          states: {
            decideMode: {
              always: [
                { target: 'tutorial', guard: ({ context }) => context.gameMode === 'tutorial' },
                { target: 'simple', guard: ({ context }) => context.gameMode === 'simple' || context.gameMode === 'fast' },
                { target: 'full', guard: ({ context }) => context.gameMode === 'full' || context.gameMode === 'main' },
                { target: 'solo', guard: ({ context }) => context.gameMode === 'solo' },
              ],
            },
            tutorial: {
              invoke: {
                id: 'rulesActor',
                src: 'ruleTutorial',
                input: ({ context }) => ({ pacingDelay: context.pacingDelay }),
              },
            },
            simple: {
              invoke: {
                id: 'rulesActor',
                src: 'ruleSimple',
                input: ({ context }) => ({ pacingDelay: context.pacingDelay }),
              },
            },
            full: {
              invoke: {
                id: 'rulesActor',
                src: 'ruleFull',
                input: ({ context }) => ({ pacingDelay: context.pacingDelay }),
              },
            },
            solo: {
              invoke: {
                id: 'rulesActor',
                src: 'ruleSolo',
                input: ({ context }) => ({ pacingDelay: context.pacingDelay }),
              },
            },
          },
        },
        persistence: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                PLAY_CARD: 'playingCard',
                PASS: 'passingTurn',
                EXCHANGE: 'exchangingCard',
                OBJECT: 'objecting',
                CHALLENGE_STUTTER: 'challengingStutter',
                CONFIRM_CARD: 'confirmingCard',
                INTERRUPT: {
                  actions: sendTo('rulesActor', { type: 'INTERRUPT' }),
                },
              },
            },
            playingCard: {
              invoke: {
                src: 'playCardActor',
                input: ({ context, event }): PlayCardActorInput => {
                  assertEvent(event, 'PLAY_CARD')
                  if (!context.gameSessionId) throw new Error('Game session ID is missing')
                  if (!context.currentPlayerId) throw new Error('Current player ID is missing')

                  return {
                    gameSessionId: context.gameSessionId,
                    playerId: context.currentPlayerId,
                    cardId: event.card.id,
                    position: event.playedCardsCount,
                  }
                },
                onDone: {
                  target: 'idle',
                  actions: [
                    assign({ lastPlayedCardId: ({ event }) => event.output.id }),
                    sendTo('rulesActor', ({ event }) => ({ type: 'PLAY_CARD_ACK', playedCardId: event.output.id })),
                  ],
                },
                onError: {
                  target: 'idle',
                  actions: assign({
                    lastPersistenceError: ({ event }: { event: ErrorActorEvent<Error> }) => event.error.message || 'Unknown error',
                    inFlightHandId: null, // Clear the lock explicitly on error
                    optimisticCard: null, // Rollback optimistic update
                  }),
                },
              },
            },
            passingTurn: {
              invoke: {
                src: 'drawCardsActor',
                input: ({ context }): DrawCardsActorInput => {
                  if (!context.gameSessionId) throw new Error('Game session ID is missing')
                  if (!context.currentPlayerId) throw new Error('Current player ID is missing')

                  return {
                    gameSessionId: context.gameSessionId,
                    playerId: context.currentPlayerId,
                    count: 1,
                  }
                },
                onDone: 'updateTurn',
                onError: 'idle',
              },
              always: [
                {
                  target: 'updateTurn',
                  guard: ({ context, event }) => {
                    const passEvent = event as Extract<GameEvent, { type: 'PASS' }>
                    return context.gameMode === 'tutorial'
                      && context.lastPlayedCardId !== null
                      && !passEvent.isHandEmpty
                  },
                },
              ],
            },
            exchangingCard: {
              invoke: {
                src: 'exchangeCardActor',
                input: ({ context, event }): ExchangeCardActorInput => {
                  assertEvent(event, 'EXCHANGE')
                  if (!context.gameSessionId) throw new Error('Game session ID is missing')
                  if (!context.currentPlayerId) throw new Error('Current player ID is missing')

                  return {
                    gameSessionId: context.gameSessionId,
                    playerId: context.currentPlayerId,
                    cardId: event.cardId,
                    isEnding: event.isEnding,
                  }
                },
                onDone: 'updateTurn',
                onError: {
                  target: 'idle',
                  actions: assign({
                    lastPersistenceError: ({ event }: { event: ErrorActorEvent<Error> }) => event.error.message || 'Unknown error',
                  }),
                },
              },
            },
            updateTurn: {
              invoke: {
                src: 'passTurnActor',
                input: ({ context }): PassTurnActorInput => {
                  if (!context.gameSessionId) throw new Error('Game session ID is missing')
                  if (!context.nextPlayerId) throw new Error('Next player ID is missing')

                  return {
                    gameSessionId: context.gameSessionId,
                    nextPlayerId: context.nextPlayerId,
                  }
                },
                onDone: {
                  target: 'idle',
                  actions: [
                    raise({ type: 'RESET_RULES' }),
                    assign({
                      optimisticCard: null,
                      inFlightHandId: null,
                      lastPlayedCardId: null,
                    }),
                  ],
                },
              },
            },
            objecting: {
              invoke: {
                src: 'objectActor',
                input: ({ context, event }): ObjectActorInput => {
                  assertEvent(event, 'OBJECT')
                  if (!context.gameSessionId) throw new Error('Game session ID is missing')

                  return {
                    gameSessionId: context.gameSessionId,
                    playedCardId: event.playedCardId,
                    storytellerId: event.storytellerId,
                    nextPlayerId: event.nextPlayerId,
                  }
                },
                onDone: 'penaltyForStoryteller',
              },
            },
            penaltyForStoryteller: {
              invoke: {
                src: 'drawCardsActor',
                input: ({ context, event }): DrawCardsActorInput => {
                  if (!context.gameSessionId) throw new Error('Game session ID is missing')

                  // Event is done.invoke.objectActor. We need access to output.
                  const output = ((event as unknown) as DoneActorEvent<ObjectActorInput>).output
                  if (!output?.storytellerId) throw new Error('Storyteller ID missing from objectActor output')

                  return {
                    gameSessionId: context.gameSessionId,
                    playerId: output.storytellerId,
                    count: 1,
                  }
                },
                onDone: 'updateTurnFromObject',
              },
            },
            updateTurnFromObject: {
              invoke: {
                src: 'passTurnActor',
                input: ({ context }): PassTurnActorInput => {
                  if (!context.gameSessionId) throw new Error('Game session ID is missing')
                  if (!context.nextPlayerId) throw new Error('Next player ID is missing (should have been set in objecting entry)')

                  return {
                    gameSessionId: context.gameSessionId,
                    nextPlayerId: context.nextPlayerId,
                  }
                },
                onDone: {
                  target: 'idle',
                  actions: [
                    raise({ type: 'RESET_RULES' }),
                    assign({
                      optimisticCard: null,
                      inFlightHandId: null,
                      lastPlayedCardId: null,
                    }),
                  ],
                },
              },
            },
            challengingStutter: {
              invoke: {
                src: 'drawCardsActor',
                input: ({ context, event }): DrawCardsActorInput => {
                  assertEvent(event, 'CHALLENGE_STUTTER')
                  if (!context.gameSessionId) throw new Error('Game session ID is missing')

                  return {
                    gameSessionId: context.gameSessionId,
                    playerId: event.storytellerId,
                    count: 1,
                  }
                },
                onDone: 'updateTurnFromChallenge',
              },
            },
            updateTurnFromChallenge: {
              invoke: {
                src: 'passTurnActor',
                input: ({ context }): PassTurnActorInput => {
                  if (!context.gameSessionId) throw new Error('Game session ID is missing')
                  if (!context.nextPlayerId) throw new Error('Next player ID is missing (should have been set in challengingStutter entry)')

                  return {
                    gameSessionId: context.gameSessionId,
                    nextPlayerId: context.nextPlayerId,
                  }
                },
                onDone: {
                  target: 'idle',
                  actions: [
                    raise({ type: 'RESET_RULES' }),
                  ],
                },
              },
            },
            confirmingCard: {
              invoke: {
                src: 'confirmCardActor',
                input: ({ event }): ConfirmCardActorInput => {
                  assertEvent(event, 'CONFIRM_CARD')
                  return {
                    playedCardId: event.playedCardId,
                  }
                },
                onDone: {
                  target: 'idle',
                  actions: assign({
                    optimisticCard: null,
                    inFlightHandId: null,
                  }),
                },
              },
            },
          },
        },
      },
    },
    winning: {
      initial: 'playingCard',
      states: {
        playingCard: {
          invoke: {
            src: 'playCardActor',
            input: ({ context, event }): PlayCardActorInput => {
              assertEvent(event, 'WIN_GAME')
              if (!context.gameSessionId) throw new Error('Game session ID is missing')
              if (!context.currentPlayerId) throw new Error('Current player ID is missing')

              return {
                gameSessionId: context.gameSessionId,
                playerId: context.currentPlayerId,
                cardId: event.card.id,
                position: event.playedCardsCount,
              }
            },
            onDone: {
              target: 'waiting',
              actions: assign({
                lastPlayedCardId: ({ event }) => ((event as unknown) as DoneActorEvent<PlayCardActorOutput>).output.id,
              }),
            },
          },
        },
        waiting: {
          always: { target: 'confirming', guard: ({ context }) => context.pacingDelay <= 0 },
          on: {
            OBJECT: 'objecting',
          },
          after: {
            PACING_DELAY: 'confirming',
          },
        },
        objecting: {
          invoke: {
            src: 'objectActor',
            input: ({ context, event }): ObjectActorInput => {
              assertEvent(event, 'OBJECT')
              if (!context.gameSessionId) throw new Error('Game session ID is missing')

              return {
                gameSessionId: context.gameSessionId,
                playedCardId: event.playedCardId,
                storytellerId: event.storytellerId,
                nextPlayerId: event.nextPlayerId,
              }
            },
            onDone: 'penalty',
          },
        },
        penalty: {
          invoke: {
            src: 'drawCardsActor',
            input: ({ context, event }): DrawCardsActorInput => {
              if (!context.gameSessionId) throw new Error('Game session ID is missing')
              const output = ((event as unknown) as DoneActorEvent<ObjectActorInput>).output
              if (!output?.storytellerId) throw new Error('Storyteller ID missing')

              return {
                gameSessionId: context.gameSessionId,
                playerId: output.storytellerId,
                count: 1, // Standard penalty, though rules say 1 story + 1 ending.
                // For simplicity and matching current UI expectation, 1 is fine for now
                // unless I should strictly implement dual draw.
              }
            },
            onDone: 'updateTurn',
          },
        },
        updateTurn: {
          invoke: {
            src: 'passTurnActor',
            input: ({ context }): PassTurnActorInput => {
              if (!context.gameSessionId) throw new Error('Game session ID is missing')
              if (!context.nextPlayerId) throw new Error('Next player ID is missing')

              return {
                gameSessionId: context.gameSessionId,
                nextPlayerId: context.nextPlayerId,
              }
            },
            onDone: {
              target: '#gameRoot.active',
              actions: [
                raise({ type: 'RESET_RULES' }),
                assign({
                  optimisticCard: null,
                  inFlightHandId: null,
                  lastPlayedCardId: null,
                }),
              ],
            },
          },
        },
        confirming: {
          invoke: {
            src: 'confirmCardActor',
            input: ({ context }): ConfirmCardActorInput => {
              if (!context.lastPlayedCardId) throw new Error('No card to confirm')
              return {
                playedCardId: context.lastPlayedCardId,
              }
            },
            onDone: 'finalizing',
          },
        },
        finalizing: {
          invoke: {
            src: 'finalizeWinActor',
            input: ({ context }): FinalizeWinActorInput => {
              if (!context.gameSessionId) throw new Error('Game session ID is missing')
              if (!context.currentPlayerId) throw new Error('Current player ID is missing')
              if (!context.lobbyId) throw new Error('Lobby ID is missing')

              return {
                gameSessionId: context.gameSessionId,
                winnerId: context.currentPlayerId,
                lobbyId: context.lobbyId,
              }
            },
            onDone: '#gameRoot.gameOver',
          },
        },
      },
    },
    gameOver: {
      type: 'final',
    },
  },
})
