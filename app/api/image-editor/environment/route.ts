import { NextRequest, NextResponse } from 'next/server'
import { checkEnvironment } from '@/lib/image-editor-env'
import fs from 'fs/promises'

/**
 * GET /api/image-editor/environment
 * Verify development mode and file system access
 */
export async function GET(request: NextRequest) {
  try {
    const config = checkEnvironment()

    // Check if decks directory exists and is accessible
    let decksAccessible = false
    let decksExists = false

    try {
      const decksStat = await fs.stat(config.decksPath)
      decksExists = true
      decksAccessible = decksStat.isDirectory()
    }
    catch (error) {
      console.warn('Decks directory not accessible:', error)
    }

    const isFullyAvailable = config.isLocalImageEditorEnabled
      && config.isDevelopmentMode
      && decksExists
      && decksAccessible

    return NextResponse.json({
      environment: {
        nodeEnv: process.env.NODE_ENV,
        isDevelopment: config.isDevelopmentMode,
        localImageEditorEnabled: config.isLocalImageEditorEnabled,
        available: isFullyAvailable,
      },
      fileSystem: {
        decksPath: config.decksPath,
        decksExists,
        decksAccessible,
        allowedPaths: config.allowedPaths,
      },
      config: {
        maxFileSize: config.maxFileSize,
        maxFileSizeMB: Math.round(config.maxFileSize / (1024 * 1024)),
      },
      status: isFullyAvailable ? 'ready' : 'unavailable',
      message: isFullyAvailable
        ? 'Local image editor is fully available'
        : 'Local image editor is not available - check environment and file system access',
    })
  }
  catch (error) {
    console.error('Error checking environment:', error)
    return NextResponse.json(
      { error: 'Failed to check environment' },
      { status: 500 },
    )
  }
}
