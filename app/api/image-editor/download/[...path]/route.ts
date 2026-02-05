import { NextRequest, NextResponse } from 'next/server'
import { withEnvironmentGuard, EnvironmentConfig } from '@/lib/image-editor-env'
import { fileSystemHandler } from '@/lib/file-system-handler'
import { securityValidator } from '@/lib/security-validator'
import { securityLogger, extractRequestInfo } from '@/lib/security-logger'
import path from 'path'
import { lookup } from 'mime-types'

interface RouteParams {
  params: Promise<{ path: string[] }>
}

/**
 * GET /api/image-editor/download/[...path]
 * Download image file with proper download headers and enhanced security
 * Example: /api/image-editor/download/default/Border.jpg
 */
async function handleDownloadImage(
  request: NextRequest,
  config: EnvironmentConfig,
  context: RouteParams,
) {
  const requestId = securityLogger.generateRequestId()
  const { userAgent, ip } = extractRequestInfo(request)

  try {
    // Get the path parameters
    const { path: pathSegments } = await context.params

    if (!pathSegments || pathSegments.length === 0) {
      securityLogger.logValidationError('path', pathSegments, 'No file path provided', requestId)
      return NextResponse.json(
        { error: 'No file path provided' },
        { status: 400 },
      )
    }

    // Build the full file path
    const requestedPath = path.join(config.decksPath, ...pathSegments)

    // Validate the file path using security validator
    const pathValidation = securityValidator.validateFilePath(requestedPath, requestId)
    if (!pathValidation.isValid) {
      securityLogger.log({
        level: 'warn',
        category: 'validation',
        event: 'download_path_validation_failed',
        requestId,
        details: {
          requestedPath,
          pathSegments,
          errors: pathValidation.errors,
          securityViolations: pathValidation.securityViolations,
        },
      })

      if (pathValidation.securityViolations.length > 0) {
        return NextResponse.json(
          { error: 'Access denied - security validation failed' },
          { status: 403 },
        )
      }
      else {
        return NextResponse.json(
          { error: 'Invalid file path' },
          { status: 400 },
        )
      }
    }

    // Validate and read the file
    const pathInfo = await fileSystemHandler.validateAndResolvePath(requestedPath)

    if (!pathInfo.isValid) {
      securityLogger.logFileAccessViolation(
        requestedPath,
        'Path validation failed',
        requestId,
        userAgent,
        ip,
      )
      return NextResponse.json(
        { error: 'Access denied - path outside allowed directories' },
        { status: 403 },
      )
    }

    if (!pathInfo.exists) {
      securityLogger.log({
        level: 'info',
        category: 'file_access',
        event: 'download_file_not_found',
        requestId,
        details: {
          requestedPath,
          pathSegments,
        },
      })

      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 },
      )
    }

    // Log file access attempt
    securityLogger.logFileOperation(
      'read',
      requestedPath,
      false, // Will update to true on success
      undefined,
      requestId,
    )

    // Read the file
    const imageBuffer = await fileSystemHandler.readImageFile(requestedPath)

    // Get file stats
    const fs = await import('fs/promises')
    const fileStats = await fs.stat(pathInfo.absolute)

    // Determine MIME type and filename
    const mimeType = lookup(requestedPath) || 'application/octet-stream'
    const filename = path.basename(requestedPath)

    // Validate it's an image
    if (!mimeType.startsWith('image/')) {
      securityLogger.log({
        level: 'warn',
        category: 'validation',
        event: 'download_non_image_file',
        requestId,
        details: {
          requestedPath,
          mimeType,
          filename,
        },
      })

      return NextResponse.json(
        { error: 'File is not an image' },
        { status: 400 },
      )
    }

    // Log successful file operation
    securityLogger.logFileOperation(
      'read',
      requestedPath,
      true,
      undefined,
      requestId,
    )

    securityLogger.log({
      level: 'info',
      category: 'file_access',
      event: 'image_downloaded',
      requestId,
      details: {
        filename,
        size: fileStats.size,
        mimeType,
        requestedPath: securityLogger.generateRequestId(), // Use a clean path for logging
      },
    })

    // Create response with download headers
    const response = new NextResponse(new Uint8Array(imageBuffer))
    response.headers.set('Content-Type', mimeType)
    response.headers.set('Content-Length', fileStats.size.toString())
    response.headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    response.headers.set('Cache-Control', 'no-cache')

    return response
  }
  catch (error) {
    securityLogger.log({
      level: 'error',
      category: 'api',
      event: 'download_image_error',
      requestId,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    })

    if (error instanceof Error) {
      if (error.message.includes('File not found')) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 },
        )
      }

      if (error.message.includes('Invalid file path') || error.message.includes('Access denied')) {
        return NextResponse.json(
          { error: 'Access denied - invalid file path' },
          { status: 403 },
        )
      }

      if (error.message.includes('too large')) {
        return NextResponse.json(
          { error: 'File too large to download' },
          { status: 413 },
        )
      }

      if (error.message.includes('corrupted') || error.message.includes('invalid file signature') || error.message.includes('not an image')) {
        return NextResponse.json(
          { error: 'File is not an image' },
          { status: 400 },
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to download image' },
      { status: 500 },
    )
  }
}

// Create a wrapper that handles the environment guard and route params
export async function GET(request: NextRequest, context: RouteParams) {
  const guardedHandler = withEnvironmentGuard(async (req, config) => {
    return handleDownloadImage(req, config, context)
  })

  return guardedHandler(request)
}
