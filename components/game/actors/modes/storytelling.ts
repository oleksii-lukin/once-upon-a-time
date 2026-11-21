import { assign, sendParent } from 'xstate'
import { storytellingSetup, MODE_CONFIG } from './index'

/**
 * Unified storytelling (rules) machine — the single statechart behind every
 * game mode.
 *
 * Modes differ only by the MODE_CONFIG block delivered through the machine
 * input:
 *
 *   | mode              | maxCardsPerTurn | canInterrupt | canObject |
 *   | tutorial          | 1               | false        | false     |
 *   | simple / fast     | null (unlimited)| false        | false     |
 *   | full / main       | null            | true         | true      |
 *   | solo              | null            | false        | false     |
 *
 * ## Flow
 * - **narrating**: play cards, pass, exchange (interrupt only when enabled)
 * - **cardPlay**: ack → pacing delay (objection window) → confirmed
 *   (confirmed finalizes by sending CONFIRM_CARD to the parent)
 * - **decideNext**: card-limit check (tutorial finishes after 1 card)
 * - **interruption / objecting**: VALID/INVALID arbitration against
 *   the parent's persistence layer
 * - **finished**: final output { reason, nextPlayerId }
 *
 * Communicates with the parent game machine through:
 * - `CONFIRM_CARD` (or `SYNC_ERROR`) sent when a card play is confirmed
 * - `finished` output consumed by the parent's rulesActor onDone
 */
export const storytellingMachine = storytellingSetup.createMachine({
  id: 'storytelling',
  initial: 'narrating',
  context: ({ input }) => {
    const config = MODE_CONFIG[input.mode] ?? MODE_CONFIG.full
    return {
      cardsPlayedThisTurn: 0,
      maxCardsPerTurn: config.maxCardsPerTurn,
      canInterrupt: config.canInterrupt,
      canObject: config.canObject,
      lastPlayedCardId: null,
      pacingDelay: input.pacingDelay,
      turnCompleteReason: undefined,
    }
  },
  // xstate v5 reads an invoked machine's output from the MACHINE-level
  // declaration (a final state's `output` only feeds this mapper as the
  // doneStateEvent) — the old per-state declarations never reached parents.
  output: ({ context }) => ({
    type: 'TURN_COMPLETE' as const,
    reason: context.turnCompleteReason || 'passed',
    nextPlayerId: context.nextPlayerIdOverride,
  }),
  states: {
    narrating: {
      on: {
        PLAY_CARD: 'cardPlay',
        PASS: {
          target: 'finished',
          actions: assign({ turnCompleteReason: 'passed' as const }),
        },
        EXCHANGE: {
          target: 'finished',
          actions: assign({ turnCompleteReason: 'exchanged' as const }),
        },
        INTERRUPT: {
          guard: ({ context }) => context.canInterrupt,
          target: 'interruption',
          actions: assign({ nextPlayerIdOverride: ({ event }) => event.player_id }),
        },
      },
    },
    cardPlay: {
      initial: 'awaitingAck',
      states: {
        awaitingAck: {
          on: {
            PLAY_CARD_ACK: {
              target: 'pending',
              actions: assign({
                lastPlayedCardId: ({ event }) => event.playedCardId,
                cardsPlayedThisTurn: ({ context }) => context.cardsPlayedThisTurn + 1,
              }),
            },
          },
        },
        pending: {
          // Pacing delay 0 → confirm immediately; otherwise the delay is the
          // objection window (OBJECT arrives from the parent).
          always: { target: 'confirmed', guard: ({ context }) => context.pacingDelay <= 0 },
          on: {
            OBJECT: {
              guard: ({ context }) => context.canObject,
              target: 'objecting',
              actions: assign({ nextPlayerIdOverride: ({ event }) => event.player_id }),
            },
            CONFIRM: 'confirmed',
          },
          after: {
            PACING_DELAY: 'confirmed',
          },
        },
        objecting: {
          on: {
            VALID: {
              target: '#storytelling.finished',
              actions: assign({ turnCompleteReason: 'objected' as const }),
            },
            INVALID: {
              target: 'confirmed',
              // A rejected objection must not leave its next-player
              // override behind: it would leak into a later
              // finished output and corrupt the turn order.
              actions: assign({ nextPlayerIdOverride: undefined }),
            },
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
      onDone: {
        target: 'decideNext',
      },
    },
    decideNext: {
      always: [
        {
          target: 'finished',
          guard: ({ context }) =>
            context.maxCardsPerTurn != null
            && context.cardsPlayedThisTurn >= context.maxCardsPerTurn,
          actions: assign({ turnCompleteReason: 'card_limit_reached' as const }),
        },
        { target: 'narrating' },
      ],
    },
    interruption: {
      on: {
        VALID: {
          target: 'finished',
          actions: assign({ turnCompleteReason: 'interrupted' as const }),
        },
        INVALID: {
          target: 'narrating',
          // Same leak as a rejected objection: clear the override.
          actions: assign({ nextPlayerIdOverride: undefined }),
        },
      },
    },
    finished: {
      type: 'final',
    },
  },
})
