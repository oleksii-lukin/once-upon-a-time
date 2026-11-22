'use client'

import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { createActorContext } from '@xstate/react'
import { createBrowserInspector } from '@statelyai/inspect'
import { gameMachine } from './gameMachine'
import { type CardData, type HandCardData } from '@/utils/gameUtils'
import { type GameMode, type GameSession, type Player } from '@/types/model'
import { shouldApplyRemoteTurnUpdate, selectLocalActionInFlight } from './utils/reconcile'

/**
 * Game engine as React context.
 *
 * The provider owns the single game machine; consumers subscribe with
 * `useGameSelector` so machine events re-render only the components whose
 * selected value actually changed — not the whole game tree. Action
 * callbacks come from `useGameActions` and are referentially stable.
 */

const inspector
  = process.env.NODE_ENV === 'development'
    && typeof localStorage !== 'undefined'
    && localStorage.getItem('xstate-inspector') === 'enabled'
    ? createBrowserInspector()
    : null

const GameEngineContext = createActorContext(
  gameMachine,
  inspector ? { inspect: inspector.inspect } : undefined,
)

/** Select a slice of the game machine snapshot (re-renders only on change). */
export const useGameSelector = GameEngineContext.useSelector

interface GameEngineProviderProps {
  gameSession: GameSession | null
  currentPlayer: Player | undefined
  players: Player[]
  pacingDelay: number
  timerDuration: number
  children: ReactNode
}

export function GameEngineProvider({
  gameSession,
  currentPlayer,
  players,
  pacingDelay,
  timerDuration,
  children,
}: GameEngineProviderProps) {
  return (
    <GameEngineContext.Provider>
      <GameEngineLifecycle
        gameSession={gameSession}
        currentPlayer={currentPlayer}
        players={players}
        pacingDelay={pacingDelay}
        timerDuration={timerDuration}
      />
      {children}
    </GameEngineContext.Provider>
  )
}

/**
 * Runs the machine lifecycle effects: START_GAME once the session is known,
 * and the turn reconciliation rule (see utils/reconcile.ts). Renders nothing —
 * its own re-renders never touch the subtree below the provider.
 */
function GameEngineLifecycle({
  gameSession,
  currentPlayer,
  players,
  pacingDelay,
  timerDuration,
}: Omit<GameEngineProviderProps, 'children'>) {
  const actor = GameEngineContext.useActorRef()
  const state = GameEngineContext.useSelector(snapshot => snapshot)

  // Initialize machine if session is loaded
  useEffect(() => {
    if (gameSession && currentPlayer && state.value === 'idle') {
      actor.send({
        type: 'START_GAME',
        gameSessionId: gameSession.id,
        lobbyId: gameSession.lobby_id,
        mode: gameSession.game_mode as GameMode || 'full',
        currentPlayerId: gameSession.current_turn_player_id || currentPlayer.id,
        players,
        pacingDelay,
        timerDuration,
      })
    }
  }, [gameSession, currentPlayer, players, actor, state.value, pacingDelay, timerDuration])

  // Turn reconciliation — single explicit rule (see utils/reconcile.ts):
  // the DB is authoritative for currentPlayerId, except while a local
  // action is in flight, in which case local state wins until it settles
  // (the effect re-runs on the next snapshot, so the update is not lost).
  useEffect(() => {
    const hasLocalActionInFlight = selectLocalActionInFlight({
      inFlightHandId: state.context.inFlightHandId,
      pendingPassTurn: state.context.pendingPassTurn,
      pendingConfirmCardId: state.context.pendingConfirmCardId,
      persistenceIdle: state.matches({ active: { persistence: 'idle' } }),
      isWinning: state.matches('winning'),
    })

    const remoteTurnPlayerId = gameSession?.current_turn_player_id ?? null
    if (
      remoteTurnPlayerId !== null
      && shouldApplyRemoteTurnUpdate({
        remoteTurnPlayerId,
        machineTurnPlayerId: state.context.currentPlayerId,
        hasLocalActionInFlight,
      })
    ) {
      actor.send({ type: 'SYNC_CURRENT_PLAYER', currentPlayerId: remoteTurnPlayerId })
    }
  }, [gameSession?.current_turn_player_id, state, actor])

  return null
}

export interface GameActions {
  playCard: (card: HandCardData, playedCardsCount: number) => void
  passTurn: (isHandEmpty?: boolean) => void
  exchangeCard: (cardId: string, isEnding?: boolean) => void
  interrupt: () => void
  objectToCard: (playedCardId: string, storytellerId: string) => void
  challengeStutter: (storytellerId: string) => void
  winGame: (card: CardData, playedCardsCount: number) => void
}

/**
 * Stable action callbacks for the game screen. Identity changes only when
 * the player roster changes, so memoized children stay memoized.
 */
export function useGameActions(
  currentPlayer: Player | undefined,
): GameActions {
  const actor = GameEngineContext.useActorRef()

  return useMemo(() => ({
    playCard: (card: HandCardData, playedCardsCount: number) => {
      if (card.type === 'ending') return
      actor.send({ type: 'PLAY_CARD', card, playedCardsCount })
    },
    passTurn: (isHandEmpty?: boolean) => {
      actor.send({ type: 'PASS', isHandEmpty })
    },
    exchangeCard: (cardId: string, isEnding?: boolean) => {
      actor.send({ type: 'EXCHANGE', cardId, isEnding })
    },
    interrupt: () => {
      // The actor takes the turn: the rules machine records the directed
      // event's nextPlayerId as the override, so it must be the local
      // player — not their turn-order successor (which would hand the turn
      // back to the original storyteller and make the interrupt a no-op).
      if (!currentPlayer) return
      actor.send({ type: 'INTERRUPT', nextPlayerId: currentPlayer.id })
    },
    objectToCard: (playedCardId: string, storytellerId: string) => {
      if (!currentPlayer) return
      actor.send({ type: 'OBJECT', playedCardId, storytellerId, nextPlayerId: currentPlayer.id })
    },
    challengeStutter: (storytellerId: string) => {
      if (!currentPlayer) return
      actor.send({ type: 'CHALLENGE_STUTTER', storytellerId, nextPlayerId: currentPlayer.id })
    },
    winGame: (card: CardData, playedCardsCount: number) => {
      actor.send({ type: 'WIN_GAME', card, playedCardsCount })
    },
  }), [actor, currentPlayer])
}
