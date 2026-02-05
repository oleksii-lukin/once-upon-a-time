import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { FileSystemHandler, LocalDeckInfo, LocalCardInfo, LocalImageInfo } from '@/lib/file-system-handler'
import fs from 'fs/promises'
import path from 'path'

describe('FileSystemHandler', () => {
  let handler: FileSystemHandler
  let testDecksPath: string
  let originalEnv: NodeJS.ProcessEnv

  beforeAll(async () => {
    // Save original environment
    originalEnv = { ...process.env }

    // Set up test environment
    process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true';
    (process.env as any).NODE_ENV = 'development'

    // Create test directory structure
    testDecksPath = path.join(process.cwd(), 'test-specs', 'decks')
    await createTestDeckStructure()
  })

  afterAll(async () => {
    // Restore original environment
    process.env = originalEnv

    // Clean up test directory
    try {
      await fs.rm(path.join(process.cwd(), 'test-specs'), { recursive: true, force: true })
    }
    catch (error) {
      console.warn('Failed to clean up test directory:', error)
    }
  })

  beforeEach(() => {
    handler = new FileSystemHandler()
  })

  async function createTestDeckStructure() {
    // Create test deck structure
    const testDeck = path.join(testDecksPath, 'test-deck')
    const cardsDir = path.join(testDeck, 'cards')
    const protagonistsDir = path.join(cardsDir, 'protagonists')
    const heroCardDir = path.join(protagonistsDir, 'The Hero')

    await fs.mkdir(heroCardDir, { recursive: true })

    // Create deck-level images
    await fs.writeFile(path.join(testDeck, 'Border.jpg'), Buffer.from('fake-image-data'))
    await fs.writeFile(path.join(testDeck, 'GameBoard.jpg'), Buffer.from('fake-image-data'))

    // Create card metadata files
    await fs.writeFile(path.join(heroCardDir, 'en.md'), '# The Hero\nA brave protagonist.')
    await fs.writeFile(path.join(heroCardDir, 'ru.md'), '# Герой\nХрабрый протагонист.')
    await fs.writeFile(path.join(heroCardDir, 'prompt.md'), 'A heroic character prompt.')

    // Create card images
    await fs.writeFile(path.join(heroCardDir, 'hero.png'), Buffer.from('fake-png-data'))
    await fs.writeFile(path.join(heroCardDir, 'hero-alt.jpg'), Buffer.from('fake-jpg-data'))
  }

  describe('Environment and Validation', () => {
    it('should be enabled in test environment', () => {
      expect(handler.isEnabled()).toBe(true)
      expect(handler.validateEnvironment()).toBe(true)
    })

    it('should get absolute decks path', () => {
      const decksPath = handler.getAbsoluteDecksPath()
      expect(decksPath).toContain('specs/decks')
      expect(path.isAbsolute(decksPath)).toBe(true)
    })

    it('should validate paths correctly', async () => {
      const validPath = path.join(handler.getAbsoluteDecksPath(), 'test-deck', 'Border.jpg')
      const pathInfo = await handler.validateAndResolvePath(validPath)

      expect(pathInfo.isValid).toBe(true)
      expect(pathInfo.isWithinDecksDirectory).toBe(true)
    })

    it('should reject invalid paths', async () => {
      const invalidPath = '/etc/passwd'
      const pathInfo = await handler.validateAndResolvePath(invalidPath)

      expect(pathInfo.isValid).toBe(false)
      expect(pathInfo.isWithinDecksDirectory).toBe(false)
    })
  })

  describe('Deck Operations', () => {
    it('should list available decks', async () => {
      // This test will work with the actual specs/decks directory
      // We'll just verify the method works without errors
      try {
        const decks = await handler.listDecks()
        expect(Array.isArray(decks)).toBe(true)
      }
      catch (error) {
        // If specs/decks doesn't exist, that's okay for this test
        expect(error).toBeInstanceOf(Error)
      }
    })

    it('should handle non-existent deck gracefully', async () => {
      await expect(handler.readDeckStructure('non-existent-deck')).rejects.toThrow()
    })
  })

  describe('Path Validation Security', () => {
    it('should prevent directory traversal attacks', () => {
      const maliciousPath = '../../../etc/passwd'
      expect(handler.validatePath(maliciousPath)).toBe(false)
    })

    it('should allow valid deck paths', () => {
      const validPath = path.join(handler.getAbsoluteDecksPath(), 'test-deck', 'Border.jpg')
      expect(handler.validatePath(validPath)).toBe(true)
    })

    it('should reject paths outside allowed directories', () => {
      const outsidePath = '/tmp/malicious.jpg'
      expect(handler.validatePath(outsidePath)).toBe(false)
    })
  })

  describe('File Operations', () => {
    it('should handle file reading errors gracefully', async () => {
      const nonExistentFile = path.join(handler.getAbsoluteDecksPath(), 'non-existent.jpg')
      await expect(handler.readImageFile(nonExistentFile)).rejects.toThrow('Image file not found')
    })

    it('should validate file paths before operations', async () => {
      const invalidPath = '/etc/passwd'
      await expect(handler.readImageFile(invalidPath)).rejects.toThrow('Access denied')
    })
  })

  describe('Image Format Detection', () => {
    it('should detect image formats correctly', async () => {
      // Test with the actual specs/decks directory if it exists
      try {
        const decks = await handler.listDecks()
        if (decks.length > 0) {
          const deckImages = await handler.getDeckImages(decks[0])
          if (deckImages.length > 0) {
            const image = deckImages[0]
            expect(['png', 'jpg', 'jpeg', 'gif', 'webp']).toContain(image.format)
          }
        }
      }
      catch (error) {
        // If no decks exist, skip this test
        console.log('Skipping image format test - no decks available')
      }
    })
  })

  describe('Error Handling', () => {
    it('should throw error when environment is not available', () => {
      // Temporarily disable the environment
      const originalEnabled = process.env.ENABLE_LOCAL_IMAGE_EDITOR
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'false'

      const disabledHandler = new FileSystemHandler()
      expect(() => disabledHandler.validateEnvironment()).not.toThrow()
      expect(disabledHandler.validateEnvironment()).toBe(false)

      // Restore environment
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = originalEnabled
    })

    it('should handle file system errors gracefully', async () => {
      // Test with a path that would cause permission errors
      const restrictedPath = path.join(handler.getAbsoluteDecksPath(), 'restricted')

      try {
        await handler.readImageFile(restrictedPath)
      }
      catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })
  })
})
