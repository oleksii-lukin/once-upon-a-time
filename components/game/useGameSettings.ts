'use client'

import { useMemo } from 'react'
import { LobbySettingsSchema, defaultLobbySettings } from '@/types/model'

export interface ToggleSetting {
  isEnabled: boolean
  duration: number
}

export interface GameSettings {
  /** Per-turn countdown timer */
  timer: ToggleSetting
  /** Pacing delay before card confirmation */
  pacing: ToggleSetting
  /** Whether the video-chat sidebar is active */
  enableVideoChat: boolean
}

/**
 * Parses `lobby.settings` exactly once into the three derived values the
 * game screen needs (timer, pacing delay, video chat). Falls back to
 * defaults when the settings blob is missing or invalid.
 */
export function useGameSettings(settings: unknown): GameSettings {
  return useMemo(() => {
    const fallback: GameSettings = {
      timer: { isEnabled: false, duration: 0 },
      pacing: { isEnabled: false, duration: 0 },
      enableVideoChat: defaultLobbySettings.enableVideoChat,
    }

    if (!settings || typeof settings !== 'object') return fallback

    const parsed = LobbySettingsSchema.safeParse(settings)
    if (!parsed.success) return fallback

    return {
      timer: {
        isEnabled: parsed.data.timerPerTurn,
        duration: parsed.data.timerPerTurn ? parsed.data.timerPerTurnDuration : 0,
      },
      pacing: {
        isEnabled: parsed.data.enablePacingDelay,
        duration: parsed.data.enablePacingDelay ? parsed.data.pacingDelayDuration : 0,
      },
      enableVideoChat: parsed.data.enableVideoChat,
    }
  }, [settings])
}
