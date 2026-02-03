import { Database } from '@/supabase/types'

export type CardData = Omit<Database['public']['Tables']['cards']['Row'], 'category'> & {
  category: 'protagonist' | 'antagonist' | 'setting' | 'object' | 'catalyst' | 'trait' | 'ending'
}
export type PartialCardData = Partial<CardData>

/**
 * Extended card interfaces for different contexts
 * These interfaces extend the base CardData with additional properties
 * from joined tables or computed values used in the UI components.
 */

/**
 * Card data as it appears in a player's hand
 * Includes properties from the player_hands table
 */
export interface HandCardData extends CardData {
  /** The hand record ID from player_hands table */
  hand_id: string
  /** The position of the card in the hand */
  position?: number
}

/**
 * Card data as it appears in the played cards area
 * Includes properties from the played_cards table
 */
export interface PlayedCardData extends CardData {
  /** The player ID who played this card */
  played_by: string
  /** The status of the played card (PENDING, CONFIRMED, REVERTED) */
  status: Database['public']['Enums']['played_card_status'] | null
  /** The played card record ID from played_cards table */
  played_card_id: string
}

export function getLocalizedCardContent(card: PartialCardData, language: string) {
  if (card.translations) {
    const translations = (card.translations || {}) as Record<string, { name?: string, description?: string, usage_examples?: string } | undefined>
    const localized = translations[language]

    if (localized) {
      return {
        name: localized.name || card.name || '',
        description: localized.description || card.description,
        usage_examples: localized.usage_examples || card.usage_examples,
        type: card.category,
      }
    }
  }

  return {
    name: card.name ?? '',
    description: card.description,
    usage_examples: card.usage_examples,
    type: card.category,
  }
}

export function normalizeTypeKey(raw?: string) {
  const s = (raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const map: Record<string, string> = {
    endings: 'ending',
    ending: 'ending',
    catalysts: 'catalyst',
    catalyst: 'catalyst',
    characters: 'character',
    character: 'character',
    protagonists: 'protagonist',
    protagonist: 'protagonist',
    antagonists: 'antagonist',
    antagonist: 'antagonist',
    settings: 'setting',
    setting: 'setting',
    objects: 'object',
    object: 'object',
    traits: 'trait',
    trait: 'trait',
    aspects: 'aspect',
    aspect: 'aspect',
    card: 'card',
  }
  return map[s] || 'card'
}
