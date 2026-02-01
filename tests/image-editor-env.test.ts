import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { checkEnvironment, validatePath, isLocalImageEditorAvailable } from '@/lib/image-editor-env'
import path from 'path'

describe('Image Editor Environment', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('checkEnvironment', () => {
    it('should return enabled when ENABLE_LOCAL_IMAGE_EDITOR is true', () => {
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true';
      (process.env as any).NODE_ENV = 'development'

      const config = checkEnvironment()

      expect(config.isLocalImageEditorEnabled).toBe(true)
      expect(config.isDevelopmentMode).toBe(true)
      expect(config.decksPath).toContain('specs/decks')
      expect(config.allowedPaths).toHaveLength(1)
      expect(config.maxFileSize).toBe(50 * 1024 * 1024)
    })

    it('should return disabled when ENABLE_LOCAL_IMAGE_EDITOR is false', () => {
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'false';
      (process.env as any).NODE_ENV = 'development'

      const config = checkEnvironment()

      expect(config.isLocalImageEditorEnabled).toBe(false)
      expect(config.isDevelopmentMode).toBe(true)
    })

    it('should return disabled when ENABLE_LOCAL_IMAGE_EDITOR is not set', () => {
      delete process.env.ENABLE_LOCAL_IMAGE_EDITOR;
      (process.env as any).NODE_ENV = 'development'

      const config = checkEnvironment()

      expect(config.isLocalImageEditorEnabled).toBe(false)
    })

    it('should detect production mode correctly', () => {
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true';
      (process.env as any).NODE_ENV = 'production'

      const config = checkEnvironment()

      expect(config.isDevelopmentMode).toBe(false)
    })
  })

  describe('validatePath', () => {
    it('should allow paths within specs/decks directory', () => {
      const config = checkEnvironment()
      const validPath = path.join(config.decksPath, 'default', 'Border.jpg')

      expect(validatePath(validPath, config)).toBe(true)
    })

    it('should reject paths outside specs/decks directory', () => {
      const config = checkEnvironment()
      const invalidPath = '/etc/passwd'

      expect(validatePath(invalidPath, config)).toBe(false)
    })

    it('should reject path traversal attempts', () => {
      const config = checkEnvironment()
      const maliciousPath = path.join(config.decksPath, '..', '..', 'etc', 'passwd')

      expect(validatePath(maliciousPath, config)).toBe(false)
    })
  })

  describe('isLocalImageEditorAvailable', () => {
    it('should return true when enabled and in development', () => {
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true';
      (process.env as any).NODE_ENV = 'development'

      expect(isLocalImageEditorAvailable()).toBe(true)
    })

    it('should return false when disabled', () => {
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'false';
      (process.env as any).NODE_ENV = 'development'

      expect(isLocalImageEditorAvailable()).toBe(false)
    })

    it('should return false in production mode', () => {
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true';
      (process.env as any).NODE_ENV = 'production'

      expect(isLocalImageEditorAvailable()).toBe(false)
    })
  })
})
