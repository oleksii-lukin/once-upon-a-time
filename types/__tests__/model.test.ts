import { describe, it, expect } from 'vitest'
import { LobbySettingsSchema, defaultLobbySettings } from '../model'

/**
 * Boundary tests for the lobby settings schema: the pacing/timer durations
 * must accept exactly their documented ranges (game-rules.md §6) and reject
 * values one step outside them.
 */
describe('LobbySettingsSchema boundaries', () => {
  it('accepts the pacing delay boundaries (3–30s)', () => {
    expect(LobbySettingsSchema.safeParse({ enablePacingDelay: true, pacingDelayDuration: 3 }).success).toBe(true)
    expect(LobbySettingsSchema.safeParse({ enablePacingDelay: true, pacingDelayDuration: 30 }).success).toBe(true)
    expect(LobbySettingsSchema.safeParse({ pacingDelayDuration: 2 }).success).toBe(false)
    expect(LobbySettingsSchema.safeParse({ pacingDelayDuration: 31 }).success).toBe(false)
  })

  it('accepts the turn timer boundaries (10–120s)', () => {
    expect(LobbySettingsSchema.safeParse({ timerPerTurn: true, timerPerTurnDuration: 10 }).success).toBe(true)
    expect(LobbySettingsSchema.safeParse({ timerPerTurn: true, timerPerTurnDuration: 120 }).success).toBe(true)
    expect(LobbySettingsSchema.safeParse({ timerPerTurnDuration: 9 }).success).toBe(false)
    expect(LobbySettingsSchema.safeParse({ timerPerTurnDuration: 121 }).success).toBe(false)
  })

  it('parses every documented game mode', () => {
    for (const gameMode of ['main', 'fast', 'tutorial', 'solo', 'simple', 'full'] as const) {
      expect(LobbySettingsSchema.safeParse({ gameMode }).success).toBe(true)
    }
    expect(LobbySettingsSchema.safeParse({ gameMode: 'ranked' }).success).toBe(false)
  })

  it('defaults are valid and disable pacing/timer', () => {
    expect(defaultLobbySettings.enablePacingDelay).toBe(false)
    expect(defaultLobbySettings.timerPerTurn).toBe(false)
    expect(defaultLobbySettings.gameMode).toBe('main')
  })
})
