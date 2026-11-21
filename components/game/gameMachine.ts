import { assign, setup, sendTo, raise, assertEvent, type DoneActorEvent } from 'xstate'
import { storytellingMachine } from './actors/modes/storytelling'
import { type StorytellingInput } from './actors/modes/index'
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
  type DrawCardsActorInput,
  type PassTurnActorInput,
  type ConfirmCardActorInput,
  type FinalizeWinActorInput,
  type ObjectActorInput,
  type ExchangeCardActorInput,
  type TimerSyncInput,
  type TimerExtensionOutput,
} from './gameTypes'
import { canPlayCard } from './guards/playGuards'
import { isTimerEnabled, shouldSyncTimerForSolo, needsTimerExtension } from './guards/timerGuards'
import { isSoloMode, isTutorialMode, isSimpleOrFastMode, isFullOrMainMode } from './guards/modesGuards'
import { isRulesNotFinished } from './guards/rulesGuards'
import {
  isPendingCardConfirmed,
  shouldAutoPassInTutorial,
  isTutorialRulesFinished,
  isTutorialWithPlayedCard,
  hasPendingPassTurn,
  isPacingDisabled,
} from './guards/persistenceGuards'
import { assignNextPlayer, assignNextPlayerFromEvent, assignNextPlayerFromActorOutput } from './actions/playerActions'
import { assignOptimisticCard, clearOptimisticCard, assignLastPlayedCardFromEvent, assignPendingConfirmCard } from './actions/cardActions'
import {
  assignPendingPassTurn,
  assignLastPlayedCardAndClearPending,
  assignPersistenceError,
  assignResetAfterTurnUpdate,
} from './actions/persistenceActions'
import { type GameContext, type GameEvent } from './gameTypes'
import { type CardData } from '@/utils/gameUtils'

type TimerSyncTrigger = GameEvent | DoneActorEvent<TimerExtensionOutput>

/**
 * Builds timerSyncActor input from the event that triggered the sync.
 *
 * The triggering event is available to `invoke.input`, so no temporary
 * context field is needed — keeping the machine context serializable.
 */
const buildTimerSyncInput = (context: GameContext, event: TimerSyncTrigger): TimerSyncInput => {
  const base: TimerSyncInput = {
    gameSessionId: context.gameSessionId!,
    duration: context.timerDuration,
    currentPlayerId: context.currentPlayerId,
    pacingDelay: context.pacingDelay,
    isEnabled: false,
    action: 'start',
  }

  // timerExtensionActor completed: its output says whether/how to extend
  if ('output' in event) {
    return {
      ...base,
      isEnabled: context.timerDuration > 0,
      action: 'extend',
      newExpiresAt: event.output.newExpiresAt,
    }
  }

  switch (event.type) {
    case 'SYNC_TIMER':
      return { ...base, isEnabled: event.isEnabled, duration: event.duration, action: 'sync' }
    case 'STOP_TIMER':
      return { ...base, isEnabled: false, action: 'stop' }
    case 'CONFIRM_CARD':
      return { ...base, isEnabled: true, action: 'start' }
    case 'START_TIMER':
    default:
      return { ...base, isEnabled: context.timerDuration > 0, action: 'start' }
  }
}

/* ------------------------------------------------------------------ *
 * Shared invoke configuration & typed input builders.
 *
 * The four rules-region mode states all invoke the same storytelling
 * machine (mode comes from context), and every actor input is built by
 * one of the typed helpers below — no repeated inline `if (!x) throw`
 * blocks scattered through the statechart.
 * ------------------------------------------------------------------ */

const rulesState = () => ({
  invoke: {
    id: 'rulesActor',
    src: 'storytelling' as const,
    input: ({ context }: { context: GameContext }): StorytellingInput => ({
      pacingDelay: context.pacingDelay,
      mode: context.gameMode,
    }),
    onDone: {
      target: '#rules_decide' as const,
      actions: ['markRulesFinished', 'assignNextPlayerFromActorOutput', 'signalSyncTurn'] as const,
    },
  },
})

const requireSessionId = (context: GameContext): string => {
  if (!context.gameSessionId) throw new Error('Game session ID is missing')
  return context.gameSessionId
}

const requirePlayerId = (context: GameContext): string => {
  if (!context.currentPlayerId) throw new Error('Current player ID is missing')
  return context.currentPlayerId
}

