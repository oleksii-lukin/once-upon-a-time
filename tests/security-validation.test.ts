import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { securityValidator, SecurityValidator } from '@/lib/security-validator'
import { securityLogger } from '@/lib/security-logger'
import path from 'path'

describe('Security Validation', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'
    process.env.NODE_ENV = 'development'
    securityLogger.resetMetrics()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Path Traversal Prevention', () => {
    it('should detect basic path traversal attempts', () => {
      const maliciousPath = '../../../etc/passwd'
      const result = securityValidator.validateFilePath(maliciousPath)

      expect(result.isValid).toBe(false)
      expect(result.securityViolations.length).toBeGreaterThan(0)
      expect(result.securityViolations[0]).toContain('Path traversal attempt detected')
    })

    it('should detect URL-encoded path traversal attempts', () => {
      const maliciousPath = '..%2f..%2f..%2fetc%2fpasswd'
      const result = securityValidator.validateFilePath(maliciousPath)

      expect(result.isValid).toBe(false)
      expect(result.securityViolations.length).toBeGreaterThan(0)
    })

    it('should detect null byte injection', () => {
      const maliciousPath = 'image.png\0.txt'
      const result = securityValidator.validateFilePath(maliciousPath)

      expect(result.isValid).toBe(false)
      expect(result.securityViolations).toContain('Null byte injection attempt detected')
    })

    it('should allow valid paths within specs/decks', () => {
      const validPath = path.join(process.cwd(), 'specs', 'decks', 'test-deck', 'image.png')
      const result = securityValidator.validateFilePath(validPath)

      expect(result.isValid).toBe(true)
      expect(result.securityViolations).toHaveLength(0)
    })
  })

  describe('Filename Validation', () => {
    it('should reject filenames with dangerous characters', () => {
      const dangerousFilename = 'image<script>.png'
      const result = securityValidator.validateFilename(dangerousFilename)

      expect(result.isValid).toBe(false)
      expect(result.securityViolations).toContain('Filename contains dangerous characters')
    })

    it('should reject reserved system names', () => {
      const reservedName = 'CON.png'
      const result = securityValidator.validateFilename(reservedName)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Filename uses reserved system name')
    })

    it('should accept valid filenames', () => {
      const validFilename = 'my-image_01.png'
      const result = securityValidator.validateFilename(validFilename)

      expect(result.isValid).toBe(true)
      expect(result.sanitizedValue).toBe(validFilename)
    })

    it('should trim whitespace from filenames', () => {
      const filename = '  image.png  '
      const result = securityValidator.validateFilename(filename)

      expect(result.isValid).toBe(true)
      expect(result.sanitizedValue).toBe('image.png')
    })
  })

  describe('Image Data Validation', () => {
    it('should validate PNG signature', () => {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D])
      const result = securityValidator.validateImageData(pngSignature, 'test.png')

      expect(result.isValid).toBe(true)
    })

    it('should validate JPEG signature', () => {
      const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])
      const result = securityValidator.validateImageData(jpegSignature, 'test.jpg')

      expect(result.isValid).toBe(true)
    })

    it('should reject invalid image data', () => {
      const invalidData = Buffer.from('not an image')
      const result = securityValidator.validateImageData(invalidData, 'test.png')

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject empty image data', () => {
      const emptyData = Buffer.alloc(0)
      const result = securityValidator.validateImageData(emptyData, 'test.png')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Image data is empty')
    })
  })

  describe('Request Parameter Validation', () => {
    it('should validate and sanitize request parameters', () => {
      const params = {
        filePath: path.join(process.cwd(), 'specs', 'decks', 'test', 'image.png'),
        newFilename: '  new-image.png  ',
        format: 'PNG',
        quality: '0.8',
        overwrite: 'true',
      }

      const result = securityValidator.validateRequestParams(params)

      expect(result.isValid).toBe(true)
      expect(result.sanitizedData.newFilename).toBe('new-image.png')
      expect(result.sanitizedData.format).toBe('png')
      expect(result.sanitizedData.quality).toBe('0.8')
      expect(result.sanitizedData.overwrite).toBe('true')
    })

    it('should detect script injection in parameters', () => {
      const params = {
        newFilename: '<script>alert("xss")</script>image.png',
      }

      const result = securityValidator.validateRequestParams(params)

      expect(result.isValid).toBe(false)
      expect(result.securityViolations.length).toBeGreaterThan(0)
    })
  })

  describe('Security Logging', () => {
    it('should provide security metrics interface', () => {
      const metrics = securityLogger.getMetrics()

      expect(metrics).toHaveProperty('totalRequests')
      expect(metrics).toHaveProperty('securityViolations')
      expect(metrics).toHaveProperty('pathTraversalAttempts')
      expect(metrics).toHaveProperty('invalidFileAccess')
      expect(metrics).toHaveProperty('errorCount')
      expect(metrics).toHaveProperty('lastReset')
    })

    it('should reset metrics correctly', () => {
      // Get initial metrics
      let metrics = securityLogger.getMetrics()
      const initialViolations = metrics.securityViolations

      // Reset
      securityLogger.resetMetrics()
      metrics = securityLogger.getMetrics()

      expect(metrics.securityViolations).toBe(0)
      expect(metrics.pathTraversalAttempts).toBe(0)
      expect(metrics.totalRequests).toBe(0)
      expect(metrics.errorCount).toBe(0)
      expect(metrics.invalidFileAccess).toBe(0)
    })
  })
})
