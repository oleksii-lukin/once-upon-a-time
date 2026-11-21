import { assign } from 'xstate'

/**
 * XState actions for error handling and recovery
 */

export const resetInFlightState = assign({
  inFlightHandId: null,
  optimisticCard: null,
})

export const resetErrorState = assign({
  error: null,
  lastPersistenceError: null,
})

export const assignPersistenceError = (error: string) =>
  assign({
    lastPersistenceError: error,
    inFlightHandId: null,
    optimisticCard: null,
  })

export const assignPendingPassTurn = assign({
  pendingPassTurn: true,
})

export const clearPendingPassTurn = assign({
  pendingPassTurn: false,
})
