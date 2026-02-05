import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// Set up environment before importing modules
beforeAll(() => {
  process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'
  process.env.NODE_ENV = 'development'
})

// Import after environment setup
const { POST: saveHandler } = await import('@/app/api/image-editor/save/route')
const { POST: saveAsHandler } = await import('@/app/api/image-editor/save-as/route')

describe('Image Format and Quality Optimization', () => {
  const testDecksPath = path.join(process.cwd(), 'specs', 'decks', 'test-deck')
  const testImagePath = path.join(testDecksPath, 'test-image.png')

  beforeEach(async () => {
    // Ensure test directory exists
    await fs.mkdir(testDecksPath, { recursive: true })
  })

  describe('Format and Quality Parameters', () => {
    it('should accept format and quality parameters in save endpoint', async () => {
      // Create a simple test image blob (1x1 PNG)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // IHDR data
        0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
        0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // IDAT data
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82, // IEND chunk
      ])

      const formData = new FormData()
      formData.append('image', new Blob([pngData], { type: 'image/png' }), 'test.png')
      formData.append('filePath', testImagePath)
      formData.append('overwrite', 'true')
      formData.append('format', 'png')
      formData.append('quality', '0.8')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      const response = await saveHandler(request, {} as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.file.format).toBe('png')
      expect(data.file.compressionRatio).toBeDefined()
      expect(data.file.originalSize).toBeDefined()
    })

    it('should accept format and quality parameters in save-as endpoint', async () => {
      // Create a simple test image blob
      const jpegData = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, // JPEG header
        0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
        0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, // Quantization table
        0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
        0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F,
        0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28,
        0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
        0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32,
        0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, // Start of frame
        0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, // Huffman table
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08,
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x00, // Start of scan
        0xFF, 0xD9, // End of image
      ])

      const formData = new FormData()
      formData.append('image', new Blob([jpegData], { type: 'image/jpeg' }), 'test.jpg')
      formData.append('originalPath', testImagePath)
      formData.append('newFilename', 'optimized-test-' + Date.now() + '.jpg')
      formData.append('format', 'jpeg')
      formData.append('quality', '0.9')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save-as', {
        method: 'POST',
        body: formData,
      })

      const response = await saveAsHandler(request, {} as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.file.format).toBe('jpeg')
      expect(data.file.quality).toBe('0.9')
      expect(data.file.compressionRatio).toBeDefined()
    })

    it('should handle missing format parameter gracefully', async () => {
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE,
        0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
        0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
      ])

      const formData = new FormData()
      formData.append('image', new Blob([pngData], { type: 'image/png' }), 'test.png')
      formData.append('filePath', path.join(testDecksPath, 'default-format.png'))
      formData.append('overwrite', 'true')
      // No format parameter - should default to 'png'

      const request = new NextRequest('http://localhost:3000/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      const response = await saveHandler(request, {} as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.file.format).toBe('png') // Should default to PNG
    })

    it('should handle missing quality parameter gracefully', async () => {
      const jpegData = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
        0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
        0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
        0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
        0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F,
        0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28,
        0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
        0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32,
        0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01,
        0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08,
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x00,
        0xFF, 0xD9,
      ])

      const formData = new FormData()
      formData.append('image', new Blob([jpegData], { type: 'image/jpeg' }), 'test.jpg')
      formData.append('filePath', path.join(testDecksPath, 'default-quality.jpg'))
      formData.append('overwrite', 'true')
      formData.append('format', 'jpeg')
      // No quality parameter - should default to 0.9

      const request = new NextRequest('http://localhost:3000/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      const response = await saveHandler(request, {} as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.file.format).toBe('jpeg')
      expect(data.file.quality).toBe('0.9') // Should return default quality for JPEG
    })
  })

  describe('File Size Optimization', () => {
    it('should report compression ratio when optimization occurs', async () => {
      // Create a larger test image to see compression effects
      const largerImageData = Buffer.alloc(1024, 0xFF) // 1KB of data

      const formData = new FormData()
      formData.append('image', new Blob([largerImageData], { type: 'image/png' }), 'large.png')
      formData.append('filePath', path.join(testDecksPath, 'large-optimized.png'))
      formData.append('overwrite', 'true')
      formData.append('format', 'png')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      const response = await saveHandler(request, {} as any)

      if (response.status !== 200) {
        const errorData = await response.json()
        console.error('Save handler error (compression ratio test):', response.status, errorData)
      }

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.file.originalSize).toBe(1024)
      expect(data.file.compressionRatio).toBeDefined()
      expect(typeof data.file.compressionRatio).toBe('number')
    })

    it('should maintain reasonable compression ratios', async () => {
      const testImageData = Buffer.alloc(2048, 0xAA) // 2KB of repeating data

      const formData = new FormData()
      formData.append('image', new Blob([testImageData], { type: 'image/jpeg' }), 'test.jpg')
      formData.append('filePath', path.join(testDecksPath, 'compression-test.jpg'))
      formData.append('overwrite', 'true')
      formData.append('format', 'jpeg')
      formData.append('quality', '0.7')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      const response = await saveHandler(request, {} as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.file.compressionRatio).toBeGreaterThan(0)
      expect(data.file.compressionRatio).toBeLessThanOrEqual(1)
    })
  })
})
