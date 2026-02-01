import { NextRequest, NextResponse } from 'next/server'
import { withEnvironmentGuard, EnvironmentConfig } from '@/lib/image-editor-env'
import { fileSystemHandler, FileSystemError, ImageValidationError } from '@/lib/file-system-handler'
import { securityValidator } from '@/lib/security-validator'
import { securityLogger } from '@/lib/security-logger'
import path from 'path'
import sharp from 'sharp'

/**
 * POST /api/image-editor/save-as
 * Save edited image as a new file with enhanced security validation
 */
async function handleSaveAsImage(request: NextRequest, config: EnvironmentConfig) {
  const requestId = securityLogger.generateRequestId()

  try {
    // Parse the request body
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const originalPath = formData.get('originalPath') as string
    const newFilename = formData.get('newFilename') as string
    const directory = formData.get('directory') as string
    const format = formData.get('format') as string || 'png'
    const quality = formData.get('quality') as string || '0.9'

    // Validate request parameters
    const paramValidation = securityValidator.validateRequestParams({
      originalPath,
      newFilename,
      directory,
      format,
      quality,
    }, requestId)

    if (!paramValidation.isValid) {
      securityLogger.log({
        level: 'warn',
        category: 'validation',
        event: 'request_validation_failed',
        requestId,
        details: {
          errors: paramValidation.errors,
          securityViolations: paramValidation.securityViolations,
        },
      })

      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: paramValidation.errors,
          securityViolations: paramValidation.securityViolations.length > 0 ? ['Security validation failed'] : undefined,
        },
        { status: 400 },
      )
    }

    // Use sanitized parameters
    const sanitizedParams = paramValidation.sanitizedData

    if (!imageFile) {
      securityLogger.logValidationError('image', null, 'No image file provided', requestId)
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 },
      )
    }

    if (!sanitizedParams.newFilename) {
      securityLogger.logValidationError('newFilename', newFilename, 'No new filename provided', requestId)
      return NextResponse.json(
        { error: 'No new filename provided' },
        { status: 400 },
      )
    }

    // Determine the target directory
    let targetDirectory: string

    if (sanitizedParams.directory) {
      // Use provided directory
      targetDirectory = sanitizedParams.directory
    }
    else if (sanitizedParams.originalPath) {
      // Use same directory as original file
      const originalPathInfo = await fileSystemHandler.validateAndResolvePath(sanitizedParams.originalPath)
      targetDirectory = path.dirname(originalPathInfo.absolute)
    }
    else {
      securityLogger.logValidationError(
        'directory',
        { directory, originalPath },
        'Either directory or originalPath must be provided',
        requestId,
      )
      return NextResponse.json(
        { error: 'Either directory or originalPath must be provided' },
        { status: 400 },
      )
    }

    // Build the new file path
    const newFilePath = path.join(targetDirectory, sanitizedParams.newFilename)

    // Validate the new file path
    const newPathValidation = securityValidator.validateFilePath(newFilePath, requestId)
    if (!newPathValidation.isValid) {
      securityLogger.log({
        level: 'warn',
        category: 'validation',
        event: 'new_file_path_validation_failed',
        requestId,
        details: {
          filePath: newFilePath,
          errors: newPathValidation.errors,
          securityViolations: newPathValidation.securityViolations,
        },
      })

      return NextResponse.json(
        {
          error: 'Invalid new file path',
          details: newPathValidation.errors,
          securityViolations: newPathValidation.securityViolations.length > 0 ? ['Path security validation failed'] : undefined,
        },
        { status: 403 },
      )
    }

    // Convert file to buffer
    const arrayBuffer = await imageFile.arrayBuffer()
    let imageBuffer = Buffer.from(arrayBuffer) as Buffer

    // Validate image data
    const imageValidation = securityValidator.validateImageData(imageBuffer, imageFile.name, requestId)
    if (!imageValidation.isValid) {
      securityLogger.log({
        level: 'warn',
        category: 'validation',
        event: 'image_validation_failed',
        requestId,
        details: {
          filename: imageFile.name,
          size: imageBuffer.length,
          errors: imageValidation.errors,
          securityViolations: imageValidation.securityViolations,
        },
      })

      return NextResponse.json(
        {
          error: 'Invalid image data',
          details: imageValidation.errors,
          securityViolations: imageValidation.securityViolations.length > 0 ? ['Image security validation failed'] : undefined,
        },
        { status: 422 },
      )
    }

    // Validate file size before optimization
    if (imageBuffer.length > config.maxFileSize) {
      securityLogger.logValidationError(
        'fileSize',
        imageBuffer.length,
        `File too large: ${imageBuffer.length} bytes (max: ${config.maxFileSize})`,
        requestId,
      )
      return NextResponse.json(
        { error: `Image too large: ${imageBuffer.length} bytes (max: ${config.maxFileSize})` },
        { status: 413 },
      )
    }

    // Optimize image if needed (file size optimization)
    const originalSize = imageBuffer.length
    imageBuffer = await optimizeImageBuffer(
      imageBuffer,
      sanitizedParams.format || 'png',
      parseFloat(sanitizedParams.quality || '0.9'),
      config.maxFileSize,
    )
    const compressionRatio = originalSize > 0 ? imageBuffer.length / originalSize : 1

    // Check if new file already exists
    const pathInfo = await fileSystemHandler.validateAndResolvePath(newFilePath)

    if (pathInfo.exists) {
      securityLogger.log({
        level: 'info',
        category: 'file_access',
        event: 'file_already_exists',
        requestId,
        details: {
          newFilePath,
          filename: sanitizedParams.newFilename,
        },
      })

      return NextResponse.json(
        { error: `File already exists: ${sanitizedParams.newFilename}` },
        { status: 409 },
      )
    }

    // Log file operation attempt
    securityLogger.logFileOperation(
      'create',
      newFilePath,
      false, // Will update to true on success
      undefined,
      requestId,
    )

    // Save the image with new name
    await fileSystemHandler.writeImageFile(newFilePath, imageBuffer)

    // Log successful file operation
    securityLogger.logFileOperation(
      'create',
      newFilePath,
      true,
      undefined,
      requestId,
    )

    // Get file info
    const stats = await import('fs/promises').then(fs => fs.stat(pathInfo.absolute))

    securityLogger.log({
      level: 'info',
      category: 'file_access',
      event: 'image_saved_as',
      requestId,
      details: {
        originalPath: sanitizedParams.originalPath,
        newFilePath,
        filename: sanitizedParams.newFilename,
        originalSize,
        finalSize: imageBuffer.length,
        compressionRatio,
        format: sanitizedParams.format,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Image saved as new file successfully',
      file: {
        path: newFilePath,
        filename: sanitizedParams.newFilename,
        directory: targetDirectory,
        size: imageBuffer.length,
        originalSize,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        format: sanitizedParams.format,
        quality: sanitizedParams.format === 'jpeg' ? sanitizedParams.quality : undefined,
        lastModified: stats.mtime.toISOString(),
      },
    })
  }
  catch (error) {
    securityLogger.log({
      level: 'error',
      category: 'api',
      event: 'save_as_image_error',
      requestId,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    })

    // Handle custom file system errors
    if (error instanceof FileSystemError) {
      const statusMap: Record<string, number> = {
        INVALID_PATH: 403,
        FILE_NOT_FOUND: 404,
        PERMISSION_DENIED: 403,
        FILE_TOO_LARGE: 413,
        DATA_TOO_LARGE: 413,
        NO_SPACE: 507,
        READ_ONLY: 403,
        TOO_MANY_FILES: 503,
        FILE_EXISTS: 409,
        EMPTY_DATA: 400,
        NOT_A_FILE: 400,
        DIRECTORY_ACCESS: 403,
      }

      const status = statusMap[error.code] || 500
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status },
      )
    }

    // Handle image validation errors
    if (error instanceof ImageValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
          type: 'validation_error',
        },
        { status: 422 },
      )
    }

    // Handle network/connection errors
    if (error instanceof Error) {
      if (error.message.includes('ECONNRESET')
        || error.message.includes('ECONNABORTED')
        || error.message.includes('ETIMEDOUT')) {
        return NextResponse.json(
          {
            error: 'Network connection interrupted. Please check your connection and try again.',
            code: 'NETWORK_ERROR',
            details: { originalError: error.message },
            retryable: true,
          },
          { status: 503 },
        )
      }

      if (error.message.includes('Request timeout') || error.message.includes('timeout')) {
        return NextResponse.json(
          {
            error: 'Request timed out. The file may be too large or the server is busy. Please try again.',
            code: 'TIMEOUT_ERROR',
            details: { originalError: error.message },
            retryable: true,
          },
          { status: 408 },
        )
      }
    }

    // Generic error fallback
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while saving the image. Please try again.',
        code: 'INTERNAL_ERROR',
        details: {
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 },
    )
  }
}

