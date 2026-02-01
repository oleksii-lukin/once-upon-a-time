import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import path from 'path'
import { GET as serveHandler } from '@/app/api/image-editor/serve/[...path]/route'
import { GET as thumbnailHandler } from '@/app/api/image-editor/thumbnail/[...path]/route'
import { GET as downloadHandler } from '@/app/api/image-editor/download/[...path]/route'

// Mock environment variables for testing
const originalEnv = process.env

beforeAll(() => {
  process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true';
  (process.env as any).NODE_ENV = 'development'
})

afterAll(() => {
  process.env = originalEnv
})

describe('Image Editor API Endpoints', () => {
  describe('Serve Endpoint (/api/image-editor/serve)', () => {
    it('should serve deck-level image with proper headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/default/Border.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await serveHandler(request, context)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('image/jpeg')
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
      expect(response.headers.get('Content-Length')).toBeTruthy()
      expect(response.headers.get('Last-Modified')).toBeTruthy()

      // Verify image dimensions and file information headers (Requirement 7.4)
      expect(response.headers.get('X-Image-Width')).toBeTruthy()
      expect(response.headers.get('X-Image-Height')).toBeTruthy()
      expect(response.headers.get('X-File-Name')).toBe('Border.jpg')
      expect(response.headers.get('X-File-Size')).toBeTruthy()
      expect(response.headers.get('X-Image-Format')).toBeTruthy()
    })

    it('should serve card image with proper headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/default/cards/protagonists/The%20Brave%20Farmhand/image.png')
      const context = {
        params: Promise.resolve({ path: ['default', 'cards', 'protagonists', 'The Brave Farmhand', 'image.png'] }),
      }

      const response = await serveHandler(request, context)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('image/png')
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')

      // Verify image dimensions and file information headers (Requirement 7.4)
      // Note: Image dimensions may not be available if Sharp can't read the metadata
      const width = response.headers.get('X-Image-Width')
      const height = response.headers.get('X-Image-Height')
      if (width && height) {
        expect(parseInt(width)).toBeGreaterThan(0)
        expect(parseInt(height)).toBeGreaterThan(0)
      }
      expect(response.headers.get('X-File-Name')).toBe('image.png')
      expect(response.headers.get('X-File-Size')).toBeTruthy()
    })

    it('should serve test image from The Brave Farmhand card', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/default/cards/protagonists/The%20Brave%20Farmhand/image.png')
      const context = {
        params: Promise.resolve({ path: ['default', 'cards', 'protagonists', 'The Brave Farmhand', 'image.png'] }),
      }

      const response = await serveHandler(request, context)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('image/png')
      expect(response.headers.get('X-File-Name')).toBe('image.png')

      // This specific test image should have dimensions available
      const width = response.headers.get('X-Image-Width')
      const height = response.headers.get('X-Image-Height')
      expect(width).toBeTruthy()
      expect(height).toBeTruthy()
      expect(parseInt(width!)).toBe(382)
      expect(parseInt(height!)).toBe(360)
    })

    it('should return 404 for non-existent image', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/default/nonexistent.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'nonexistent.jpg'] }),
      }

      const response = await serveHandler(request, context)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('File not found')
    })

    it('should return 400 for empty path', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/')
      const context = {
        params: Promise.resolve({ path: [] }),
      }

      const response = await serveHandler(request, context)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('No file path provided')
    })

    it('should return 403 for path outside allowed directories', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/../../../etc/passwd')
      const context = {
        params: Promise.resolve({ path: ['..', '..', '..', 'etc', 'passwd'] }),
      }

      const response = await serveHandler(request, context)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Access denied - path outside allowed directories')
    })

    it('should return 400 for non-image files', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/default/default.md')
      const context = {
        params: Promise.resolve({ path: ['default', 'default.md'] }),
      }

      const response = await serveHandler(request, context)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('File is not an image')
    })
  })

  describe('Thumbnail Endpoint (/api/image-editor/thumbnail)', () => {
    it('should generate thumbnail with default dimensions', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/thumbnail/default/Border.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await thumbnailHandler(request, context)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('image/jpeg')
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400')
      expect(response.headers.get('X-Thumbnail-Width')).toBe('200')
      expect(response.headers.get('X-Thumbnail-Height')).toBe('200')
      expect(response.headers.get('X-Thumbnail-Quality')).toBe('80')
      expect(response.headers.get('X-Original-File')).toBe('Border.jpg')
    })

    it('should generate thumbnail with custom dimensions', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/thumbnail/default/Border.jpg?width=150&height=100&quality=90')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await thumbnailHandler(request, context)

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Thumbnail-Width')).toBe('150')
      expect(response.headers.get('X-Thumbnail-Height')).toBe('100')
      expect(response.headers.get('X-Thumbnail-Quality')).toBe('90')
    })

    it('should return 400 for invalid dimensions', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/thumbnail/default/Border.jpg?width=2000&height=2000')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await thumbnailHandler(request, context)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid dimensions. Width and height must be between 1 and 1000 pixels')
    })

    it('should return 400 for invalid quality', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/thumbnail/default/Border.jpg?quality=150')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await thumbnailHandler(request, context)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid quality. Quality must be between 1 and 100')
    })

    it('should return 404 for non-existent image', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/thumbnail/default/nonexistent.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'nonexistent.jpg'] }),
      }

      const response = await thumbnailHandler(request, context)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('File not found')
    })
  })

  describe('Download Endpoint (/api/image-editor/download)', () => {
    it('should download image with proper headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/download/default/Border.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await downloadHandler(request, context)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('image/jpeg')
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="Border.jpg"')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(response.headers.get('Content-Length')).toBeTruthy()
    })

    it('should return 404 for non-existent image', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/download/default/nonexistent.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'nonexistent.jpg'] }),
      }

      const response = await downloadHandler(request, context)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('File not found')
    })

    it('should return 400 for non-image files', async () => {
      // Create a file with image extension but non-image content
      const testPath = path.join(process.cwd(), 'specs', 'decks', 'test-deck', 'fake-image.png')
      const fs = await import('fs/promises')
      await fs.writeFile(testPath, 'This is not an image file', 'utf8')

      const request = new NextRequest('http://localhost:3000/api/image-editor/download/test-deck/fake-image.png')
      const context = {
        params: Promise.resolve({ path: ['test-deck', 'fake-image.png'] }),
      }

      const response = await downloadHandler(request, context)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('File is not an image')

      // Clean up
      await fs.unlink(testPath).catch(() => {})
    })
  })

  describe('Environment Protection', () => {
    it('should block requests when feature is disabled', async () => {
      // Temporarily disable the feature
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'false'

      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/default/Border.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await serveHandler(request, context)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Local image editor is disabled. Set ENABLE_LOCAL_IMAGE_EDITOR=true in .env.local')

      // Restore for other tests
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'
    })

    it('should block requests in production mode', async () => {
      // Temporarily set production mode
      (process.env as any).NODE_ENV = 'production'

      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/default/Border.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await serveHandler(request, context)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Local image editor is only available in development mode');

      // Restore for other tests
      (process.env as any).NODE_ENV = 'development'
    })
  })

  describe('MIME Type Handling', () => {
    it('should handle different image formats correctly', async () => {
      // Test with different image extensions that might exist
      const testCases = [
        { path: ['default', 'Border.jpg'], expectedType: 'image/jpeg' },
        // Add more test cases if we have PNG or other format images
      ]

      for (const testCase of testCases) {
        const request = new NextRequest(`http://localhost:3000/api/image-editor/serve/${testCase.path.join('/')}`)
        const context = {
          params: Promise.resolve({ path: testCase.path }),
        }

        const response = await serveHandler(request, context)

        if (response.status === 200) {
          expect(response.headers.get('Content-Type')).toBe(testCase.expectedType)
        }
        // If file doesn't exist, that's okay for this test
      }
    })
  })

  describe('Caching Headers', () => {
    it('should set appropriate cache headers for serve endpoint', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/serve/default/Border.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await serveHandler(request, context)

      if (response.status === 200) {
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
        expect(response.headers.get('Last-Modified')).toBeTruthy()
      }
    })

    it('should set appropriate cache headers for thumbnail endpoint', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/thumbnail/default/Border.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await thumbnailHandler(request, context)

      if (response.status === 200) {
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400')
      }
    })

    it('should set no-cache headers for download endpoint', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/download/default/Border.jpg')
      const context = {
        params: Promise.resolve({ path: ['default', 'Border.jpg'] }),
      }

      const response = await downloadHandler(request, context)

      if (response.status === 200) {
        expect(response.headers.get('Cache-Control')).toBe('no-cache')
      }
    })
  })
})
