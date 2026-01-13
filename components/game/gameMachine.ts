import { createMachine, assign, setup, fromPromise, sendTo, raise } from 'xstate'
import {
  tutorialStorytellingMachine,
  simpleStorytellingMachine,
  fullStorytellingMachine,
  soloStorytellingMachine,
} from './ruleVariants'
import { createClient } from '@/utils/supabase/client'

export interface CardData {
  id: string
  name?: string
  type?: string
  category?: string
  hand_id?: string
  played_card_id?: string
  played_by?: string
  status?: 'PENDING' | 'CONFIRMED' | 'REVERTED'
  [key: string]: any
}

export interface GameContext {
  gameSessionId: string | null
  lobbyId: string | null
  gameMode: 'tutorial' | 'simple' | 'full' | 'solo' | 'main' | 'fast'
  error: string | null
  lastPersistenceError: string | null
  currentPlayerId: string | null
  optimisticCard: CardData | null
  inFlightHandId: string | null
  rulesFinished: boolean
}

export type GameEvent
  = | { type: 'START_GAME', sessionId: string, lobbyId: string, mode: 'tutorial' | 'simple' | 'full' | 'solo' | 'main' | 'fast', currentPlayerId: string }
    | { type: 'PLAY_CARD', card: CardData, playedCardsCount: number }
    | { type: 'PASS', nextPlayerId: string }
    | { type: 'INTERRUPT' }
    | { type: 'OBJECT', playedCardId: string, storytellerId: string, nextPlayerId: string }
    | { type: 'CHALLENGE_STUTTER', storytellerId: string, nextPlayerId: string }
    | { type: 'CONFIRM_CARD', playedCardId: string }
    | { type: 'WIN_GAME', cardId: string, playedCardsCount: number }
    | { type: 'FINALIZE_WIN', winnerId: string, lobbyId: string }
    | { type: 'RULES_DONE' }
    | { type: 'SYNC_COMPLETE' }
    | { type: 'SYNC_ERROR', error: string }
    | { type: 'RESET_RULES' }

