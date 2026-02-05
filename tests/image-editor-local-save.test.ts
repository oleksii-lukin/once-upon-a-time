import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as saveHandler } from '@/app/api/image-editor/save/route'
import { POST as saveAsHandler } from '@/app/api/image-editor/save-as/route'
import fs from 'fs/promises'
import path from 'path'

// Mock environment variables for testing
const originalEnv = process.env

beforeAll(() => {
  process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true';
  (process.env as any).NODE_ENV = 'development'
})

afterAll(() => {
  process.env = originalEnv
})

describe('Image Editor Local Save Functionality', () => {
  const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==', 'base64')

  describe('Save Endpoint (/api/image-editor/save)', () => {
    it('should save edited image to local file system', async () => {
      const formData = new FormData()
      const imageFile = new File([testImageBuffer], 'test.png', { type: 'image/png' })
      formData.append('image', imageFile)
      formData.append('filePath', 'specs/decks/default/test_save.png')
      formData.append('overwrite', 'true')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      const response = await saveHandler(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Image saved successfully')
      expect(data.file.path).toBe('specs/decks/default/test_save.png')
      expect(data.file.size).toBe(testImageBuffer.length)

      // Cleanup
      try {
        await fs.unlink(path.join(process.cwd(), 'specs/decks/default/test_save.png'))
      }
      catch (error) {
        // File might not exist, that's okay
      }
    })

    it('should return 409 when file exists and overwrite is false', async () => {
      // First, create a test file
      const testFilePath = path.join(process.cwd(), 'specs/decks/default/test_existing.png')
      await fs.writeFile(testFilePath, testImageBuffer)

      const formData = new FormData()
      const imageFile = new File([testImageBuffer], 'test.png', { type: 'image/png' })
      formData.append('image', imageFile)
      formData.append('filePath', 'specs/decks/default/test_existing.png')
      formData.append('overwrite', 'false')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      const response = await saveHandler(request)

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toBe('File already exists. Set overwrite=true to replace it.')

      // Cleanup
      await fs.unlink(testFilePath)
    })

    it('should return 400 when no image file is provided', async () => {
      const formData = new FormData()
      formData.append('filePath', 'specs/decks/default/test.png')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      const response = await saveHandler(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('No image file provided')
    })

    it('should return 400 when no file path is provided', async () => {
      const formData = new FormData()
      const imageFile = new File([testImageBuffer], 'test.png', { type: 'image/png' })
      formData.append('image', imageFile)

      const request = new NextRequest('http://localhost:3000/api/image-editor/save', {
        method: 'POST',
        body: formData,
      })

      const response = await saveHandler(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('No file path provided')
    })
  })

  describe('Save As Endpoint (/api/image-editor/save-as)', () => {
    it('should save image as new file with new filename', async () => {
      const formData = new FormData()
      const imageFile = new File([testImageBuffer], 'test.png', { type: 'image/png' })
      formData.append('image', imageFile)
      formData.append('originalPath', 'specs/decks/default/original.png')
      formData.append('newFilename', 'new_copy.png')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save-as', {
        method: 'POST',
        body: formData,
      })

      const response = await saveAsHandler(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Image saved as new file successfully')
      expect(data.file.filename).toBe('new_copy.png')
      expect(data.file.size).toBe(testImageBuffer.length)

      // Cleanup
      try {
        await fs.unlink(path.join(process.cwd(), 'specs/decks/default/new_copy.png'))
      }
      catch (error) {
        // File might not exist, that's okay
      }
    })

    it('should save image in specified directory', async () => {
      const formData = new FormData()
      const imageFile = new File([testImageBuffer], 'test.png', { type: 'image/png' })
      formData.append('image', imageFile)
      formData.append('directory', path.join(process.cwd(), 'specs/decks/default'))
      formData.append('newFilename', 'directory_test.png')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save-as', {
        method: 'POST',
        body: formData,
      })

      const response = await saveAsHandler(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.file.filename).toBe('directory_test.png')

      // Cleanup
      try {
        await fs.unlink(path.join(process.cwd(), 'specs/decks/default/directory_test.png'))
      }
      catch (error) {
        // File might not exist, that's okay
      }
    })

    it('should return 409 when new file already exists', async () => {
      // First, create a test file
      const testFilePath = path.join(process.cwd(), 'specs/decks/default/existing_copy.png')
      await fs.writeFile(testFilePath, testImageBuffer)

      const formData = new FormData()
      const imageFile = new File([testImageBuffer], 'test.png', { type: 'image/png' })
      formData.append('image', imageFile)
      formData.append('originalPath', 'specs/decks/default/original.png')
      formData.append('newFilename', 'existing_copy.png')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save-as', {
        method: 'POST',
        body: formData,
      })

      const response = await saveAsHandler(request)

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toBe('File already exists: existing_copy.png')

      // Cleanup
      await fs.unlink(testFilePath)
    })

    it('should return 400 when no image file is provided', async () => {
      const formData = new FormData()
      formData.append('newFilename', 'test.png')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save-as', {
        method: 'POST',
        body: formData,
      })

      const response = await saveAsHandler(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('No image file provided')
    })

    it('should return 400 when no filename is provided', async () => {
      const formData = new FormData()
      const imageFile = new File([testImageBuffer], 'test.png', { type: 'image/png' })
      formData.append('image', imageFile)
      formData.append('originalPath', 'specs/decks/default/original.png')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save-as', {
        method: 'POST',
        body: formData,
      })

      const response = await saveAsHandler(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('No new filename provided')
    })

    it('should return 400 when neither directory nor originalPath is provided', async () => {
      const formData = new FormData()
      const imageFile = new File([testImageBuffer], 'test.png', { type: 'image/png' })
      formData.append('image', imageFile)
      formData.append('newFilename', 'test.png')

      const request = new NextRequest('http://localhost:3000/api/image-editor/save-as', {
        method: 'POST',
        body: formData,
      })

      const response = await saveAsHandler(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Either directory or originalPath must be provided')
    })
  })

  describe('Local vs Remote Mode Detection', () => {
    it('should detect local file mode correctly', () => {
      // Test the logic that would be used in the ImageEditor component
      const isLocalFile = true
      const enableLocalFeatures = true
      const localPath = 'specs/decks/default/test.png'
      const onLocalSave = async (blob: Blob, path: string) => {
        // Mock local save function
        expect(blob).toBeDefined()
        expect(path).toBe(localPath)
      }

      // This simulates the condition check in the ImageEditor component
      const shouldUseLocalSave = !!(isLocalFile && enableLocalFeatures && typeof onLocalSave === 'function' && localPath)
      expect(shouldUseLocalSave).toBe(true)
    })

    it('should fall back to remote mode when local features are disabled', () => {
      const isLocalFile = true
      const enableLocalFeatures = false // Disabled
      const localPath = 'specs/decks/default/test.png'
      const onLocalSave = async (blob: Blob, path: string) => {}
      const onSave = async (file: File) => {
        // Mock remote save function
        expect(file).toBeDefined()
      }

      const shouldUseLocalSave = !!(isLocalFile && enableLocalFeatures && typeof onLocalSave === 'function' && localPath)
      const shouldUseRemoteSave = !shouldUseLocalSave && !!onSave

      expect(shouldUseLocalSave).toBe(false)
      expect(shouldUseRemoteSave).toBe(true)
    })
  })
})
