import { createActor, createMachine, assign } from 'xstate'
import { storytellingMachine } from '../actors/modes/storytelling'

/**
 * Test harness: runs the storytelling machine under a minimal parent so
 * CONFIRM_CARD (sendParent) has a target and the finished-state output is
 * observable through the invoke's onDone — exactly how the real game
 * machine consumes it.
 */

export interface Harness {
  /** Sends an event to the child machine */
  send: (event: any) => void
  /** Snapshot of the live child (undefined once the child has finished) */
  child: () => any
  /** Snapshot of the parent harness */
  parent: () => any
}

export function startChild(mode: 'tutorial' | 'simple' | 'full' | 'solo', pacingDelay = 0): Harness {
  const parentMachine = createMachine(
    {
      id: 'testParent',
      context: { result: null as any },
      initial: 'run',
      states: {
        run: {
          invoke: {
            id: 'child',
            src: 'child',
            input: { pacingDelay, mode },
            onDone: {
              target: 'done',
              actions: assign({ result: ({ event }: any) => event.output }),
            },
          },
        },
        done: { type: 'final' },
      },
    },
    { actors: { child: storytellingMachine } },
  )

  const actor = createActor(parentMachine).start()
  return {
    send: event => actor.getSnapshot().children!.child!.send(event),
    child: () => actor.getSnapshot().children!.child?.getSnapshot(),
    parent: () => actor.getSnapshot(),
  }
}
