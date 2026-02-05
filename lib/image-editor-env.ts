import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { securityLogger, extractRequestInfo, RequestTimer } from './security-logger'

/**
 * Environment configuration for local image editor
 */
export interface EnvironmentConfig {
  isLocalImageEditorEnabled: boolean
  isDevelopmentMode: boolean
  decksPath: string
  allowedPaths: string[]
  maxFileSize: number
}

/**
 * Check if local image editor is enabled and in development mode
 */
export function checkEnvironment(): EnvironmentConfig {
  const isEnabled = process.env.ENABLE_LOCAL_IMAGE_EDITOR === 'true'
  const isDevelopment = process.env.NODE_ENV === 'development'
  const projectRoot = process.cwd()
  const decksPath = path.join(projectRoot, 'specs', 'decks')

  return {
    isLocalImageEditorEnabled: isEnabled,
    isDevelopmentMode: isDevelopment,
    decksPath,
    allowedPaths: [decksPath],
    maxFileSize: 50 * 1024 * 1024, // 50MB
  }
}

/**
 * Environment guard middleware for API routes with enhanced security logging
 */
export function withEnvironmentGuard(
  handler: (request: NextRequest, config: EnvironmentConfig) => Promise<NextResponse>,
) {
  return async (request: NextRequest) => {
    const timer = new RequestTimer()
    const requestId = securityLogger.generateRequestId()
    const { userAgent, ip } = extractRequestInfo(request)
    const config = checkEnvironment()

    // Log request start
    securityLogger.logApiRequest(
      requestId,
      request.method,
      request.url,
      userAgent,
      ip,
    )

    // Log environment check
    securityLogger.logEnvironmentCheck(
      config.isLocalImageEditorEnabled,
      config.isDevelopmentMode,
      requestId,
    )

    // Check if feature is enabled
    if (!config.isLocalImageEditorEnabled) {
      const response = NextResponse.json(
        { error: 'Local image editor is disabled. Set ENABLE_LOCAL_IMAGE_EDITOR=true in .env.local' },
        { status: 403 },
      )

      securityLogger.logApiResponse(requestId, 403, timer.getDuration(), 'Feature disabled')
      return response
    }

    // Check if in development mode
    if (!config.isDevelopmentMode) {
      const response = NextResponse.json(
        { error: 'Local image editor is only available in development mode' },
        { status: 403 },
      )

      securityLogger.logSecurityViolation(
        'production_access_attempt',
        {
          nodeEnv: process.env.NODE_ENV,
          reason: 'Attempted to access local image editor in non-development mode',
        },
        requestId,
        userAgent,
        ip,
      )

      securityLogger.logApiResponse(requestId, 403, timer.getDuration(), 'Production access denied')
      return response
    }

    try {
      const response = await handler(request, config)
      const statusCode = response.status

      securityLogger.logApiResponse(requestId, statusCode, timer.getDuration())
      return response
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      securityLogger.log({
        level: 'error',
        category: 'api',
        event: 'request_error',
        requestId,
        details: {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          duration: timer.getDuration(),
        },
      })

      securityLogger.logApiResponse(requestId, 500, timer.getDuration(), errorMessage)

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      )
    }
  }
}

/**
 * Validate that a file path is within allowed directories with enhanced security
 */
export function validatePath(filePath: string, config: EnvironmentConfig): boolean {
  try {
    const resolvedPath = path.resolve(filePath)

    // Check for path traversal patterns
    const traversalPatterns = [
      '../',
      '..\\',
      '..%2f',
      '..%2F',
      '..%5c',
      '..%5C',
      '%2e%2e%2f',
      '%2e%2e%5c',
      '....//',
      '....\\\\',
    ]

    const hasTraversalPattern = traversalPatterns.some(pattern =>
      filePath.toLowerCase().includes(pattern.toLowerCase()),
    )

    if (hasTraversalPattern) {
      securityLogger.logPathTraversalAttempt(filePath)
      return false
    }

    // Check for null bytes
    if (filePath.includes('\0')) {
      securityLogger.logSecurityViolation(
        'null_byte_injection',
        { filePath, reason: 'Path contains null bytes' },
      )
      return false
    }

    // Check if within allowed paths
    const isWithinAllowed = config.allowedPaths.some(allowedPath =>
      resolvedPath.startsWith(path.resolve(allowedPath)),
    )

    if (!isWithinAllowed) {
      securityLogger.logFileAccessViolation(
        filePath,
        'Path outside allowed directories',
      )
    }

    return isWithinAllowed
  }
  catch (error) {
    securityLogger.log({
      level: 'error',
      category: 'validation',
      event: 'path_validation_error',
      details: {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    return false
  }
}

/**
 * Get absolute path to decks directory
 */
export function getDecksPath(): string {
  return path.join(process.cwd(), 'specs', 'decks')
}

/**
 * Check if local image editor features are available
 */
export function isLocalImageEditorAvailable(): boolean {
  const config = checkEnvironment()
  return config.isLocalImageEditorEnabled && config.isDevelopmentMode
}
