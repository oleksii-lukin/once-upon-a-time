import { assign, setup, sendTo, raise, assertEvent, type DoneActorEvent, type ErrorActorEvent } from 'xstate'
import {
  tutorialStorytellingMachine,
  simpleStorytellingMachine,
  fullStorytellingMachine,
  soloStorytellingMachine,
} from './ruleVariants'
import { playCardActor } from './actors/playCardActor'
import { drawCardsActor } from './actors/drawCardsActor'
import { passTurnActor } from './actors/passTurnActor'
import { confirmCardActor } from './actors/confirmCardActor'
import { finalizeWinActor } from './actors/finalizeWinActor'
import { objectActor } from './actors/objectActor'
import { exchangeCardActor } from './actors/exchangeCardActor'
import { timerSyncActor } from './actors/timerSyncActor'
import { timerExtensionActor } from './actors/timerExtensionActor'
import {
  type PlayCardActorInput,
  type PlayCardActorOutput,
  type DrawCardsActorInput,
  type PassTurnActorInput,
  type ConfirmCardActorInput,
  type FinalizeWinActorInput,
  type ObjectActorInput,
  type ExchangeCardActorInput,
  type TimerSyncInput,
  type TimerExtensionInput,
  type TimerExtensionOutput
} from './gameTypes'
import { canPlayCard, isRulesFinished } from './guards/playGuards'
import { isTimerEnabled, shouldSyncTimerForSolo, needsTimerExtension } from './guards/timerGuards'
import { isSoloMode, isTutorialMode, isSimpleOrFastMode, isFullOrMainMode } from './guards/modesGuards'
import { isRulesNotFinished } from './guards/rulesGuards'
import {
  isPendingCardConfirmed,
  shouldAutoPassInTutorial,
  isTutorialRulesFinished,
  isTutorialWithPlayedCard,
  hasPendingPassTurn,
  isPacingDisabled
} from './guards/persistenceGuards'
import { assignNextPlayer, assignNextPlayerFromEvent, assignNextPlayerFromActorOutput } from './actions/playerActions'
import { assignRulesFinished, resetRulesFinished } from './actions/rulesActions'
import { assignOptimisticCard, clearOptimisticCard, assignLastPlayedCardFromEvent, assignPendingConfirmCard } from './actions/cardActions'
import { assignTimerSyncInput, clearTimerSyncInput } from './actions/timerActions'
import {
  assignPendingPassTurn,
  clearPendingStates,
  assignLastPlayedCardAndClearPending,
  assignPersistenceError,
  assignResetAfterTurnUpdate
} from './actions/persistenceActions'
import { getNextPlayerId } from './utils/playerUtils'
import { type GameContext, type GameEvent, type GameActors } from './gameTypes'
import { type PlayedCardWithCard } from '@/types/model'
import { type CardData } from '@/utils/gameUtils'



