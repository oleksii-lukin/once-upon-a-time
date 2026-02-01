import { NextRequest, NextResponse } from 'next/server'
import { withEnvironmentGuard, EnvironmentConfig } from '@/lib/image-editor-env'
import { fileSystemHandler } from '@/lib/file-system-handler'

// Type for deck response data
export interface ApiDeckResponse {
  name: string
  path: string
  cardCount: number
  categories: string[]
  deckImages: number // API returns count, not array
  lastModified: string // ISO date string
  error?: string // Only present if there was an error
}

/**
 * GET /api/image-editor/decks
 * List available decks from specs/decks/ directory
 */
async function handleGetDecks(request: NextRequest, config: EnvironmentConfig) {
  try {
    // Get deck names using the file system handler
    const deckNames = await fileSystemHandler.listDecks()

    // Get detailed info for each deck
    const decks = await Promise.all(
      deckNames.map(async (deckName) => {
        try {
          const deckStructure = await fileSystemHandler.readDeckStructure(deckName)
          return {
            name: deckStructure.deck.name,
            path: deckStructure.deck.path,
            cardCount: deckStructure.deck.cardCount,
            categories: deckStructure.deck.categories,
            deckImages: deckStructure.deck.deckImages.length,
            lastModified: deckStructure.deck.lastModified.toISOString(),
          }
        }
        catch (error) {
          console.error(`Error reading deck ${deckName}:`, error)
          return {
            name: deckName,
            path: `${config.decksPath}/${deckName}`,
            cardCount: 0,
            categories: [],
            deckImages: 0,
            lastModified: new Date().toISOString(),
            error: 'Failed to read deck information',
          }
        }
      }),
    )

    return NextResponse.json({
      decks,
      total: decks.length,
      decksPath: config.decksPath,
      summary: {
        totalDecks: decks.length,
        totalCards: decks.reduce((sum, deck) => sum + deck.cardCount, 0),
        totalDeckImages: decks.reduce((sum, deck) => sum + deck.deckImages, 0),
        allCategories: [...new Set(decks.flatMap(deck => deck.categories))],
      },
    })
  }
  catch (error) {
    console.error('Error listing decks:', error)
    return NextResponse.json(
      { error: 'Failed to list decks' },
      { status: 500 },
    )
  }
}

export const GET = withEnvironmentGuard(handleGetDecks)
