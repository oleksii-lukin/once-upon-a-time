import { z } from 'zod'
import { Database } from '@/supabase/types'

// --- Layout & Positioning ---

export const LayoutElementSchema = z.object({
  top: z.number().min(0).max(100),
  left: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
  preserveRatio: z.boolean().optional().default(false),
})

export type LayoutElement = z.infer<typeof LayoutElementSchema>

export const CardLayoutSchema = z.object({
  name: LayoutElementSchema,
  image: LayoutElementSchema,
  icon: LayoutElementSchema,
})

export type CardLayout = z.infer<typeof CardLayoutSchema>

export const defaultCardLayout: CardLayout = {
  name: { top: 7, left: 12, width: 76, height: 12, preserveRatio: false },
  image: { top: 30, left: 14, width: 72, height: 55, preserveRatio: false },
  icon: { top: 3.5, left: 3.5, width: 12, height: 12, preserveRatio: false },
}

export function parseCardLayout(data: unknown): CardLayout {
  const result = CardLayoutSchema.safeParse(data)
  return result.success ? result.data : defaultCardLayout
}

// --- Enums & Schemas ---

export const CardCategorySchema = z.enum([
  'protagonist',
  'antagonist',
  'setting',
  'object',
  'catalyst',
  'trait',
  'ending',
])

export type CardCategory = z.infer<typeof CardCategorySchema>

export const CardTypeSchema = z.enum(['story', 'ending'])

export type CardType = z.infer<typeof CardTypeSchema>

export const TranslationEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  usage_examples: z.string(),
})

export const CardTranslationsSchema = z.record(
  z.string().regex(/^[a-z]{2}$/), // strict 2-char lang code
  TranslationEntrySchema,
)

export type TranslationEntry = z.infer<typeof TranslationEntrySchema>
export type CardTranslations = z.infer<typeof CardTranslationsSchema>

// --- Strict Database Types ---

// Base Card Row from Supabase
type DbCardRow = Database['public']['Tables']['cards']['Row']

/**
 * Strict Card type that overrides generic JSON/nullable fields from the DB generator
 * with strict application-level types enforced by Zod and pg_jsonschema.
 */
export type Card = Omit<DbCardRow, 'category' | 'translations' | 'type'> & {
  category: CardCategory
  type: CardType
  translations: CardTranslations | null
}

// Re-export specific fields if needed for simpler imports
export type DbDeck = Database['public']['Tables']['decks']['Row']
export type DbLobby = Database['public']['Tables']['lobbies']['Row']

/**
 * Strict Deck type with typed layout and category images
 */
export type Deck = Omit<DbDeck, 'card_layout' | 'category_images'> & {
  card_layout: CardLayout | null
  category_images: Record<string, string> | null
}

// --- Lobby Extensions ---

export const LobbySettingsSchema = z.object({
  allowHotJoin: z.boolean().default(true),
  publicGame: z.boolean().default(true),
  allowSpectators: z.boolean().default(true),
  allowInterrupts: z.boolean().default(true),
  timerPerTurn: z.boolean().default(false),
  timerPerTurnDuration: z.number().min(10).max(120).default(30),
  happyEnding: z.boolean().default(false),
  enableVideoChat: z.boolean().default(false),
  enablePacingDelay: z.boolean().default(false),
  pacingDelayDuration: z.number().min(3).max(30).default(10),
  gameMode: z.enum(['main', 'fast', 'tutorial', 'solo', 'simple', 'full']).default('main'),
  selectedDecks: z.array(z.string()).default([]),
})

export type LobbySettings = z.infer<typeof LobbySettingsSchema>

export const defaultLobbySettings: LobbySettings = LobbySettingsSchema.parse({})

/**
 * Strict Lobby type with typed settings
 */
export type Lobby = Omit<DbLobby, 'settings'> & {
  settings: LobbySettings
}

/**
 * Common join type for lobbies with player counts
 */
export type LobbyWithPlayerCount = Lobby & {
  players: { count: number }[]
}

// --- Played Cards Extensions ---

export type PlayedCard = Database['public']['Tables']['played_cards']['Row']
export type PlayedCardWithCard = PlayedCard & {
  cards: Card
}
