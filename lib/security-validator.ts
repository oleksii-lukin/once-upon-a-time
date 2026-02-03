/**
 * Enhanced Security Validator for Local Image Editor Service
 * Provides comprehensive validation and sanitization for requests
 */

import path from 'path'
import { securityLogger } from './security-logger'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  sanitizedValue?: string
  securityViolations: string[]
}

export interface FilePathValidationResult extends ValidationResult {
  resolvedPath?: string
  isWithinAllowedPaths?: boolean
  detectedPatterns?: string[]
}

export interface RequestValidationResult {
  isValid: boolean
  errors: string[]
  securityViolations: string[]
  sanitizedData: Record<string, string | null>
}

/**
 * Enhanced security validator class
 */
export class SecurityValidator {
  private allowedPaths: string[]
  private maxFileSize: number
  private allowedImageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
  private allowedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/bmp',
  ]

  constructor(allowedPaths: string[], maxFileSize: number = 50 * 1024 * 1024) {
    this.allowedPaths = allowedPaths.map(p => path.resolve(p))
    this.maxFileSize = maxFileSize
  }

  /**
   * Comprehensive file path validation with enhanced security
   */
  validateFilePath(filePath: string, requestId?: string): FilePathValidationResult {
    const errors: string[] = []
    const securityViolations: string[] = []
    let resolvedPath: string | undefined
    let isWithinAllowedPaths = false
    let detectedPatterns: string[] = []

    try {
      // Basic input validation
      if (!filePath || typeof filePath !== 'string') {
        errors.push('File path is required and must be a string')
        return { isValid: false, errors, securityViolations, detectedPatterns }
      }

      if (filePath.trim() === '') {
        errors.push('File path cannot be empty')
        return { isValid: false, errors, securityViolations, detectedPatterns }
      }

      // Check for path traversal patterns
      detectedPatterns = this.detectPathTraversalPatterns(filePath)
      if (detectedPatterns.length > 0) {
        securityViolations.push(`Path traversal attempt detected: ${detectedPatterns.join(', ')}`)
        securityLogger.logPathTraversalAttempt(filePath, requestId)
        return {
          isValid: false,
          errors: ['Invalid file path'],
          securityViolations,
          detectedPatterns,
        }
      }

      // Check for null bytes (directory traversal via null byte injection)
      if (filePath.includes('\0')) {
        securityViolations.push('Null byte injection attempt detected')
        securityLogger.logSecurityViolation(
          'null_byte_injection',
          { filePath, reason: 'Path contains null bytes' },
          requestId,
        )
        return { isValid: false, errors: ['Invalid file path'], securityViolations, detectedPatterns }
      }

      // Check for excessively long paths
      if (filePath.length > 1000) {
        errors.push('File path too long (maximum 1000 characters)')
        securityViolations.push('Excessively long path detected')
        return { isValid: false, errors, securityViolations, detectedPatterns }
      }

      // Resolve the path
      try {
        resolvedPath = path.resolve(filePath)
      }
      catch (resolveError) {
        errors.push('Invalid file path format')
        return { isValid: false, errors, securityViolations, detectedPatterns }
      }

      // Check if path is within allowed directories
      isWithinAllowedPaths = this.allowedPaths.some(allowedPath =>
        resolvedPath!.startsWith(allowedPath),
      )

      if (!isWithinAllowedPaths) {
        securityViolations.push('File path outside allowed directories')
        securityLogger.logFileAccessViolation(
          filePath,
          'Path outside allowed directories',
          requestId,
        )
        return {
          isValid: false,
          errors: ['Access denied'],
          securityViolations,
          resolvedPath,
          isWithinAllowedPaths,
          detectedPatterns,
        }
      }

      // Validate file extension
      const extension = path.extname(filePath).toLowerCase()
      if (extension && !this.allowedImageExtensions.includes(extension)) {
        errors.push(`Unsupported file extension: ${extension}`)
        return {
          isValid: false,
          errors,
          securityViolations,
          resolvedPath,
          isWithinAllowedPaths,
          detectedPatterns,
        }
      }

      return {
        isValid: true,
        errors: [],
        securityViolations: [],
        resolvedPath,
        isWithinAllowedPaths,
        detectedPatterns: [],
      }
    }
    catch (error) {
      errors.push('Path validation failed')
      securityLogger.log({
        level: 'error',
        category: 'validation',
        event: 'path_validation_error',
        requestId,
        details: {
          filePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      return {
        isValid: false,
        errors,
        securityViolations,
        resolvedPath,
        isWithinAllowedPaths,
        detectedPatterns,
      }
    }
  }

  /**
   * Validate filename for save operations
   */
  validateFilename(filename: string): ValidationResult {
    const errors: string[] = []
    const securityViolations: string[] = []

    if (!filename || typeof filename !== 'string') {
      errors.push('Filename is required and must be a string')
      return { isValid: false, errors, securityViolations }
    }

    const trimmedFilename = filename.trim()
    if (trimmedFilename === '') {
      errors.push('Filename cannot be empty')
      return { isValid: false, errors, securityViolations }
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/
    if (dangerousChars.test(trimmedFilename)) {
      securityViolations.push('Filename contains dangerous characters')
      return { isValid: false, errors: ['Invalid filename'], securityViolations }
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
    if (reservedNames.test(trimmedFilename)) {
      errors.push('Filename uses reserved system name')
      return { isValid: false, errors, securityViolations }
    }

    // Check length
    if (trimmedFilename.length > 255) {
      errors.push('Filename too long (maximum 255 characters)')
      return { isValid: false, errors, securityViolations }
    }

    // Validate extension
    const extension = path.extname(trimmedFilename).toLowerCase()
    if (extension && !this.allowedImageExtensions.includes(extension)) {
      errors.push(`Unsupported file extension: ${extension}`)
      return { isValid: false, errors, securityViolations }
    }

    return {
      isValid: true,
      errors: [],
      securityViolations: [],
      sanitizedValue: trimmedFilename,
    }
  }

  /**
   * Validate image file data
   */
  validateImageData(data: Buffer, filename: string): ValidationResult {
    const errors: string[] = []
    const securityViolations: string[] = []

    if (!Buffer.isBuffer(data)) {
      errors.push('Invalid image data format')
      return { isValid: false, errors, securityViolations }
    }

    if (data.length === 0) {
      errors.push('Image data is empty')
      return { isValid: false, errors, securityViolations }
    }

    if (data.length > this.maxFileSize) {
      errors.push(`Image too large: ${data.length} bytes (maximum: ${this.maxFileSize})`)
      return { isValid: false, errors, securityViolations }
    }

    // Validate image file signature
    const signatureValidation = this.validateImageSignature(data, filename)
    if (!signatureValidation.isValid) {
      errors.push(...signatureValidation.errors)
      securityViolations.push(...signatureValidation.securityViolations)
      return { isValid: false, errors, securityViolations }
    }

    return {
      isValid: true,
      errors: [],
      securityViolations: [],
    }
  }

  /**
   * Validate request parameters for API endpoints
   */
  validateRequestParams(params: Record<string, string | null>, requestId?: string): RequestValidationResult {
    const errors: string[] = []
    const securityViolations: string[] = []
    const sanitizedData: Record<string, string | null> = {}

    for (const [key, value] of Object.entries(params)) {
      const paramValidation = this.validateParameter(key, value, requestId)

      if (!paramValidation.isValid) {
        errors.push(...paramValidation.errors)
        securityViolations.push(...paramValidation.securityViolations)
      }
      else {
        sanitizedData[key] = paramValidation.sanitizedValue ?? value
      }
    }

    return {
      isValid: errors.length === 0 && securityViolations.length === 0,
      errors,
      securityViolations,
      sanitizedData,
    }
  }

  /**
   * Validate individual parameter
   */
  private validateParameter(key: string, value: string | null, requestId?: string): ValidationResult {
    const errors: string[] = []
    const securityViolations: string[] = []
    let sanitizedValue: string | undefined

    // Common validation for all string parameters
    if (typeof value === 'string') {
      // Check for script injection attempts
      if (this.containsScriptInjection(value)) {
        securityViolations.push(`Script injection attempt in parameter: ${key}`)
        securityLogger.logSecurityViolation(
          'script_injection_attempt',
          { parameter: key, value: value.substring(0, 100) },
          requestId,
        )
        return { isValid: false, errors: ['Invalid parameter value'], securityViolations }
      }

      // Sanitize string value
      sanitizedValue = value.trim()
    }

    // Parameter-specific validation
    switch (key) {
      case 'filePath':
      case 'originalPath':
      case 'directory':
        if (typeof value === 'string') {
          const pathValidation = this.validateFilePath(value, requestId)
          if (!pathValidation.isValid) {
            errors.push(...pathValidation.errors)
            securityViolations.push(...pathValidation.securityViolations)
          }
        }
        break

      case 'newFilename':
      case 'filename':
        if (typeof value === 'string') {
          const filenameValidation = this.validateFilename(value, requestId)
          if (!filenameValidation.isValid) {
            errors.push(...filenameValidation.errors)
            securityViolations.push(...filenameValidation.securityViolations)
          }
          else {
            sanitizedValue = filenameValidation.sanitizedValue
          }
        }
        break

      case 'quality':
        if (value) {
          const numValue = parseFloat(value)
          if (isNaN(numValue) || numValue < 0 || numValue > 1) {
            errors.push('Quality must be a number between 0 and 1')
          }
          else {
            sanitizedValue = numValue.toString()
          }
        }
        break

      case 'format':
        if (typeof value === 'string') {
          const allowedFormats = ['png', 'jpg', 'jpeg']
          if (!allowedFormats.includes(value.toLowerCase())) {
            errors.push(`Invalid format: ${value}. Allowed: ${allowedFormats.join(', ')}`)
          }
          else {
            sanitizedValue = value.toLowerCase()
          }
        }
        break

      case 'overwrite':
        if (value) {
          sanitizedValue = value === 'true' ? 'true' : 'false'
        }
        break
    }

    return {
      isValid: errors.length === 0 && securityViolations.length === 0,
      errors,
      securityViolations,
      sanitizedValue,
    }
  }

  /**
   * Detect path traversal patterns
   */
  private detectPathTraversalPatterns(path: string): string[] {
    const patterns = [
      { pattern: /\.\./g, name: 'parent_directory' },
      { pattern: /\.\.%2f/gi, name: 'url_encoded_traversal' },
      { pattern: /\.\.%5c/gi, name: 'url_encoded_backslash' },
      { pattern: /%2e%2e%2f/gi, name: 'double_url_encoded' },
      { pattern: /%2e%2e%5c/gi, name: 'double_url_encoded_backslash' },
      { pattern: /\.\.\/\.\.\//g, name: 'multiple_traversal' },
      { pattern: /\.\.\\\.\.\\/, name: 'windows_traversal' },
      { pattern: /\.\.\.\./g, name: 'extended_traversal' },
    ]

    return patterns
      .filter(({ pattern }) => pattern.test(path))
      .map(({ name }) => name)
  }

  /**
   * Check for script injection attempts
   */
  private containsScriptInjection(value: string): boolean {
    const scriptPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers like onclick=
      /eval\s*\(/i,
      /expression\s*\(/i,
      /vbscript:/i,
      /data:text\/html/i,
    ]

    return scriptPatterns.some(pattern => pattern.test(value))
  }

  /**
   * Validate image file signature
   */
  private validateImageSignature(data: Buffer, filename: string): ValidationResult {
    const errors: string[] = []
    const securityViolations: string[] = []

    if (data.length < 8) {
      errors.push('File too small to be a valid image')
      return { isValid: false, errors, securityViolations }
    }

    // Check file signatures
    const signatures = {
      png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      jpeg: [0xFF, 0xD8, 0xFF],
      gif87a: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      gif89a: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
      bmp: [0x42, 0x4D],
    }

    let validSignature = false
    const extension = path.extname(filename).toLowerCase()

    // Check PNG
    if (data.length >= 8 && signatures.png.every((byte, i) => data[i] === byte)) {
      validSignature = true
      if (extension && extension !== '.png') {
        securityViolations.push('File signature mismatch: PNG data with non-PNG extension')
      }
    }
    // Check JPEG
    else if (data.length >= 3 && signatures.jpeg.every((byte, i) => data[i] === byte)) {
      validSignature = true
      if (extension && !['.jpg', '.jpeg'].includes(extension)) {
        securityViolations.push('File signature mismatch: JPEG data with non-JPEG extension')
      }
    }
    // Check GIF
    else if (data.length >= 6 && (
      signatures.gif87a.every((byte, i) => data[i] === byte)
      || signatures.gif89a.every((byte, i) => data[i] === byte)
    )) {
      validSignature = true
      if (extension && extension !== '.gif') {
        securityViolations.push('File signature mismatch: GIF data with non-GIF extension')
      }
    }
    // Check WebP
    else if (data.length >= 12
      && signatures.webp.every((byte, i) => data[i] === byte)
      && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
      validSignature = true
      if (extension && extension !== '.webp') {
        securityViolations.push('File signature mismatch: WebP data with non-WebP extension')
      }
    }
    // Check BMP
    else if (data.length >= 2 && signatures.bmp.every((byte, i) => data[i] === byte)) {
      validSignature = true
      if (extension && extension !== '.bmp') {
        securityViolations.push('File signature mismatch: BMP data with non-BMP extension')
      }
    }

    if (!validSignature) {
      errors.push('Invalid or unsupported image format')
      securityViolations.push('Potential file type spoofing detected')
    }

    return {
      isValid: validSignature && securityViolations.length === 0,
      errors,
      securityViolations,
    }
  }
}

/**
 * Create validator instance with current configuration
 */
export function createSecurityValidator(): SecurityValidator {
  const projectRoot = process.cwd()
  const decksPath = path.join(projectRoot, 'specs', 'decks')
  const allowedPaths = [decksPath]
  const maxFileSize = 50 * 1024 * 1024 // 50MB

  return new SecurityValidator(allowedPaths, maxFileSize)
}

// Export singleton instance
export const securityValidator = createSecurityValidator()