const supabase = createClient()

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actors: {
    ruleTutorial: tutorialStorytellingMachine,
    ruleSimple: simpleStorytellingMachine,
    ruleFull: fullStorytellingMachine,
    ruleSolo: soloStorytellingMachine,
    playCardActor: fromPromise(async ({ input }: { input: { sessionId: string, playerId: string, cardId: string, position: number } }) => {
      const { data, error } = await supabase
        .from('played_cards')
        .insert({
          game_session_id: input.sessionId,
          player_id: input.playerId,
          card_id: input.cardId,
          position: input.position,
          status: 'PENDING',
        })
        .select('*, cards(*)')
        .single()

      if (error) throw error

      await supabase
        .from('player_hands')
        .delete()
        .eq('game_session_id', input.sessionId)
        .eq('player_id', input.playerId)
        .eq('card_id', input.cardId)

      return data
    }),
    drawCardsActor: fromPromise(async ({ input }: { input: { sessionId: string, playerId: string, count: number } }) => {
      const { data: drawCards, error: drawError } = await supabase
        .from('draw_pile')
        .select('*')
        .eq('game_session_id', input.sessionId)
        .order('position', { ascending: true })
        .limit(input.count)

      if (drawError || !drawCards || drawCards.length === 0) throw drawError || new Error('No cards in draw pile')

      const cardsToAdd = drawCards.map((dc: any, index: number) => ({
        game_session_id: input.sessionId,
        player_id: input.playerId,
        card_id: dc.card_id,
        position: 999 + index,
      }))

      const { error: handError } = await supabase
        .from('player_hands')
        .insert(cardsToAdd)

      if (handError) throw handError

      await supabase
        .from('draw_pile')
        .delete()
        .in('id', drawCards.map((dc: any) => dc.id))

      return true
    }),
    passTurnActor: fromPromise(async ({ input }: { input: { sessionId: string, nextPlayerId: string } }) => {
      const { error } = await supabase
        .from('game_sessions')
        .update({
          current_turn_player_id: input.nextPlayerId,
          storyteller_id: input.nextPlayerId,
        })
        .eq('id', input.sessionId)
      if (error) throw error
      return true
    }),
    confirmCardActor: fromPromise(async ({ input }: { input: { playedCardId: string } }) => {
      const { error } = await supabase
        .from('played_cards')
        .update({ status: 'CONFIRMED' })
        .eq('id', input.playedCardId)
      if (error) throw error
      return true
    }),
    finalizeWinActor: fromPromise(async ({ input }: { input: { sessionId: string, winnerId: string, lobbyId: string } }) => {
      const { error } = await supabase
        .from('game_sessions')
        .update({
          winner_id: input.winnerId,
          status: 'COMPLETED',
        })
        .eq('id', input.sessionId)

      if (error) throw error

      await supabase
        .from('lobbies')
        .update({ status: 'finished' })
        .eq('id', input.lobbyId)

      return true
    }),
    objectActor: fromPromise(async ({ input }: { input: { sessionId: string, playedCardId: string, storytellerId: string, nextPlayerId: string } }) => {
      const { data: playedCard, error: fetchError } = await supabase
        .from('played_cards')
        .select('*')
        .eq('id', input.playedCardId)
        .single()

      if (fetchError || !playedCard) throw fetchError || new Error('Played card not found')

      await supabase
        .from('player_hands')
        .insert({
          game_session_id: input.sessionId,
          player_id: input.storytellerId,
          card_id: playedCard.card_id,
          position: 0,
        })

      await supabase.from('played_cards').delete().eq('id', input.playedCardId)
      return true
    }),
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
    rulesFinished: false,
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        START_GAME: {
          target: 'active',
          actions: assign({
            gameSessionId: ({ event }) => event.sessionId,
            lobbyId: ({ event }) => event.lobbyId,
            gameMode: ({ event }) => event.mode,
            currentPlayerId: ({ event }) => event.currentPlayerId,
          }),
        },
      },
    },
    active: {
      on: {
        WIN_GAME: 'winning',
      },
      type: 'parallel',
      states: {
        rules: {
          initial: 'decideMode',
          on: {
            RULES_DONE: { actions: assign({ rulesFinished: true }) },
            PLAY_CARD: {
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
                  inFlightHandId: ({ event }) => (event as any).card.hand_id || null,
                }),
                sendTo('rulesActor', ({ event }) => ({ type: 'PLAY_CARD', cardId: (event as any).card.id })),
              ],
            },
            PASS: {
              actions: sendTo('rulesActor', { type: 'PASS' }),
            },
            INTERRUPT: {
              actions: sendTo('rulesActor', { type: 'INTERRUPT' }),
            },
            OBJECT: {
              actions: sendTo('rulesActor', ({ event }) => ({ type: 'OBJECT', playedCardId: (event as any).playedCardId, storytellerId: (event as any).storytellerId })),
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
              },
            },
            simple: {
              invoke: {
                id: 'rulesActor',
                src: 'ruleSimple',
              },
            },
            full: {
              invoke: {
                id: 'rulesActor',
                src: 'ruleFull',
              },
            },
            solo: {
              invoke: {
                id: 'rulesActor',
                src: 'ruleSolo',
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
                input: ({ context, event }) => {
                  const playEvent = event as { type: 'PLAY_CARD', card: CardData, playedCardsCount: number }
                  return {
                    sessionId: context.gameSessionId!,
                    playerId: context.currentPlayerId!,
                    cardId: playEvent.card.id,
                    position: playEvent.playedCardsCount,
                  }
                },
                onDone: {
                  target: 'idle',
                  actions: [
                    sendTo('rulesActor', ({ event }) => ({ type: 'PLAY_CARD_ACK', playedCardId: (event.output as any).id })),
                  ],
                },
                onError: {
                  target: 'idle',
                  actions: assign({ lastPersistenceError: ({ event }) => (event.error as any)?.message || 'Unknown error' }),
                },
              },
            },
            passingTurn: {
              invoke: {
                src: 'drawCardsActor',
                input: ({ context }) => ({
                  sessionId: context.gameSessionId!,
                  playerId: context.currentPlayerId!,
                  count: 1,
                }),
                onDone: 'updateTurn',
                onError: 'idle',
              },
            },
            updateTurn: {
              invoke: {
                src: 'passTurnActor',
                input: ({ context, event }) => {
                  return {
                    sessionId: context.gameSessionId!,
                    nextPlayerId: (event as any).nextPlayerId,
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
            objecting: {
              invoke: {
                src: 'objectActor',
                input: ({ context, event }) => ({
                  sessionId: context.gameSessionId!,
                  playedCardId: (event as any).playedCardId,
                  storytellerId: (event as any).storytellerId,
                  nextPlayerId: (event as any).nextPlayerId,
                }),
                onDone: 'penaltyForStoryteller',
              },
            },
            penaltyForStoryteller: {
              invoke: {
                src: 'drawCardsActor',
                input: ({ context, event }) => ({
                  sessionId: context.gameSessionId!,
                  playerId: (event as any).input.storytellerId,
                  count: 1,
                }),
                onDone: 'updateTurnFromObject',
              },
            },
            updateTurnFromObject: {
              invoke: {
                src: 'passTurnActor',
                input: ({ context, event }) => ({
                  sessionId: context.gameSessionId!,
                  nextPlayerId: (event as any).input.nextPlayerId,
                }),
                onDone: {
                  target: 'idle',
                  actions: [
                    raise({ type: 'RESET_RULES' }),
                  ],
                },
              },
            },
            challengingStutter: {
              invoke: {
                src: 'drawCardsActor',
                input: ({ context, event }) => ({
                  sessionId: context.gameSessionId!,
                  playerId: (event as any).storytellerId,
                  count: 1,
                }),
                onDone: 'updateTurnFromChallenge',
              },
            },
            updateTurnFromChallenge: {
              invoke: {
                src: 'passTurnActor',
                input: ({ context, event }) => ({
                  sessionId: context.gameSessionId!,
                  nextPlayerId: (event as any).nextPlayerId,
                }),
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
                input: ({ event }) => ({
                  playedCardId: (event as any).playedCardId,
                }),
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
            input: ({ context, event }: { context: GameContext, event: GameEvent }) => ({
              sessionId: context.gameSessionId!,
              playerId: context.currentPlayerId!,
              cardId: (event as any).cardId,
              position: (event as any).playedCardsCount,
            }),
            onDone: 'confirming',
          },
        },
        confirming: {
          invoke: {
            src: 'confirmCardActor',
            input: ({ event }: { event: any }) => ({
              playedCardId: event.output.id,
            }),
            onDone: 'finalizing',
          },
        },
        finalizing: {
          invoke: {
            src: 'finalizeWinActor',
            input: ({ context }: { context: GameContext }) => ({
              sessionId: context.gameSessionId!,
              winnerId: context.currentPlayerId!,
              lobbyId: context.lobbyId!,
            }),
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
