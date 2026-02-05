import { NextRequest, NextResponse } from 'next/server'
import { withEnvironmentGuard, EnvironmentConfig } from '@/lib/image-editor-env'
import { FileSystemError, fileSystemHandler } from '@/lib/file-system-handler'
import path from 'path'

interface RouteParams {
  params: Promise<{ deckName: string }>
}

/**
 * GET /api/image-editor/decks/[deckName]/cards
 * Get list of cards in a specific deck
 */
async function handleGetCards(
  request: NextRequest,
  config: EnvironmentConfig,
  context: RouteParams,
) {
  try {
    const { deckName } = await context.params

    if (!deckName) {
      return NextResponse.json(
        { error: 'Deck name is required' },
        { status: 400 },
      )
    }

    // First validate that the deck exists by checking the deck directory
    const deckPath = path.join(config.decksPath, deckName)
    const deckPathInfo = await fileSystemHandler.validateAndResolvePath(deckPath)

    if (!deckPathInfo.exists) {
      return NextResponse.json(
        { error: `Deck not found: ${deckName}` },
        { status: 404 },
      )
    }

    // Get URL search params for filtering
    const url = new URL(request.url)
    const category = url.searchParams.get('category')

    // Get cards using the file system handler
    let cards = await fileSystemHandler.getCardList(deckName)

    // Filter by category if specified
    if (category) {
      cards = cards.filter(card => card.category === category)
    }

    // Group cards by category for easier frontend consumption
    const cardsByCategory = cards.reduce((acc, card) => {
      if (!acc[card.category]) {
        acc[card.category] = []
      }
      acc[card.category].push(card)
      return acc
    }, {} as Record<string, typeof cards>)

    return NextResponse.json({
      deckName,
      cards,
      cardsByCategory,
      categories: Object.keys(cardsByCategory),
      summary: {
        totalCards: cards.length,
        categoryCounts: Object.entries(cardsByCategory).reduce((acc, [cat, catCards]) => {
          acc[cat] = catCards.length
          return acc
        }, {} as Record<string, number>),
        totalImages: cards.reduce((sum, card) => sum + card.images.length, 0),
      },
    })
  }
  catch (error) {
    console.error(`Error getting cards for deck ${(await context.params).deckName}:`, error)

    if (error instanceof FileSystemError) {
      if (error.message.includes('not found') || error.code === 'DECK_NOT_FOUND') {
        return NextResponse.json(
          { error: `Deck not found: ${(await context.params).deckName}` },
          { status: 404 },
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to get cards' },
      { status: 500 },
    )
  }
}

// Create a wrapper that handles the environment guard and route params
export async function GET(request: NextRequest, context: RouteParams) {
  const guardedHandler = withEnvironmentGuard(async (req, config) => {
    return handleGetCards(req, config, context)
  })

  return guardedHandler(request)
}
