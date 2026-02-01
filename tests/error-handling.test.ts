import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { FileSystemHandler, FileSystemError, ImageValidationError } from '@/lib/file-system-handler'
import fs from 'fs/promises'
import path from 'path'

describe('Enhanced Error Handling', () => {
  let handler: FileSystemHandler
  let originalEnv: NodeJS.ProcessEnv

  beforeAll(async () => {
    // Save original environment
    originalEnv = { ...process.env }

    // Set up test environment
    process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true';
    (process.env as any).NODE_ENV = 'development'
  })

  afterAll(async () => {
    // Restore original environment
    process.env = originalEnv
  })

  beforeEach(() => {
    handler = new FileSystemHandler()
  })

  describe('File System Error Handling', () => {
    it('should throw FileSystemError for invalid paths', async () => {
      const invalidPath = '/etc/passwd'

      await expect(handler.readImageFile(invalidPath)).rejects.toThrow(FileSystemError)

      try {
        await handler.readImageFile(invalidPath)
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        expect((error as FileSystemError).code).toBe('INVALID_PATH')
        expect((error as FileSystemError).message).toContain('Access denied')
        expect((error as FileSystemError).details).toHaveProperty('filePath', invalidPath)
      }
    })

    it('should throw FileSystemError for non-existent files', async () => {
      const nonExistentPath = path.join(handler.getAbsoluteDecksPath(), 'non-existent.png')

      await expect(handler.readImageFile(nonExistentPath)).rejects.toThrow(FileSystemError)

      try {
        await handler.readImageFile(nonExistentPath)
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        expect((error as FileSystemError).code).toBe('FILE_NOT_FOUND')
        expect((error as FileSystemError).message).toContain('Image file not found')
      }
    })

    it('should handle environment disabled gracefully', async () => {
      // Temporarily disable environment
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'false'
      const disabledHandler = new FileSystemHandler()

      await expect(disabledHandler.listDecks()).rejects.toThrow(FileSystemError)

      try {
        await disabledHandler.listDecks()
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        expect((error as FileSystemError).code).toBe('ENVIRONMENT_DISABLED')
        expect((error as FileSystemError).message).toContain('not available')
      }

      // Restore environment
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'
    })
  })

  describe('Image Validation Error Handling', () => {
    it('should throw ImageValidationError for invalid image data', async () => {
      // Test with buffer that has invalid image signature
      const invalidData = Buffer.from('This is not image data')

      // We'll test the validation through writeImageFile since it calls validateImageBuffer
      const outputPath = path.join(handler.getAbsoluteDecksPath(), 'test-output.png')

      await expect(handler.writeImageFile(outputPath, invalidData)).rejects.toThrow(ImageValidationError)

      try {
        await handler.writeImageFile(outputPath, invalidData)
      }
      catch (error) {
        expect(error).toBeInstanceOf(ImageValidationError)
        expect((error as ImageValidationError).code).toBe('INVALID_IMAGE')
        // The error message could be either "not a supported image format" or "corrupted"
        expect((error as ImageValidationError).message).toMatch(/supported image format|corrupted/)
      }
    })

    it('should validate PNG signature correctly', async () => {
      // Test with valid PNG signature
      const validPngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // Width: 1
        0x00, 0x00, 0x00, 0x01, // Height: 1
        0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
        0x90, 0x77, 0x53, 0xDE, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND chunk length
        0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82, // CRC
      ])

      // This should not throw an error
      const outputPath = path.join(handler.getAbsoluteDecksPath(), 'valid-test.png')

      // Clean up any existing file first
      try {
        await fs.unlink(outputPath)
      }
      catch {
        // Ignore if file doesn't exist
      }

      await expect(handler.writeImageFile(outputPath, validPngData)).resolves.not.toThrow()

      // Clean up
      try {
        await fs.unlink(outputPath)
      }
      catch {
        // Ignore cleanup errors
      }
    })

    it('should throw ImageValidationError for corrupted PNG files', async () => {
      // Test with corrupted PNG (invalid signature)
      const corruptedPngData = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
      const outputPath = path.join(handler.getAbsoluteDecksPath(), 'corrupted-test.png')

      await expect(handler.writeImageFile(outputPath, corruptedPngData)).rejects.toThrow(ImageValidationError)

      try {
        await handler.writeImageFile(outputPath, corruptedPngData)
      }
      catch (error) {
        expect(error).toBeInstanceOf(ImageValidationError)
        expect((error as ImageValidationError).code).toBe('INVALID_IMAGE')
        expect((error as ImageValidationError).message).toContain('corrupted')
      }
    })
  })

  describe('Write Operation Error Handling', () => {
    it('should throw FileSystemError for empty image data', async () => {
      const outputPath = path.join(handler.getAbsoluteDecksPath(), 'test-deck', 'output.png')
      const emptyData = Buffer.alloc(0)

      await expect(handler.writeImageFile(outputPath, emptyData)).rejects.toThrow(FileSystemError)

      try {
        await handler.writeImageFile(outputPath, emptyData)
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        expect((error as FileSystemError).code).toBe('EMPTY_DATA')
        expect((error as FileSystemError).message).toContain('Cannot save empty image data')
      }
    })

    it('should throw FileSystemError for invalid image data', async () => {
      const outputPath = path.join(handler.getAbsoluteDecksPath(), 'test-deck', 'output.png')
      const invalidData = Buffer.from('This is not image data')

      await expect(handler.writeImageFile(outputPath, invalidData)).rejects.toThrow(ImageValidationError)
    })

    it('should validate path security for write operations', async () => {
      const maliciousPath = '../../../etc/passwd'
      const validData = Buffer.from([0x89, 0x50, 0x4E, 0x47]) // PNG signature start

      await expect(handler.writeImageFile(maliciousPath, validData)).rejects.toThrow(FileSystemError)

      try {
        await handler.writeImageFile(maliciousPath, validData)
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        expect((error as FileSystemError).code).toBe('INVALID_PATH')
        expect((error as FileSystemError).message).toContain('Access denied')
      }
    })
  })

  describe('Deck Operations Error Handling', () => {
    it('should handle invalid deck names', async () => {
      const invalidDeckName = '../malicious'

      await expect(handler.readDeckStructure(invalidDeckName)).rejects.toThrow(FileSystemError)

      try {
        await handler.readDeckStructure(invalidDeckName)
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        expect((error as FileSystemError).code).toBe('INVALID_DECK_NAME')
        expect((error as FileSystemError).message).toContain('Invalid deck name')
      }
    })

    it('should handle empty deck names', async () => {
      await expect(handler.readDeckStructure('')).rejects.toThrow(FileSystemError)

      try {
        await handler.readDeckStructure('')
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        expect((error as FileSystemError).code).toBe('INVALID_DECK_NAME')
        expect((error as FileSystemError).message).toContain('cannot be empty')
      }
    })

    it('should handle non-existent decks', async () => {
      const nonExistentDeck = 'non-existent-deck'

      await expect(handler.readDeckStructure(nonExistentDeck)).rejects.toThrow(FileSystemError)

      try {
        await handler.readDeckStructure(nonExistentDeck)
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        expect((error as FileSystemError).code).toBe('DECK_NOT_FOUND')
        expect((error as FileSystemError).message).toContain('not found')
      }
    })
  })

  describe('Error Message Quality', () => {
    it('should provide descriptive error messages with context', async () => {
      const invalidPath = '/etc/passwd'

      try {
        await handler.readImageFile(invalidPath)
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        const fsError = error as FileSystemError

        // Check that error message is descriptive
        expect(fsError.message).toContain('Access denied')
        expect(fsError.message).toContain(invalidPath)
        expect(fsError.message).toContain('outside allowed directories')

        // Check that details provide additional context
        expect(fsError.details).toHaveProperty('filePath')
        expect(fsError.details).toHaveProperty('allowedPaths')
        expect(Array.isArray(fsError.details.allowedPaths)).toBe(true)
      }
    })

    it('should include helpful suggestions in error messages', async () => {
      // Test environment disabled error
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'false'
      const disabledHandler = new FileSystemHandler()

      try {
        await disabledHandler.listDecks()
      }
      catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        const fsError = error as FileSystemError

        expect(fsError.message).toContain('ENABLE_LOCAL_IMAGE_EDITOR=true')
        expect(fsError.message).toContain('.env.local')
        expect(fsError.message).toContain('development mode')
      }

      // Restore environment
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should handle missing decks directory gracefully', async () => {
      // Test what happens when specs/decks doesn't exist
      // This will depend on the actual file system state, so we'll just verify
      // that the error handling works correctly
      try {
        const decks = await handler.listDecks()
        // If successful, verify it returns an array
        expect(Array.isArray(decks)).toBe(true)
      }
      catch (error) {
        // If it fails, verify it's a proper FileSystemError
        expect(error).toBeInstanceOf(FileSystemError)
        const fsError = error as FileSystemError
        expect(['DECKS_DIRECTORY_NOT_FOUND', 'PERMISSION_DENIED', 'LIST_ERROR']).toContain(fsError.code)
      }
    })
  })
})
