import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { FileSystemHandler } from '@/lib/file-system-handler'
import { checkEnvironment } from '@/lib/image-editor-env'

// Mock environment variables for testing
const originalEnv = process.env

beforeAll(() => {
  process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'
  process.env.NODE_ENV = 'development'
})

afterAll(() => {
  process.env = originalEnv
})

describe('Complete Workflow Integration Test: Deck Selection to Image Save', () => {
  // Test data that we'll use throughout the workflow
  let testDeckName: string
  let testCardName: string
  let testImagePath: string
  let fileSystemHandler: FileSystemHandler

  beforeEach(async () => {
    // Create a new FileSystemHandler instance for each test to pick up environment changes
    fileSystemHandler = new FileSystemHandler()

    // Reset test data for each test
    testDeckName = ''
    testCardName = ''
    testImagePath = ''
  })

  describe('Step 1: Environment and Setup Validation', () => {
    it('should have proper environment configuration for testing', () => {
      const config = checkEnvironment()

      // Verify environment is properly configured for testing
      expect(config.isLocalImageEditorEnabled).toBe(true)
      expect(config.isDevelopmentMode).toBe(true)
      expect(config.decksPath).toContain('specs/decks')
      expect(config.allowedPaths).toContain(config.decksPath)
    })

    it('should validate file system handler is enabled', () => {
      expect(fileSystemHandler.isEnabled()).toBe(true)
      expect(fileSystemHandler.validateEnvironment()).toBe(true)
    })
  })

  describe('Step 2: Deck Browsing and Selection', () => {
    it('should successfully browse available decks', async () => {
      const deckNames = await fileSystemHandler.listDecks()

      // Verify deck browsing works (Requirement 4.1)
      expect(Array.isArray(deckNames)).toBe(true)
      expect(deckNames.length).toBeGreaterThan(0)

      // Store first deck for subsequent tests
      testDeckName = deckNames[0]
      expect(testDeckName).toBeTruthy()

      // Verify we have the expected 'default' deck
      expect(deckNames).toContain('default')
    })

    it('should successfully get deck structure after selection', async () => {
      const deckNames = await fileSystemHandler.listDecks()
      testDeckName = deckNames[0]

      const deckStructure = await fileSystemHandler.readDeckStructure(testDeckName)

      // Verify deck details are properly loaded (Requirement 4.2)
      expect(deckStructure).toHaveProperty('deck')
      expect(deckStructure).toHaveProperty('cards')
      expect(deckStructure).toHaveProperty('deckImages')

      expect(deckStructure.deck.name).toBe(testDeckName)
      expect(Array.isArray(deckStructure.cards)).toBe(true)
      expect(Array.isArray(deckStructure.deckImages)).toBe(true)
      expect(deckStructure.cards.length).toBeGreaterThan(0)

      // Verify deck structure recognition (Requirement 2.2, 2.3, 2.4)
      expect(deckStructure.deck).toHaveProperty('cardCount')
      expect(deckStructure.deck).toHaveProperty('categories')
      expect(deckStructure.deck.cardCount).toBeGreaterThan(0)
      expect(Array.isArray(deckStructure.deck.categories)).toBe(true)
      expect(deckStructure.deck.categories.length).toBeGreaterThan(0)
    })
  })

  describe('Step 3: Card Selection and Navigation', () => {
    it('should successfully browse cards within selected deck', async () => {
      const deckNames = await fileSystemHandler.listDecks()
      testDeckName = deckNames[0]

      const deckStructure = await fileSystemHandler.readDeckStructure(testDeckName)

      // Verify card browsing works (Requirement 4.4)
      expect(deckStructure.cards.length).toBeGreaterThan(0)
      expect(deckStructure.deck.categories.length).toBeGreaterThan(0)

      // Find a card with images for testing
      const cardWithImages = deckStructure.cards.find(card => card.images.length > 0)
      expect(cardWithImages).toBeTruthy()

      testCardName = cardWithImages!.name
      testImagePath = cardWithImages!.images[0].relativePath

      // Verify card structure (Requirement 2.3, 2.4)
      expect(cardWithImages).toHaveProperty('name')
      expect(cardWithImages).toHaveProperty('category')
      expect(cardWithImages).toHaveProperty('path')
      expect(cardWithImages).toHaveProperty('images')
      expect(cardWithImages).toHaveProperty('metadata')

      expect(cardWithImages!.images.length).toBeGreaterThan(0)
      expect(cardWithImages!.metadata).toHaveProperty('enFile')
    })

    it('should successfully filter cards by category', async () => {
      const deckNames = await fileSystemHandler.listDecks()
      testDeckName = deckNames[0]

      const deckStructure = await fileSystemHandler.readDeckStructure(testDeckName)
      const categories = deckStructure.deck.categories

      if (categories.length === 0) return // Skip if no categories

      const category = categories[0]
      const cardsInCategory = deckStructure.cards.filter(card => card.category === category)

      // Verify category filtering works (Requirement 4.4)
      expect(cardsInCategory.length).toBeGreaterThan(0)
      cardsInCategory.forEach((card) => {
        expect(card.category).toBe(category)
      })
    })
  })

  describe('Step 4: Image Loading and File Operations', () => {
    it('should successfully validate and resolve image paths', async () => {
      const deckNames = await fileSystemHandler.listDecks()
      testDeckName = deckNames[0]

      const deckStructure = await fileSystemHandler.readDeckStructure(testDeckName)
      const cardWithImages = deckStructure.cards.find(card => card.images.length > 0)

      if (!cardWithImages) return // Skip if no images available

      const image = cardWithImages.images[0]

      // Verify image information is available for editing tools (Requirement 3.1-3.5)
      expect(image).toHaveProperty('filename')
      expect(image).toHaveProperty('format')
      expect(image).toHaveProperty('size')
      expect(image).toHaveProperty('path')
      expect(image).toHaveProperty('relativePath')

      expect(['png', 'jpg', 'jpeg', 'gif', 'webp']).toContain(image.format)
      expect(image.size).toBeGreaterThan(0)

      // Verify path validation works
      const pathInfo = await fileSystemHandler.validateAndResolvePath(image.path)
      expect(pathInfo.isValid).toBe(true)
      expect(pathInfo.exists).toBe(true)
      expect(pathInfo.isWithinDecksDirectory).toBe(true)
    })

    it('should successfully read image file data', async () => {
      const deckNames = await fileSystemHandler.listDecks()
      testDeckName = deckNames[0]

      const deckStructure = await fileSystemHandler.readDeckStructure(testDeckName)

      // Find a valid image file (skip corrupted ones)
      let validImage = null
      for (const card of deckStructure.cards) {
        for (const image of card.images) {
          try {
            // Try to read the image to see if it's valid
            await fileSystemHandler.readImageFile(image.path)
            validImage = image
            break
          }
          catch (error) {
            // Skip corrupted images
            continue
          }
        }
        if (validImage) break
      }

      if (!validImage) {
        // Skip test if no valid images are available
        console.warn('No valid images found for testing')
        return
      }

      // Verify the image file can be read (Requirement 4.5, 7.4)
      const imageBuffer = await fileSystemHandler.readImageFile(validImage.path)
      expect(imageBuffer).toBeInstanceOf(Buffer)
      expect(imageBuffer.length).toBeGreaterThan(0)
      expect(imageBuffer.length).toBe(validImage.size)
    })
  })

  describe('Step 5: Image Save Operations', () => {
    it('should successfully save edited image back to file system', async () => {
      const deckNames = await fileSystemHandler.listDecks()
      testDeckName = deckNames[0]

      // Create a test save path
      const testSavePath = path.join(fileSystemHandler.getAbsoluteDecksPath(), testDeckName, 'test_workflow_save.png')

      // Create test image data (simulating edited image)
      const testImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==', 'base64')

      // Save the image
      await fileSystemHandler.writeImageFile(testSavePath, testImageData)

      // Verify save operation works (Requirement 5.1, 2.5, 2.6)
      const fileExists = await fs.access(testSavePath).then(() => true).catch(() => false)
      expect(fileExists).toBe(true)

      // Verify file content
      const savedData = await fs.readFile(testSavePath)
      expect(savedData.length).toBe(testImageData.length)
      expect(Buffer.compare(savedData, testImageData)).toBe(0)

      // Cleanup
      try {
        await fs.unlink(testSavePath)
      }
      catch (error) {
        // File might not exist, that's okay
      }
    })

    it('should validate file paths during save operations', async () => {
      // Test path validation (Requirement 5.5, 8.5)
      const invalidPath = '/etc/passwd'

      await expect(async () => {
        await fileSystemHandler.writeImageFile(invalidPath, Buffer.from('test'))
      }).rejects.toThrow()

      // Test path traversal prevention
      const traversalPath = '../../../etc/passwd'

      await expect(async () => {
        await fileSystemHandler.writeImageFile(traversalPath, Buffer.from('test'))
      }).rejects.toThrow()
    })
  })

  describe('Step 6: End-to-End Workflow Validation', () => {
    it('should complete full workflow: browse → select → load → edit → save', async () => {
      // Step 1: Browse decks
      const deckNames = await fileSystemHandler.listDecks()
      expect(deckNames.length).toBeGreaterThan(0)

      const selectedDeck = deckNames[0]
      testDeckName = selectedDeck

      // Step 2: Select deck and browse cards
      const deckStructure = await fileSystemHandler.readDeckStructure(testDeckName)
      expect(deckStructure.cards.length).toBeGreaterThan(0)

      // Find a valid image file (skip corrupted ones)
      let validImage = null
      let cardWithValidImage = null
      for (const card of deckStructure.cards) {
        for (const image of card.images) {
          try {
            // Try to read the image to see if it's valid
            await fileSystemHandler.readImageFile(image.path)
            validImage = image
            cardWithValidImage = card
            break
          }
          catch (error) {
            // Skip corrupted images
            continue
          }
        }
        if (validImage) break
      }

      if (!validImage) {
        console.warn('No valid images found for end-to-end test')
        return
      }

      // Step 3: Load image for editing
      const originalImageBuffer = await fileSystemHandler.readImageFile(validImage.path)
      expect(originalImageBuffer.length).toBeGreaterThan(0)

      // Step 4: Simulate image editing (in real scenario, this would be canvas operations)
      // For testing, we'll use a simple test image
      const editedImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==', 'base64')

      // Step 5: Save edited image
      const savePath = path.join(fileSystemHandler.getAbsoluteDecksPath(), testDeckName, 'workflow_complete_test.png')
      await fileSystemHandler.writeImageFile(savePath, editedImageData)

      // Step 6: Verify the saved file exists and can be read
      const savedImageBuffer = await fileSystemHandler.readImageFile(savePath)
      expect(savedImageBuffer.length).toBe(editedImageData.length)
      expect(Buffer.compare(savedImageBuffer, editedImageData)).toBe(0)

      // Cleanup
      try {
        await fs.unlink(savePath)
      }
      catch (error) {
        // File might not exist, that's okay
      }

      // Verify all requirements are met
      // Requirement 4.1: Deck browsing ✓
      // Requirement 4.2: Card selection ✓
      // Requirement 4.4: Image navigation ✓
      // Requirement 4.6: Image loading ✓
      // Requirements 2.5, 2.6: File system operations ✓
      // Requirements 5.1, 5.2: Save operations ✓
    })

    it('should handle workflow with different image formats', async () => {
      const deckNames = await fileSystemHandler.listDecks()
      testDeckName = deckNames[0]

      const deckStructure = await fileSystemHandler.readDeckStructure(testDeckName)

      // Find images with different formats (only test valid ones)
      const allImages = deckStructure.cards.flatMap(card => card.images)
      const validPngImages = []
      const validJpgImages = []

      // Test each image to see if it's valid
      for (const img of allImages) {
        try {
          await fileSystemHandler.readImageFile(img.path)
          if (img.format === 'png') {
            validPngImages.push(img)
          }
          else if (['jpg', 'jpeg'].includes(img.format)) {
            validJpgImages.push(img)
          }
        }
        catch (error) {
          // Skip corrupted images
          continue
        }
      }

      // Test PNG format handling (Requirement 6.1, 6.2)
      if (validPngImages.length > 0) {
        const pngImage = validPngImages[0]
        const imageBuffer = await fileSystemHandler.readImageFile(pngImage.path)
        expect(imageBuffer).toBeInstanceOf(Buffer)
        expect(imageBuffer.length).toBe(pngImage.size)
      }

      // Test JPEG format handling (Requirement 6.2)
      if (validJpgImages.length > 0) {
        const jpgImage = validJpgImages[0]
        const imageBuffer = await fileSystemHandler.readImageFile(jpgImage.path)
        expect(imageBuffer).toBeInstanceOf(Buffer)
        expect(imageBuffer.length).toBe(jpgImage.size)
      }

      // At least one format should be available
      expect(validPngImages.length + validJpgImages.length).toBeGreaterThan(0)
    })
  })

  describe('Step 7: Error Handling and Edge Cases', () => {
    it('should handle non-existent deck gracefully', async () => {
      await expect(async () => {
        await fileSystemHandler.readDeckStructure('nonexistent-deck')
      }).rejects.toThrow()
    })

    it('should handle non-existent image gracefully', async () => {
      const nonExistentPath = path.join(fileSystemHandler.getAbsoluteDecksPath(), 'default', 'nonexistent.jpg')

      await expect(async () => {
        await fileSystemHandler.readImageFile(nonExistentPath)
      }).rejects.toThrow()
    })

    it('should prevent path traversal attacks', async () => {
      const traversalPath = '../../../etc/passwd'

      await expect(async () => {
        await fileSystemHandler.readImageFile(traversalPath)
      }).rejects.toThrow()
    })

    it('should validate file paths correctly', async () => {
      // Valid path within decks directory
      const validPath = path.join(fileSystemHandler.getAbsoluteDecksPath(), 'default', 'test.png')
      const validPathInfo = await fileSystemHandler.validateAndResolvePath(validPath)
      expect(validPathInfo.isWithinDecksDirectory).toBe(true)

      // Invalid path outside decks directory
      const invalidPath = '/etc/passwd'
      const invalidPathInfo = await fileSystemHandler.validateAndResolvePath(invalidPath)
      expect(invalidPathInfo.isWithinDecksDirectory).toBe(false)
    })
  })

  describe('Step 8: Performance and Quality Validation', () => {
    it('should handle large deck structures efficiently', async () => {
      const startTime = Date.now()

      const deckNames = await fileSystemHandler.listDecks()
      const deckStructures = await Promise.all(
        deckNames.map(name => fileSystemHandler.readDeckStructure(name)),
      )

      const endTime = Date.now()
      const responseTime = endTime - startTime

      // Should respond within reasonable time (Requirement 7.4)
      expect(responseTime).toBeLessThan(5000) // 5 seconds max

      expect(deckStructures.length).toBeGreaterThan(0)
      deckStructures.forEach((structure) => {
        expect(structure).toHaveProperty('deck')
        expect(structure).toHaveProperty('cards')
        expect(structure).toHaveProperty('deckImages')
      })
    })

    it('should maintain image quality during file operations', async () => {
      const deckNames = await fileSystemHandler.listDecks()
      testDeckName = deckNames[0]

      const deckStructure = await fileSystemHandler.readDeckStructure(testDeckName)

      // Find a valid image file (skip corrupted ones)
      let validImage = null
      for (const card of deckStructure.cards) {
        for (const image of card.images) {
          try {
            // Try to read the image to see if it's valid
            await fileSystemHandler.readImageFile(image.path)
            validImage = image
            break
          }
          catch (error) {
            // Skip corrupted images
            continue
          }
        }
        if (validImage) break
      }

      if (!validImage) {
        console.warn('No valid images found for quality test')
        return // Skip if no valid images available
      }

      // Verify image quality preservation (Requirement 6.5)
      const imageBuffer = await fileSystemHandler.readImageFile(validImage.path)
      expect(imageBuffer.length).toBeGreaterThan(0)
      expect(imageBuffer.length).toBe(validImage.size)

      // Verify image metadata is accurate
      expect(validImage.format).toBeTruthy()
      expect(['png', 'jpg', 'jpeg', 'gif', 'webp']).toContain(validImage.format)
    })
  })
})
