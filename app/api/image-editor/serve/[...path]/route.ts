import { NextRequest, NextResponse } from 'next/server'
import { withEnvironmentGuard, EnvironmentConfig, validatePath } from '@/lib/image-editor-env'
import fs from 'fs/promises'
import path from 'path'
import { lookup } from 'mime-types'
import sharp from 'sharp'

interface RouteParams {
  params: Promise<{ path: string[] }>
}

/**
 * GET /api/image-editor/serve/[...path]
 * Serve local image files with proper headers
 * Example: /api/image-editor/serve/default/Border.jpg
 */
async function handleServeImage(
  request: NextRequest,
  config: EnvironmentConfig,
  context: RouteParams,
) {
  try {
    // Get the path parameters
    const { path: pathSegments } = await context.params

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        { error: 'No file path provided' },
        { status: 400 },
      )
    }

    // Build the full file path
    const requestedPath = path.join(config.decksPath, ...pathSegments)

    // Validate the path is within allowed directories
    if (!validatePath(requestedPath, config)) {
      return NextResponse.json(
        { error: 'Access denied - path outside allowed directories' },
        { status: 403 },
      )
    }

    // Check if file exists
    let fileStats
    try {
      fileStats = await fs.stat(requestedPath)
    }
    catch (error) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 },
      )
    }

    // Ensure it's a file, not a directory
    if (!fileStats.isFile()) {
      return NextResponse.json(
        { error: 'Path is not a file' },
        { status: 400 },
      )
    }

    // Check file size
    if (fileStats.size > config.maxFileSize) {
      return NextResponse.json(
        { error: `File too large (${fileStats.size} bytes, max ${config.maxFileSize})` },
        { status: 413 },
      )
    }

    // Read the file
    const fileBuffer = await fs.readFile(requestedPath)

    // Determine MIME type
    const mimeType = lookup(requestedPath) || 'application/octet-stream'

    // Validate it's an image
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File is not an image' },
        { status: 400 },
      )
    }

    // Get image dimensions using Sharp
    let imageMetadata
    try {
      imageMetadata = await sharp(fileBuffer).metadata()
    }
    catch (error) {
      console.error('Error reading image metadata:', error)
      // Continue without metadata if Sharp fails
      imageMetadata = { width: undefined, height: undefined, format: undefined }
    }

    // Create response with proper headers
    const response = new NextResponse(new Uint8Array(fileBuffer))
    response.headers.set('Content-Type', mimeType)
    response.headers.set('Content-Length', fileStats.size.toString())
    response.headers.set('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    response.headers.set('Last-Modified', fileStats.mtime.toUTCString())

    // Add image dimensions and file information headers (Requirement 7.4)
    if (imageMetadata.width && imageMetadata.height) {
      response.headers.set('X-Image-Width', imageMetadata.width.toString())
      response.headers.set('X-Image-Height', imageMetadata.height.toString())
    }
    response.headers.set('X-File-Name', path.basename(requestedPath))
    response.headers.set('X-File-Size', fileStats.size.toString())
    if (imageMetadata.format) {
      response.headers.set('X-Image-Format', imageMetadata.format)
    }

    return response
  }
  catch (error) {
    console.error('Error serving image:', error)
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 },
    )
  }
}

// Create a wrapper that handles the environment guard and route params
export async function GET(request: NextRequest, context: RouteParams) {
  const guardedHandler = withEnvironmentGuard(async (req, config) => {
    return handleServeImage(req, config, context)
  })

  return guardedHandler(request)
}