export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  delays: {
    PACING_DELAY: ({ context }) => context.pacingDelay * 1000,
  },
  actors: {
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
    timerSyncActor,
    timerExtensionActor,
  },
  guards: {
    canPlayCard,
    isRulesFinished: ({ context }) => !context.canPlayMoreCards,
    isTimerEnabled,
    isSoloMode,
  },
  actions: {
    assignNextPlayer,
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
    canPlayMoreCards: true,
    players: [],
    nextPlayerId: null,
    pacingDelay: 0,
    timerDuration: 0,
    pendingConfirmCardId: null,
    pendingPassTurn: false,
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        START_GAME: {
          target: 'active',
          actions: [
            assign({
              gameSessionId: ({ event }) => event.gameSessionId,
              lobbyId: ({ event }) => event.lobbyId,
              gameMode: ({ event }) => event.mode,
              currentPlayerId: ({ event }) => event.currentPlayerId,
              players: ({ event }) => event.players || [],
              pacingDelay: ({ event }) => event.pacingDelay || 0,
              timerDuration: ({ event }) => event.timerDuration || 0,
            }),
            raise(({ context }) => ({
              type: 'SYNC_TIMER' as const,
              isEnabled: context.timerDuration > 0,
              duration: context.timerDuration,
            })),
            // Start the timer if enabled
            raise(() => ({
              type: 'START_TIMER' as const,
            })),
          ],
        },
      },
    },
    active: {
      on: {
        TIMER_EXPIRED: {
          actions: [
            raise({ type: 'STOP_TIMER' as const }),
            raise({ type: 'PASS' as const, isHandEmpty: true }),
          ],
        },
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
        SYNC_CURRENT_PLAYER: {
          actions: [
            ({ event, context }) => console.log('[SYNC_CURRENT_PLAYER]', {
              old: context.currentPlayerId,
              new: (event as { currentPlayerId: string }).currentPlayerId,
            }),
            assign({
              currentPlayerId: ({ event }) => (event as { currentPlayerId: string }).currentPlayerId,
            }),
          ],
        },
      },
      type: 'parallel',
      states: {
        logger: {
          on: {
            '*': {
              actions: [
                ({ event }) => console.log(`[GAME_MACHINE_EVENT] ${event.type}`, event),
              ],
            },
          },
        },
        rules: {
          initial: 'decideMode',
          on: {

            PLAY_CARD: {
              guard: 'canPlayCard',
              actions: [
                assignOptimisticCard,
                sendTo('rulesActor', ({ event }) => {
                  const playCardEvent = event as Extract<GameEvent, { type: 'PLAY_CARD' }>
                  return { type: 'PLAY_CARD', cardId: playCardEvent.card.id }
                }),
              ],
            },
            PASS: [
              {
                guard: isRulesNotFinished,
                actions: sendTo('rulesActor', { type: 'PASS' }),
              },
              {
                actions: [
                  assignNextPlayer,
                  // Start timer for next player
                  raise(() => ({ type: 'START_TIMER' as const })),
                ],
              },
            ],
            CHALLENGE_STUTTER: {
              actions: [
                assignNextPlayerFromEvent,
                sendTo('rulesActor', ({ event }) => event),
              ],
            },
            VALID: {
              actions: sendTo('rulesActor', { type: 'VALID' as const }),
            },
            INVALID: {
              actions: sendTo('rulesActor', { type: 'INVALID' as const }),
            },
            INTERRUPT: {
              guard: isRulesNotFinished,
              actions: [
                assignNextPlayerFromEvent,
                sendTo('rulesActor', ({ context, event }) => {
                  const intEvent = event as Extract<GameEvent, { type: 'INTERRUPT' }>
                  return {
                    type: 'INTERRUPT',
                    player_id: intEvent.nextPlayerId,
                    card_id: context.lastPlayedCardId || ''
                  }
                }),
              ],
            },
            OBJECT: [
              {
                guard: isRulesNotFinished,
                actions: [
                  assignNextPlayerFromEvent,
                  sendTo('rulesActor', ({ context, event }) => {
                    const objectEvent = event as Extract<GameEvent, { type: 'OBJECT' }>
                    return {
                      type: 'OBJECT',
                      played_card_id: objectEvent.playedCardId,
                      player_id: objectEvent.nextPlayerId
                    }
                  }),
                ],
              },
              {
                actions: assignNextPlayerFromEvent,
              },
            ],
            EXCHANGE: [
              {
                guard: isRulesNotFinished,
                actions: sendTo('rulesActor', { type: 'EXCHANGE' }),
              },
              {
                actions: assignNextPlayer,
              },
            ],
            RESET_RULES: {
              actions: assign({ canPlayMoreCards: true }),
              target: '#rules_decide',
            },
          },
          states: {
            decideMode: {
              id: 'rules_decide',
              always: [
                { target: 'tutorial', guard: isTutorialMode },
                { target: 'simple', guard: isSimpleOrFastMode },
                { target: 'full', guard: isFullOrMainMode },
                { target: 'solo', guard: isSoloMode },
              ],
            },
            tutorial: {
              id: 'rules_tutorial',
              invoke: {
                id: 'rulesActor',
                src: 'ruleTutorial',
                input: ({ context }) => ({ pacingDelay: context.pacingDelay }),
                onDone: {
                  target: '#rules_decide',
                  actions: [
                    assign({ canPlayMoreCards: true }),
                    assignNextPlayerFromActorOutput,
                    raise({ type: 'SYNC_TURN' as const }),
                  ],
                },
              },
            },
            simple: {
              id: 'rules_simple',
              invoke: {
                id: 'rulesActor',
                src: 'ruleSimple',
                input: ({ context }) => ({ pacingDelay: context.pacingDelay }),
                onDone: {
                  target: '#rules_decide',
                  actions: [
                    assign({ canPlayMoreCards: true }),
                    assignNextPlayerFromActorOutput,
                    raise({ type: 'SYNC_TURN' as const }),
                  ],
                },
              },
            },
            full: {
              id: 'rules_full',
              invoke: {
                id: 'rulesActor',
                src: 'ruleFull',
                input: ({ context }) => ({ pacingDelay: context.pacingDelay }),
                onDone: {
                  target: '#rules_decide',
                  actions: [
                    assign({ canPlayMoreCards: true }),
                    assignNextPlayerFromActorOutput,
                    raise({ type: 'SYNC_TURN' as const }),
                  ],
                },
              },
            },
            solo: {
              id: 'rules_solo',
              invoke: {
                id: 'rulesActor',
                src: 'ruleSolo',
                input: ({ context }) => ({ pacingDelay: context.pacingDelay }),
                onDone: {
                  target: '#rules_decide',
                  actions: [
                    assign({ canPlayMoreCards: true }),
                    assignNextPlayer,
                    raise({ type: 'SYNC_TURN' as const }),
                  ],
                },
              },
            },
          },
        },
        timer: {
          initial: 'idle',
          on: {
            PLAY_CARD: {
              guard: ({ context }) => context.timerDuration > 0 && context.pacingDelay > 0,
              target: '.checkingExtension',
            },
            CONFIRM_CARD: {
              guard: shouldSyncTimerForSolo,
              target: '.syncing',
              actions: assign(({ context }) => ({
                timerSyncInput: {
                  gameSessionId: context.gameSessionId!,
                  isEnabled: true,
                  duration: context.timerDuration,
                  currentPlayerId: context.currentPlayerId,
                  action: 'start' as const,
                  pacingDelay: context.pacingDelay,
                },
              })),
            },
            SYNC_TIMER: {
              target: '.syncing',
              actions: assign(({ context, event }) => ({
                timerSyncInput: {
                  gameSessionId: context.gameSessionId!,
                  isEnabled: event.isEnabled,
                  duration: event.duration,
                  currentPlayerId: context.currentPlayerId,
                  action: 'sync' as const,
                  pacingDelay: context.pacingDelay,
                },
              })),
            },
            START_TIMER: {
              target: '.syncing',
              actions: assign(({ context }) => ({
                timerSyncInput: {
                  gameSessionId: context.gameSessionId!,
                  isEnabled: context.timerDuration > 0,
                  duration: context.timerDuration,
                  currentPlayerId: context.currentPlayerId,
                  action: 'start' as const,
                  pacingDelay: context.pacingDelay,
                },
              })),
            },
            STOP_TIMER: {
              target: '.syncing',
              actions: assign(({ context }) => ({
                timerSyncInput: {
                  gameSessionId: context.gameSessionId!,
                  isEnabled: false,
                  duration: context.timerDuration,
                  currentPlayerId: context.currentPlayerId,
                  action: 'stop' as const,
                  pacingDelay: context.pacingDelay,
                },
              })),
            },
            EXTEND_TIMER: {
              target: '.syncing',
              actions: assign(({ context }) => ({
                timerSyncInput: {
                  gameSessionId: context.gameSessionId!,
                  isEnabled: context.timerDuration > 0,
                  duration: context.timerDuration,
                  currentPlayerId: context.currentPlayerId,
                  action: 'extend' as const,
                  pacingDelay: context.pacingDelay,
                  // We don't have a specific timestamp here, but extend should handle it
                  // Actually, let's just make extend fallback to now + pacingDelay + 5 if newExpiresAt is missing
                },
              })),
            },
          },
          states: {
            idle: {},
            checkingExtension: {
              invoke: {
                src: 'timerExtensionActor',
                id: 'timerExtensionActor',
                input: ({ context }) => ({
                  gameSessionId: context.gameSessionId!,
                  timerDuration: context.timerDuration,
                  pacingDelay: context.pacingDelay,
                }),
                onDone: [
                  {
                    target: 'syncing',
                    guard: needsTimerExtension,
                    actions: assignTimerSyncInput,
                  },
                  { target: 'idle' },
                ],
              },
            },
            syncing: {
              invoke: {
                src: 'timerSyncActor',
                id: 'timerSyncActor',
                input: ({ context }) => context.timerSyncInput!,
                onDone: {
                  target: 'idle',
                  actions: clearTimerSyncInput,
                },
                onError: {
                  target: 'idle',
                  actions: clearTimerSyncInput,
                },
              },
            },
          },
        },
        persistence: {
          initial: 'idle',
          on: {
            CONFIRM_CARD: {
              actions: assignPendingConfirmCard,
            },
            PASS: {
              actions: assignPendingPassTurn,
            },
            AUTO_PASS: {
              actions: [
                assignPendingPassTurn,
                assign({ canPlayMoreCards: false }), // Force rules-finished state for auto-pass
              ],
            },
          },
          states: {
            idle: {
              on: {
                PLAY_CARD: 'playingCard',
                PASS: 'passingTurn',
                AUTO_PASS: 'passingTurn',
                EXCHANGE: 'exchangingCard',
                SYNC_TURN: 'updateTurn',
                OBJECT: 'objecting',
                CHALLENGE_STUTTER: 'challengingStutter',
                CONFIRM_CARD: 'confirmingCard',
                INTERRUPT: {
                  guard: isRulesNotFinished,
                  actions: sendTo('rulesActor', { type: 'INTERRUPT' }),
                },
              },
            },
            playingCard: {
              invoke: {
                src: 'playCardActor',
                id: 'playCardActor',
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
                onDone: [
                  {
                    target: 'confirmingCard',
                    guard: isPendingCardConfirmed,
                    actions: [
                      assignLastPlayedCardAndClearPending,
                      sendTo('rulesActor', ({ event }: { event: any }) => ({
                        type: 'PLAY_CARD_ACK',
                        playedCardId: event.output.id,
                      })),
                    ],
                  },
                  {
                    target: 'idle',
                    guard: isRulesNotFinished,
                    actions: [
                      assignLastPlayedCardFromEvent,
                      sendTo('rulesActor', ({ event }: { event: any }) => ({
                        type: 'PLAY_CARD_ACK',
                        playedCardId: event.output.id,
                      })),
                    ],
                  },
                  {
                    target: 'idle',
                    actions: assignLastPlayedCardFromEvent,
                  },
                ],
                onError: {
                  target: 'idle',
                  actions: assignPersistenceError,
                },
              },
            },
            passingTurn: {
              invoke: {
                src: 'drawCardsActor',
                id: 'drawCardsActor',
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
                  guard: shouldAutoPassInTutorial,
                },
              ],
            },
            exchangingCard: {
              invoke: {
                src: 'exchangeCardActor',
                id: 'exchangeCardActor',
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
                  actions: assignPersistenceError,
                },
              },
            },
            updateTurn: {
              invoke: {
                src: 'passTurnActor',
                id: 'passTurnActor',
                input: ({ context }): PassTurnActorInput => {
                  if (!context.gameSessionId) throw new Error('Game session ID autonomy check: session ID missing')
                  if (!context.nextPlayerId) throw new Error('Next player ID missing')

                  return {
                    gameSessionId: context.gameSessionId,
                    nextPlayerId: context.nextPlayerId,
                  }
                },
                onDone: {
                  target: 'idle',
                  actions: [
                    ({ context }) => console.log('[updateTurn DONE] Resetting state', {
                      oldCurrentPlayerId: context.currentPlayerId,
                      newCurrentPlayerId: context.nextPlayerId,
                      inFlightHandId: context.inFlightHandId,
                      canPlayMoreCards: context.canPlayMoreCards,
                    }),
                    assignResetAfterTurnUpdate,
                    () => console.log('[updateTurn DONE] State reset complete'),
                    raise({ type: 'RESET_RULES' }),
                  ],
                },
              },
            },
            objecting: {
              invoke: {
                src: 'objectActor',
                id: 'objectActor',
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
                id: 'drawCardsActor',
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
                id: 'passTurnActor',
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
                    assignResetAfterTurnUpdate,
                    raise({ type: 'RESET_RULES' }),
                  ],
                },
              },
            },
            challengingStutter: {
              invoke: {
                src: 'drawCardsActor',
                id: 'drawCardsActor',
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
                id: 'passTurnActor',
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
                    assignResetAfterTurnUpdate,
                    raise({ type: 'RESET_RULES' }),
                  ],
                },
              },
            },
            confirmingCard: {
              invoke: {
                src: 'confirmCardActor',
                id: 'confirmCardActor',
                input: ({ context, event }: { context: GameContext, event: GameEvent }): ConfirmCardActorInput => {
                  if (event.type === 'CONFIRM_CARD') return { playedCardId: event.playedCardId }
                  if (context.lastPlayedCardId) return { playedCardId: context.lastPlayedCardId }
                  throw new Error('No card ID to confirm')
                },
                onDone: [
                  {
                    target: 'passingTurn',
                    guard: hasPendingPassTurn,
                  },
                  {
                    guard: isTutorialRulesFinished,
                    target: 'passingTurn',
                  },
                  {
                    guard: isTutorialWithPlayedCard,
                    target: 'passingTurn',
                  },
                  {
                    target: 'idle',
                    actions: clearOptimisticCard,
                  },
                ],
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
            id: 'playCardActor',
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
              actions: assignLastPlayedCardFromEvent,
            },
          },
        },
        waiting: {
          always: { target: 'confirming', guard: isPacingDisabled },
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
            id: 'objectActor',
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
            id: 'drawCardsActor',
            input: ({ context, event }): DrawCardsActorInput => {
              if (!context.gameSessionId) throw new Error('Game session ID is missing')
              const output = ((event as unknown) as DoneActorEvent<ObjectActorInput>).output
              if (!output?.storytellerId) throw new Error('Storyteller ID missing')

              return {
                gameSessionId: context.gameSessionId,
                playerId: output.storytellerId,
                count: 1,
              }
            },
            onDone: 'updateTurn',
          },
        },
        updateTurn: {
          invoke: {
            src: 'passTurnActor',
            id: 'passTurnActor',
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
                assignResetAfterTurnUpdate,
              ],
            },
          },
        },
        confirming: {
          invoke: {
            src: 'confirmCardActor',
            id: 'confirmCardActor',
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
            id: 'finalizeWinActor',
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
