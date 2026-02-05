/**
 * Security Logger for Local Image Editor Service
 * Provides comprehensive logging for security events and debugging
 */

export interface SecurityLogDetails {
  // API request details
  method?: string
  path?: string
  statusCode?: number
  duration?: number
  success?: boolean

  // Security violation details
  severity?: string
  blocked?: boolean
  attemptedPath?: string
  patterns?: string[]

  // File access details
  filePath?: string
  requestedPath?: string
  pathSegments?: string[]
  newFilePath?: string
  originalPath?: string | null
  allowedPaths?: string[]
  operation?: 'read' | 'write' | 'delete' | 'create'
  fileSize?: number
  finalSize?: number
  originalSize?: number
  compressionRatio?: number
  size?: number
  filename?: string
  format?: string | null
  mimeType?: string
  overwritten?: boolean
  securityViolations?: string[]

  // Validation details
  field?: string
  value?: unknown
  valueType?: string

  // Environment details
  isEnabled?: boolean
  isDevelopment?: boolean
  allowed?: boolean
  nodeEnv?: string

  // Error details
  error?: string
  errors?: unknown
  stack?: string

  // Generic details
  reason?: string
  timestamp?: string
  parameter?: string
}

export interface SecurityLogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'security'
  category: 'auth' | 'file_access' | 'validation' | 'api' | 'security' | 'system'
  event: string
  details: SecurityLogDetails
  requestId?: string
  userAgent?: string
  ip?: string
  path?: string
}

export interface SecurityMetrics {
  totalRequests: number
  securityViolations: number
  pathTraversalAttempts: number
  invalidFileAccess: number
  errorCount: number
  lastReset: string
}

class SecurityLogger {
  private metrics: SecurityMetrics = {
    totalRequests: 0,
    securityViolations: 0,
    pathTraversalAttempts: 0,
    invalidFileAccess: 0,
    errorCount: 0,
    lastReset: new Date().toISOString(),
  }

  private isDevelopment = process.env.NODE_ENV === 'development'
  private isLoggingEnabled = process.env.ENABLE_LOCAL_IMAGE_EDITOR_LOGGING === 'true'

  /**
   * Generate a unique request ID for tracking
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Log a security event with structured data
   */
  log(entry: Omit<SecurityLogEntry, 'timestamp'>): void {
    if (!this.isLoggingEnabled) return

    const logEntry: SecurityLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    }

    // Update metrics
    this.updateMetrics(entry)

    // Format log message
    const logMessage = this.formatLogMessage(logEntry)

    // Output based on log level
    switch (entry.level) {
      case 'error':
      case 'security':
        console.error(logMessage)
        break
      case 'warn':
        console.warn(logMessage)
        break
      case 'info':
      default:
        if (this.isDevelopment) {
          console.log(logMessage)
        }
        break
    }

