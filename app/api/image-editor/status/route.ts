import { NextRequest, NextResponse } from 'next/server'
import { checkEnvironment } from '@/lib/image-editor-env'

/**
 * GET /api/image-editor/status
 * Check if local image editor is enabled and available
 */
export async function GET(request: NextRequest) {
  try {
    const config = checkEnvironment()
    const isAvailable = config.isLocalImageEditorEnabled && config.isDevelopmentMode

    return NextResponse.json({
      enabled: config.isLocalImageEditorEnabled,
      development: config.isDevelopmentMode,
      available: isAvailable,
      decksPath: config.decksPath,
      message: isAvailable
        ? 'Local image editor is available'
        : 'Local image editor is disabled or not in development mode',
    })
  }
  catch (error) {
    console.error('Error checking image editor status:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 },
    )
  }
}
