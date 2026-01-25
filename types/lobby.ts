import { z } from 'zod'

export type GameMode = 'tutorial' | 'simple' | 'full' | 'solo' | 'main' | 'fast'

export const LobbySettingsSchema = z.object({
  allowHotJoin: z.boolean().default(true),
  publicGame: z.boolean().default(true),
  allowSpectators: z.boolean().default(true),
  allowInterrupts: z.boolean().default(true),
  timerPerTurn: z.boolean().default(false),
  happyEnding: z.boolean().default(false),
  enableVideoChat: z.boolean().default(false),
  enablePacingDelay: z.boolean().default(false),
  pacingDelayDuration: z.number().min(3).max(30).default(5),
  gameMode: z.enum(['main', 'fast', 'tutorial', 'solo', 'simple', 'full']).default('main'),
  selectedDecks: z.array(z.string()).default([]),
})

export type LobbySettings = z.infer<typeof LobbySettingsSchema>

export const defaultLobbySettings: LobbySettings = LobbySettingsSchema.parse({})