const requireNextPlayerId = (context: GameContext): string => {
  if (!context.nextPlayerId) throw new Error('Next player ID missing')
  return context.nextPlayerId
}

const requireLobbyId = (context: GameContext): string => {
  if (!context.lobbyId) throw new Error('Lobby ID is missing')
  return context.lobbyId
}

const buildPlayCardInput = (
  { context, event }: { context: GameContext, event: GameEvent },
): PlayCardActorInput => {
  assertEvent(event, 'PLAY_CARD')
  return {
    gameSessionId: requireSessionId(context),
    playerId: requirePlayerId(context),
    cardId: event.card.id,
    position: event.playedCardsCount,
  }
}

const buildWinCardInput = (
  { context, event }: { context: GameContext, event: GameEvent },
): PlayCardActorInput => {
  assertEvent(event, 'WIN_GAME')
  return {
    gameSessionId: requireSessionId(context),
    playerId: requirePlayerId(context),
    cardId: event.card.id,
    position: event.playedCardsCount,
  }
}

const buildDrawCardsInput = (
  { context }: { context: GameContext },
): DrawCardsActorInput => ({
  gameSessionId: requireSessionId(context),
  playerId: requirePlayerId(context),
  count: 1,
})

const buildPenaltyDrawInput = (
  { context, event }: { context: GameContext, event: GameEvent | DoneActorEvent<ObjectActorInput> },
): DrawCardsActorInput => {
  const output = 'output' in event ? event.output : undefined
  if (!output?.storytellerId) throw new Error('Storyteller ID missing from objectActor output')
  return {
    gameSessionId: requireSessionId(context),
    playerId: output.storytellerId,
    count: 1,
  }
}

const buildChallengeDrawInput = (
  { context, event }: { context: GameContext, event: GameEvent },
): DrawCardsActorInput => {
  assertEvent(event, 'CHALLENGE_STUTTER')
  return {
    gameSessionId: requireSessionId(context),
    playerId: event.storytellerId,
    count: 1,
  }
}

const buildObjectInput = (
  { context, event }: { context: GameContext, event: GameEvent },
): ObjectActorInput => {
  assertEvent(event, 'OBJECT')
  return {
    gameSessionId: requireSessionId(context),
    playedCardId: event.playedCardId,
    storytellerId: event.storytellerId,
    nextPlayerId: event.nextPlayerId,
  }
}

const buildExchangeInput = (
  { context, event }: { context: GameContext, event: GameEvent },
): ExchangeCardActorInput => {
  assertEvent(event, 'EXCHANGE')
  return {
    gameSessionId: requireSessionId(context),
    playerId: requirePlayerId(context),
    cardId: event.cardId,
    isEnding: event.isEnding,
  }
}

const buildConfirmInput = (
  { context, event }: { context: GameContext, event: GameEvent | DoneActorEvent<unknown> },
): ConfirmCardActorInput => {
  if (event.type === 'CONFIRM_CARD') return { playedCardId: event.playedCardId }
  if (context.lastPlayedCardId) return { playedCardId: context.lastPlayedCardId }
  throw new Error('No card ID to confirm')
}

const buildPassTurnInput = (
  { context }: { context: GameContext },
): PassTurnActorInput => ({
  gameSessionId: requireSessionId(context),
  nextPlayerId: requireNextPlayerId(context),
})

const buildFinalizeWinInput = (
  { context }: { context: GameContext },
): FinalizeWinActorInput => ({
  gameSessionId: requireSessionId(context),
  winnerId: requirePlayerId(context),
  lobbyId: requireLobbyId(context),
})

