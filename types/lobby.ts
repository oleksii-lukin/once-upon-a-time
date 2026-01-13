import { z } from 'zod'

export const LobbySettingsSchema = z.object({
  allowHotJoin: z.boolean().default(true),
  publicGame: z.boolean().default(true),
  allowSpectators: z.boolean().default(true),
  allowInterrupts: z.boolean().default(true),
  timerPerTurn: z.boolean().default(false),
  happyEnding: z.boolean().default(false),
  enableVideoChat: z.boolean().default(false),
  gameMode: z.enum(['main', 'fast', 'tutorial', 'solo']).default('main'),
  selectedDecks: z.array(z.string()).default([]),
})

export type LobbySettings = z.infer<typeof LobbySettingsSchema>

export const defaultLobbySettings: LobbySettings = LobbySettingsSchema.parse({})
