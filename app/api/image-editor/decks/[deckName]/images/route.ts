import { NextRequest, NextResponse } from 'next/server'
import { withEnvironmentGuard, EnvironmentConfig } from '@/lib/image-editor-env'
import { fileSystemHandler } from '@/lib/file-system-handler'

interface RouteParams {
  params: Promise<{ deckName: string }>
}

/**
 * GET /api/image-editor/decks/[deckName]/images
 * Get deck-level images (Border.jpg, GameBoard.jpg, etc.)
 */
async function handleGetDeckImages(
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

    // Get deck images using the file system handler
    const deckImages = await fileSystemHandler.getDeckImages(deckName)

    return NextResponse.json({
      deckName,
      images: deckImages,
      summary: {
        totalImages: deckImages.length,
        totalSize: deckImages.reduce((sum, img) => sum + img.size, 0),
        formats: [...new Set(deckImages.map(img => img.format))],
        imageTypes: deckImages.map(img => ({
          filename: img.filename,
          format: img.format,
          size: img.size,
        })),
      },
    })
  }
  catch (error) {
    console.error(`Error getting deck images for ${(await context.params).deckName}:`, error)

    if (error instanceof Error) {
      if (error.message.includes('Invalid or non-existent')) {
        return NextResponse.json(
          { error: `Deck not found: ${(await context.params).deckName}` },
          { status: 404 },
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to get deck images' },
      { status: 500 },
    )
  }
}

// Create a wrapper that handles the environment guard and route params
export async function GET(request: NextRequest, context: RouteParams) {
  const guardedHandler = withEnvironmentGuard(async (req, config) => {
    return handleGetDeckImages(req, config, context)
  })

  return guardedHandler(request)
}