/** Common completion of a successful turn update in the database. */
const afterTurnUpdate = ['assignResetAfterTurnUpdate', 'signalResetRules'] as const

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  delays: {
    PACING_DELAY: ({ context }) => context.pacingDelay * 1000,
  },
  actors: {
    storytelling: storytellingMachine,
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
  },
  actions: {
    assignNextPlayer,
    assignNextPlayerFromActorOutput,
    assignResetAfterTurnUpdate,
    markRulesFinished: assign({ canPlayMoreCards: true }),
    signalSyncTurn: raise({ type: 'SYNC_TURN' as const }),
    signalResetRules: raise({ type: 'RESET_RULES' as const }),
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
          actions: assign({
            currentPlayerId: ({ event }) => (event as { currentPlayerId: string }).currentPlayerId,
          }),
        },
      },
      type: 'parallel',
      states: {
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
                    card_id: context.lastPlayedCardId || '',
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
                      player_id: objectEvent.nextPlayerId,
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
            // All four mode states invoke the SAME storytelling machine —
            // the mode only contributes a config block via gameMode input.
            tutorial: rulesState(),
            simple: rulesState(),
            full: rulesState(),
            solo: rulesState(),
          },
        },
        timer: {
          initial: 'idle',
          on: {
            PLAY_CARD: {
              guard: isTimerEnabled,
              target: '.checkingExtension',
            },
            CONFIRM_CARD: {
              guard: shouldSyncTimerForSolo,
              target: '.syncing',
            },
            SYNC_TIMER: {
              target: '.syncing',
            },
            START_TIMER: {
              target: '.syncing',
            },
            STOP_TIMER: {
              target: '.syncing',
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
                  },
                  { target: 'idle' },
                ],
              },
            },
            syncing: {
              invoke: {
                src: 'timerSyncActor',
                id: 'timerSyncActor',
                input: ({ context, event }) =>
                  buildTimerSyncInput(context, event as TimerSyncTrigger),
                onDone: 'idle',
                onError: 'idle',
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
                input: buildPlayCardInput,
                onDone: [
                  {
                    target: 'confirmingCard',
                    guard: isPendingCardConfirmed,
                    actions: [
                      assignLastPlayedCardAndClearPending,
                      sendTo('rulesActor', ({ event }: { event: DoneActorEvent<{ id: string }> }) => ({
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
                      sendTo('rulesActor', ({ event }: { event: DoneActorEvent<{ id: string }> }) => ({
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
                input: buildDrawCardsInput,
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
                input: buildExchangeInput,
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
                input: buildPassTurnInput,
                onDone: {
                  target: 'idle',
                  actions: afterTurnUpdate,
                },
              },
            },
            objecting: {
              invoke: {
                src: 'objectActor',
                id: 'objectActor',
                input: buildObjectInput,
                onDone: 'penaltyForStoryteller',
              },
            },
            penaltyForStoryteller: {
              invoke: {
                src: 'drawCardsActor',
                id: 'drawCardsActor',
                input: buildPenaltyDrawInput,
                onDone: 'updateTurn',
              },
            },
            challengingStutter: {
              invoke: {
                src: 'drawCardsActor',
                id: 'drawCardsActor',
                input: buildChallengeDrawInput,
                onDone: 'updateTurn',
              },
            },
            confirmingCard: {
              invoke: {
                src: 'confirmCardActor',
                id: 'confirmCardActor',
                input: buildConfirmInput,
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
            input: buildWinCardInput,
            onDone: {
              target: 'waiting',
              actions: assignLastPlayedCardFromEvent,
            },
          },
        },
        waiting: {
          always: { target: 'confirming', guard: isPacingDisabled },
          on: {
            OBJECT: {
              target: 'objecting',
              // The winning flow runs outside the rules region, so the
              // next player from the objection event must be captured here
              // (the active flow gets it from the rules-region handler).
              actions: assignNextPlayerFromEvent,
            },
          },
          after: {
            PACING_DELAY: 'confirming',
          },
        },
        objecting: {
          invoke: {
            src: 'objectActor',
            id: 'objectActor',
            input: buildObjectInput,
            onDone: 'penalty',
          },
        },
        penalty: {
          invoke: {
            src: 'drawCardsActor',
            id: 'drawCardsActor',
            input: buildPenaltyDrawInput,
            onDone: 'updateTurn',
          },
        },
        updateTurn: {
          invoke: {
            src: 'passTurnActor',
            id: 'passTurnActor',
            input: buildPassTurnInput,
            onDone: {
              target: '#gameRoot.active',
              actions: afterTurnUpdate,
            },
          },
        },
        confirming: {
          invoke: {
            src: 'confirmCardActor',
            id: 'confirmCardActor',
            input: buildConfirmInput,
            onDone: 'finalizing',
          },
        },
        finalizing: {
          invoke: {
            src: 'finalizeWinActor',
            id: 'finalizeWinActor',
            input: buildFinalizeWinInput,
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
