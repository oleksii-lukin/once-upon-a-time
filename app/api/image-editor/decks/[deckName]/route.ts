import { NextRequest, NextResponse } from 'next/server'
import { withEnvironmentGuard, EnvironmentConfig } from '@/lib/image-editor-env'
import { fileSystemHandler, FileSystemError } from '@/lib/file-system-handler'

interface RouteParams {
  params: Promise<{ deckName: string }>
}

/**
 * GET /api/image-editor/decks/[deckName]
 * Get detailed information about a specific deck
 */
async function handleGetDeck(
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

    // Get deck structure using the file system handler
    const deckStructure = await fileSystemHandler.readDeckStructure(deckName)

    return NextResponse.json({
      deck: deckStructure.deck,
      cards: deckStructure.cards,
      deckImages: deckStructure.deckImages,
      summary: {
        totalCards: deckStructure.cards.length,
        categories: deckStructure.deck.categories,
        totalDeckImages: deckStructure.deckImages.length,
        totalCardImages: deckStructure.cards.reduce((sum, card) => sum + card.images.length, 0),
      },
    })
  }
  catch (error) {
    console.error(`Error getting deck ${(await context.params).deckName}:`, error)

    if (error instanceof FileSystemError) {
      if (error.message.includes('not found') || error.code === 'DECK_NOT_FOUND') {
        return NextResponse.json(
          { error: `Deck not found: ${(await context.params).deckName}` },
          { status: 404 },
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to get deck information' },
      { status: 500 },
    )
  }
}

// Create a wrapper that handles the environment guard and route params
export async function GET(request: NextRequest, context: RouteParams) {
  const guardedHandler = withEnvironmentGuard(async (req, config) => {
    return handleGetDeck(req, config, context)
  })

  return guardedHandler(request)
}
