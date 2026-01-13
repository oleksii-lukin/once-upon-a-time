import { createBrowserInspector } from '@statelyai/inspect'
import { createActor } from 'xstate'
import { gameMachine } from '@/components/game/gameMachine'

const inspector = createBrowserInspector()

const actor = createActor(gameMachine, {
  inspect: inspector.inspect,
})

actor.start()