/**
 * Optimize image buffer for file size while maintaining quality
 */
async function optimizeImageBuffer(
  buffer: Buffer,
  format: string,
  quality: number,
  maxFileSize: number,
): Promise<Buffer> {
  try {
    // Validate input parameters
    if (!buffer || buffer.length === 0) {
      throw new Error('Invalid image buffer: buffer is empty')
    }

    if (quality < 0 || quality > 1) {
      throw new Error(`Invalid quality parameter: ${quality}. Must be between 0 and 1`)
    }

    // Normalize format
    const normalizedFormat = format.toLowerCase().replace('jpg', 'jpeg')

    // Create Sharp instance
    let sharpInstance = sharp(buffer)

    // Remove metadata for privacy and file size reduction
    sharpInstance = sharpInstance.withMetadata({})

    // Configure output format and quality
    switch (normalizedFormat) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({
          quality: Math.round(quality * 100),
          progressive: true,
          mozjpeg: true,
        })
        break

      case 'png':
        sharpInstance = sharpInstance.png({
          compressionLevel: Math.round((1 - quality) * 9), // Invert quality for PNG
          progressive: true,
          adaptiveFiltering: true,
        })
        break

      case 'webp':
        sharpInstance = sharpInstance.webp({
          quality: Math.round(quality * 100),
          effort: 6, // Maximum effort for best compression
        })
        break

      default:
        // If format is not supported, fall back to original buffer
        console.warn(`Unsupported format: ${format}, returning original buffer`)
        return buffer
    }

    // Generate optimized buffer
    let optimizedBuffer = await sharpInstance.toBuffer()

    // Progressive optimization: if still too large, try more aggressive compression
    if (optimizedBuffer.length > maxFileSize) {
      console.warn(`Initial optimization still too large: ${optimizedBuffer.length} bytes, applying aggressive compression`)

      // Try with lower quality for JPEG/WebP
      if (normalizedFormat === 'jpeg' || normalizedFormat === 'webp') {
        const aggressiveQuality = Math.max(10, Math.round(quality * 50))

        if (normalizedFormat === 'jpeg') {
          sharpInstance = sharp(buffer).jpeg({
            quality: aggressiveQuality,
            progressive: true,
            mozjpeg: true,
          })
        }
        else {
          sharpInstance = sharp(buffer).webp({
            quality: aggressiveQuality,
            effort: 6,
          })
        }

        optimizedBuffer = await sharpInstance.toBuffer()
      }
      // For PNG, try maximum compression
      else if (normalizedFormat === 'png') {
        sharpInstance = sharp(buffer).png({
          compressionLevel: 9,
          progressive: true,
          adaptiveFiltering: true,
        })
        optimizedBuffer = await sharpInstance.toBuffer()
      }
    }

    // Final size check
    if (optimizedBuffer.length > maxFileSize) {
      throw new Error(`Optimized image still too large: ${optimizedBuffer.length} bytes (max: ${maxFileSize})`)
    }

    // Log optimization results
    const compressionRatio = buffer.length > 0 ? optimizedBuffer.length / buffer.length : 1
    console.log(`Image optimization successful: ${buffer.length} → ${optimizedBuffer.length} bytes (${Math.round(compressionRatio * 100)}% of original, format: ${normalizedFormat})`)

    return optimizedBuffer
  }
  catch (error) {
    // If Sharp fails, log the error and return original buffer
    console.error('Image optimization failed:', error instanceof Error ? error.message : error)

    // Only return original buffer if it's within size limits
    if (buffer.length <= maxFileSize) {
      console.warn('Falling back to original buffer due to optimization failure')
      return buffer
    }

    // If original buffer is also too large, throw the error
    throw new Error(`Image optimization failed and original buffer is too large: ${buffer.length} bytes (max: ${maxFileSize}). Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export const POST = withEnvironmentGuard(handleSaveAsImage)