    // In production, you might want to send logs to external service
    if (!this.isDevelopment && entry.level === 'security') {
      this.handleSecurityAlert(logEntry)
    }
  }

  /**
   * Log API request start
   */
  logApiRequest(requestId: string, method: string, path: string, userAgent?: string, ip?: string): void {
    this.log({
      level: 'info',
      category: 'api',
      event: 'request_start',
      requestId,
      userAgent,
      ip,
      path,
      details: {
        method,
        path,
        timestamp: new Date().toISOString(),
      },
    })
  }

  /**
   * Log API request completion
   */
  logApiResponse(requestId: string, statusCode: number, duration: number, error?: string): void {
    this.log({
      level: statusCode >= 400 ? 'warn' : 'info',
      category: 'api',
      event: 'request_complete',
      requestId,
      details: {
        statusCode,
        duration,
        error,
        success: statusCode < 400,
      },
    })
  }

  /**
   * Log security violation
   */
  logSecurityViolation(
    event: string,
    details: SecurityLogDetails,
    requestId?: string,
    userAgent?: string,
    ip?: string,
  ): void {
    this.log({
      level: 'security',
      category: 'security',
      event,
      requestId,
      userAgent,
      ip,
      details: {
        ...details,
        severity: 'high',
        blocked: true,
      },
    })
  }

  /**
   * Log path traversal attempt
   */
  logPathTraversalAttempt(
    attemptedPath: string,
    requestId?: string,
    userAgent?: string,
    ip?: string,
  ): void {
    this.logSecurityViolation(
      'path_traversal_attempt',
      {
        attemptedPath,
        reason: 'Path contains directory traversal patterns',
        patterns: this.detectTraversalPatterns(attemptedPath),
      },
      requestId,
      userAgent,
      ip,
    )
  }

  /**
   * Log file access violation
   */
  logFileAccessViolation(
    filePath: string,
    reason: string,
    requestId?: string,
    userAgent?: string,
    ip?: string,
  ): void {
    this.logSecurityViolation(
      'file_access_violation',
      {
        filePath,
        reason,
        allowedPaths: process.env.NODE_ENV === 'development' ? ['specs/decks/'] : [],
      },
      requestId,
      userAgent,
      ip,
    )
  }

  /**
   * Log validation error
   */
  logValidationError(
    field: string,
    value: unknown,
    reason: string,
    requestId?: string,
  ): void {
    this.log({
      level: 'warn',
      category: 'validation',
      event: 'validation_failed',
      requestId,
      details: {
        field,
        value: typeof value === 'string' ? value.substring(0, 100) : String(value), // Truncate long values
        reason,
        valueType: typeof value,
      },
    })
  }

  /**
   * Log file system operation
   */
  logFileOperation(
    operation: 'read' | 'write' | 'delete' | 'create',
    filePath: string,
    success: boolean,
    error?: string,
    requestId?: string,
    requestedPath?: string,
  ): void {
    this.log({
      level: success ? 'info' : 'error',
      category: 'file_access',
      event: `file_${operation}`,
      requestId,
      details: {
        operation,
        filePath: this.sanitizePathForLogging(filePath),
        requestedPath: requestedPath ? this.sanitizePathForLogging(requestedPath) : undefined,
        success,
        error,
        fileSize: undefined, // Could be added if available
      },
    })
  }

  /**
   * Log environment check
   */
  logEnvironmentCheck(
    isEnabled: boolean,
    isDevelopment: boolean,
    requestId?: string,
  ): void {
    this.log({
      level: isEnabled && isDevelopment ? 'info' : 'warn',
      category: 'auth',
      event: 'environment_check',
      requestId,
      details: {
        isEnabled,
        isDevelopment,
        allowed: isEnabled && isDevelopment,
        nodeEnv: process.env.NODE_ENV,
      },
    })
  }

  /**
   * Get current security metrics
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset security metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      securityViolations: 0,
      pathTraversalAttempts: 0,
      invalidFileAccess: 0,
      errorCount: 0,
      lastReset: new Date().toISOString(),
    }
  }

  /**
   * Update metrics based on log entry
   */
  private updateMetrics(entry: Omit<SecurityLogEntry, 'timestamp'>): void {
    if (entry.category === 'api' && entry.event === 'request_start') {
      this.metrics.totalRequests++
    }

    if (entry.level === 'security') {
      this.metrics.securityViolations++

      if (entry.event === 'path_traversal_attempt') {
        this.metrics.pathTraversalAttempts++
      }

      if (entry.event === 'file_access_violation') {
        this.metrics.invalidFileAccess++
      }
    }

    if (entry.level === 'error') {
      this.metrics.errorCount++
    }
  }

  /**
   * Format log message for console output
   */
  private formatLogMessage(entry: SecurityLogEntry): string {
    const timestamp = entry.timestamp
    const level = entry.level.toUpperCase().padEnd(8)
    const category = entry.category.toUpperCase().padEnd(12)
    const event = entry.event
    const requestId = entry.requestId ? ` [${entry.requestId}]` : ''

    let message = `${timestamp} ${level} ${category} ${event}${requestId}`

    // Add key details
    if (entry.details) {
      const keyDetails = this.extractKeyDetails(entry.details)
      if (keyDetails) {
        message += ` - ${keyDetails}`
      }
    }

    // Add full details in development
    if (this.isDevelopment && Object.keys(entry.details || {}).length > 0) {
      message += `\n  Details: ${JSON.stringify(entry.details, null, 2)}`
    }

    return message
  }

  /**
   * Extract key details for log message
   */
  private extractKeyDetails(details: SecurityLogDetails): string {
    const keyFields = ['filePath', 'attemptedPath', 'reason', 'error', 'statusCode', 'method'] as const
    const keyValues = keyFields
      .filter(field => details[field] !== undefined)
      .map(field => `${field}=${details[field]}`)
      .join(', ')

    return keyValues
  }

  /**
   * Detect path traversal patterns
   */
  private detectTraversalPatterns(path: string): string[] {
    const patterns = [
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

    return patterns.filter(pattern =>
      path.toLowerCase().includes(pattern.toLowerCase()),
    )
  }

  /**
   * Sanitize file path for logging (remove sensitive info)
   */
  private sanitizePathForLogging(filePath: string): string {
    // Remove absolute path prefixes for security
    const projectRoot = process.cwd()
    if (filePath.startsWith(projectRoot)) {
      return filePath.substring(projectRoot.length + 1)
    }
    return filePath
  }

  /**
   * Handle security alerts (placeholder for production integration)
   */
  private handleSecurityAlert(entry: SecurityLogEntry): void {
    // In production, this could:
    // - Send alerts to monitoring service
    // - Trigger security notifications
    // - Update security dashboards
    // - Block suspicious IPs

    // For now, just ensure it's logged prominently
    console.error(`🚨 SECURITY ALERT: ${entry.event}`, {
      timestamp: entry.timestamp,
      details: entry.details,
      requestId: entry.requestId,
    })
  }
}

// Create singleton instance
export const securityLogger = new SecurityLogger()

/**
 * Middleware to extract request information for logging
 */
export function extractRequestInfo(request: Request) {
  const userAgent = request.headers.get('user-agent') || undefined
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || undefined

  return { userAgent, ip }
}

/**
 * Performance timer for request duration tracking
 */
export class RequestTimer {
  private startTime: number

  constructor() {
    this.startTime = Date.now()
  }

  getDuration(): number {
    return Date.now() - this.startTime
  }
}
