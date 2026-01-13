import { createMachine, assign, sendParent, setup } from 'xstate'

// Types for storytelling machines
export interface StorytellingContext {
  cardsPlayedThisTurn: number
  maxCardsPerTurn: number | null
  canInterrupt: boolean
  canObject: boolean
  lastPlayedCardId: string | null
}

export type StorytellingEvent
  = | { type: 'PLAY_CARD', cardId: string }
    | { type: 'PLAY_CARD_ACK', playedCardId: string }
    | { type: 'PASS' }
    | { type: 'INTERRUPT', player_id: string, card_id: string }
    | { type: 'OBJECT', player_id: string, played_card_id: string }
    | { type: 'CONFIRM' }
    | { type: 'VALID' }
    | { type: 'INVALID' }

export const storytellingSetup = setup({
  types: {
    context: {} as StorytellingContext,
    events: {} as StorytellingEvent,
  },
})

// 1. Tutorial Mode: 1 card, no interrupts/objections
export const tutorialStorytellingMachine = storytellingSetup.createMachine({
  id: 'tutorialStorytelling',
  initial: 'narrating',
  context: {
    cardsPlayedThisTurn: 0,
    maxCardsPerTurn: 1,
    canInterrupt: false,
    canObject: false,
    lastPlayedCardId: null,
  },
  states: {
    narrating: {
      on: {
        PLAY_CARD: 'cardPlay',
        PASS: { target: 'finished' },
      },
    },
    cardPlay: {
      on: {
        PLAY_CARD_ACK: {
          actions: [
            assign({
              lastPlayedCardId: ({ event }) => event.playedCardId,
              cardsPlayedThisTurn: ({ context }) => context.cardsPlayedThisTurn + 1,
            }),
            sendParent(({ event }) => ({ type: 'CONFIRM_CARD', playedCardId: event.playedCardId })),
          ],
          target: 'decideNext',
        },
      },
    },
    decideNext: {
      always: [
        { target: 'finished', guard: ({ context }) => context.cardsPlayedThisTurn >= (context.maxCardsPerTurn || 1) },
        { target: 'narrating' },
      ],
    },
    finished: {
      type: 'final',
      entry: sendParent({ type: 'RULES_DONE' }),
    },
  },
})

// 2. Simple Mode: Multiple cards, no interrupts
export const simpleStorytellingMachine = storytellingSetup.createMachine({
  id: 'simpleStorytelling',
  initial: 'narrating',
  context: {
    cardsPlayedThisTurn: 0,
    maxCardsPerTurn: null,
    canInterrupt: false,
    canObject: false,
    lastPlayedCardId: null,
  },
  states: {
    narrating: {
      on: {
        PLAY_CARD: 'cardPlay',
        PASS: 'finished',
      },
    },
    cardPlay: {
      on: {
        PLAY_CARD_ACK: {
          actions: [
            assign({ lastPlayedCardId: ({ event }) => event.playedCardId }),
            sendParent(({ event }) => ({ type: 'CONFIRM_CARD', playedCardId: event.playedCardId })),
          ],
          target: 'narrating',
        },
      },
    },
    finished: {
      type: 'final',
      entry: sendParent({ type: 'RULES_DONE' }),
    },
  },
})

// 3. Full Mode: Full rules
export const fullStorytellingMachine = storytellingSetup.createMachine({
  id: 'fullStorytelling',
  initial: 'narrating',
  context: {
    cardsPlayedThisTurn: 0,
    maxCardsPerTurn: null,
    canInterrupt: true,
    canObject: true,
    lastPlayedCardId: null,
  },
  states: {
    narrating: {
      on: {
        PLAY_CARD: 'cardPlay',
        PASS: 'finished',
        INTERRUPT: 'interruption',
      },
    },
    cardPlay: {
      initial: 'awaitingAck',
      states: {
        awaitingAck: {
          on: {
            PLAY_CARD_ACK: {
              target: 'pending',
              actions: assign({ lastPlayedCardId: ({ event }) => event.playedCardId }),
            },
          },
        },
        pending: {
          on: {
            OBJECT: 'objecting',
            CONFIRM: 'confirmed',
          },
          after: {
            5000: 'confirmed',
          },
        },
        objecting: {
          on: {
            VALID: '#fullStorytelling.finished',
            INVALID: 'confirmed',
          },
        },
        confirmed: {
          type: 'final',
          entry: sendParent(({ context }) => {
            if (!context.lastPlayedCardId) return { type: 'SYNC_ERROR', error: 'No card to confirm' }
            return {
              type: 'CONFIRM_CARD',
              playedCardId: context.lastPlayedCardId,
            }
          }),
        },
      },
      onDone: 'narrating',
    },
    interruption: {
      on: {
        VALID: 'finished',
        INVALID: 'narrating',
      },
    },
    finished: {
      type: 'final',
      entry: sendParent({ type: 'RULES_DONE' }),
    },
  },
})

// 4. Solo Mode: Multiple cards, no interrupts, optimized for single player
export const soloStorytellingMachine = storytellingSetup.createMachine({
  id: 'soloStorytelling',
  initial: 'narrating',
  context: {
    cardsPlayedThisTurn: 0,
    maxCardsPerTurn: null,
    canInterrupt: false,
    canObject: false,
    lastPlayedCardId: null,
  },
  states: {
    narrating: {
      on: {
        PLAY_CARD: 'cardPlay',
        PASS: 'finished',
      },
    },
    cardPlay: {
      on: {
        PLAY_CARD_ACK: {
          actions: [
            assign({ lastPlayedCardId: ({ event }) => event.playedCardId }),
            sendParent(({ event }) => ({ type: 'CONFIRM_CARD', playedCardId: event.playedCardId })),
          ],
          target: 'narrating',
        },
      },
    },
    finished: {
      type: 'final',
      entry: sendParent({ type: 'RULES_DONE' }),
    },
  },
})
