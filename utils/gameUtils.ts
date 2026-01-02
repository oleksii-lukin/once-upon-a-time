import { Database } from '@/supabase/types'

type CardData = Database['public']['Tables']['cards']['Row'] & { type?: string }
type PartialCardData = Partial<CardData> & { type?: string }

export function getLocalizedCardContent(card: PartialCardData, language: string) {
  if (!card.translations) {
    return {
      name: card.name,
      description: card.description,
      type: card.type || card.category || 'Card',
    }
  }

  const translations = card.translations as Record<string, { name?: string, description?: string } | undefined>
  const localized = translations[language]

  if (localized) {
    return {
      name: localized.name || card.name,
      description: localized.description || card.description,
      type: card.type || card.category || 'Card',
    }
  }

  return {
    name: card.name,
    description: card.description,
    type: card.type || card.category || 'Card',
  }
}
