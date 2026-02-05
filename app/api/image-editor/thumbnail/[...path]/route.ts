import { NextRequest, NextResponse } from 'next/server'
import { withEnvironmentGuard, EnvironmentConfig } from '@/lib/image-editor-env'
import { fileSystemHandler } from '@/lib/file-system-handler'
import path from 'path'
import { lookup } from 'mime-types'
import sharp from 'sharp'

interface RouteParams {
  params: Promise<{ path: string[] }>
}

/**
 * GET /api/image-editor/thumbnail/[...path]
 * Generate and serve thumbnails for local images
 * Query params: width (default: 200), height (default: 200), quality (default: 80)
 * Example: /api/image-editor/thumbnail/default/Border.jpg?width=150&height=150
 */
async function handleThumbnail(
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

    // Get query parameters for thumbnail size and quality
    const url = new URL(request.url)
    const width = parseInt(url.searchParams.get('width') || '200')
    const height = parseInt(url.searchParams.get('height') || '200')
    const quality = parseInt(url.searchParams.get('quality') || '80')

    // Validate parameters
    if (width < 1 || width > 1000 || height < 1 || height > 1000) {
      return NextResponse.json(
        { error: 'Invalid dimensions. Width and height must be between 1 and 1000 pixels' },
        { status: 400 },
      )
    }

    if (quality < 1 || quality > 100) {
      return NextResponse.json(
        { error: 'Invalid quality. Quality must be between 1 and 100' },
        { status: 400 },
      )
    }

    // Build the full file path
    const requestedPath = path.join(config.decksPath, ...pathSegments)

    // Validate and read the file
    const pathInfo = await fileSystemHandler.validateAndResolvePath(requestedPath)

    if (!pathInfo.isValid) {
      return NextResponse.json(
        { error: 'Access denied - path outside allowed directories' },
        { status: 403 },
      )
    }

    if (!pathInfo.exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 },
      )
    }

    // Check if it's an image file
    const mimeType = lookup(requestedPath)
    if (!mimeType || !mimeType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File is not an image' },
        { status: 400 },
      )
    }

    // Read the original image
    const imageBuffer = await fileSystemHandler.readImageFile(requestedPath)

    // Generate thumbnail using Sharp
    let thumbnailBuffer: Buffer

    try {
      thumbnailBuffer = await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'inside', // Maintain aspect ratio
          withoutEnlargement: true, // Don't enlarge smaller images
        })
        .jpeg({ quality }) // Convert to JPEG for smaller file size
        .toBuffer()
    }
    catch (sharpError) {
      console.error('Error processing image with Sharp:', sharpError)
      return NextResponse.json(
        { error: 'Failed to process image' },
        { status: 500 },
      )
    }

    // Create response with proper headers
    const response = new NextResponse(new Uint8Array(thumbnailBuffer))
    response.headers.set('Content-Type', 'image/jpeg')
    response.headers.set('Content-Length', thumbnailBuffer.length.toString())
    response.headers.set('Cache-Control', 'public, max-age=86400') // Cache for 24 hours

    // Add custom headers for thumbnail info
    response.headers.set('X-Thumbnail-Width', width.toString())
    response.headers.set('X-Thumbnail-Height', height.toString())
    response.headers.set('X-Thumbnail-Quality', quality.toString())
    response.headers.set('X-Original-File', path.basename(requestedPath))

    return response
  }
  catch (error) {
    console.error('Error generating thumbnail:', error)

    if (error instanceof Error) {
      if (error.message.includes('File not found')) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 },
        )
      }

      if (error.message.includes('Invalid file path')) {
        return NextResponse.json(
          { error: 'Access denied - invalid file path' },
          { status: 403 },
        )
      }

      if (error.message.includes('too large')) {
        return NextResponse.json(
          { error: 'File too large to process' },
          { status: 413 },
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate thumbnail' },
      { status: 500 },
    )
  }
}

// Create a wrapper that handles the environment guard and route params
export async function GET(request: NextRequest, context: RouteParams) {
  const guardedHandler = withEnvironmentGuard(async (req, config) => {
    return handleThumbnail(req, config, context)
  })

  return guardedHandler(request)
}
