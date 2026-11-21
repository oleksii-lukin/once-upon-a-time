import { describe, it, expect } from 'vitest'
import {
  shouldApplyRemoteTurnUpdate,
  selectLocalActionInFlight,
  type LocalActionState,
} from '../utils/reconcile'

const cleanLocal: LocalActionState = {
  inFlightHandId: null,
  pendingPassTurn: false,
  pendingConfirmCardId: null,
  persistenceIdle: true,
  isWinning: false,
}

describe('shouldApplyRemoteTurnUpdate', () => {
  it('applies the remote turn when it differs and no local action is in flight', () => {
    expect(shouldApplyRemoteTurnUpdate({
      remoteTurnPlayerId: 'p2',
      machineTurnPlayerId: 'p1',
      hasLocalActionInFlight: false,
    })).toBe(true)
  })

  it('ignores a missing remote value', () => {
    expect(shouldApplyRemoteTurnUpdate({
      remoteTurnPlayerId: null,
      machineTurnPlayerId: 'p1',
      hasLocalActionInFlight: false,
    })).toBe(false)
  })

  it('ignores a remote value that matches the machine', () => {
    expect(shouldApplyRemoteTurnUpdate({
      remoteTurnPlayerId: 'p1',
      machineTurnPlayerId: 'p1',
      hasLocalActionInFlight: false,
    })).toBe(false)
  })

  it('defers to local state while an action is in flight', () => {
    expect(shouldApplyRemoteTurnUpdate({
      remoteTurnPlayerId: 'p2',
      machineTurnPlayerId: 'p1',
      hasLocalActionInFlight: true,
    })).toBe(false)
  })
})

describe('selectLocalActionInFlight', () => {
  it('is idle when nothing is pending', () => {
    expect(selectLocalActionInFlight(cleanLocal)).toBe(false)
  })

  it.each([
    ['optimistic card write in flight', { inFlightHandId: 'hand-1' }],
    ['turn pass queued', { pendingPassTurn: true }],
    ['card confirmation queued', { pendingConfirmCardId: 'pc-1' }],
    ['persistence actor running', { persistenceIdle: false }],
    ['win finalization running', { isWinning: true }],
  ])('reports in-flight for %s', (_label, override) => {
    expect(selectLocalActionInFlight({ ...cleanLocal, ...override })).toBe(true)
  })
})
