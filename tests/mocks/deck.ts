import { CardData } from '@/utils/gameUtils'

export const MOCK_CATEGORIES = [
  'antagonist',
  'catalyst',
  'object',
  'protagonist',
  'setting',
  'trait',
  'ending'
] as const

export const createMockDeck = (): CardData[] => {
  const cards: CardData[] = []

  MOCK_CATEGORIES.forEach((category) => {
    for (let i = 1; i <= 5; i++) {
      cards.push({
        id: `card-${category}-${i}`,
        deck_id: 'mock-deck-id',
        name: `${category} Card ${i}`,
        description: `Description for ${category} card ${i}`,
        type: category === 'ending' ? 'ending' : 'story',
        category: category === 'ending' ? null : category,
        usage_examples: `Usage example for ${category} card ${i}`,
        translations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        image_url: null,
      } as CardData)
    }
  })

  return cards
}

export const mockDeck = createMockDeck()
